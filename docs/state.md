# Current State

> Snapshot of what exists and what's live. **Keep this current** — it's the first
> thing an agent reads to know where the project actually stands.

**Last updated:** 2026-07-09

## Status: live in production

Scorers is deployed and running at **https://scorersonline.uk**. The
platform-owned competitions model (the big refactor) is complete and live.

## What's built and working

Everything through **phase 23** (see [changelog.md](changelog.md) for the phase list):

- **Auth** — email/password registration (invite-code gated), login, JWT sessions,
  profile page with API-key generation, forgot-password / reset via email.
- **Two admin tiers:**
  - **Site hosts** (`User.isSiteAdmin`) own competitions, fixtures, imports, and
    the platform-wide result-confirmation queue at `/host`.
  - **League commissioners** manage only their league's settings at `/admin`.
- **Platform-owned competitions** — `Competition` owns canonical fixtures; leagues
  subscribe via `League.competitionId`. One prediction per user per fixture counts
  across all their leagues on that competition.
- **Automatic fixtures** — a 10-minute cron imports upcoming fixtures for active
  competitions that have a football-data.org code and at least one subscribed league.
- **Predictions** — score inputs that lock at kickoff; other players' picks reveal
  after the deadline.
- **Result resolution** — cron pre-fetches proposed scores; hosts confirm from a
  platform-wide queue (with **Accept All**); scoring runs once per fixture, then
  Grand Slam bonuses fan out per subscribing league.
- **Provisional scores/points everywhere** — dashboard, My Predictions, leaderboard,
  and API show projected scores/points (badged amber) once a proposed score exists,
  until a host confirms. Standings rank by **confirmed** points only.
- **Leaderboard** — standings, exact-score count, Grand Slam badges, per-player
  "form" strip over the last 5 rounds.
- **Deadline reminder emails** — the same cron emails members who haven't predicted
  a fixture kicking off within 3 hours (via Resend).
- **Public bot API** — `/api/v1/fixtures`, `/predictions`, `/leaderboard`.
- **Design** — "Quiet Product" system with broadcast-scoreboard moments (see
  [design-system.md](design-system.md)).

## Deployment state

- **Hosting:** GCP Cloud Run (`football-prediction-app`, europe-west2) + Cloud SQL
  (PostgreSQL 16). Deployed by GitHub Actions on every push to `main`.
- **Domain:** `scorersonline.uk` via a Cloudflare Worker proxy (europe-west2 has no
  native Cloud Run domain mapping).
- **Cron:** Cloud Scheduler job `football-prediction-resolve`, **enabled**, calls
  `POST /api/cron/resolve` every 10 minutes against the direct run.app URL.
- **Email:** Resend, sending from the verified `scorersonline.uk` domain.

## Test & build health

- **140 unit tests** (vitest, prisma/fetch mocked) — all passing.
- Production build is clean (`npm run build`, type-checked).

## Known rough edges

- The GitHub Actions workflow logs a **Node 20 deprecation warning** (actions are
  forced onto Node 24). Harmless; bump `actions/checkout`/`setup-node` when convenient.
- **No local PostgreSQL** on the dev machine — migrations are authored offline and
  applied by CI. See [development.md](development.md#migrations).

For what's next, see [roadmap.md](roadmap.md).
