# Football Prediction App

A score-prediction game for football fans. Users join leagues, predict scorelines for upcoming fixtures, and earn points based on accuracy. Site **hosts** own the competitions — fixtures and results are imported and confirmed once, centrally, and every league subscribed to a competition gets them automatically. League commissioners only manage their league's settings.

## Tech Stack

| Layer          | Choice                                                    |
| -------------- | --------------------------------------------------------- |
| Framework      | Next.js 16 (App Router) + TypeScript                      |
| Styling        | Tailwind CSS v4                                           |
| Database       | PostgreSQL via Prisma 7 (Cloud SQL in production)         |
| Auth           | NextAuth.js v5 beta — JWT sessions, credentials provider  |
| Fixtures API   | football-data.org v4 (free tier, covers PL + WC)          |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

| Variable                  | Where to get it                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `FOOTBALL_DATA_API_KEY`   | [football-data.org/client/register](https://www.football-data.org/client/register) (free) |
| `AUTH_SECRET`             | `openssl rand -base64 32`                                                              |
| `DATABASE_URL`            | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/football_prediction_app`) |
| `SITE_ADMIN_EMAILS`       | Comma-separated list of emails granted the site-host role (synced on login). Optional locally. |

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma db seed
```

The seed creates the platform competitions (Premier League, FIFA World Cup 2026), five test accounts (password: `password123`), and one league with canonical fixtures:

| Email                           | Role                    |
| ------------------------------- | ----------------------- |
| `host@football.test`            | Site host (isSiteAdmin) |
| `commissioner@football.test`    | League commissioner     |
| `alice@football.test`           | Member                  |
| `bob@football.test`             | Member                  |
| `robo@football.test`            | Member (bot)            |

League invite code: **GOAAALLL**. The host account can reach the **Host** area (`/host`) to manage competitions, fixtures, imports, and result confirmation.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### Leagues

Users sign up without a league, then either **create** one or **join** one with an invite code. A user can belong to multiple leagues; the active league is stored in a cookie and can be switched from the My Leagues page.

### Competitions

Competitions are **platform-owned** — hosts create them in **Host → Competitions**, each with an optional football-data.org code (`PL`, `WC`, …; leave blank for a manual-only competition). A `Competition` owns its canonical fixtures and results; leagues subscribe to a competition and share those fixtures. When creating a league, the commissioner just picks one of the active competitions — no fixtures to import, nothing to confirm.

### Fixture Import

Fixtures are added **automatically**: the cron sweep tops up the next couple of rounds for every active competition that has a code and at least one subscribed league (`lib/autoImport.ts`), deduplicated by the canonical `(competitionId, homeTeam, awayTeam, kickoffTime)` key. Hosts can also import on demand from **Host → Import** (select 1–3 rounds ahead) as a manual override.

### Making Predictions

Users predict the exact home and away score for each fixture. Predictions lock at kickoff and are hidden from other users until the deadline passes.

Because fixtures are canonical and shared across every league on a competition, there is exactly **one prediction per user per fixture** — it counts in all the leagues that user plays in that competition. No cross-league copying is needed.

### Scoring

| Outcome                                   | Points |
| ----------------------------------------- | ------ |
| Exact score                               | 3      |
| Correct result + same goal difference     | 1.5    |
| Correct result only                       | 1      |
| Wrong result                              | 0      |

An optional **Grand Slam** bonus awards extra points (configurable per league in **Admin → Settings**) if a player gets every fixture in a round correct. Bonuses are stored separately from base prediction points (`BonusAward` table) and shown with a 🏆 badge on the leaderboard. Because leagues share fixtures but keep their own Grand Slam settings and members, confirming a result scores each prediction once, then fans the bonus out per subscribing league.

### Result Resolution

Results flow through a confirm-before-save pipeline, with **provisional** scores shown everywhere in the meantime:

1. **Automated sweep** — a Cloud Scheduler job calls `POST /api/cron/resolve` every 10 minutes. It moves fixtures ≥1h45m past kickoff to `AWAITING_RESULT` and pre-fetches the final score from football-data.org (one API call per competition, shared across every subscribed league).
2. **Provisional everywhere** — once a proposed score exists, the dashboard, My Predictions, leaderboard, and API show the projected scoreline and points badged amber (e.g. `+3 prov.`) until a host confirms. Standings still rank by **confirmed** points only; provisional points are never stored.
3. **Host confirms** — **Host → Results** is a platform-wide queue of pre-fetched scores ready to Accept, Edit, or Retry, plus an **Accept All** button. Nothing is scored until a host confirms — the human check keeps bad data (postponements, ambiguous team names) off the leaderboard.
4. **Fallbacks** — any league member can hit **Request result** on a kicked-off fixture from the dashboard if the sweep hasn't found a score yet; the host's "Check for Updates" button runs the same sweep on demand, manual score entry always works, and per-fixture API lookup remains available.

### Deadline Reminders

The same cron sweep emails league members who haven't predicted a fixture kicking off within the next 3 hours — one email per user listing their open fixtures, sent via [Resend](https://resend.com). Requires the optional `RESEND_API_KEY` and `EMAIL_FROM` secrets; silently skipped without them. Each fixture only ever triggers one reminder batch (`reminderSentAt` guard).

### Forgot Password

A "Forgot password?" link on the login page leads to `/forgot-password`. Submitting an email always shows the same generic confirmation (so the app can't be used to check which emails are registered); if the address matches an account, a single-use reset link valid for 1 hour is emailed via the same Resend integration used for reminders. The link opens `/reset-password/<token>`, which validates the token server-side before showing the new-password form. Setting a new password invalidates all other outstanding reset tokens for that user. Unlike reminders, this flow requires `RESEND_API_KEY`/`EMAIL_FROM` to be configured — it errors rather than silently skipping if they're missing, since account recovery isn't optional.

## Host Guide

The **Host** area is behind `/host` and requires the site-host role (`User.isSiteAdmin`, bootstrapped from `SITE_ADMIN_EMAILS`, re-checked against the DB on every request). Hosts own competitions platform-wide.

| Route                 | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `/host/competitions`  | Create/edit competitions (name, football-data code, flag, active) |
| `/host/fixtures`      | Add, edit, and manage canonical fixtures for a competition        |
| `/host/import`        | Manually import upcoming fixtures from football-data.org           |
| `/host/results`       | Platform-wide result queue — confirm pre-fetched scores (Accept All), manual entry, or API lookup |

## League Admin Guide

League routes are behind `/admin` and require the **COMMISSIONER** role in the active league. Fixtures and results are handled by hosts, so commissioners only manage league settings.

| Route              | Purpose                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `/admin/settings`  | Rename league, Grand Slam toggle + points, invite code management |

## Public API

All endpoints require `Authorization: Bearer <apiKey>`. API keys are generated on the profile page.

| Method  | Endpoint                          | Description           |
| ------- | --------------------------------- | --------------------- |
| `GET`   | `/api/v1/fixtures?status=open`    | List fixtures         |
| `GET`   | `/api/v1/predictions`             | Your predictions      |
| `POST`  | `/api/v1/predictions`             | Submit a prediction   |
| `GET`   | `/api/v1/leaderboard`             | League standings      |

Add `?leagueId=<id>` to any endpoint to scope it to a specific league (defaults to your first league).

Full reference with curl examples and a Python starter bot lives in-app at `/api-docs` (linked from the profile page).

## Future Ideas

Not yet built — noted here for later scoping:

- **Chips** — one-off boosts/wildcards a user can play on a fixture or round (e.g. double points, safety net against a wrong score), borrowed from fantasy football-style games. Needs a per-user/per-season budget and a way to flag which chip is active on a prediction.
- **Double-down pick** — each week a user nominates one fixture to earn double points, raising the stakes on a single prediction instead of a whole round.
- **Model arena** — pit AI models (or bot strategies) against human players in the same league, ranked on the same leaderboard, for fun/comparison.
- **Downloadable summaries** — end-of-season (or end-of-round) exportable recap (image or PDF) with standings, best/worst predictions, streaks, etc. — shareable for bragging rights.
- **Nicknames with personality** — fun, generated or user-chosen nicknames/titles shown next to leaderboard entries instead of just plain usernames.
- **Staging environment** — a non-prod deployment (e.g. a second Cloud Run service + DB deployed from a `staging` branch) to review visual/functional changes before they hit the live site, instead of pushing straight to production.

## Deployment

Every push to `main` triggers the GitHub Actions workflow at `.github/workflows/deploy.yml`.

### Infrastructure (Terraform)

Provisioned in `terraform/`:

| Resource          | Details                                                    |
| ----------------- | ---------------------------------------------------------- |
| Cloud Run         | `football-prediction-app`, europe-west2                    |
| Cloud SQL         | PostgreSQL 16, ENTERPRISE edition, `db-f1-micro`           |
| Artifact Registry | Docker image repository                                    |
| Cloud Scheduler   | `football-prediction-resolve` — calls `/api/cron/resolve` every 30 min |
| Service accounts  | Separate deploy SA and Cloud Run SA (minimal IAM roles)    |

To provision from scratch: `cd terraform && terraform init && terraform apply`

The scheduler job is created only once the `app_url` (Cloud Run URL, known after the first deploy) and `cron_secret` variables are set in `terraform.tfvars` — re-run `terraform apply` at that point. `cron_secret` must equal the `CRON_SECRET` GitHub secret. Trigger a manual test run with:

```bash
gcloud scheduler jobs run football-prediction-resolve --location europe-west2
```

### GitHub Secrets

| Secret                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `GCP_SA_KEY`            | JSON key for the deploy service account              |
| `DATABASE_URL`          | Cloud SQL Unix-socket connection string              |
| `DB_MIGRATION_URL`      | TCP connection string used by Cloud SQL Auth Proxy   |
| `CLOUD_SQL_INSTANCE`    | Cloud SQL instance connection name                   |
| `CLOUD_RUN_SA`          | Cloud Run service account email                      |
| `AUTH_SECRET`           | NextAuth secret                                      |
| `NEXTAUTH_SECRET`       | NextAuth secret (both vars required)                 |
| `FOOTBALL_DATA_API_KEY` | football-data.org API key                            |
| `CRON_SECRET`           | Shared secret for `/api/cron/*` (also set as the `cron_secret` Terraform variable) |
| `RESEND_API_KEY`        | Resend API key. Optional for deadline reminders (skipped without it), but required for password reset emails to send |
| `EMAIL_FROM`            | Sender address, e.g. `Football Predictions <predictions@yourdomain.com>` — same requirement as `RESEND_API_KEY` |
| `SITE_ADMIN_EMAILS`     | Comma-separated emails granted the site-host role on login (set via a `^\|^`-delimited `--set-env-vars` in the deploy workflow so commas survive) |

### Custom domain

The app is served at **https://scorersonline.uk** via a Cloudflare Worker (`cloudflare/worker.js`) that proxies to the Cloud Run URL — Cloud Run's native domain mappings don't support europe-west2. The Worker is deployed through the Cloudflare dashboard with `scorersonline.uk` attached as its custom domain; the copy in `cloudflare/` is the source of truth if it needs editing. `AUTH_URL` is pinned to the domain in `deploy.yml` (`APP_URL` env), and `next.config.ts` allowlists the domain for Server Actions since the Host header Cloud Run sees is still `*.run.app`. The same domain is verified in Resend for outbound email (`EMAIL_FROM`).

### Deploy pipeline

1. Cloud SQL Auth Proxy tunnels to Cloud SQL so migrations run in CI (`npx prisma migrate deploy`)
2. Multi-stage Docker build (`deps → builder → runner`) produces a standalone image
3. Image pushed to Artifact Registry and deployed to Cloud Run
4. `AUTH_URL` is pinned to `APP_URL` (the custom domain) in the deploy workflow
