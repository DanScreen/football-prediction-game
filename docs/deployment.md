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
| Cloud SQL | PostgreSQL 16, **ENTERPRISE** edition, `db-f1-micro`, `PD_HDD`, daily backups + 7-day PITR |
| Artifact Registry | Docker image repository |
| Cloud Scheduler | `football-prediction-resolve` — `POST /api/cron/resolve` every **10 min** |
| Service accounts | Separate deploy SA and Cloud Run SA (minimal IAM) |

> Cloud SQL must be `edition = "ENTERPRISE"` — the default ENTERPRISE_PLUS doesn't
> support `db-f1-micro`.

### Backups and destructive-change traps

Prod ran with **`backup_configuration { enabled = false }` and no deletion protection**
until Aug 2026 — a live database with no recovery path. It now takes a daily backup at
03:00, retains 7 backups and 7 days of transaction logs (point-in-time recovery), and
sets `deletion_protection` (blocks `terraform destroy`) plus
`deletion_protection_enabled` (blocks deletion via API/console). Cost is ~£0.50/month.

> **Never change `disk_type` on an existing instance.** Storage type is fixed at creation
> — the [instance settings docs](https://cloud.google.com/sql/docs/postgres/instance-settings)
> mark it non-modifiable and `gcloud sql instances patch` has no `--storage-type` flag.
> Editing it in Terraform forces **destroy-and-recreate**, i.e. total data loss. The same
> applies to `tier` downgrades below what the edition supports.

Artifact Registry keeps the 5 most recent image versions plus anything under 30 days
(`cleanup_policies` in `terraform/main.tf`); older images are collected automatically.

> **Terraform state is local and gitignored** (`terraform/.gitignore` excludes `*.tfstate`
> and `*.tfvars`), and no workflow runs Terraform — infra changes are applied by hand with
> `terraform apply` from `terraform/`. Only `deploy.yml` runs automatically, and it never
> touches Terraform.
>
> This means the only copy of the state, and of `terraform.tfvars` (which holds
> `cron_secret` and `db_password`), lives on one developer machine. Losing it means
> re-importing every resource by hand. Moving state to a GCS backend — as Tiki Acca
> already does — is the fix; tracked in [roadmap.md](roadmap.md).

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

1. **Tests gate the deploy** — `npx prisma generate` then `npx vitest run`. A red suite
   fails the job before anything touches Cloud SQL or Cloud Run. (The generate step is
   required: several tests import types from `app/generated/prisma/client`.)
2. Cloud SQL Auth Proxy tunnels to Cloud SQL so migrations run in CI
   (`npx prisma migrate deploy` via `DB_MIGRATION_URL`).
3. Multi-stage Docker build (`deps → builder → runner`) → standalone image.
4. Image pushed to Artifact Registry and deployed to Cloud Run, with env vars set from
   the secrets above.
5. `AUTH_URL` pinned to the custom domain.

> Pushing to `main` runs migrations against **production**. For a destructive or
> hand-edited migration, verify it against a throwaway Postgres first
> ([development.md](development.md#migrations)) and flag it before pushing.

Runner Node is **22** (matching the `Dockerfile`); the actions are pinned to their
current majors (`checkout@v7`, `setup-node@v7`, `google-github-actions/auth@v3`,
`setup-gcloud@v3`), which run on Node 24.
