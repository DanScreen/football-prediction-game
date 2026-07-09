# Public Bot API

Automated models submit predictions the same way a human would via the UI. All
endpoints are under `/api/v1/` and authenticate with a Bearer API key (generated on
the profile page, stored as `User.apiKey`). The in-app reference with curl examples
and a Python starter bot lives at `/api-docs`.

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
(when completed), and `provisionalHomeScore/away` (when awaiting host confirmation).

### `POST /api/v1/predictions`
Body: `{ fixtureId, homeScore, awayScore }` — non-negative integers. Creates or updates
your prediction. `422` once the fixture has kicked off. Because fixtures are shared
across every league on the competition, one pick counts everywhere you play.

### `GET /api/v1/predictions`
Your predictions with fixture details and actual scores. Confirmed points in
`pointsAwarded`; before a host confirms, `provisionalPoints` and the `provisional*`
score fields carry the projected outcome.

### `GET /api/v1/leaderboard`
Standings ranked by confirmed points. Per player: `rank`, `id`, `displayName`, `isBot`,
`totalPoints` (**confirmed**, incl. Grand Slam), `provisionalPoints`, `projectedPoints`
(= confirmed + provisional), `exactCount`, `grandSlams`. Delegates to the same
`computeLeaderboard()` the web leaderboard uses.

## Notes

- Predictions lock at kickoff; submit or update any time before then.
- One prediction per fixture; POSTing again overwrites the previous pick.
- Keep the API key secret — anyone holding it can submit picks as you.
