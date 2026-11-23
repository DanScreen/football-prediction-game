# Public Bot API

Automated models submit predictions the same way a human would via the UI. All
endpoints are under `/api/v1/` and authenticate with a Bearer API key (generated on
the profile page, stored as `User.apiKey`). The in-app reference with curl examples
and a Python starter bot lives at `/api-docs`.

> **Mobile apps** use a separate surface (`/api/mobile/v1`) with access/refresh tokens —
> not API keys. See [mobile.md](mobile.md). Do not overload this bot API for the phone
> clients.

> Keep this doc and `app/api-docs/page.tsx` in sync when endpoints or fields change.
> **Bot compatibility rule:** `competition` stays a **string** in responses, and
> `leaderboard.totalPoints` keeps meaning **confirmed** points — don't repurpose
> existing fields; add new ones.

## Auth

```
Authorization: Bearer <apiKey>
```

Missing/invalid key → `401`. All list endpoints accept `?leagueId=<id>` to scope to a
specific league you belong to (defaults to your oldest membership). Fixtures/predictions
are scoped to that league's **competition**.

## Endpoints

### `GET /api/v1/fixtures?status=open`
Fixtures for your league's competition, oldest first. Omit `status=open` to include
locked and completed fixtures. Each fixture: `id`, `competition` (name string),
`round`, `homeTeam`, `awayTeam`, `kickoffTime`, `status`, `actualHomeScore/away`
(when completed). Legacy `provisionalHomeScore/away` fields remain but are null under
auto-confirm.

### `POST /api/v1/predictions`
Body: `{ fixtureId, homeScore, awayScore, isBanker? }` — scores are non-negative
integers; `isBanker` is an optional boolean, and omitting it leaves your banker
untouched. Creates or updates your prediction. `422` once the fixture has kicked off,
or if the banker for that round is already locked on a match that has started. Because fixtures are shared
across every league on the competition, one pick counts everywhere you play.

### `GET /api/v1/predictions`
Your predictions with fixture details and actual scores. `isBanker` flags the
double-points pick for that round, and `pointsAwarded` includes the doubling once the
fixture is completed. `submittedVia` is where the pick was first made: `API` (this
API), `WEB` (the website) or `APP` (the native app — new on 2026-11-23; earlier app
picks read `API`). Legacy `provisionalPoints` / `provisional*` fields remain for
compatibility but are null under auto-confirm.

### `GET /api/v1/leaderboard`
Standings ranked by confirmed points. Per player: `rank`, `id`, `displayName`, `isBot`,
`totalPoints` (**confirmed**, incl. streak bonuses), legacy `provisionalPoints`,
`projectedPoints`, `exactCount`, `streakPoints` (total
bonus points earned, not a count of bonuses), and `pointsBreakdown`:
`{ result, close, exact, banker, streak }` — where the confirmed total came from. The
five sum to `totalPoints` exactly. `banker` is the *extra* the doubling produced, so a
bankered exact score contributes 3 to `exact` and 3 to `banker`. Delegates to the same
`computeLeaderboard()` the web leaderboard uses.

## Notes

- Predictions lock at kickoff; submit or update any time before then.
- One prediction per fixture; POSTing again overwrites the previous pick.
- One banker per gameweek per competition; setting a new one clears the old.
- Keep the API key secret — anyone holding it can submit picks as you.
