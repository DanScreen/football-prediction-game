# Architecture

How the system fits together and where to find things in the code.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 (tokens in `app/globals.css`) |
| Database | PostgreSQL via Prisma 7 (Cloud SQL in prod) |
| Auth | NextAuth.js v5 beta — credentials provider, JWT (stateless) sessions |
| Fixtures & results | football-data.org v4 REST API (free tier: Premier League + World Cup) |
| Email | Resend (deadline reminders + password reset) |
| Hosting | GCP Cloud Run + Cloud SQL (europe-west2) |
| Infra | Terraform (`terraform/`) |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) |
| Domain | Cloudflare Worker proxy → Cloud Run (`cloudflare/worker.js`) |
| Mobile | Expo app in `apps/mobile/` (Phases 1–4) — [mobile.md](mobile.md); store submit [store-release.md](store-release.md) |

> **Next.js 16 caveat:** this is a newer Next.js than most training data. APIs and
> conventions may differ — check `node_modules/next/dist/docs/` when unsure. Notably,
> route middleware lives in **`proxy.ts`** (not `middleware.ts`).

## The hub-and-spoke domain model

The defining architectural choice: **competitions are platform-owned and own the
canonical fixtures; leagues subscribe to a competition and share its fixtures.**

```
Competition ──owns──▶ Fixture ──has──▶ Prediction (one per user per fixture)
     ▲                                      
     │ subscribes                           
   League ──has──▶ LeagueMembership ──▶ User
     │
     └──has──▶ BonusAward (streak bonus, per league)
```

Because a fixture is shared across every league on its competition, a user has
exactly **one prediction per fixture** that counts in all their leagues on that
competition. Results are confirmed once (scoring all predictions globally); only the
streak bonus fans out per subscribing league. Full schema in
[data-model.md](data-model.md).

## Request/permission flow

- **Public pages** (login, register, forgot/reset password, API) are allowlisted in
  `proxy.ts` via `PUBLIC_PATHS`. Everything else redirects to `/login`.
- **Active league** is stored in an `httpOnly` cookie `activeLeagueId` (not in the
  URL), read via `lib/activeLeague.ts`. A user can belong to several leagues and
  switch between them.
- **Two authorization gates:**
  - `requireSiteAdmin()` (`lib/adminAuth.ts`) — session + a fresh DB re-check of
    `User.isSiteAdmin`, so host access can be revoked immediately. Gates `/host`.
  - `requireCommissioner()` (`lib/adminAuth.ts`) — checks the active league
    membership role is `COMMISSIONER`. Gates `/admin`.
  - `authenticateApiKey()` (`lib/apiAuth.ts`) — Bearer API key → user, for `/api/v1`.

## Code map

### Routes (`app/`)

| Path | Purpose |
|------|---------|
| `app/page.tsx` | **Predictions** — open fixtures (with inputs), kicked-off picks, settled results |
| `app/PredictionHistory.tsx` | Settled picks grouped by competition + round |
| `app/FixtureRoundGroup.tsx` | Collapsible gameweek section + `groupByRound()`, shared by Open and Kicked Off |
| `app/predictions/` | `actions.ts` (the prediction server action) + a permanent redirect to `/` |
| `app/leaderboard/` | Standings table + form strip |
| `app/leagues/` | Create/join/switch leagues; competition picker |
| `app/profile/` | API key management |
| `app/host/` | **Site-host area** (isSiteAdmin): competitions, fixtures, import, results |
| `app/admin/` | **League commissioner area**: settings only |
| `app/api/v1/` | Public bot API (fixtures, predictions, leaderboard) |
| `app/api/mobile/v1/` | Native-app API (access/refresh auth + player endpoints) — [mobile.md](mobile.md) |
| `app/api/cron/resolve/` | Cron entry point (sweep + reminders) |
| `app/api/auth/[...nextauth]/` | NextAuth handler |
| `app/api-docs/` | In-app API reference for bot authors |
| `app/rules/` | **How it works** — the rules of the game. Public; personalised per league when signed in |
| `app/error.tsx`, `app/not-found.tsx` | Error boundary (logs rather than renders the message) and 404 |
| `app/login`, `app/register`, `app/forgot-password`, `app/reset-password/[token]` | Auth pages |

### Domain logic (`lib/`)

| File | Responsibility |
|------|----------------|
| `lib/scoring.ts` | Pure scoring: `scoreOnePrediction`, `awardedPoints` (banker multiplier), `streakPoints` (bonus tiers) |
| `lib/results.ts` | `confirmFixtureResult` (score once + streak-bonus fan-out), `acceptAllProposed` |
| `lib/provisional.ts` | Read-time provisional score/points helpers (never stored) |
| `lib/leaderboard.ts` | `computeLeaderboard` (+ the per-player points breakdown) — shared by the leaderboard page **and** the API |
| `lib/resolution.ts` | The cron sweep: transitions, proposal fetch, `runResolutionSweep` |
| `lib/autoImport.ts` | Auto-import upcoming fixtures for active competitions |
| `lib/footballData.ts` | football-data.org client (fetch fixtures, look up results) |
| `lib/predictions.ts` | `upsertPrediction` (one canonical prediction per fixture) |
| `lib/banker.ts` | `setBanker` — one double-points pick per (user, competition, round) |
| `lib/reminders.ts` | Deadline reminder email fan-out |
| `lib/passwordReset.ts` / `lib/email.ts` | Password reset flow + Resend send helper |
| `lib/adminAuth.ts` | `requireSiteAdmin` / `requireCommissioner` |
| `lib/apiAuth.ts` | API-key auth + league/competition resolution |
| `lib/mobileAuth.ts` | Mobile access JWT + refresh-token issue/rotate/revoke |
| `lib/mobileHttp.ts` | Shared JSON error/body helpers for `/api/mobile/v1` |
| `lib/activeLeague.ts` | Active-league cookie read/write |
| `lib/inviteCode.ts` | Invite-code generation/normalisation + invite-link URL builder |
| `lib/theme.ts` / `lib/theme.server.ts` | Theme constants (client-safe) and the cookie read. **Kept separate on purpose** — merging them breaks the build |
| `lib/prisma.ts` | Prisma client (Prisma 7 needs an explicit pg adapter) |

### Other

- `prisma/schema.prisma` — the schema. Client is generated to
  `app/generated/prisma/client` (import from there, **not** `@prisma/client`).
- `prisma/migrations/` — SQL migrations, applied by CI.
- `prisma/seed.ts` — local/dev seed (competitions, host + members, fixtures).
- `terraform/` — GCP infra. `cloudflare/worker.js` — the domain proxy.
- `auth.ts` / `auth.config.ts` — NextAuth config; `auth.ts` syncs `isSiteAdmin` from
  `SITE_ADMIN_EMAILS` on login.

## The automated sweep

`POST /api/cron/resolve` (Bearer `CRON_SECRET`) runs every 10 minutes and calls
`runResolutionSweep()` + `sendDeadlineReminders()`:

1. **Auto-import** upcoming fixtures for active competitions with a code and ≥1
   subscribed league (`autoImportFixtures`, deduped by the canonical unique key).
2. **Transition** fixtures ≥1h45m past kickoff to `AWAITING_RESULT`.
3. **Fetch proposals** — one API call per competition/date window, storing proposed
   scores (shown as provisional; not yet scored).
4. **Reminders** — email members with unpredicted fixtures kicking off within 3h.

Nothing is scored here — a host confirms results from `/host/results`. See
[features.md](features.md#result-resolution).
