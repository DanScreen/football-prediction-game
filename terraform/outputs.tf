# Run `terraform output -raw <name>` to retrieve sensitive values.

output "cloud_sql_instance" {
  description = "GitHub Secret: CLOUD_SQL_INSTANCE"
  value       = google_sql_database_instance.main.connection_name
}

output "cloud_run_sa" {
  description = "GitHub Secret: CLOUD_RUN_SA"
  value       = google_service_account.cloud_run.email
}

output "gcp_sa_key" {
  description = "GitHub Secret: GCP_SA_KEY (JSON key for GitHub Actions)"
  value       = base64decode(google_service_account_key.deploy.private_key)
  sensitive   = true
}

output "database_url" {
  description = "GitHub Secret: DATABASE_URL (Cloud Run — Unix socket)"
  value       = "postgresql://footy_user:${var.db_password}@/footy_predictor?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
  sensitive   = true
}

output "db_migration_url" {
  description = "GitHub Secret: DB_MIGRATION_URL (GitHub Actions — via Cloud SQL Proxy)"
  value       = "postgresql://footy_user:${var.db_password}@localhost:5432/footy_predictor"
  sensitive   = true
}
