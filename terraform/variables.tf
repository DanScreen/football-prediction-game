variable "project_id" {
  description = "GCP project ID — must be globally unique (e.g. footy-predictor-prod-abc123)"
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
  description = "Password for the footy_user PostgreSQL user"
  type        = string
  sensitive   = true
}
