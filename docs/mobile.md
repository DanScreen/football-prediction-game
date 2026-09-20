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

#### `DELETE /api/mobile/v1/me`

Permanently deletes the caller's account and everything belonging to it, then
returns `204`. Required in-app by App Store guideline 5.1.1(v). Shares
`lib/accountDeletion.ts` with the web profile page; leagues survive unless the
leaver was the last member — see [decisions.md](decisions.md).

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
- For `status=open` only: capped at the **current gameweek and the next one** per
  competition (`VISIBLE_OPEN_ROUNDS`), matching the website Predictions tab. Locked and
  completed lists are unscoped so history still loads in full.

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

Fixtures on a competition a host has declared **finished** (`Competition.archivedAt`)
are excluded, exactly as they are on the web.

#### `GET /api/mobile/v1/bonuses`

The viewer's streak bonuses rolled up per competition + round:
`{ competitionId, round, points }[]`. A bonus is awarded per *league* while fixtures
are league-agnostic, so it can't ride inside the fixtures payload — the Results tab
fetches this alongside and folds it into each round subtotal, the way the web results
page does. Finished competitions are excluded.

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
Each entry also carries `competitionArchived: boolean` — true when a host has declared
the competition finished. Archived leagues stay in the list; the app files them under
a "Finished" heading and hides their invite code. Creating or joining a league on a
finished competition is rejected (`400` / `409`).

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
Leagues on a finished competition are omitted unless `?archived=1` is passed, mirroring
`/leaderboard?archived=1` on the web.

Each league block:

```json
{
  "leagueId": "...",
  "leagueName": "...",
  "competitionName": "...",
  "competitionArchived": false,
  "formRounds": ["Matchweek 34", "Matchweek 35"],
  "playedRounds": ["Matchweek 35", "Matchweek 34"],
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
      },
      "form": [{ "round": "Matchweek 34", "tier": "strong", "scored": 12 }]
    }
  ]
}
```

Delegates to `computeLeaderboard()` — same numbers as web and `/api/v1/leaderboard` —
and to `computeLeagueForm()` for the last-five-rounds form strip. `form` has one
cell per `formRounds` entry, in the same order (oldest → newest); `tier` is
`strong | mixed | poor | none`. Both the web leaderboard page and this route read
that one function, so a round cannot be graded differently on the two platforms.

Also: `GET /api/mobile/v1/leagues/:leagueId/leaderboard` for a single league (must be a member).

#### `GET /api/mobile/v1/leaderboards/round?leagueId=&round=`

One league's standings for a **single gameweek** — the Gameweek half of the
Leaderboard tab's Overall/Gameweek toggle. Both parameters are required (400
without them).

This endpoint exists **for the app only**. The web has the same feature (parity
is the rule — see [product.md](product.md)), but its leaderboard is a server
component, so it calls `computeLeaderboard(leagueId, { round })` directly and
keeps the selection in the URL rather than fetching over HTTP. Don't assume a
change here is needed for a web change to the gameweek view, or vice versa; the
one thing both must share is `lib/leaderboard.ts`.

`playedRounds` on the block above is the picker's range: every round of the
league's competition that has kicked off, **newest first**, ordered on each
round's *latest* kickoff so a round spanning a weekend does not sort ahead of one
that finished after it. Rounds that have not started are excluded — every pick is
still hidden and every score zero, so such a table would only invite players to
read a gameweek that has not happened.

Only the round *names* travel with `/leaderboards`; a round's table is fetched
here when the player opens it. Shipping every round's standings alongside the
overall table would multiply that payload by the length of the season to serve
one gameweek at a time.

Entries are shaped exactly like the ones in `/leaderboards`, except `form` is
always `[]` — form is a trend across rounds and means nothing inside one. Points
come from `computeLeaderboard(leagueId, { round })`: the same calculation as the
overall table with the predictions *and* the bonus awards filtered to that round,
so the two cannot disagree about what a point is worth.

Unlike `/leaderboards`, this takes a league id from the caller, so it checks
membership itself and returns **404** — not 403 — for a league the viewer is not
in, so the endpoint cannot be used to probe which league ids exist.

**Version skew.** The app and the server deploy independently, so a build can
always meet a server older than this endpoint. `playedRounds` is therefore
optional on the client: when it is missing the picker does not render at all and
the tab shows the overall table, rather than throwing on `undefined`. Any field
added to a mobile payload needs the same treatment — the app in someone's pocket
is not redeployed when Cloud Run is.

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
| `app/(tabs)/index` | Predictions — Open + Kicked off; scores auto-save |
| `app/(tabs)/results` | Settled fixtures with every league-mate's pick — flat sections, newest round first, per-round subtotal (mirrors web `/results`) |
| `app/(tabs)/leaderboard` | Stacked standings |
| `app/(tabs)/leagues` | List (live + finished) / create / join / share |
| `app/(tabs)/rules` | Scoring constants from API |
| `lib/api.ts` | Client with refresh |
| `lib/notifications.ts` | Expo push registration |

Run: `cd apps/mobile && npm start`. Typecheck: `npm run mobile:typecheck`.
See `apps/mobile/README.md`.

---

## Gotchas

**Scrolling screens use `screenPadding.scrollContent`, never `.pad`.** `pad` sets
`flex: 1`, which pins a ScrollView's content container to the viewport height —
the content cannot grow, so the screen silently stops scrolling past the first
screenful. `scrollContent` uses `flexGrow: 1`, which fills a short screen and
grows past a long one; it is right for every ScrollView, including short forms.
`pad` is for non-scrolling layouts only. This shipped as a bug on the Results tab
(2026-09-05) and is now enforced by `lib/mobileScreenPadding.test.ts`, which
lives in the root project because the mobile tsconfig has no Node types.

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

- Apple/Google developer accounts and the actual `eas build` / submit — [store-release.md](store-release.md)
- A production demo account for the App Store reviewer
- Decide iPad: produce a 13" screenshot set, or set `supportsTablet: false`
- Universal links / App Links for `https://scorersonline.uk/register?invite=` (optional; scheme works)

### Resolved earlier

- **Reconciled with `main`** (2026-09-04): the store-prep branch had forked before
  league-mate picks, autosave and the Predictions/Results tab split landed, so neither
  line was submittable alone. `FixtureCard` now carries `main`'s behaviour (autosave
  status slot, peer picks, banker gated on a saved prediction) inside the branch's
  scoreboard styling (accent edge, countdown, points badges, `★ ×2`). `results.tsx`
  regained its tab and now groups by round. Its `onSave` prop had not been updated when
  autosave landed, so the app did not typecheck on `main`.
- **Privacy policy reachable in-app** — linked from the Account screen and beneath the
  sign-up form, not only from the store listing.


- Access TTL **30m**, refresh TTL **30d**, DB-backed `MobileRefreshToken` with rotation.
- `forgot-password` on mobile API (website reset link).
- Fixtures returned **flat**; client groups in UI.
- Push device tokens + Expo reminders; invite deep link.
- **Account screen** (`app/account.tsx`) carrying sign-out and in-app account deletion.
  API-key management stays on the website. Reached from a person icon in the **top-right
  of the tab header** (2026-09-05) — it used to be a button at the bottom of the Leagues
  tab, which buried it under two forms and tied it to one tab.
- **Visual parity with the web** (2026-08-28): kickoff countdown, `★ ×2` banker tag,
  outcome accent borders, points badges, the "Nailed it!" moment, and a leaderboard
  with the board-panel header, podium ramp, breakdown chips, exact counts and the
  form strip.
