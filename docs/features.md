# Features

How each part of the app behaves, from the user's side and the code's. **Update this
when behaviour changes.** For the public bot API see [api.md](api.md).

## Navigation & shell

**Four destinations, one job each:** Predictions (`/`), Leaderboard, My Leagues, Rules —
plus Admin/Host chips when the user holds those roles. Dashboard and My Predictions merged on
2026-08-16; they duplicated the same picks and results either side of kickoff.
`/predictions` is a permanent redirect to `/` so old links still land.

- **Desktop (≥640px):** top-bar links.
- **Mobile (<640px):** a fixed **bottom tab bar** (`app/components/MobileNav.tsx`) with
  the same destinations. The top-bar nav is hidden at this width, so before this existed
  there was no way to reach any page but the dashboard. Both share their link list and
  active-state logic from `NavLinks.tsx`. Profile stays reachable via the header name.
- **Loading states:** `loading.tsx` skeletons for the predictions and leaderboard
  pages — these matter because Cloud Run runs at `--min-instances 0`, so a
  cold start is a visible wait.
- **Errors:** `app/error.tsx` (retry + dashboard link; the error text is logged, not
  rendered, since it can carry connection strings) and `app/not-found.tsx`.
- **Theme toggle:** cycles System → Light → Dark, in the header on every page including
  the auth pages. See [design-system.md](design-system.md#dark-theme).
- **How it works (`/rules`):** a nav tab (desktop and mobile), plus links under the
  Predictions page and on the register page. Signed-out visitors get a "How it works"
  link in the header instead, since there is no nav for them.

### League scoping (and why most pages ignore it)

A `Prediction` is unique per `(userId, fixtureId)` — there is **no `leagueId`** on it. One
pick counts in every league you have on that competition. So leagues only decide *whose*
picks appear beside yours and who you're ranked against:

| Surface | Scoped by | Why |
|---|---|---|
| Predictions (`/`) | **Competition** | Per-league would render the same fixtures and the same inputs once per league |
| Leaderboard | **League** — all of them, stacked | Standings are genuinely per-league; stacking removes the need to switch |
| `/admin` | **League**, explicitly chosen | Managing settings is a deliberate act on one league |

The `activeLeagueId` cookie therefore now only drives `/admin`.
`lib/activeLeague.ts` resolves it per request:

- `resolveActiveLeagueId(userId)` — cookie if the membership is still valid, else the
  earliest-joined league, else `null` (genuinely no leagues).
- `resolveCommissionerLeagueId(userId)` — same, but **filtered to `COMMISSIONER`**. This
  matters: a user can be a plain member of the league they joined first and commissioner
  of another, and the unfiltered resolver would bounce them straight out of `/admin`.

Neither writes the cookie back — Server Components can't set cookies during render. It's
still written by the explicit "Manage" action on `/leagues`.

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
import. A user can belong to multiple leagues — predictions and leaderboards cover all
of them at once, so there is nothing to "switch" as a player. Commissioners use the
**Manage** action here to pick which league `/admin` edits.

### Invites

Two ways in, for the two situations:

| | For | Where it's used |
|---|---|---|
| **Invite link** `/register?invite=CODE` | Someone with **no account** | Creates the account *and* joins the league in one step |
| **Invite code** (6 chars) | Someone who **already has an account** | The "Join a league" form on `/leagues` |

Any member can share either from `/leagues`; commissioners also get them on
`/admin/settings`. The URL is built client-side from `window.location.origin`
(`CopyInvite.tsx`), so it's right on the live domain, the run.app URL and localhost
without an env var.

**Sign-up itself is open and has no invite field.** The code rides in a hidden input
populated by the link. Consequences that are deliberate:

- An **unrecognised code never blocks registration** — the user can't see or correct a
  code that came from a link, so they get an account and a prompt to join later.
- Codes are normalised with `normaliseInviteCode()` (trim + uppercase) at **both** entry
  points. They used to diverge, so a lowercase code was rejected at sign-up but accepted
  when joining.

## Predictions (`/`)

The single home for a player's picks, scoped by **competition** (see League scoping
above). Three sections, top to bottom:

- **Open** — upcoming fixtures with a countdown and a score input each, **grouped into
  gameweeks** (`FixtureRoundGroup.tsx`). Cards carry an amber left edge when unpredicted,
  green when predicted.
  Only the nearest round that still needs picks is expanded; later rounds collapse to a
  one-line summary with a "N to predict" badge. A full Premier League round is 10
  fixtures and several rounds import at once, so a flat list ran past 20 cards.
  Built on native `<details>` — no client JS, keyboard accessible. Each card carries a
  **☆ Banker** toggle (double points, one per gameweek — see Scoring), and the gameweek
  header names the banker or says "no banker yet", since it's a per-round decision you'd
  otherwise have to expand and scan for.
- **Kicked Off** — grouped into gameweeks the same way (most recent expanded).
  Predictions lock at kickoff and everyone's picks reveal. If a
  proposed score exists the fixture shows the **provisional** scoreline and each pick's
  provisional points (amber `+X prov.`), plus an "awaiting confirmation" note. A
  bankered pick is tagged ★ ×2 and its points already include the double. A member
  can press **Request result** to trigger the lookup early.
- **Results** — settled picks grouped by competition and round, newest first, with the
  round subtotal and any streak bonus.

Above them, when picks are outstanding: an amber nudge with the count and the next
deadline. It counts only the **next gameweek needing picks in each competition**, not
everything open — fixtures import a couple of rounds ahead, so counting all of them read
"20 fixtures still to predict" for deadlines a fortnight out. Later rounds are covered by
their own gameweek badge. Standing totals (points, exact count, rank) are deliberately *not* here — they
belong to the Leaderboard, where they can be read per league and against other people.

Whose picks show under Kicked Off: everyone who shares a league with you **on that
competition**. A league-mate on the World Cup doesn't surface on your Premier League
fixtures.

## How it works (`/rules`)

The rules in one page: making a prediction and the kickoff deadline, the points table,
banker, the streak bonus, provisional results, the leaderboard, leagues, and a pointer
to the bot API.

**Public** (in `PUBLIC_PATHS`) so someone following an invite link can read what they're
joining before creating an account — signed out it ends on a "Create an account" CTA
instead.

Every rule on it is platform-wide, so the page reads its numbers from `STREAK_TIERS`,
`BANKER_MULTIPLIER` and `RESULT_DELAY_MS` rather than restating them in prose. It was
briefly personalised per league, because Grand Slam was a per-league setting; the streak
bonus that replaced it is the same everywhere, so that came back out.

## Leaderboard (`/leaderboard`)

Standings ranked by **confirmed** points (ties share a rank). Built on
`computeLeaderboard()` (shared with the API). Shows a **points breakdown** per player, a
per-player **form strip** (last 5 completed rounds, oldest → newest) and
a `+X` provisional chip per row. Provisional never changes rank.

**Points breakdown.** Every row accounts for itself: **Result** (1-pointers), **Close**
(1.5s — right result, scoreline within one goal), **Exact** (3s), **★** (the extra the banker
doubling produced) and **🔥** (streak bonuses). The five always sum to the player's
total, which is why they're derived by splitting the *stored* `pointsAwarded` rather than
recomputing from scorelines — a parallel recomputation could drift from the total.
Banker is counted as the extra only, so a bankered exact reads as 3 exact + 3 banker
rather than 6 in a column claiming to mean "exact scores".

Five extra numeric columns would force a phone to scroll the table sideways, so below
`md` they collapse into a wrapping chip line under the player's name showing only the
non-zero parts. The ★ and 🔥 headers carry `sr-only` labels, since an emoji alone
announces nothing useful.

Each form cell is **dual-encoded**## Host area (`/host`) — site hosts only

| Page | Purpose |
|------|---------|
| `/host/competitions` | Create/edit competitions (name, football-data code, flag, active). No delete. |
| `/host/fixtures` | Add/edit/delete canonical fixtures for a competition. |
| `/host/import` | Manually import upcoming fixtures from football-data.org (1–3 rounds). Override for the auto-import. |
| `/host/results` | **Platform-wide** queue of fixtures awaiting a result, with pre-fetched scores. Accept, edit, retry, or **Accept All**. |

## League admin (`/admin`) — commissioners only

Slimmed to `/admin/settings` only: rename the league and manage its invite code, plus a
read-only summary of the streak tiers (kept because commissioners used to configure the
Grand Slam here and will look for it). Fixtures and results are handled by hosts, so
there's nothing else.

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
   and points show (amber) across the predictions page, leaderboard, and API,
   until a host confirms. Computed at read time (`lib/provisional.ts`); never stored;
   standings still rank by confirmed points.
3. **Host confirms** at `/host/results` — a platform-wide queue with **Accept All**.
   `confirmFixtureResult()` (`lib/results.ts`) saves the scores + `COMPLETED`, scores
   every prediction on the fixture once, then fans out streak bonuses per subscribing
   league. Nothing scores without host sign-off — the
   human check keeps bad data (postponements, ambiguous names) off the leaderboard.
4. **Fallbacks** — members can Request result from the dashboard; hosts have a "Check
   for Updates" button (runs the sweep on demand); manual entry and per-fixture API
   lookup always work.

## Scoring

Pure function `scoreOnePrediction` in `lib/scoring.ts`:

| Outcome | Points |
|---|---|
| Exact score | 3 |
| Correct result (W/D/L), scoreline within one goal, not exact | 1.5 |
| Correct result only | 1 |
| Wrong result | 0 |

**What counts as "close" (1.5).** The right result *and* a scoreline within one goal —
which is one of two shapes:

- one team's score exactly right and the other out by one (2–0 for a 2–1); or
- both out by one **in the same direction**, which preserves the goal difference
  (3–2 or 1–0 for a 2–1).

Out by one on both sides in *opposite* directions (3–0 for a 2–1) is two goals away and
pays 1. Matching goal difference on its own is **not** enough — 5–4 for a 2–1, or 4–4 for
a 1–1, both score 1.

This mirrors Superbru, whose Closeness Index is
`|your GD − actual GD| + |your total goals − actual total goals| ÷ 2`, close at ≤ 1.5.
The two formulations are exactly equivalent; the code uses goal offsets because that's
how players reason about it. Corrected on 2026-08-16 — see
[decisions.md](decisions.md) — the original build read "correct goal difference", which
was both too generous (any matching GD, however far out) and too stingy (no credit for
2–0 on a 2–1).

**Banker** (always on): one fixture per gameweek, per competition, scores **double**.
Set it with the ☆ Banker button on any open fixture once you've saved a prediction
there; picking another fixture in the same round moves it. Because the minimum score is
0, a banker is upside-only — the skill is choosing the match you're most confident in,
not staking anything on it. Two locks stop it being chosen with hindsight: you can't
banker a fixture that has kicked off, and you can't move the banker off one that has.
Applied in `awardedPoints()` (`lib/scoring.ts`) at both confirm time and in provisional
points, so a bankered pick reads double everywhere. It is **not** a per-league toggle —
see [data-model.md](data-model.md#key-invariants) for why it can't be.

**Streak bonus** (always on, every league): bonus points for calling a lot of a
gameweek's *results* right — win/draw/loss, not exact scores.

| Results correct in a gameweek | Bonus |
|---|---|
| 5–7 | +1 |
| 8–9 | +2 |
| 10 or more | +3 |

Tiers live in `STREAK_TIERS` (`lib/scoring.ts`) and every surface reads them, so the
numbers can't drift between the settings page, `/rules` and the scoring itself. Awarded
once the whole round is confirmed, stored as a `BonusAward` row (never folded into a
prediction's points), shown as 🔥+N on the leaderboard.

Eligibility counts *correct results*, so:
- Fixtures you didn't predict simply don't count towards the total.
- Bankering a match makes no difference — the bonus counts results, not points.
- Re-confirming a result can move you **down** a tier or off the bonus entirely; stale
  awards are cleared on every round completion.
- A round with fewer than 5 fixtures can't reach the lowest tier. Fine for a 10-fixture
  Premier League matchweek; a short knockout round pays nothing.

Replaced the all-or-nothing **Grand Slam** on 2026-08-16, which was a per-league toggle
with a configurable points value. See [decisions.md](decisions.md).

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
