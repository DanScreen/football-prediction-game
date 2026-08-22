# Mobile apps

Plan and contract for the Scorers **iOS and Android** apps. Native apps were
previously out of scope (responsive web only); this doc is the source of truth for
how we reverse that and ship them.

**Status:** Phases 1–4 **shipped** in code (2026-08-16). Phase 5 is store
submission (accounts + EAS) — see [store-release.md](store-release.md).

---

## Goals

1. **Player loop on a phone** — predict, banker, see provisional/confirmed points,
   stacked leaderboards, join/create leagues. Same rules as the web.
2. **One codebase for Apple + Android** — Expo, TypeScript, shared with the web team's
   language and Cursor workflow.
3. **API-first** — the app talks to Scorers over HTTP; it does not wrap the website in
   a WebView.
4. **Do not break bots** — `/api/v1` stays the bot API (Bearer API key). Mobile gets a
   separate surface with password-based tokens.

## Non-goals (v1)

- Host (`/host`) and commissioner (`/admin`) — stay on the web.
- Bot API-key management as a primary flow (optional later on profile).
- Offline-first prediction queues, social feed, chips, Model Arena, etc.

---

## Stack & repo layout

| Piece | Choice |
|-------|--------|
| App framework | **Expo** (managed workflow), React Native, TypeScript |
| Navigation | Expo Router (file-based), tabs mirroring the web |
| Secure storage | Expo SecureStore for refresh tokens |
| Push (later) | Expo Notifications + device-token registration API |
| Stores | TestFlight + Google Play internal testing before public |

### Monorepo shape (target)

```
apps/
  web/       # Next.js site (today still at repo root — relocate when CI/deploy ready)
  mobile/    # Expo app
packages/    # optional later: shared Zod schemas / API types
docs/        # this wiki (unchanged)
```

**Near term:** keep the Next.js app at the **repo root** so Cloud Run, Terraform, and
GitHub Actions stay untouched. Add `apps/mobile/` when Phase 2 starts. Relocate web →
`apps/web` in a dedicated infra PR — do not block Phase 1 API work on that move.

### What the app reuses

- All scoring and domain logic stays on the **server** (`lib/scoring`, `lib/predictions`,
  `lib/leaderboard`, `lib/banker`, league create/join). The app never reimplements
  points rules.
- Design: Quiet Product tokens and scoreboard moments from
  [design-system.md](design-system.md), expressed as RN styles / theme constants — not
  a pixel-perfect port of every web component.

---

## Auth model (Phase 1)

Web auth today is NextAuth credentials + **httpOnly JWT cookies**. That does not fit
native clients. Bots use a long-lived **API key**. Mobile needs a third lane:

| Client | Auth |
|--------|------|
| Web UI | NextAuth session cookie (unchanged) |
| Bots | `Authorization: Bearer <apiKey>` on `/api/v1` (unchanged) |
| Mobile app | Access + refresh tokens on `/api/mobile/v1` |

### Token shape

- **Access token** — HS256 JWT, **30 minutes**, signed with `AUTH_SECRET` (fallback
  `NEXTAUTH_SECRET`). `Authorization: Bearer <accessToken>`. Claims: `sub` (user id),
  `typ: "access"`, `iat`, `exp`. Implemented in `lib/mobileAuth.ts`.
- **Refresh token** — opaque random string, **30 days**, stored as SHA-256 hash in
  `MobileRefreshToken`. Rotated on every `POST /auth/refresh`; revoked on logout.
- **Logout** — body `refreshToken` revokes that session; access token alone revokes
  **all** of the user's refresh tokens.

Passwords are checked with the same `passwordHash` path as web login. Registration
creates the same `User` row the web does (including generating an API key for bots —
unused by the app).

Do **not** ask mobile users to paste an API key.

### Public paths

`proxy.ts` allows the whole `/api/mobile` prefix through (same pattern as `/api/v1`).
Auth routes are unauthenticated; everything else requires a valid access JWT inside
the handler.

---

## Phase 1 — Mobile API surface (shipped)

Base path: **`/api/mobile/v1`**. Code under `app/api/mobile/v1/`; auth helpers in
`lib/mobileAuth.ts`.

All authenticated routes: `Authorization: Bearer <accessToken>` → `401` if missing/invalid.

Reuse existing domain helpers; thin route handlers. Response shapes match **web player UX**
(competition-scoped predictions, stacked league leaderboards).

Keep [api.md](api.md) for bots only.

### Auth

#### `POST /api/mobile/v1/auth/register`

Body:

```json
{
  "email": "string",
  "password": "string",
  "displayName": "string",
  "inviteCode": "string | optional"
}
```

- Same validation rules as web register.
- Optional `inviteCode`: join that league after create (same semantics as
  `/register?invite=CODE` — unrecognised code must not block account creation).
- Response `201`: `{ user, accessToken, refreshToken }` (same `user` shape as login).

#### `POST /api/mobile/v1/auth/login`

Body: `{ "email", "password" }`  
Response `200`: `{ user, accessToken, refreshToken }`  
`401` on bad credentials.

`user`: `{ id, email, displayName, isBot }` — no password hash, no API key.

#### `POST /api/mobile/v1/auth/refresh`

Body: `{ "refreshToken" }`  
Response `200`: `{ accessToken, refreshToken }` (rotated refresh)  
`401` if revoked/expired.

#### `POST /api/mobile/v1/auth/logout`

Auth: access token (or accept refresh in body). Revokes the refresh token.  
Response `204`.

#### `POST /api/mobile/v1/auth/forgot-password`

Body: `{ "email" }` — triggers the same Resend reset flow as the web. Always `204`
(no email enumeration). Reset link still opens the **website**; the app can deep-link
later.

### Session / profile

#### `GET /api/mobile/v1/me`

Response: `{ id, email, displayName, isBot }` plus membership summary if cheap:

```json
{
  "id": "...",
  "email": "...",
  "displayName": "...",
  "isBot": false,
  "leagues": [
    {
      "id": "...",
      "name": "...",
      "role": "MEMBER | COMMISSIONER",
      "competitionId": "...",
      "competitionName": "..."
    }
  ]
}
```

### Scoring constants (so the Rules screen stays accurate)

#### `GET /api/mobile/v1/rules`

Authenticated. Response mirrors scoring constants (not hardcoded in the app):

```json
{
  "exact": 3,
  "close": 1.5,
  "correctResult": 1,
  "bankerMultiplier": 2,
  "streakTiers": [
    { "minCorrect": 5, "points": 1 },
    { "minCorrect": 8, "points": 2 },
    { "minCorrect": 10, "points": 3 }
  ]
}
```

### Fixtures & predictions (competition-scoped, like the web)

A user may play multiple competitions via different leagues. Return **all** open (or
filtered) fixtures for competitions they belong to, grouped for the UI.

#### `GET /api/mobile/v1/fixtures?status=open`

- Flat list (client groups by competition/round). `status`: `open` | `locked` |
  `completed` | omit/`all`.
- Covers **all** competitions the user plays via any league membership.

Each fixture:

| Field | Notes |
|-------|--------|
| `id` | Fixture id |
| `competitionId`, `competitionName` | Prefer id + name (bots keep string-only `competition`) |
| `round` | Gameweek label |
| `homeTeam`, `awayTeam` | |
| `kickoffTime` | ISO |
| `status` | Same enum as DB / web |
| `actualHomeScore`, `actualAwayScore` | When completed |
| `provisionalHomeScore`, `provisionalAwayScore` | When awaiting host confirm |
| `prediction` | Optional nested current pick: `{ userId, displayName, isBot, homeScore, awayScore, isBanker, pointsAwarded, provisionalPoints }` |
| `peerPredictions` | League-mate picks on this fixture — **empty before kickoff**, populated once the fixture has kicked off (same peer filter as the web). Sorted with the viewer first, then alphabetical. |

#### `POST /api/mobile/v1/predictions`

Body: `{ "fixtureId", "homeScore", "awayScore", "isBanker?" }`  
Same rules as web / bot: lock at kickoff; banker one per round per competition;
omitting `isBanker` leaves banker unchanged.  
Response: the saved prediction (+ fixture summary). `422` when locked.

#### `GET /api/mobile/v1/predictions`

Optional `?competitionId=` filter. Returns the user's picks with fixture details and
confirmed / provisional points (same semantics as the bot predictions list).

### Leagues & leaderboards

#### `GET /api/mobile/v1/leagues`

Memberships for the current user (name, invite code for sharing, competition, role).

#### `POST /api/mobile/v1/leagues`

Body: `{ "name", "competitionId" }` — create league, caller becomes commissioner.
Response includes `inviteCode`.

#### `POST /api/mobile/v1/leagues/join`

Body: `{ "inviteCode" }` — normalised like the web.  
`404` if unknown; **`409`** if already a member.

#### `GET /api/mobile/v1/competitions`

Active competitions available when creating a league: `{ id, name }[]`.

#### `GET /api/mobile/v1/leaderboards`

**Stacked** standings for every league the user is in (matches web leaderboard page).

Each league block:

```json
{
  "leagueId": "...",
  "leagueName": "...",
  "competitionName": "...",
  "standings": [
    {
      "rank": 1,
      "id": "...",
      "displayName": "...",
      "isBot": false,
      "totalPoints": 0,
      "provisionalPoints": 0,
      "projectedPoints": 0,
      "exactCount": 0,
      "streakPoints": 0,
      "pointsBreakdown": {
        "result": 0,
        "close": 0,
        "exact": 0,
        "banker": 0,
        "streak": 0
      }
    }
  ]
}
```

Delegate to `computeLeaderboard()` — same numbers as web and `/api/v1/leaderboard`.

Also: `GET /api/mobile/v1/leagues/:leagueId/leaderboard` for a single league (must be a member).

### Errors

Consistent JSON: `{ "error": "human-readable message" }` with appropriate HTTP status
(`400` validation, `401` auth, `404`, `409`, `422` business rule / locked fixture).

### Out of Phase 1 originally — now shipped in Phase 4

- Device push token registration (`POST/DELETE /api/mobile/v1/devices`)
- Deadline reminders also send Expo push (alongside email)
- Invite deep link `scorers://join?code=`

Still out of native scope: host/commissioner endpoints; API-key management in-app.
---

## Later phases (app)

| Phase | Work |
|-------|------|
| **1 — Mobile API** | ✅ |
| **2 — Expo skeleton** | ✅ |
| **3 — Player features** | ✅ Predictions + banker, leaderboards, create/join/share |
| **4 — Store polish** | ✅ Push tokens + reminders, deep links, empty/error states, EAS config |
| **5 — Store release** | ⏳ Accounts + submit — [store-release.md](store-release.md) |

### App layout (`apps/mobile`)

| Path | Role |
|------|------|
| `app/(auth)/login\|register` | Auth (+ forgot password via API) |
| `app/join` | Deep-link join (`scorers://join?code=`) |
| `app/(tabs)/index` | Predictions — Open + Kicked off |
| `app/(tabs)/results` | Settled fixtures with every league-mate's pick |
| `app/(tabs)/leaderboard` | Stacked standings |
| `app/(tabs)/leagues` | List / create / join / share |
| `app/(tabs)/rules` | Scoring constants from API |
| `lib/api.ts` | Client with refresh |
| `lib/notifications.ts` | Expo push registration |

Run: `cd apps/mobile && npm start`. Typecheck: `npm run mobile:typecheck`.
See `apps/mobile/README.md`.

---

## Working agreement (Cursor)

1. **Phase 1 before UI** — mobile API + tests green on the existing Next server; then scaffold Expo.
2. **Web quality bar unchanged** — `npm run build` and `npx vitest run` still gate the
   server. Add Expo typecheck/tests when `apps/mobile` exists.
3. **Docs** — update this file when the contract changes; update [state.md](state.md) /
   [changelog.md](changelog.md) when something ships; [api.md](api.md) stays bot-only
   unless we add a one-line pointer.
4. **No WebView shell** — if we ever ship a Capacitor experiment, it is a separate
   decision entry, not a substitute for this plan.

---

## Open items (Phase 5)

- Apple/Google developer accounts + EAS `projectId` — [store-release.md](store-release.md)
- Universal links / App Links for `https://scorersonline.uk/register?invite=` (optional; scheme works)

### Resolved earlier

- Access TTL **30m**, refresh TTL **30d**, DB-backed `MobileRefreshToken` with rotation.
- `forgot-password` on mobile API (website reset link).
- Fixtures returned **flat**; client groups in UI.
- Push device tokens + Expo reminders; invite deep link.
