# Football Prediction App

A score-prediction game for football fans. Users join leagues, predict scorelines for upcoming fixtures, and earn points based on accuracy. Commissioners manage fixtures, import schedules, and resolve results.

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

### 3. Set up the database

```bash
npx prisma migrate deploy
npx prisma db seed
```

The seed creates four test accounts (password: `password123`) and one league with fixtures:

| Email                           | Role        |
| ------------------------------- | ----------- |
| `commissioner@football.test`    | Commissioner |
| `alice@football.test`           | Member      |
| `bob@football.test`             | Member      |
| `robo@football.test`            | Member (bot) |

League invite code: **GOAAALLL**

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### Leagues

Users sign up without a league, then either **create** one or **join** one with an invite code. A user can belong to multiple leagues; the active league is stored in a cookie and can be switched from the My Leagues page.

### Competitions

When creating a league, the commissioner picks a competition:

- **Premier League** — mapped to football-data.org code `PL`
- **FIFA World Cup 2026** — mapped to `WC`

### Fixture Import

Commissioners use the **Admin → Import** tab to pull upcoming fixtures directly from football-data.org. Select 1, 2, or 3 rounds ahead — the API returns structured data (exact kickoff times, team names, round labels) with no AI parsing risk.

### Making Predictions

Users predict the exact home and away score for each fixture. Predictions lock at kickoff and are hidden from other users until the deadline passes.

Cross-league sync: if the same real-world match exists in multiple leagues a user belongs to, submitting a prediction in one league automatically copies it to the others.

### Scoring

| Outcome                                   | Points |
| ----------------------------------------- | ------ |
| Exact score                               | 3      |
| Correct result + same goal difference     | 1.5    |
| Correct result only                       | 1      |
| Wrong result                              | 0      |

An optional **Grand Slam** bonus awards extra points (configurable per league) if a player gets every fixture in a round correct.

### Result Resolution

Commissioners mark results manually, or use **Admin → Results** to trigger a lookup via football-data.org which proposes the final score for review before saving.

## Admin Guide

All admin routes are behind `/admin` and require the **COMMISSIONER** role in the active league.

| Route              | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `/admin/fixtures`  | Add, edit, and manage fixtures                   |
| `/admin/import`    | Import upcoming fixtures from football-data.org  |
| `/admin/results`   | Resolve results (manual entry or API lookup)     |

## Public API

All endpoints require `Authorization: Bearer <apiKey>`. API keys are generated on the profile page.

| Method  | Endpoint                          | Description           |
| ------- | --------------------------------- | --------------------- |
| `GET`   | `/api/v1/fixtures?status=open`    | List fixtures         |
| `GET`   | `/api/v1/predictions`             | Your predictions      |
| `POST`  | `/api/v1/predictions`             | Submit a prediction   |
| `GET`   | `/api/v1/leaderboard`             | League standings      |

Add `?leagueId=<id>` to any endpoint to scope it to a specific league (defaults to your first league).

## Deployment

Every push to `main` triggers the GitHub Actions workflow at `.github/workflows/deploy.yml`.

### Infrastructure (Terraform)

Provisioned in `terraform/`:

| Resource          | Details                                                    |
| ----------------- | ---------------------------------------------------------- |
| Cloud Run         | `football-prediction-app`, europe-west2                    |
| Cloud SQL         | PostgreSQL 16, ENTERPRISE edition, `db-f1-micro`           |
| Artifact Registry | Docker image repository                                    |
| Service accounts  | Separate deploy SA and Cloud Run SA (minimal IAM roles)    |

To provision from scratch: `cd terraform && terraform init && terraform apply`

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
| `RESEND_API_KEY`        | Optional — Resend API key for deadline reminder emails (reminders are skipped without it) |
| `EMAIL_FROM`            | Optional — sender address for reminders, e.g. `Football Predictions <predictions@yourdomain.com>` |

### Deploy pipeline

1. Cloud SQL Auth Proxy tunnels to Cloud SQL so migrations run in CI (`npx prisma migrate deploy`)
2. Multi-stage Docker build (`deps → builder → runner`) produces a standalone image
3. Image pushed to Artifact Registry and deployed to Cloud Run
4. `AUTH_URL` is automatically set to the Cloud Run service URL after each deploy
