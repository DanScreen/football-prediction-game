# ── Cloud Scheduler — automated result resolution ─────────────────────────────
# Calls /api/cron/resolve every 30 minutes: moves fixtures past kickoff+2.5h to
# AWAITING_RESULT and pre-fetches proposed scores from football-data.org.
# app_url is only known after the first Cloud Run deploy, so the job is skipped
# until it's set in terraform.tfvars.

resource "google_cloud_scheduler_job" "resolve" {
  count = var.app_url == "" ? 0 : 1

  project   = google_project.main.project_id
  region    = var.region
  name      = "football-prediction-resolve"
  schedule  = "*/30 * * * *"
  time_zone = "Europe/London"

  http_target {
    uri         = "${var.app_url}/api/cron/resolve"
    http_method = "POST"
    headers = {
      Authorization = "Bearer ${var.cron_secret}"
    }
  }

  retry_config {
    retry_count = 1
  }

  depends_on = [google_project_service.apis]
}
