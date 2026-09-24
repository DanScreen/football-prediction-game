# Current State

> Snapshot of what exists and what's live. **Keep this current** — it's the first
> thing an agent reads to know where the project actually stands.

**Last updated:** 2026-09-24

## Status: live in production

Scorers is deployed and running at **https://scorersonline.uk**. The
platform-owned competitions model (the big refactor) is complete and live.

**Native apps:** Phases 1–4 complete (`apps/mobile` + `/api/mobile/v1`). Phase 5
is **prepared**: the app now matches the website visually, in-app account
deletion, a real privacy policy and a support page are shipped, and the listing copy and
screenshots are generated (`store-assets/`, `npm run store:shots`). **iOS 1.0.1
(8) is live on the App Store** (2026-09-24) — the release with the
email-verification screen. Google Play is still to do. The next iOS release must
be **1.0.2** or higher (1.0.1's version train is now closed). From now on
iOS builds ship from CI: bumping `expo.version` and merging to `main` builds on EAS
and uploads to App Store Connect (`mobile-release.yml`, see
[deployment.md](deployment.md#mobile-release)). The app itself can be tried on a phone today
through **Expo Go** (`cd apps/mobile && npm run start:go`), verified 2026-09-05 —
everything but push reminders and `scorers://` deep links works there. See
[store-release.md](store-release.md). Open fixtures on Predictions (web and app) are
capped at the current and next gameweek per competition.

## What's built and working

Everything through **phase 23** (see [changelog.md](changelog.md) for the phase list):

- **Auth** — open email/password registration (email format checked), login, JWT
  sessions, profile page with API-key generation, forgot-password / reset via email.
  **Email verification is required** (live 2026-09-23): every account — existing ones included — is held at
  `/verify-email` (web) / the verify screen (app) until it clicks the emailed link. **Invite links**
  (`/register?invite=CODE`) create the account and join the league in one step.
- **Two admin tiers:**
  - **Site hosts** (`User.isSiteAdmin`) own competitions, fixtures, imports, and
    the platform-wide result-confirmation queue at `/host`. `/host` itself is an
    **overview** of user counts and activity (DAU/WAU/MAU via `lastSeenAt`,
    signups, prediction volume, recent users).
  - **League commissioners** manage only their league's settings at `/admin`.
- **Platform-owned competitions** — `Competition` owns canonical fixtures; leagues
  subscribe via `League.competitionId`. One prediction per user per fixture counts
  across all their leagues on that competition. A host can declare one **finished**
  (`archivedAt`), which drops it off the core pages, auto-import and reminders while
  keeping all its history.
- **Automatic fixtures** — a 10-minute cron imports upcoming fixtures for active
  competitions that have a football-data.org code and at least one subscribed league.
- **Predictions** (`/`) — one page for open fixtures, kicked-off picks and settled
  results. Scoped by competition, not league: a pick counts in every league you're in.
- **Banker** — one fixture per gameweek scores double. Always on (it can't be a
  per-league toggle; see [decisions.md](decisions.md)), locked at kickoff.
- **Result resolution** — cron confirms scores from football-data.org as soon as
  they’re available, then **reconciles** recent AI-confirmed results for 24h after
  kickoff so a later feed correction (disallowed goal, etc.) updates points without
  a host edit. Hosts can still enter missing results or edit confirmed scores from
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
- **Support** (`/support`) — public FAQ + `support@scorersonline.uk`, the Support URL
  both store listings use (was `/rules` until 2026-09-05).
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

- **351 unit tests** (vitest, prisma/fetch mocked) — all passing.
- **30 end-to-end tests** (Playwright, real browser + Postgres; `npm run e2e`) — all
  passing, and stable across repeated runs. They cover the golden path (invite, sign
  up, verify, predict with a banker, kickoff lock, host confirms, leaderboard), public
  vs protected routing, nav with a fresh session, the bot API over HTTP, and password
  reset. They gate pull requests in CI.
- Production build is clean (`npm run build`, type-checked).
- CI runs the unit suite **before** deploying, so a red test blocks production. The E2E
  suite runs on pull requests only.

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
