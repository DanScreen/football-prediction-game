# Data Model

The source of truth is `prisma/schema.prisma`. This doc explains the models, their
relationships, and the invariants that matter. **Update it whenever the schema
changes** (and record the migration in [changelog.md](changelog.md)).

> Prisma 7 note: the client is generated to `app/generated/prisma` — import from
> `@/app/generated/prisma/client`, not `@prisma/client`. Prisma 7 also requires an
> explicit `pg` adapter (see `lib/prisma.ts`). Run `npx prisma generate` after
> schema edits.

## Models

### Competition
Platform-owned. Owns the canonical fixtures that leagues share.
- `id`, `name` (unique), `flag`, `createdAt`
- `code` (nullable) — football-data.org code (`"PL"`, `"WC"`). **Null = manual-only**
  competition (no auto-import / result lookup).
- `isActive` — included in auto-import and selectable at league creation.
- `archivedAt` (nullable) — set when a host declares the competition **finished**
  (checkbox on `/host/competitions`). Archived competitions keep every fixture,
  prediction and standing, but drop out of the player-facing core pages (predict /
  results / leaderboard, web and app), out of auto-import, and out of the reminder
  sweep. Their leagues move to a "Finished leagues" section on `/leagues` and stay
  readable via `/leaderboard?archived=1`. Distinct from `isActive`, which only says
  whether new leagues may subscribe — a season can be closed to new leagues while
  still being played. Migration: `20260905000000_competition_archived_at`.
- Relations: `leagues[]`, `fixtures[]`.

### User
- `id`, `email` (unique), `passwordHash`, `displayName`, `createdAt`
- `isBot` — cosmetic flag (🤖 in the UI); bots are just users who use the API.
- `isSiteAdmin` — **site host**. Synced from the `SITE_ADMIN_EMAILS` env var on
  login (see `auth.ts`); gates the `/host` area.
- `apiKey` (unique) — Bearer token for the public API.
- Relations: `memberships[]`, `predictions[]`, `bonusAwards[]`, `resetTokens[]`,
  `mobileRefreshTokens[]`, `mobileDeviceTokens[]`.

### League
A group of players subscribed to one competition.
- `id`, `name`, `inviteCode` (unique), `createdAt`
- `competitionId` → **Competition** (FK). This is the subscription.
- Relations: `competition`, `memberships[]`, `bonusAwards[]`.

### LeagueMembership
- `userId` + `leagueId` (unique together), `role` (`COMMISSIONER` / `MEMBER`), `joinedAt`.

### Fixture
A real-world match. **Canonical per competition** — shared by every subscribed league.
- `id`, `competitionId` → **Competition** (FK), `round`, `homeTeam`, `awayTeam`, `kickoffTime`
- `status`: `SCHEDULED` → `AWAITING_RESULT` → `COMPLETED` (`FixtureStatus` enum)
- `actualHomeScore` / `actualAwayScore` (nullable until completed)
- `proposedHomeScore` / `proposedAwayScore` (nullable) — pre-fetched by the sweep,
  shown as **provisional** until a host confirms. Never a substitute for actual scores.
- `reminderSentAt` (nullable) — guard so each fixture triggers one reminder batch.
- `resultSource`: `MANUAL` / `AI_CONFIRMED` (`ResultSource` enum, nullable until completed).
- **Unique:** `(competitionId, homeTeam, awayTeam, kickoffTime)` — the canonical
  dedupe key that makes `createMany({ skipDuplicates: true })` safe for re-imports.
- Relations: `competition`, `predictions[]`.

### Prediction
One user's pick for one canonical fixture.
- `id`, `userId`, `fixtureId`, `predictedHomeScore`, `predictedAwayScore`
- `isBanker` (`Boolean`, default false) — the user's double-points pick for this
  fixture's round. At most one per `(user, competition, round)`; the round lives on
  Fixture, so this **cannot be a unique index** and is enforced transactionally in
  `setBanker()` (`lib/banker.ts`).
- `pointsAwarded` (`Float?`) — points as they count: base score × the banker
  multiplier. Streak bonuses are *not* folded in (they live in BonusAward). Null
  until the fixture is confirmed complete. Float because a close pick scores 1.5.
- `submittedVia`: `WEB` / `API` (`SubmitVia` enum).
- **Unique:** `(userId, fixtureId)` — exactly one prediction per user per fixture,
  editable until kickoff.

### BonusAward
A per-round bonus (currently only the streak bonus), kept separate from
`Prediction.pointsAwarded` so base points stay pure and bonuses are visible.
- `id`, `userId`, `leagueId`, `round`, `points`, `createdAt`
- **Unique:** `(userId, leagueId, round)` — one bonus per user per league per round.
  (Round labels are unique within a competition, so this fully identifies a bonus.)

### PasswordResetToken
- `id`, `userId`, `tokenHash` (unique — **SHA-256 hash only**, the raw token lives
  only in the email link), `expiresAt`, `usedAt` (nullable), `createdAt`.

### MobileDeviceToken
Expo push tokens for deadline reminders. Migration
`20260816230000_add_mobile_device_token`.
- `id`, `userId`, `expoPushToken` (unique), `platform` (nullable), `createdAt`, `updatedAt`.
- Upserted by `POST /api/mobile/v1/devices`; used by `sendDeadlineReminders`.

## Key invariants

- **One prediction per fixture, shared across leagues.** Because fixtures are
  canonical, a user's single prediction counts in every league they play on that
  competition. There is no cross-league copying (that mechanism was deleted in the
  competitions refactor — see [decisions.md](decisions.md)).
- **Provisional is never stored.** Provisional scores/points are computed at read
  time from `proposed*` scores (`lib/provisional.ts`). Standings rank by confirmed
  `pointsAwarded` + `BonusAward` only.
- **The banker doubles globally, not per league.** `pointsAwarded` is competition-wide
  (one prediction, scored once, counting in every league on that competition), so a
  doubling can't apply in one league and not another — unlike a BonusAward, banker
  can't be a per-league toggle. See [decisions.md](decisions.md).
- **Score once, fan out bonuses.** Confirming a result (`lib/results.ts`) scores all
  predictions on the fixture once, then awards streak bonuses per subscribing league.
  The bonus is identical everywhere; it's stored per league because membership is.
- **Active league** is a cookie (`activeLeagueId`), not a DB field.

## Migrations

Authored offline by diffing schemas, verified against the local Docker Postgres, and
applied by CI. See
[development.md](development.md#migrations) for the workflow and the destructive
competitions-refactor migration as a worked example.
