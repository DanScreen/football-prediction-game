# CLAUDE.md

## Project

"Football Prediction App" — a private football score-prediction game for a small group
of friends, with a public API so automated prediction models can submit picks
alongside human users. The full functional spec, data model, scoring rules,
and phased build plan live in `FOOTBALL_PREDICTION_APP_SPEC.md` — read it in full
before starting any work.

**Roles.** Site **hosts** (`User.isSiteAdmin`, bootstrapped from `SITE_ADMIN_EMAILS`)
own platform-wide `Competition`s and their canonical fixtures/results via the `/host`
area. Leagues subscribe to a competition (`League.competitionId`) and share its fixtures,
so fixtures and results are automatic from a league's perspective. League **commissioners**
(`LeagueMembership.role = "COMMISSIONER"`) only manage league settings via `/admin`.
Once the sweep pre-fetches a proposed score, provisional scores/points show everywhere
(read-time, `lib/provisional.ts`) until a host confirms; standings rank by confirmed points.

## Working agreement

- Turn the Section 8 build plan in the spec into `TODO.md` and keep it updated
  as you go (check off items, split out sub-tasks you discover along the way).
- Work through phases in order. After each phase, run the dev server, build,
  and lint (and any tests you've added) — fix issues before moving on to the
  next phase.
- Commit to git after each completed phase or meaningful sub-task, with a
  clear, descriptive message. This is the main way progress gets reviewed
  later, so commit often.
- If you hit a product decision the spec doesn't cover, make a sensible
  choice, note it under a "Decisions made" section in `TODO.md` with a one-line
  rationale, and keep going rather than stopping to ask — there's nobody
  around to answer tonight.
- If you get properly stuck (not just a design judgment call, but something
  blocking, like a missing credential), note it clearly at the top of
  `TODO.md` under "Blocked" and move on to other phases that aren't affected.

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Prisma 7 + PostgreSQL (Cloud SQL in production, local Postgres in dev)
- NextAuth.js v5 beta, credentials provider, JWT sessions
- football-data.org v4 REST API (fixture import + result lookup; free tier covers PL + WC)

## Environment

- `.env.local` holds `FOOTBALL_DATA_API_KEY`, `DATABASE_URL`, and NextAuth config —
  never commit this file. See `.env.local.example` for the expected keys.

## Commands

Node.js (v26) is installed via Homebrew at `/opt/homebrew/bin`. All `npm`/`npx`
commands must be run with `PATH="/opt/homebrew/bin:$PATH"` prepended, or just
run them from a terminal where Homebrew is on the PATH.

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build + type check
- `npm run lint` — ESLint
- `npx prisma migrate dev` — apply schema changes and regenerate client (requires local Postgres via `DATABASE_URL`)
- `npx prisma generate` — regenerate the Prisma client after schema changes
- `npx prisma studio` — inspect the database visually (connects to `DATABASE_URL`)
- `npx prisma db seed` — seed the database with test users, league, fixtures, and predictions

## Deployment

The app is deployed on GCP (Cloud Run + Cloud SQL, europe-west2) via GitHub Actions.
Infrastructure is provisioned with Terraform in `terraform/`. Every push to `main` runs migrations and deploys automatically.

- Cloud Run connects to Cloud SQL via Unix socket (`DATABASE_URL` contains `?host=/cloudsql/<instance>`)
- CI migrations use a TCP URL via Cloud SQL Auth Proxy (`DB_MIGRATION_URL`)
- `AUTH_URL` is set automatically to the Cloud Run service URL after each deploy
- Cloud Scheduler calls `POST /api/cron/resolve` every 10 min (Bearer `CRON_SECRET`) —
  auto-imports fixtures for active competitions, fixture transitions, result proposal
  pre-fetch, and deadline reminder emails
- See `.github/workflows/deploy.yml` for the full pipeline and `README.md` for required secrets
