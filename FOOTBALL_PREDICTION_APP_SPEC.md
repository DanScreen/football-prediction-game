# Football Prediction App — Project Spec

## 1. Overview

A web app where a private group of friends (plus optional "bot" accounts run by
automated prediction models) log in, submit predicted scorelines for upcoming
football fixtures, and earn points based on how accurate those predictions turn
out to be once real results come in. A shared leaderboard tracks standings over
the season/competition.

## 2. Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** PostgreSQL via Prisma 7 — Cloud SQL (ENTERPRISE, db-f1-micro) in production; local Postgres in dev
- **Auth:** NextAuth.js v5 beta, credentials provider (email + password), JWT sessions
- **Fixtures & results:** football-data.org v4 REST API (free tier covers Premier League + World Cup)
- **Deployment:** Cloud Run + Cloud SQL (GCP, europe-west2); provisioned via Terraform; deployed via GitHub Actions

## 3. Users & Access

- **Roles:** Commissioner (admin) and Player. Bot accounts are just Players
  that happen to interact only via the API instead of the UI.
- **Registration** requires an invite code (set by the Commissioner) — keeps
  the league private to your group.
- Each user has: display name, optional "bot" flag (for a fun icon in the UI),
  and a personal API key for programmatic prediction submission.

## 4. Data Model

**User**
- id, email, passwordHash, displayName, isBot, apiKey, createdAt

**League**
- id, name, competition, inviteCode, grandSlamEnabled (bool), grandSlamPoints (int)

**LeagueMembership**
- userId, leagueId, role: `COMMISSIONER` / `MEMBER`

**Fixture**
- id, leagueId, competition, round, homeTeam, awayTeam, kickoffTime
- status: `SCHEDULED` / `AWAITING_RESULT` / `COMPLETED`
- actualHomeScore, actualAwayScore (nullable)
- proposedHomeScore, proposedAwayScore (nullable — pre-fetched by the automated
  sweep, awaiting Commissioner confirmation)
- reminderSentAt (nullable — set once deadline-reminder emails have gone out)
- resultSource: `MANUAL` / `API_CONFIRMED` (nullable until completed)

**Prediction**
- id, userId, fixtureId, predictedHomeScore, predictedAwayScore
- pointsAwarded (nullable until fixture completed; always *base* points — bonuses
  live in BonusAward)

**BonusAward**
- id, userId, leagueId, competition, round, points
- unique on (userId, leagueId, competition, round) — one Grand Slam per round
- submittedVia: `WEB` / `API`
- unique on (userId, fixtureId) — one prediction per user per fixture, editable
  until the deadline

Active league is stored in an `httpOnly` cookie (`activeLeagueId`). A user can belong to multiple leagues and switch between them. Submitting a prediction auto-copies it to matching fixtures (same teams + kickoff) in the user's other leagues.

## 5. Core Features / Pages

### 5.1 Dashboard
Lists upcoming fixtures with a countdown to each prediction deadline (kickoff
time). Each fixture has a simple "home score / away score" input. Once a
fixture's deadline passes, the prediction locks and other users' picks become
visible (classic prediction-game etiquette).

### 5.2 My Predictions
History of the user's past predictions vs. actual results, with points earned
per fixture and a running total.

### 5.3 Leaderboard
League standings: total points, number of exact predictions, "form" over the
last few rounds. Styled like a real football table for the playful vibe.

### 5.4 Commissioner Panel (admin only)
- Add/edit fixtures (competition, teams, kickoff time)
- View "Pending Results" queue (fixtures past kickoff + buffer, awaiting a
  result)
- Trigger result lookup via football-data.org, review/confirm or manually override (see 5.5)
- Manage league settings (invite code, Grand Slam toggle)

### 5.5 Result Resolution
1. A Cloud Scheduler job calls `POST /api/cron/resolve` (secured by
   `CRON_SECRET`) every 30 minutes. It moves fixtures ≥1h45m past kickoff
   to `AWAITING_RESULT` across all leagues and pre-fetches proposed scores from
   football-data.org — one API call per competition + date window, fuzzy-matched
   by team name, shared by cross-league copies of the same match.
2. Pre-fetched scores appear in the Commissioner's queue with a "score found"
   badge; the confirm page loads with the proposal ready to review. Any league
   member can also press "Request result" on a kicked-off fixture from the
   dashboard to trigger the same lookup early; a fetched score shows there as
   "awaiting confirmation". The Commissioner's "Check for Updates" button runs
   the sweep on demand, and per-fixture "Look Up Result" remains as a manual
   fallback.
3. The proposed score is shown to the Commissioner, who can **Accept**
   (locks in the score and triggers scoring for all predictions), **Edit**
   (enter the correct score manually), or **Retry**.
4. If `FOOTBALL_DATA_API_KEY` is not set, lookups are skipped and the
   Commissioner enters scores manually.
5. This confirmation step exists because results can occasionally be wrong
   (postponements, ambiguous team names) — a quick human check keeps bad data
   off the leaderboard. Nothing is ever scored without Commissioner sign-off.
6. The same cron sweep also sends deadline-reminder emails (via Resend, when
   `RESEND_API_KEY`/`EMAIL_FROM` are configured) to members who haven't
   predicted a fixture kicking off within the next 3 hours.

### 5.6 Public Prediction API (for bots)
All endpoints under `/api/v1/`, authenticated via `Authorization: Bearer <apiKey>`.

- `GET /fixtures?status=open` — fixtures still open for predictions, with
  deadlines
- `GET /predictions` — the authenticated user's own predictions
- `POST /predictions` — body `{ fixtureId, homeScore, awayScore }`; creates or
  updates a prediction, rejected if past the deadline
- `GET /leaderboard` — current standings

This lets your automated models submit picks the same way a human would via
the dashboard. An in-app reference with curl examples and a Python starter bot
lives at `/api-docs`, linked from the profile page.

## 6. Scoring Rules (Superbru-style)

For each prediction, once the fixture's real result is confirmed:

| Outcome | Points |
|---|---|
| Exact score correct | 3 |
| Correct result (W/D/L) **and** correct goal difference, but not exact score | 1.5 |
| Correct result (W/D/L) only | 1 |
| Incorrect result | 0 |

**Grand Slam bonus (optional, toggleable in Admin → Settings):** if a user
correctly predicts the *result* of every fixture in a round, they earn a bonus
(default 3 points, configurable 1–20). Off by default. Awarded once the whole
round is confirmed, stored as a `BonusAward` row (never folded into a
prediction's points), and shown as a 🏆 badge on the leaderboard.

## 7. Design Direction — Playful & Creative

- Pitch-green base palette with yellow/red "card" accent colors for fun
  moments (e.g., a red flash for a totally wrong prediction)
- Friendly, rounded headline font paired with a clean body sans-serif
- Light use of football iconography (⚽ 🏆 🟨) for status indicators
- Micro-interactions: a small celebration animation ("Nailed it!") when a user
  hits an exact score, animated point updates on the leaderboard
- Leaderboard table styled like a real league table, with a "form" strip
  (last 5 rounds) per player

## 8. Build Plan (phased checklist)

See `TODO.md` for the full checklist with completion status. Phases completed:

1. **Setup** — Next.js + TS + Tailwind, Prisma + PostgreSQL schema, NextAuth credentials provider
2. **Auth & users** — registration, login, session, profile page with API key generation
3. **Fixtures** — Commissioner UI; dashboard list view
4. **Predictions** — submission UI with deadline locking; prediction storage
5. **Scoring engine** — pure function with unit tests
6. **Result resolution** — manual entry + football-data.org lookup with confirm flow
7. **Leaderboard** — standings, points breakdown, form strip
8. **Public API** — `/api/v1/*` endpoints with API key auth
9. **Design pass** — pitch-green theme, animations, responsive layout
10. **Seed data & QA** — full predict → resolve → score cycle
11. **Multi-league architecture** — League model, LeagueMembership, active league cookie, cross-league sync
12. **Fixture import** — football-data.org integration, round selector, Admin → Import page
13. **Infrastructure & deployment** — Terraform + Cloud Run + Cloud SQL + GitHub Actions CI/CD
14. **League Settings page** — Grand Slam toggle/points, rename, invite code management
15. **Automated result resolution** — Cloud Scheduler + `/api/cron/resolve`, proposal pre-fetch
16. **Deadline reminder emails** — Resend integration in the cron sweep
17. **Grand Slam transparency** — BonusAward model, leaderboard badge
18. **Bot API docs** — in-app `/api-docs` reference
19. **My Predictions round breakdown** — per-round subtotals and summary
20. **Unit test expansion** — 95 tests across scoring, football-data matching, auth, cron, API routes

## 9. Prerequisites

- **`DATABASE_URL`** — PostgreSQL connection string. Locally: `postgresql://user:pass@localhost:5432/football_prediction_app`. In production: Cloud SQL Unix socket connection string.
- **`FOOTBALL_DATA_API_KEY`** — needed for fixture import and result lookup. Register at football-data.org (free). Without it, the app falls back to manual-only fixture entry and result entry.
- **`AUTH_SECRET`** / **`NEXTAUTH_SECRET`** — `openssl rand -base64 32`. Both env vars are required by NextAuth v5 beta.
- **Initial fixtures** — run `npx prisma db seed` for test data, or use Admin → Import to pull real fixtures from football-data.org.

## 10. Future Enhancements

- Social feed / comments between rounds
- PWA / mobile-friendly install prompt
- Additional competitions beyond PL and WC (requires paid football-data.org tier)
- Admin dashboard — season-level stats, export CSV
