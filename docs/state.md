# Current State

> Snapshot of what exists and what's live. **Keep this current** — it's the first
> thing an agent reads to know where the project actually stands.

**Last updated:** 2026-09-05

## Status: live in production

Scorers is deployed and running at **https://scorersonline.uk**. The
platform-owned competitions model (the big refactor) is complete and live.

**Native apps:** Phases 1–4 complete (`apps/mobile` + `/api/mobile/v1`). Phase 5
is **prepared**: the app now matches the website visually, in-app account
deletion and a real privacy policy are shipped, and the listing copy and
screenshots are generated (`store-assets/`, `npm run store:shots`). What remains
needs your Apple account — membership and `eas build`; the reviewer account
and the iPad decision are done. The app itself can be tried on a phone today
through **Expo Go** (`cd apps/mobile && npm run start:go`), verified 2026-09-05 —
everything but push reminders and `scorers://` deep links works there. See
[store-release.md](store-release.md).

## What's built and working

Everything through **phase 23** (see [changelog.md](changelog.md) for the phase list):

- **Auth** — open email/password registration, login, JWT sessions, profile page with
  API-key generation, forgot-password / reset via email. **Invite links**
  (`/register?invite=CODE`) create the account and join the league in one step.
- **Two admin tiers:**
  - **Site hosts** (`User.isSiteAdmin`) own competitions, fixtures, imports, and
    the platform-wide result-confirmation queue at `/host`.
  - **League commissioners** manage only their league's settings at `/admin`.
- **Platform-owned competitions** — `Competition` owns canonical fixtures; leagues
  subscribe via `League.competitionId`. One prediction per user per fixture counts
  across all their leagues on that competition.
- **Automatic fixtures** — a 10-minute cron imports upcoming fixtures for active
  competitions that have a football-data.org code and at least one subscribed league.
- **Predictions** (`/`) — one page for open fixtures, kicked-off picks and settled
  results. Scoped by competition, not league: a pick counts in every league you're in.
- **Banker** — one fixture per gameweek scores double. Always on (it can't be a
  per-league toggle; see [decisions.md](decisions.md)), locked at kickoff.
- **Result resolution** — cron confirms scores from football-data.org as soon as
  they’re available; hosts can enter missing results or edit confirmed scores from
  `/host/results` and `/host/fixtures`.
- **Standings** — leaderboard ranks by confirmed points (including streak bonuses).
  No provisional/pre-confirm step — results score immediately once confirmed.
- **Leaderboard** — every league you're in, stacked: standings, exact-score count,
  a points breakdown (result / close / exact / banker / streak), per-player "form" strip
  over the last 5 rounds.
- **Deadline reminder emails** — the same cron emails members who haven't predicted
  a fixture kicking off within 3 hours (via Resend).
- **How it works** (`/rules`) — the rules in one public page. Nothing varies by league
  any more, so it reads its numbers from the scoring constants.
- **Public bot API** — `/api/v1/fixtures`, `/predictions`, `/leaderboard`.
- **Mobile API (Phase 1)** — `/api/mobile/v1` with access/refresh tokens (not API keys):
  auth, me, rules, fixtures, predictions, leagues, competitions, leaderboards. See
  [mobile.md](mobile.md).
- **Design** — "Quiet Product" system with broadcast-scoreboard moments (see
  [design-system.md](design-system.md)), fully tokenised with a **dark theme** that
  follows the OS setting.
- **Mobile** — bottom tab bar; skeleton loading states, an error boundary and a 404 page.
- **Account deletion** — irreversible, in-app on both platforms, one shared
  implementation (`lib/accountDeletion.ts`). Leagues outlive the member who leaves.
- **Privacy policy** (`/privacy`) — public, and the URL both store listings use.
- **Store assets** — `store-assets/app-store-listing.md` (every App Store Connect
  field) and `store-assets/promo/` (six framed 1290×2796 panels, captured from the
  real app; regenerate with `npm run store:shots`).

## Deployment state

- **Hosting:** GCP Cloud Run (`football-prediction-app`, europe-west2) + Cloud SQL
  (PostgreSQL 16). Deployed by GitHub Actions on every push to `main`.
- **Domain:** `scorersonline.uk` via a Cloudflare Worker proxy (europe-west2 has no
  native Cloud Run domain mapping).
- **Cron:** Cloud Scheduler job `football-prediction-resolve`, **enabled**, calls
  `POST /api/cron/resolve` every 10 minutes against the direct run.app URL.
- **Email:** Resend, sending from the verified `scorersonline.uk` domain.

## Test & build health

- **229 unit tests** (vitest, prisma/fetch mocked) — all passing.
- Production build is clean (`npm run build`, type-checked).
- CI runs the suite **before** deploying, so a red test blocks production.

## Known rough edges

- **Google Safe Browsing flag on `scorersonline.uk` — appears cleared, not confirmed.**
  Flagged 2026-07-10 with a Chrome "Dangerous site" / social-engineering warning. The app
  was never compromised; it was a domain-reputation flag, most likely inherited prior use
  of the purchased `.uk` domain or a new-domain + credential-form heuristic.
  **Rechecked 2026-08-16:** the site loads in Chrome with **no interstitial**, and the
  Safe Browsing transparency report returns "No available data" (i.e. no verdict, which
  is not a positive all-clear). Treat as resolved unless a warning reappears.
  **Caveat:** the recheck ran on the owner's own machine, where a warning may have been
  dismissed back in July and remembered — Chrome suppresses it per-site after a bypass.
  A clean load on another device or a guest profile would settle it.
  **If it does reappear:** verify the domain in Google Search Console → Security Issues →
  Request Review (social-engineering reviews clear in ~72h). It also hurts Resend email
  deliverability while listed.
  **Mitigation deployed:** auth page titles use the "Scorers" brand, and login/register
  carry a plain-English "what this site is" explainer. Since 2026-08-16 that copy is also
  accurate about open sign-up, which it previously wasn't.
- Migrations are still **authored offline** (`prisma migrate diff`) rather than against
  a live dev DB — but a local Docker Postgres now exists to verify them against
  (`docker compose up -d`). See [development.md](development.md#local-database).
- **No staging environment** — pushes to `main` go straight to production, gated only by
  the test suite. See [roadmap.md](roadmap.md).

For what's next, see [roadmap.md](roadmap.md).
