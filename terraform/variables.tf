variable "project_id" {
  description = "GCP project ID — must be globally unique (e.g. football-prediction-app-abc123)"
  type        = string
}

variable "billing_account_id" {
  description = "GCP billing account ID — run: gcloud billing accounts list"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west2"
}

variable "db_password" {
  description = "Password for the app_user PostgreSQL user"
  type        = string
  sensitive   = true
}

variable "app_url" {
  description = "Cloud Run service URL (known after first deploy); leave empty to skip the Cloud Scheduler job"
  type        = string
  default     = ""
}

variable "cron_secret" {
  description = "Shared secret for /api/cron/* endpoints — must match the CRON_SECRET GitHub secret"
  type        = string
  sensitive   = true
  default     = ""
}
