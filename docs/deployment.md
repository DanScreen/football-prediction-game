# Deployment & Infrastructure

Everything about how Scorers runs in production. **Update this on any infra, secret,
or pipeline change.**

## Overview

Every push to `main` triggers `.github/workflows/deploy.yml`, which runs DB migrations
then builds and deploys to Cloud Run. Infra is provisioned with Terraform in
`terraform/`.

## Infrastructure (Terraform)

| Resource | Details |
|----------|---------|
| Cloud Run | `football-prediction-app`, europe-west2 |
| Cloud SQL | PostgreSQL 16, **ENTERPRISE** edition, `db-f1-micro` |
| Artifact Registry | Docker image repository |
| Cloud Scheduler | `football-prediction-resolve` — `POST /api/cron/resolve` every **10 min** |
| Service accounts | Separate deploy SA and Cloud Run SA (minimal IAM) |

> Cloud SQL must be `edition = "ENTERPRISE"` — the default ENTERPRISE_PLUS doesn't
> support `db-f1-micro`.

Provision from scratch: `cd terraform && terraform init && terraform apply`.

### The scheduler / `app_url` gotcha

The scheduler resource has `count = var.app_url == "" ? 0 : 1`, so it **only exists
once `app_url` is set** in `terraform.tfvars`. For a long time `app_url` was unset, so
the cron job never existed and the automated sweep never ran — this only mattered once
fixtures/results became automatic. It's now set to the **direct Cloud Run URL**
(`https://football-prediction-app-lze2bvdarq-nw.a.run.app`), not the public domain:
a machine-to-machine cron call should bypass the Cloudflare proxy, and auth is via
`CRON_SECRET` so the Host header is irrelevant. `terraform.tfvars` is gitignored (it
holds `cron_secret` + `db_password`). `cron_secret` must equal the `CRON_SECRET`
GitHub secret.

Manual cron test run:
```bash
gcloud scheduler jobs run football-prediction-resolve --location europe-west2
# or hit it directly:
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://football-prediction-app-lze2bvdarq-nw.a.run.app/api/cron/resolve
```

## GitHub secrets

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | JSON key for the deploy service account |
| `DATABASE_URL` | Cloud SQL Unix-socket connection string (runtime) |
| `DB_MIGRATION_URL` | TCP connection string via Cloud SQL Auth Proxy (CI migrations) |
| `CLOUD_SQL_INSTANCE` | Cloud SQL instance connection name |
| `CLOUD_RUN_SA` | Cloud Run service account email |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | NextAuth secrets (both required) |
| `FOOTBALL_DATA_API_KEY` | football-data.org API key |
| `CRON_SECRET` | Shared secret for `/api/cron/*` (also the `cron_secret` Terraform var) |
| `RESEND_API_KEY` | Resend key. Optional for reminders (skipped without it); **required** for password-reset emails |
| `EMAIL_FROM` | Sender, e.g. `Scorers <predictions@scorersonline.uk>` — same requirement as `RESEND_API_KEY` |
| `SITE_ADMIN_EMAILS` | Comma-separated emails granted the host role on login |

> **`SITE_ADMIN_EMAILS` gotcha:** its value can contain commas, which collide with
> gcloud's `--set-env-vars` delimiter. The deploy workflow sets it with a custom
> `^\|^` delimiter so commas survive:
> `--set-env-vars "^\|^SITE_ADMIN_EMAILS=..."`.

## Custom domain

Served at **https://scorersonline.uk** via a **Cloudflare Worker** (`cloudflare/worker.js`)
that proxies to the Cloud Run URL — europe-west2 has no native Cloud Run domain mapping.
The Worker is deployed through the Cloudflare dashboard with `scorersonline.uk` as its
custom domain; the copy in `cloudflare/` is the source of truth. `AUTH_URL` is pinned to
the domain via `APP_URL` in `deploy.yml`, and `next.config.ts` allowlists the domain for
Server Actions (Cloud Run still sees a `*.run.app` Host header behind the proxy). The
domain is verified in Resend for outbound email.

## Deploy pipeline

1. Cloud SQL Auth Proxy tunnels to Cloud SQL so migrations run in CI
   (`npx prisma migrate deploy` via `DB_MIGRATION_URL`).
2. Multi-stage Docker build (`deps → builder → runner`) → standalone image.
3. Image pushed to Artifact Registry and deployed to Cloud Run, with env vars set from
   the secrets above.
4. `AUTH_URL` pinned to the custom domain.

> Pushing to `main` runs migrations against **production**. For a destructive or
> hand-edited migration, verify it against a throwaway Postgres first
> ([development.md](development.md#migrations)) and flag it before pushing.

## Known rough edge

The workflow logs a **Node 20 deprecation warning** (actions forced onto Node 24).
Harmless; bump `actions/checkout` and `actions/setup-node` when convenient.
