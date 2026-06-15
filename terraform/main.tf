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
}

# ── Cloud SQL ─────────────────────────────────────────────────────────────────

resource "google_sql_database_instance" "main" {
  project          = google_project.main.project_id
  name             = "football-prediction-app-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier      = "db-f1-micro"
    disk_size = 10
    disk_type = "PD_HDD"

    backup_configuration {
      enabled = false
    }

    ip_configuration {
      ipv4_enabled = false
    }
  }

  deletion_protection = false
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
