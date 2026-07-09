# TODO — Football Prediction App

## Blocked
- **No local PostgreSQL** — `.env`/`.env.local` still point `DATABASE_URL` at the old
  SQLite file (`file:./dev.db`) and Postgres isn't installed locally, so `prisma migrate dev`,
  seeding, and runtime testing of DB-backed flows can't run on this machine. New migrations
  are authored offline with `prisma migrate diff --from-schema-datamodel … --script` and
  applied by CI (`prisma migrate deploy`) on push. To unblock locally:
  `brew install postgresql@16`, create a `football_prediction_app` DB, and update `DATABASE_URL`.

## Decisions Made
- **Node.js installed via Homebrew** — not pre-installed; added via `brew install node` (v26.3.0).
- **Prisma v7 + `@prisma/adapter-pg`** — Prisma 7 dropped no-adapter mode; runtime `PrismaClient` requires an explicit `pg.Pool` + `PrismaPg` adapter. Connection URL is configured via `prisma.config.ts` for CLI operations; `lib/prisma.ts` wires it at runtime.
- **NextAuth v5 beta** — using JWT sessions (stateless) with credentials provider; no DB adapter needed for auth sessions.
- **Fixture import + result lookup via football-data.org** — REST API (free tier covers PL + WC) used for both fixture import and result lookup. No AI/Anthropic dependency. Key: `FOOTBALL_DATA_API_KEY`.
- **PostgreSQL on Cloud SQL (ENTERPRISE, db-f1-micro)** — explicit `edition = "ENTERPRISE"` required in Terraform; ENTERPRISE_PLUS is the default but doesn't support `db-f1-micro`.
- **Cloud Run connects to Cloud SQL via Unix socket** — `DATABASE_URL` uses `?host=/cloudsql/<instance>` for the running container; CI migrations use a TCP URL via Cloud SQL Auth Proxy.
- **Active league via cookie** — league context stored in `httpOnly` cookie `activeLeagueId` rather than URL segments, keeping all existing routes unchanged.
- **Platform-owned competitions** — fixtures/results moved from per-league to a shared `Competition` that leagues subscribe to (`League.competitionId`, `Fixture.competitionId`). Hosts own competitions; league admins no longer import fixtures or confirm results. This replaced the old cross-league prediction sync — one prediction per user per canonical fixture now counts across all their leagues on that competition.
- **Site-host role** — `User.isSiteAdmin` (bootstrapped from `SITE_ADMIN_EMAILS`, synced on login, re-checked against the DB per request) gates the `/host` area, separate from the per-league `COMMISSIONER` role that gates `/admin`.
- **Provisional scores/points** — once the sweep pre-fetches a proposed score, projected scores and points are shown everywhere (dashboard, My Predictions, leaderboard, API) badged amber until a host confirms; computed at read-time (`lib/provisional.ts`), never stored. Standings rank by confirmed points only.
- **Commissioner role per league** — `isAdmin` removed from User/session; league admin access is gated by `LeagueMembership.role = "COMMISSIONER"` for the active league.
- **`"use server"` files export functions only** — Turbopack errors if a server-action file exports a constant; shared constants (e.g. `COMPETITIONS`) live in plain `.ts` files.

---

## Phase 1 — Setup ✅
- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind CSS
- [x] Configure Prisma with PostgreSQL (`@prisma/adapter-pg` for Prisma v7)
- [x] Define Prisma schema (User, LeagueSettings, Fixture, Prediction)
- [x] Set up NextAuth.js v5 credentials provider (`auth.ts`)
- [x] Create `.env.local.example` with required keys
- [x] Initial git commit

## Phase 2 — Auth & Users ✅
- [x] Registration page with invite code gate
- [x] Login page + session handling
- [x] Profile page with API key generation
- [x] Route protection middleware (proxy.ts — Next.js 16 convention)

## Phase 3 — Fixtures ✅
- [x] Commissioner UI to add/edit fixtures
- [x] Dashboard fixture list view with countdown to deadline

## Phase 4 — Predictions ✅
- [x] Prediction submission UI (home/away score inputs per fixture)
- [x] Deadline locking logic (lock at kickoff time)
- [x] Prediction storage — upsert (one per user per fixture)
- [x] Reveal others' picks once deadline passes

## Phase 5 — Scoring Engine ✅
- [x] Pure scoring function implementing Section 6 rules
- [x] Unit tests: exact score (3 pts), correct result + goal diff (1.5 pts), correct result only (1 pt), wrong (0 pt)
- [x] Edge cases: 0-0 draws, same goal diff different result, draws
- [x] Grand Slam bonus logic (per-round, toggleable via LeagueSettings)

## Phase 6 — Result Resolution & Fixture Import ✅
- [x] Manual result entry by Commissioner
- [x] Fixture status transitions: SCHEDULED → AWAITING_RESULT → COMPLETED
- [x] Auto-move fixtures to AWAITING_RESULT ~2.5 h after kickoff (on-demand check)
- [x] football-data.org result lookup — date-range query for finished matches with fuzzy team name matching
- [x] Review/confirm flow: Accept / Edit / Retry
- [x] Graceful degradation when FOOTBALL_DATA_API_KEY is absent (manual-only mode)

## Phase 7 — Leaderboard ✅
- [x] Standings page: total points, exact predictions count
- [x] Form strip (last 5 rounds) per player
- [x] Styled as a real league table

## Phase 8 — Public API ✅
- [x] `GET /api/v1/fixtures?status=open`
- [x] `GET /api/v1/predictions`
- [x] `POST /api/v1/predictions`
- [x] `GET /api/v1/leaderboard`
- [x] API key auth middleware (`Authorization: Bearer <apiKey>`)

## Phase 9 — Design Pass ✅
- [x] Pitch-green palette with yellow/red card accent colours
- [x] Rounded headline font + clean body sans-serif
- [x] Football iconography (⚽ 🏆 🟨) for status indicators
- [x] Celebration animation for exact-score predictions ("Nailed it!")
- [x] Animated leaderboard point updates
- [x] Responsive / mobile-friendly layout

## Phase 10 — Seed Data & QA ✅
- [x] Seed real or placeholder upcoming fixtures
- [x] End-to-end cycle: predict → resolve → score
- [x] Final lint + build check

## Phase 11 — Multi-League Architecture ✅
- [x] Remove global invite-code gate — registration is now open; invite code optional (links user to a league on sign-up)
- [x] Schema: `League`, `LeagueMembership` (role: COMMISSIONER / MEMBER); `Fixture.leagueId`
- [x] Active league stored in `httpOnly` cookie; helper `lib/activeLeague.ts`
- [x] League creation: choose competition (Premier League / World Cup 2026), redirect to Admin → Import for fixture setup
- [x] League join via invite code; invite code shown on My Leagues page
- [x] "My Leagues" tab — list leagues, switch active league, view member/fixture counts
- [x] Dashboard scoped to active league — performance summary (rank, points, exact ⚽), upcoming fixtures with prediction inputs
- [x] `requireCommissioner()` pattern in all admin actions — DB membership check replaces `isAdmin` flag
- [x] Admin layout, fixtures, results, and import all scoped to active league
- [x] Cross-league prediction sync — submitting a prediction auto-copies to matching fixtures in user's other leagues
- [x] Leaderboard and Predictions pages scoped to active league
- [x] Public API endpoints accept optional `?leagueId=` param
- [x] Header shows Admin link only to commissioners of the active league
- [x] Seed updated: league with `competition`, 4 memberships (commissioner + 3 members), league-scoped fixtures

## Phase 12 — Fixture Import via football-data.org ✅
- [x] `lib/footballData.ts` — fetches scheduled matches from football-data.org v4 API
- [x] Competition → API code mapping: Premier League (`PL`), World Cup 2026 (`WC`)
- [x] Rounds selector (1 / 2 / 3) replaces free-text competition / round / season inputs
- [x] Admin import page reads competition from the active league (no user input needed)
- [x] `FOOTBALL_DATA_API_KEY` added to `.env.local.example`

## Phase 13 — Infrastructure & Deployment ✅
- [x] Terraform: Cloud Run, Cloud SQL (PostgreSQL 16, ENTERPRISE, db-f1-micro), Artifact Registry, service accounts
- [x] Multi-stage Dockerfile (`deps → builder → runner`; `output: "standalone"`; Prisma client copied from deps stage)
- [x] GitHub Actions deploy workflow: Cloud SQL Auth Proxy for migrations, Docker build + push, Cloud Run deploy
- [x] `AUTH_URL` auto-set to Cloud Run service URL after each deploy
- [x] `@prisma/adapter-pg` + `pg.Pool` wired in `lib/prisma.ts` and `prisma/seed.ts`
- [x] Cloud SQL Unix socket connection via `?host=/cloudsql/...` in `DATABASE_URL`

## Phase 14 — League Settings page (spec §5.4 gap) ✅
- [x] `app/admin/settings/` — page + form: rename league, Grand Slam toggle, Grand Slam points
- [x] Show invite code with a "Regenerate" action (invalidates the old code)
- [x] Move invite-code generator to `lib/inviteCode.ts`, shared with league creation
- [x] Add "Settings" link to the admin nav

## Phase 15 — Automated result resolution ✅
- [x] Schema: add `proposedHomeScore`/`proposedAwayScore` (Int?) to `Fixture`
- [x] `lib/resolution.ts` — shared logic: transition SCHEDULED → AWAITING_RESULT (≥2.5 h past
      kickoff, all leagues) and fetch proposed scores — one football-data.org call per
      competition + date window, fuzzy-matched to all awaiting fixtures (incl. cross-league copies)
- [x] `POST /api/cron/resolve` secured by `Authorization: Bearer $CRON_SECRET`
- [x] Results UI: pre-fetched proposal shown ready to Accept; proposals cleared on confirm
- [x] Terraform: Cloud Scheduler job (every 30 min) + `CRON_SECRET` env var on Cloud Run
- [x] Commissioner's manual "Look Up Result" stays as fallback

## Phase 16 — Deadline reminder emails ✅
- [x] Reminder step in the cron route: for fixtures kicking off within 3 h, email each league
      member who hasn't predicted yet (one email per user per run, listing their open fixtures)
- [x] `Fixture.reminderSentAt` timestamp guards against duplicate sends
- [x] Send via Resend HTTP API using fetch (no new dependency); silently skipped unless
      `RESEND_API_KEY` + `EMAIL_FROM` are configured

## Phase 17 — Grand Slam transparency (BonusAward) ✅
- [x] Schema: `BonusAward` model — userId, leagueId, competition, round, points;
      unique on (userId, leagueId, competition, round)
- [x] `confirmResult` upserts/removes BonusAward rows instead of folding the bonus into one
      prediction's `pointsAwarded` (which becomes pure base points)
- [x] Leaderboard page, `/api/v1/leaderboard`, and dashboard totals = base points + bonuses;
      🏆 Grand Slam count shown on the leaderboard
- [x] Legacy baked-in bonuses (if any) self-correct when any fixture in the round is re-confirmed

## Phase 18 — Bot API documentation ✅
- [x] `/api-docs` page documenting `/api/v1/*`: auth header, endpoints, params, curl + Python examples
- [x] Link from the profile page next to the API key

## Phase 19 — My Predictions round breakdown ✅
- [x] Group prediction history by competition + round with per-round subtotals
- [x] Show Grand Slam bonuses per round; summary strip (total, best round, exact count)

## Phase 20 — Unit test coverage ✅
- [x] `vitest.config.ts` — `@/` path alias + node environment for mocked-module tests
- [x] `lib/footballData.test.ts` — fuzzy team matching, round selection/labels, API error paths (fetch mocked)
- [x] `lib/apiAuth.test.ts` — Bearer parsing and league resolution (Prisma mocked)
- [x] `lib/resolution.test.ts` — transition cutoff, one API call per competition, partial-failure handling
- [x] `lib/reminders.test.ts` — env gating, reminderSentAt claim, bot/predicted exclusion, one email per user
- [x] `lib/predictions.test.ts` — cross-league sync criteria and single-league fast path
- [x] `app/api/cron/resolve/route.test.ts` — 503/401/200 auth matrix
- [x] `app/api/v1/predictions/route.test.ts` — validation, membership 404, deadline 422, success shape
- [x] Total: 95 tests (was 25, scoring only). Still untested: server actions (confirmResult
      transaction, registration) and UI — integration-test territory needing a real database.

## Phase 21 — Member result requests + faster transitions ✅
- [x] `RESULT_DELAY_MS` reduced 2.5 h → 1 h 45 m (kickoff + full time + stoppage)
- [x] "Request result" button on kicked-off dashboard fixtures — any league member can
      trigger the transition + proposal fetch if the cron hasn't found a score yet
- [x] Proposed scores show on the dashboard as "⏳ awaiting confirmation" (Commissioner
      confirmation still required before anything is scored)
- [x] 8 unit tests for the `requestResult` action (auth, membership hiding, timing gate,
      transition, pending/found/error paths)

## Phase 22 — Forgot password / reset ✅
- [x] Schema: `PasswordResetToken` (userId, tokenHash unique, expiresAt, usedAt)
- [x] `lib/email.ts` — generic Resend send helper (throws if unconfigured, unlike the
      reminder sweep which silently skips)
- [x] `lib/passwordReset.ts` — `requestPasswordReset` (generic response regardless of
      whether the email exists, 5-min per-user cooldown to prevent spam/enumeration),
      `isResetTokenValid`, `resetPassword` (single-use, 1h expiry, invalidates all
      outstanding tokens for the user on success)
- [x] `/forgot-password` + `/reset-password/[token]` pages, "Forgot password?" link on
      the login form
- [x] 11 unit tests in `lib/passwordReset.test.ts`
- [x] `RESEND_API_KEY`/`EMAIL_FROM` are now effectively required (reset requests fail
      without them) rather than optional as they were for reminders

## Phase 23 — Platform-owned competitions ✅
- [x] Schema: new `Competition` (name unique, code?, flag, isActive) owning canonical
      fixtures; `League.competition` → `competitionId` FK; `Fixture` drops `leagueId` +
      `competition` for `competitionId` + `@@unique([competitionId, homeTeam, awayTeam,
      kickoffTime])`; `User.isSiteAdmin`; `BonusAward` drops `competition` column
- [x] Site-host role: `requireSiteAdmin()` (session + DB re-check), `SITE_ADMIN_EMAILS`
      synced in `auth.ts` authorize(), threaded through JWT/session, Header "Host" pill
- [x] `/host` area — competitions, fixtures, import, platform-wide results queue with
      **Accept All** (`lib/results.ts`); `/admin` slimmed to Settings only
- [x] Core libs: `lib/autoImport.ts` (sweep tops up active competitions), `lib/results.ts`
      (confirm once + Grand Slam fan-out per subscribing league), `lib/provisional.ts`,
      `lib/leaderboard.ts` (shared by page + API); `resolution`/`footballData`/`reminders`/
      `predictions`/`apiAuth` reworked to competition scope
- [x] Provisional scores/points shown on dashboard, My Predictions, leaderboard, and API
      (amber, read-time only); standings still rank by confirmed points
- [x] Automatic fixtures — leagues get fixtures/results with no admin action; league create
      flow picks an active competition; cron cadence 30min → 10min
- [x] Fresh-start migration (clears predictions/bonus/fixtures, seeds competitions, backfills
      `League.competitionId` by name); seed rewritten with `host@football.test`
- [x] 139 unit tests green; clean production build
