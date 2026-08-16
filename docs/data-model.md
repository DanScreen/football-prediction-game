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
- Relations: `leagues[]`, `fixtures[]`.

### User
- `id`, `email` (unique), `passwordHash`, `displayName`, `createdAt`
- `isBot` — cosmetic flag (🤖 in the UI); bots are just users who use the API.
- `isSiteAdmin` — **site host**. Synced from the `SITE_ADMIN_EMAILS` env var on
  login (see `auth.ts`); gates the `/host` area.
- `apiKey` (unique) — Bearer token for the public API.
- Relations: `memberships[]`, `predictions[]`, `bonusAwards[]`, `resetTokens[]`.

### League
A group of players subscribed to one competition.
- `id`, `name`, `inviteCode` (unique), `createdAt`
- `competitionId` → **Competition** (FK). This is the subscription.
- `grandSlamEnabled` (bool), `grandSlamPoints` (int, default 3) — per-league bonus config.
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
- `pointsAwarded` (`Float?`) — **base** points only (bonuses live in BonusAward); null
  until the fixture is confirmed complete. Float because a correct-result-and-GD pick
  scores 1.5.
- `submittedVia`: `WEB` / `API` (`SubmitVia` enum).
- **Unique:** `(userId, fixtureId)` — exactly one prediction per user per fixture,
  editable until kickoff.

### BonusAward
A per-round bonus (currently only the Grand Slam), kept separate from
`Prediction.pointsAwarded` so base points stay pure and bonuses are visible.
- `id`, `userId`, `leagueId`, `round`, `points`, `createdAt`
- **Unique:** `(userId, leagueId, round)` — one bonus per user per league per round.
  (Round labels are unique within a competition, so this fully identifies a bonus.)

### PasswordResetToken
- `id`, `userId`, `tokenHash` (unique — **SHA-256 hash only**, the raw token lives
  only in the email link), `expiresAt`, `usedAt` (nullable), `createdAt`.

## Key invariants

- **One prediction per fixture, shared across leagues.** Because fixtures are
  canonical, a user's single prediction counts in every league they play on that
  competition. There is no cross-league copying (that mechanism was deleted in the
  competitions refactor — see [decisions.md](decisions.md)).
- **Provisional is never stored.** Provisional scores/points are computed at read
  time from `proposed*` scores (`lib/provisional.ts`). Standings rank by confirmed
  `pointsAwarded` + `BonusAward` only.
- **Score once, fan out bonuses.** Confirming a result (`lib/results.ts`) scores all
  predictions on the fixture once, then awards Grand Slam bonuses per subscribing
  league that has it enabled.
- **Active league** is a cookie (`activeLeagueId`), not a DB field.

## Migrations

Authored offline by diffing schemas, verified against the local Docker Postgres, and
applied by CI. See
[development.md](development.md#migrations) for the workflow and the destructive
competitions-refactor migration as a worked example.
