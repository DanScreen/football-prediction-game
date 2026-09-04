# Alerting. Added alongside Tiki Acca's, after an env-wipe incident there left a
# 5-minutely cron failing for ~28 hours unnoticed. This project had the same
# blind spot: no notification channels and no alert policies at all, with
# /api/cron/resolve running every 10 minutes and nothing watching it.
#
# Log-match conditions rather than metric conditions: log matches return no data
# points, so they avoid the per-point alerting charge, and Cloud Scheduler
# publishes no metrics to Cloud Monitoring here (only logs).

resource "google_monitoring_notification_channel" "email" {
  project      = google_project.main.project_id
  display_name = "Scorers alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis]
}

# football-prediction-resolve runs every 10 minutes and sweeps fixtures/results.
# If it fails silently, scores quietly stop updating for everyone.
resource "google_monitoring_alert_policy" "scheduler_job_failed" {
  project      = google_project.main.project_id
  display_name = "Cloud Scheduler job failed"
  combiner     = "OR"
  severity     = "ERROR"

  conditions {
    display_name = "A scheduler job attempt returned an error"

    condition_matched_log {
      filter = "resource.type=\"cloud_scheduler_job\" AND severity>=ERROR"
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  # Required for log-match conditions, and it stops a 10-minutely cron from
  # filling the inbox during an outage.
  alert_strategy {
    notification_rate_limit {
      period = "1800s" # at most one email per 30 min
    }
  }

  documentation {
    subject = "Scorers: the results sweep is failing"
    content = <<-EOT
    The football-prediction-resolve job returned a non-2xx response, so fixtures
    and results are no longer syncing.

    Check why:
      gcloud logging read 'resource.type="cloud_scheduler_job" AND severity>=ERROR' \
        --project=football-prediction-app-499513 --limit=10 --freshness=1h

    Likely causes: FOOTBALL_DATA_API_KEY missing or out of quota, CRON_SECRET
    mismatch between the Scheduler job and the Cloud Run service, or the service
    failing to start. See docs/deployment.md.
    EOT
  }
}

resource "google_monitoring_alert_policy" "cloud_run_server_errors" {
  project      = google_project.main.project_id
  display_name = "Cloud Run 5xx responses"
  combiner     = "OR"
  severity     = "WARNING"

  conditions {
    display_name = "football-prediction-app returned a 5xx"

    condition_matched_log {
      filter = <<-EOT
      resource.type="cloud_run_revision"
      AND resource.labels.service_name="football-prediction-app"
      AND httpRequest.status>=500
      EOT
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    notification_rate_limit {
      period = "1800s"
    }
  }

  documentation {
    subject = "Scorers: the web service is returning 5xx"
    content = "Check Cloud Run logs for football-prediction-app. If this fires alongside the scheduler alert, treat the scheduler alert as the root cause."
  }
}
