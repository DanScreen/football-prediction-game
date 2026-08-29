terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  region = var.region
}

# ── Project ───────────────────────────────────────────────────────────────────

resource "google_project" "main" {
  name            = "Football Prediction App"
  project_id      = var.project_id
  billing_account = var.billing_account_id
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudscheduler.googleapis.com",
  ])
  project            = google_project.main.project_id
  service            = each.value
  disable_on_destroy = false
}

# ── Artifact Registry ─────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "docker" {
  project       = google_project.main.project_id
  location      = var.region
  repository_id = "football-prediction-app"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]

  # Every push to main publishes a new image and nothing removed the old ones.
  # KEEP wins over DELETE, so the 5 most recent versions always survive
  # regardless of age — the deployed image is never collected.
  cleanup_policies {
    id     = "keep-recent-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-stale"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  cleanup_policy_dry_run = false
}

# ── Cloud SQL ─────────────────────────────────────────────────────────────────

resource "google_sql_database_instance" "main" {
  project          = google_project.main.project_id
  name             = "football-prediction-app-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier      = "db-f1-micro"
    edition   = "ENTERPRISE"
    disk_size = 10
    disk_type = "PD_HDD" # Fixed at creation — changing this recreates the instance.

    deletion_protection_enabled = true

    # This instance ran with NO backups at all. Daily backup + 7 days of
    # transaction logs gives point-in-time recovery, matching Tiki Acca's prod
    # posture. Costs roughly £0.50/month on a 10 GB instance.
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled = true
    }
  }

  # Guard the live database at both layers: `deletion_protection` blocks
  # `terraform destroy`, `deletion_protection_enabled` blocks deletion via the
  # API/console. Storage type is deliberately absent from any change here — it
  # is fixed at creation, so editing `disk_type` would force destroy-and-recreate.
  deletion_protection = true
  depends_on          = [google_project_service.apis]
}

resource "google_sql_database" "main" {
  project  = google_project.main.project_id
  name     = "football_prediction_app"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  project  = google_project.main.project_id
  name     = "app_user"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# ── Service Accounts & IAM ────────────────────────────────────────────────────

# Cloud Run SA — minimal, only needs to connect to Cloud SQL at runtime
resource "google_service_account" "cloud_run" {
  project      = google_project.main.project_id
  account_id   = "football-prediction-run"
  display_name = "Football Prediction App Cloud Run SA"
}

resource "google_project_iam_member" "cloud_run_sql" {
  project = google_project.main.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Deploy SA — used by GitHub Actions to push images, run migrations, deploy
resource "google_service_account" "deploy" {
  project      = google_project.main.project_id
  account_id   = "football-prediction-deploy"
  display_name = "Football Prediction App Deploy SA"
}

resource "google_project_iam_member" "deploy_ar" {
  project = google_project.main.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "deploy_run" {
  project = google_project.main.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "deploy_sql" {
  project = google_project.main.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Allow deploy SA to assign the Cloud Run SA when deploying the service
resource "google_service_account_iam_member" "deploy_act_as_run" {
  service_account_id = google_service_account.cloud_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# JSON key for GitHub Actions — treat the output as a secret
resource "google_service_account_key" "deploy" {
  service_account_id = google_service_account.deploy.name
}
