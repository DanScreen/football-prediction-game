# Features

How each part of the app behaves, from the user's side and the code's. **Update this
when behaviour changes.** For the public bot API see [api.md](api.md).

## Roles

| Role | Flag/check | Can do |
|------|-----------|--------|
| Player | any member | Predict, view leaderboard, use the API |
| League commissioner | `LeagueMembership.role = COMMISSIONER` | Manage league settings at `/admin` |
| Site host | `User.isSiteAdmin` | Own competitions/fixtures/results at `/host` |

Site hosts are bootstrapped from the `SITE_ADMIN_EMAILS` env var (comma-separated,
case-insensitive), synced to the DB on login. `requireSiteAdmin()` re-checks the DB
per request so access can be revoked immediately.

## Leagues (`/leagues`)

Users sign up without a league, then **create** one or **join** with an invite code.
Creating a league means picking one of the **active competitions** — no fixtures to
import. A user can belong to multiple leagues; the active one is a cookie and is
switched from this page.

## Dashboard (`/page.tsx`)

- **Upcoming fixtures** with a countdown to kickoff and a score input each.
- **Kicked-off fixtures** — predictions lock at kickoff and everyone's picks reveal.
  If a proposed score exists, the fixture shows the **provisional** scoreline and each
  pick's provisional points (amber `+X prov.`), plus an "awaiting confirmation" note.
- **Performance tiles** — rank, points (with `+X prov.` sub-label), exact count.
- Fixtures are queried by the active league's `competitionId`; predictions are scoped
  to league members so you see your league-mates' picks.
- If no score has been fetched yet, a member can press **Request result** on a
  kicked-off fixture to trigger the lookup early.

## My Predictions (`/predictions`)

Full history grouped by round, newest first. Per round: subtotal, exact count, Grand
Slam bonus. Per pick: your score, the result (or provisional score, amber), and points
(confirmed `PointsBadge`, or provisional amber badge). Round subtotals show provisional
separately until confirmed.

## Leaderboard (`/leaderboard`)

Standings ranked by **confirmed** points (ties share a rank). Built on
`computeLeaderboard()` (shared with the API). Shows exact-score count, Grand Slam
badges (🏆), a per-player **form strip** (last 5 completed rounds, colour-coded by
points ratio), and a `+X` provisional chip per row. Provisional never changes rank.

## Host area (`/host`) — site hosts only

| Page | Purpose |
|------|---------|
| `/host/competitions` | Create/edit competitions (name, football-data code, flag, active). No delete. |
| `/host/fixtures` | Add/edit/delete canonical fixtures for a competition. |
| `/host/import` | Manually import upcoming fixtures from football-data.org (1–3 rounds). Override for the auto-import. |
| `/host/results` | **Platform-wide** queue of fixtures awaiting a result, with pre-fetched scores. Accept, edit, retry, or **Accept All**. |

## League admin (`/admin`) — commissioners only

Slimmed to `/admin/settings` only: rename league, Grand Slam toggle + points, invite
code management. Fixtures and results are handled by hosts, so there's nothing else here.

## Fixture import (automatic + manual)

- **Automatic:** the cron sweep tops up the next couple of rounds for every active
  competition that has a `code` and ≥1 subscribed league (`lib/autoImport.ts`),
  deduped by the canonical `(competitionId, homeTeam, awayTeam, kickoffTime)` key.
- **Manual:** hosts can import on demand from `/host/import`.
- **Undecided teams are skipped.** Knockout fixtures whose teams aren't known yet
  (e.g. World Cup semi-finals) come back from football-data.org with null team names;
  `fetchUpcomingFixtures` drops any fixture missing a team so they don't violate the
  `Fixture.homeTeam` NOT NULL constraint. (This once 500'd the whole sweep — see
  [changelog.md](changelog.md).)

## Result resolution

Results flow through a **confirm-before-save** pipeline, with provisional scores shown
in the meantime:

1. **Sweep** (`POST /api/cron/resolve`, every 10 min) moves fixtures ≥1h45m past
   kickoff to `AWAITING_RESULT` and pre-fetches the final score from football-data.org
   (one API call per competition/date window, fuzzy-matched by team name).
2. **Provisional everywhere** — once `proposed*` scores exist, the projected scoreline
   and points show (amber) across dashboard, My Predictions, leaderboard, and API,
   until a host confirms. Computed at read time (`lib/provisional.ts`); never stored;
   standings still rank by confirmed points.
3. **Host confirms** at `/host/results` — a platform-wide queue with **Accept All**.
   `confirmFixtureResult()` (`lib/results.ts`) saves the scores + `COMPLETED`, scores
   every prediction on the fixture once, then fans out Grand Slam bonuses per
   subscribing league that has it enabled. Nothing scores without host sign-off — the
   human check keeps bad data (postponements, ambiguous names) off the leaderboard.
4. **Fallbacks** — members can Request result from the dashboard; hosts have a "Check
   for Updates" button (runs the sweep on demand); manual entry and per-fixture API
   lookup always work.

## Scoring

Pure function `scoreOnePrediction` in `lib/scoring.ts`:

| Outcome | Points |
|---|---|
| Exact score | 3 |
| Correct result (W/D/L) **and** goal difference, not exact | 1.5 |
| Correct result only | 1 |
| Wrong result | 0 |

**Grand Slam bonus** (optional, per league): if a user gets the *result* of every
fixture in a round right, they earn a bonus (default 3, configurable 1–20). Off by
default. Awarded once the whole round is confirmed, stored as a `BonusAward` row
(never folded into a prediction's points), shown as 🏆 on the leaderboard.

## Deadline reminder emails

The cron sweep emails league members who haven't predicted a fixture kicking off within
the next 3 hours — one email per user listing their open fixtures (via Resend). A
multi-league user gets a single deduped email. Each fixture triggers one batch only
(`reminderSentAt` guard). Silently skipped if `RESEND_API_KEY`/`EMAIL_FROM` are unset.

## Forgot password / reset

`/forgot-password` → submitting an email always shows the same generic confirmation
(no account enumeration); if the email matches, a single-use link valid 1 hour is sent.
`/reset-password/[token]` validates server-side before showing the form. Setting a new
password invalidates all the user's other outstanding tokens. Only the SHA-256 hash of
the token is stored. There's a 5-minute per-user cooldown. Unlike reminders, this flow
**requires** Resend to be configured (account recovery isn't optional) and errors if
it isn't. See `lib/passwordReset.ts`.
