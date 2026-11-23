# Features

How each part of the app behaves, from the user's side and the code's. **Update this
when behaviour changes.** For the public bot API see [api.md](api.md).

## Homepage (`/` when signed out)

A signed-out visitor to `/` sees a public homepage (`app/welcome/`) instead of the login
form. `proxy.ts` **rewrites** `/` to `/welcome` when there is no session, so the address
stays `/`; signed-in users get Predictions at `/` as before. `/welcome` is in
`PUBLIC_PATHS`.

The page is one deep-green scoreboard band: the headline, "Start a league" (→
`/register`), "Sign in", an invite-code box (→ `/register?invite=CODE`), and a **playable
demo** (`ScoreDemo.tsx`). The visitor sets a score for an example fixture with − / +,
optionally makes it their banker, and blows the full-time whistle; the demo shows the
points and where that puts them in an example five-player table. It scores with the real
`scoreOnePrediction` and `BANKER_MULTIPLIER` from `lib/scoring.ts`, so it can never
disagree with the game. The fixture, result and table are fixed examples and labelled so.

## Navigation & shell

**Five destinations, one job each:** Predictions (`/`), Results (`/results`), Leaderboard,
My Leagues, Rules — plus Admin/Host chips when the user holds those roles. Predictions
holds **Open** and **Kicked Off** only; settled history moved to **Results** on
2026-08-22 so the pick flow stays short. `/predictions` is a permanent redirect to `/`
so old links still land.

- **Desktop (≥640px):** top-bar links.
- **Mobile (<640px):** a fixed **bottom tab bar** (`app/components/MobileNav.tsx`) with
  the same destinations. The top-bar nav is hidden at this width, so before this existed
  there was no way to reach any page but the dashboard. Both share their link list and
  active-state logic from `NavLinks.tsx`. Profile stays reachable via the header name.
- **Loading states:** `loading.tsx` skeletons for the predictions, results, and
  leaderboard pages — these matter because Cloud Run runs at `--min-instances 0`, so a
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
| Results (`/results`) | **Competition** | Same fixtures/peers as predictions, but settled only |
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
| League commissioner | `LeagueMembership.role = COMMISSIONER` | Manage league settings and view pick status at `/admin` |
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

Each league card shows **where you stand**: your position, the player count, your points
and the gap to the player directly above ("3 behind Marcus", "Level with …", "Top of the
league") — `app/leagues/standing.ts`, from `computeLeaderboard`. "Open table" jumps to
that league on the leaderboard. Once you are in a league, the join and create forms sit
behind one "Join or create a league" control; with no leagues they are shown outright.

Leagues on a competition a host has declared **finished** move into a collapsed
"Finished leagues" section at the bottom, with a link through to
`/leaderboard?archived=1` for the final table. They keep their history but lose the
invite code, the share control and **Manage** — a finished league is closed.

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

Open fixtures to pick on and kicked-off fixtures still in play, scoped by **competition**
(see League scoping above). Two sections, top to bottom:

- **Open** — upcoming fixtures with a countdown and a score input each, **grouped into
  gameweeks** (`FixtureRoundGroup.tsx`) and capped at the **current gameweek and the next
  one** per competition (`VISIBLE_OPEN_ROUNDS` in `lib/visibleOpenRounds.ts`). Later rounds
  can exist in the database — hosts add fixtures by hand, and the auto-import window moves
  on — but picks four gameweeks out aren't the game, and they buried the round with a live
  deadline. The same cap applies on the **mobile** Predictions tab (client-side) and on
  `GET /api/mobile/v1/fixtures?status=open` (so already-shipped app builds pick it up without
  a store update). The cap is applied before the banker header and the nudge derive from the
  list, so they only ever describe fixtures the player can act on. Cards carry an amber left
  edge when unpredicted, green when predicted. Scores **auto-save** once both boxes have a
  valid integer (debounced ~450ms, also on blur) — there is no Save button. A brief ✓ Saved /
  Saving status appears beside the inputs. Only the nearest round that still needs picks is
  expanded; later rounds collapse to a one-line summary with a "N to predict" badge. A
  full Premier League round is 10 fixtures and several rounds import at once, so a flat
  list ran past 20 cards. Built on native `<details>` — no client JS for the grouping,
  keyboard accessible. Each card carries a **☆ Banker** toggle (double points, one per
  gameweek — see Scoring), enabled once both scores are saved; the gameweek header names
  the banker or says "no banker yet".
- **Kicked Off** — grouped into gameweeks the same way (most recent expanded).
  Predictions lock at kickoff and everyone's picks reveal. Until the API confirms a
  score the fixture shows "awaiting result"; once confirmed it moves to Results with
  points. A bankered pick is tagged ★ ×2. A member can press **Request result** to
  trigger the lookup early.

Above them, when picks are outstanding: an amber nudge with the count and the next
deadline. It counts only the **next gameweek needing picks in each competition**, not
everything open — fixtures import a couple of rounds ahead, so counting all of them read
"20 fixtures still to predict" for deadlines a fortnight out. Later rounds are covered by
their own gameweek badge.

Beneath it, when the **nearest open gameweek in a competition has no banker**, a second
amber nudge: "No banker set for Gameweek N", with a line pointing at the ☆ Banker button
(`roundsMissingBanker()` in `lib/bankerNudge.ts`). Only the nearest round counts, for the
same reason as the picks nudge — next week's banker isn't urgent while this week's is
sorted. With several competitions it names each round with its competition. It goes away
as soon as a banker is set. The player's bankers are looked up per round **including
finished fixtures**, so a banker on Friday's match still counts on Saturday, after that
fixture has left the page — the gameweek header's "no banker yet" uses the same lookup.

Standing totals (points, exact count, rank) are deliberately *not* here — they
belong to the Leaderboard, where they can be read per league and against other people.

Whose picks show under Kicked Off: everyone who shares a league with you **on that
competition**. A league-mate on the World Cup doesn't surface on your Premier League
fixtures.

**Score entry.** Each score box has a − and a + button beside it (`PredictionInput.tsx`),
so a pick needs no keyboard. Pressing either on an empty side sets it (+ gives 1, − gives
0) and fills the other side with 0, so one press makes a complete pick; steps clamp to
0–20. Typing still works, and both routes share the same debounced auto-save. In the app
the steppers replace the text fields (`components/PredictRow.tsx`), with a light haptic
tick per step.

**Countdowns are neutral until the last 24 hours** before kickoff, then amber. In the app
the countdown pill only appears inside that window. Unpicked fixtures keep their amber
edge (web) or dashed amber border (app).

**Club colour chips.** Team names carry a small two-tone chip from a hand-kept table
(`lib/teamColours.ts`, mirrored at `apps/mobile/lib/teamColours.ts`; a unit test keeps the
two identical). A team that isn't in the table gets a neutral chip.

## Results (`/results`)

Settled fixtures grouped by competition and round, newest first (`PredictionHistory.tsx`).
Each card leads with the **scoreline** between the two team names, then **your pick**
with its points and the reason ("One goal out", "Right result", "Wrong result", or
"Nailed it!"), then **every league-mate's pick grouped by scoreline** — "1 – 1  Bob,
Marcus, Priya" — with a ★ after a banker (`app/components/PickGroups.tsx`, on
`lib/groupPicks.ts`; same visibility as Kicked Off, which uses the same grouping). The
app's results card is the same layout. The round header still shows **your** subtotal
and any streak bonus. Left-edge colour reflects your outcome on that fixture. Split from
Predictions on 2026-08-22 — the combined page grew unbounded once every league-mate's
pick appeared on each settled fixture.

## Finishing a competition (host-only)

Old seasons used to linger on Predict, Results and the leaderboard forever. A site host
can now tick **Finished** on a competition at `/host/competitions`, which stamps
`Competition.archivedAt`.

A finished competition:

- disappears from **Predict**, **Results** and the **leaderboard** (web *and* app) —
  the filter lives in one place, `resolvePeerContext()` in `lib/peers.ts`, which every
  core page goes through;
- disappears from the league-creation competition picker, and joining one of its
  leagues by code is refused ("… has finished — that league is closed to new members.");
- stops auto-importing fixtures (`lib/autoImport.ts`) and stops sending deadline
  reminders (`lib/reminders.ts`);
- keeps **everything**. Its leagues move to "Finished leagues" on `/leagues`, and
  `/leaderboard?archived=1` still renders the final table. Untick the box to bring it
  back — the archive date is preserved across unrelated edits, so re-saving the form
  never restamps it.

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

**Gameweek tables (web and app, 2026-09-06).** Both clients toggle each league
between **Overall** and **Gameweek**, and the gameweek view steps back and forward
through the rounds with ‹ › arrows. It opens on the most recent round that has
kicked off; rounds that have not started are not offered, since every pick is still
hidden and every score zero. The toggle is per league, so opening a gameweek on one
board leaves the others on Overall.

A round table is `computeLeaderboard(leagueId, { round })` — the same function as
the overall table with the predictions *and* the bonus awards filtered to that
round, rather than a second idea of what a point is worth. Form strips are hidden
in gameweek mode: form is a trend across rounds and means nothing inside one.

The one deliberate difference between the clients is where the selection lives.
The web keeps it in the URL, one `gw-<leagueId>` param per league, so a gameweek
table can be linked to and the back button steps through the rounds you looked at.
The app holds it in component state — there is no URL to share in a native tab.
The web therefore needs no round endpoint: the page is a server component and
calls `computeLeaderboard` directly. See [mobile.md](mobile.md) for the app's
`/leaderboards/round` endpoint.

**A podium sits above each table** (web and app) when there are at least three players
and the leader has points: 2nd, 1st, 3rd as steps in the scoreboard palette. Rows show
plain rank numbers and only your own row is tinted.

**Podium places go by rank, not row order.** The 1st/2nd/3rd labels follow `rank`, so players level
on points share a place (joint-first is two 1sts, and 2nd is skipped) instead
of having the order decided by whichever name sorted first. Nobody medals on zero
points — a round whose results a host has not confirmed scores everyone zero, and
handing out three medals for it would invent a winner. Both clients use the same
rule (`app/leaderboard/podium.ts`, `apps/mobile/lib/podium.ts`).

**Points breakdown.** Every row accounts for itself: **Result** (1-pointers), **Close**
(1.5s — right result, scoreline within one goal), **Exact** (3s), **★** (the extra the banker
doubling produced) and **🔥** (streak bonuses). The five always sum to the player's
total, which is why they're derived by splitting the *stored* `pointsAwarded` rather than
recomputing from scorelines — a parallel recomputation could drift from the total.
Banker is counted as the extra only, so a bankered exact reads as 3 exact + 3 banker
rather than 6 in a column claiming to mean "exact scores".

Five extra numeric columns would force a phone to scroll the table sideways, so below
`md` the breakdown opens on tap instead (a `<details>` under the player's name, no
client JS): a stacked bar, a legend of the non-zero parts and "N exact scores". Your own
row starts open. The app does the same at every width. The ★ and 🔥 headers carry `sr-only` labels, since an emoji alone
announces nothing useful.

**Form is drawn as bars**, one per round: height is the points scored that gameweek
relative to the player's own best of the five, colour is the tier. Height carries the
meaning, so it reads without colour and needs no printed key (the old glyph boxes had a
legend under the page).

## Host area (`/host`) — site hosts only

| Page | Purpose |
|------|---------|
| `/host` | **Overview** — platform user counts (humans/bots), DAU/WAU/MAU from `lastSeenAt`, signups and prediction volume (7d/30d, split web / app / bot API — picks players made or edited in the window; scoring doesn't count), mobile reach, and a recent-users table. |
| `/host/analytics` | **Analytics** — engagement across the platform, with **Groups** (`/host/analytics/leagues`) and **Players** (`/host/analytics/players`) tabs that drill down to one league or one player. See [below](#host-analytics). |
| `/host/users` | **Users** — every account, newest first, searchable by name or email, with All / Unverified / Verified tabs (counts on each; bots only under All). Each row shows verification status (and when the last link went out), joined, last seen and league count. Actions: **Send verification link** and **Fix email** (unverified only), and **Send reset link** (anyone). See [below](#host-user-management). |
| `/host/competitions` | Create/edit competitions (name, football-data code, flag, active). No delete. |
| `/host/fixtures` | Add/edit/delete canonical fixtures for a competition. |
| `/host/fixtures/editor` | **Gameweek editor** — one competition at a time, every fixture in the database grouped by gameweek. Tick any number and move them to another gameweek or delete them in bulk. For re-cutting rounds that don't divide evenly (TV splits, postponements, cup ties landing mid-round). Guards below. |
| `/host/import` | Manually import upcoming fixtures from football-data.org (1–3 rounds). Override for the auto-import. |
| `/host/results` | **Platform-wide** queue of fixtures awaiting a result, with manual entry. Edit confirmed scores from here or `/host/fixtures`. |

### Host analytics

`/host/analytics` (`app/host/analytics/`, numbers from `lib/analytics/`) answers
"who's playing, which groups are alive, and how often do people come back". Bots
are left out of player numbers (the Players tab can include them).

**Definitions** (all in `lib/analytics/compute.ts`):

- A **gameweek** is a (competition, round). It has *started* once its first fixture
  kicks off. A player is *eligible* for one if they were in a league on that
  competition before one of its fixtures kicked off; they *played* it if they picked
  at least one of its fixtures.
- **Recent gameweeks** are the last 4 started ones of each unfinished competition.
- **Segments** (per player): **Core** (played 3+ of their last 4), **Regular** (2),
  **Casual** (1), **Lapsed** (picked before, none recently), **Never picked** (had
  gameweeks, no picks), **Not started** (no gameweek has kicked off since joining),
  **No league**.
- **Group health** (per league): the average share of eligible members who played
  each recent gameweek — **Thriving** ≥60%, **Active** 30–60%, **Quiet** under 30%,
  **Dormant** 0. **Solo** means one human member; **Finished** means an archived
  competition.
- **Active days** come from `UserActivityDay` (one row per user per London day,
  [data model](data-model.md#useractivityday)), so "returning" means a different
  day, not another page view.

**Overview:** headline tiles (players, making picks, active this week with
week-over-week return, stickiness = mean DAU/MAU, multi-player groups, healthy
groups, picks in 7 days, slipping away); daily active players for 30/90/180 days,
split into returning and first visit; a funnel from sign-up to "back in the last 7
days"; segments; return frequency (days active in the last 30); platform reach (web,
app, bot API); weekly retention cohorts by sign-up week; gameweek participation per
active competition; group sizes and the busiest groups; and **Slipping away** —
players who played 3+ gameweeks and then missed the latest 2+ in a row.

**Groups** lists every league with players, active pickers, participation per
gameweek (with a mini bar for each of the last 4), active members, picks, health and
creation date, filterable to 2+ players or solo and sortable. A **group page** adds
per-gameweek participation for the last 12, a 28-day grid of which members visited
on which day, and a member table (joined, picks, gameweeks played since joining,
last pick, last seen, segment).

**Players** lists every player with groups, picks, last-4 record, fixture coverage,
days active in 30, last seen, surfaces used and segment, with segment tabs, search
and sorting. A **player page** adds a 26-week activity calendar, accuracy (exact %,
results called, points per settled pick), median time between picking and kickoff,
bankers, per-gameweek picks for the last 12, their groups and their recent picks.
Player names on `/host` and `/host/users` link here.

Everything is computed in memory from a lean snapshot (`lib/analytics/load.ts`);
drill-down pages load only the users concerned. Charts are server-rendered (CSS
tooltips, no client JS) and each has a "Show as table" view.

### Host user management

`/host/users` (`lib/hostUsers.ts`, `app/host/users/`) lets a site host get a stuck
player unstuck without touching the database:

- **Send verification link** calls the same `sendVerificationEmail` as the player's own
  button, so the 60 s per-user cooldown applies and the host is told the wait.
- **Send reset link** calls `sendPasswordResetEmail`. It's the same email as
  `/forgot-password`, but it reports the 5-minute cooldown instead of silently skipping,
  so the host knows the earlier link is still live. Completing a reset also verifies
  the email, so this works for someone stuck on both.
- **Fix email** is `changeUnverifiedEmail`: the same rules as the player's own "Change
  it" link. It only works while unverified, the new address can't already be in use,
  and it kills the old links and sends a new one.
- Bots get no actions. Every action re-checks `requireSiteAdmin()` and logs
  `[host] <hostId> …` to the server log.
- There's no delete here. Players can delete their own account from `/profile` or the app.

### Gameweek editor guards

Both bulk operations refuse rather than repair, because the damage is invisible after
the fact:

- **Settled fixtures can't be moved or deleted.** `RoundBonus` is keyed by
  (user, league, round) and points are already awarded against the old label, so moving
  one silently rewrites a finished gameweek's scoring.
- **Fixtures carrying predictions can't be deleted.** Those are picks players made, and
  `Prediction.fixture` has no cascade, so the delete would fail at the foreign key
  anyway — the tool says how many picks are in the way instead of surfacing a
  constraint error. Moving is still allowed; the count shows on each row.
- **Duplicate bankers are resolved on move.** One banker per (user, competition, round)
  has no database constraint to lean on — the round lives on `Fixture`, not
  `Prediction` — so a move can carry a second banker into a round a player has already
  bankered. The *arriving* banker is cleared, not the incumbent, and the result line
  reports how many; see [decisions.md](decisions.md).

## League admin (`/admin`) — commissioners only

Two destinations, scoped to the league chosen via **Manage** on `/leagues`:

| Page | Purpose |
|---|---|
| `/admin/picks` | **Pick status** — for each upcoming fixture in the **current and next gameweek** (same `VISIBLE_OPEN_ROUNDS` cap as Predictions), see which league members have submitted a prediction and which haven't. Actual scores stay hidden until kickoff; commissioners only see picked vs not yet. Includes a per-member summary across those open fixtures. |
| `/admin/settings` | Rename the league, manage its invite code, plus a read-only summary of the streak tiers (kept because commissioners used to configure the Grand Slam here and will look for it). |

Fixtures and results are handled by site hosts, not league commissioners.

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

Results are applied automatically once football-data.org has them:

1. **Sweep** (`POST /api/cron/resolve`, every 10 min) moves fixtures ≥1h45m past
   kickoff to `AWAITING_RESULT`, then looks up the final score from football-data.org
   (one API call per competition/date window, fuzzy-matched by team name).
2. **Auto-confirm** — when a score is found, `confirmFixtureResult()` (`lib/results.ts`)
   saves it immediately, marks the fixture `COMPLETED`, scores every prediction once,
   and fans out streak bonuses per subscribing league. No host sign-off step.
3. **Reconcile** — for **24 hours after kickoff**, the same sweep re-checks every
   `AI_CONFIRMED` result against the API. If the published scoreline has changed
   (typical case: a goal disallowed after football-data.org first marked the match
   `FINISHED`), it re-applies the new score, re-scores predictions, and updates
   streak bonuses. Host **`MANUAL`** corrections are never overwritten. Matching
   scores are a no-op so the extra work is cheap.
4. **Host correction** — site hosts can enter a missing result or **edit a confirmed
   score** from `/host/results` or `/host/fixtures` (re-scores every prediction and
   updates streak bonuses for the round). API lookup on the enter-result page also
   confirms immediately.
5. **Fallbacks** — members can **Request result** from Predictions once the fixture is
   due; hosts have a **Check for Updates** button (runs the sweep on demand); manual
   entry always works when the API has nothing yet.

Fixtures still in **Kicked Off** with no result yet show everyone's picks but no
scoreline — there is no provisional/pre-confirm state any more.

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

## Email format check & verification (`/verify-email`)

**Format check at sign-up.** `lib/emailAddress.ts` (`isValidEmail`) runs on web
register, mobile register and the change-address form: a pragmatic dot-atom local
part, ≥2 hostname labels, a letters-only (or punycode) TLD of 2+ chars, 254/64 length
caps. It rejects the junk that actually turned up (`name@gmail`, `a@b.c`, spaces,
`a..b@x.com`). The Expo app has a copy (`apps/mobile/lib/emailAddress.ts`) for instant
feedback; the server's is the authority.

**Every account must verify its email before using the product** — new sign-ups and
every account that existed before this shipped (2026-09-23).

- **Sign-up** sends a single-use link (`/verify-email/<token>`, 24 h, SHA-256 hash
  stored only) and lands the user on **`/verify-email`**, signed in. A failed send
  doesn't fail the sign-up — the page's button re-sends (60 s cooldown).
- **Nobody has to ask for the first link.** Whenever an unverified user reaches the
  verify page (web) or the app fetches `GET /me`, `ensureVerificationEmailSent` mails
  a link unless a live one (unused, unexpired, to the current address) is already out.
  That covers accounts from before verification existed, a failed sign-up send, and a
  link that expired. If that send fails, the web page says so and the button
  retries.
- **The gate (web):** `proxy.ts` redirects any signed-in, unverified session to
  `/verify-email`; the header hides the nav for them. The JWT carries
  `hasVerifiedEmail`, and **the `jwt` callback re-reads it from the DB on every request
  until it's true** — the proxy re-issues the cookie — so clicking the link on another
  device (the phone, usually) lifts the gate without signing in again, and sessions from
  before this feature (no claim at all) are checked too. Once true it sticks, so
  verified users cost no extra query.
- **Opening the link** verifies on render. It only works for the address it was sent
  to; re-opening a used link on a verified account says "verified" (mail scanners
  pre-click links). It works signed out too, and tells app users to go back to the app.
- **Wrong address?** Unverified users can change it from the verify page (or the
  app). That kills every outstanding verification link *and* password-reset link, then
  sends a new link. Verified addresses can't be changed — that isn't a feature.
- **A completed password reset verifies the account** — it proved the mailbox.
- **Mobile:** player endpoints answer an unverified account with
  **403 `{ code: "email_unverified" }`**; the app shows its own verify screen. See
  [mobile.md](mobile.md#email-verification).
- **Unverified accounts get no reminders** (email or push).
- Not gated: the bot API (`/api/v1`, API-key auth), `/profile`-free public pages,
  sign-out, and account deletion in the app.

Code: `lib/emailVerification.ts`, `app/verify-email/`, `proxy.ts`, `auth.config.ts`.

## Email design (every email is branded)

Every email goes out in the Scorers theme. There's a deep-green scoreboard header
with the mark and wordmark, a gold rule, and a white card holding an eyebrow, a
title, the body and a pitch-green button. A quiet footer links back to the app.
Each email also carries a plain-text alternative.

- **`lib/emailLayout.ts`** is the shell (`renderEmail`) plus building blocks:
  `paragraph`, `mutedNote`, `fixtureCard` (a mini scoreboard with `? – ?` and an
  amber "Locks …" chip) and `escapeHtml`.
- **`lib/emailTemplates.ts`** holds every email: `verificationEmail`,
  `passwordResetEmail` and `deadlineReminderEmail`. Each returns
  `{ subject, html, text }` to spread into `sendEmail`. **New emails go here.** Don't
  build HTML at the call site.
- The header logo is `public/brand/email-logo.png`, loaded from `AUTH_URL`. It comes
  from `npm run brand:assets`.
- Verification and reset repeat their link as copyable text under the button. The
  header isn't a link, so the button is always the first `href`, which is the link
  the E2E mail helper follows.
- `npm run email:preview` renders every template with sample data into the
  git-ignored `.email-previews/`.

## Deadline reminder emails

The cron sweep emails league members who haven't predicted a fixture kicking off within
the next 3 hours — one email per user listing their open fixtures (via Resend). A
multi-league user gets a single deduped email. Each fixture triggers one batch only
(`reminderSentAt` guard). Silently skipped if `RESEND_API_KEY`/`EMAIL_FROM` are unset.
Bots and accounts with an unverified email are skipped (no email, no push).
Each open fixture shows as a scoreboard card with its London kickoff time. A send that
fails for one user is logged and doesn't stop the rest.

## Forgot password / reset

`/forgot-password` → submitting an email always shows the same generic confirmation
(no account enumeration); if the email matches, a single-use link valid 1 hour is sent.
`/reset-password/[token]` validates server-side before showing the form. Setting a new
password invalidates all the user's other outstanding tokens. Only the SHA-256 hash of
the token is stored. There's a 5-minute per-user cooldown. Site hosts can also send a
reset link from `/host/users`. Unlike reminders, this flow
**requires** Resend to be configured (account recovery isn't optional) and errors if
it isn't. Completing a reset also marks an unverified email as verified — the link
proved the mailbox. See `lib/passwordReset.ts`.

The login form keeps the typed email after a failed sign-in. React resets a form once
its action returns, so `loginUser` echoes the email back as the field's
`defaultValue`. Until 2026-09-24 a wrong password also cleared the email.

## Profile pictures (`/profile`, app Account screen)

Every player has an avatar. Until they upload a picture it is their **initials**
(first and last word of the display name, or one letter for a single word) on one
of four tones picked from their user id, so the colour survives a rename. The
helpers are `lib/avatar.ts`, mirrored in `apps/mobile/lib/avatar.ts` (a test keeps
the two identical); the components are `app/components/Avatar.tsx` and
`apps/mobile/components/Avatar.tsx`.

Avatars show in the web header (beside your name, linking to `/profile`), on
leaderboard rows and the podium (web and app), and beside each league-mate's name
in grouped picks on Predictions/Results (web) and fixture cards (app).

**Uploading.** Web: *Upload picture* on `/profile`. The browser first shrinks the
photo to 1024px JPEG (it has to fit the 1 MB server-action limit, and phone photos
are several MB), then the server action stores it. App: *Add a picture* on Account
opens the system photo picker with a square crop, and the base64 goes to
`PUT /api/mobile/v1/me/avatar`. Both end in `lib/avatarUpload.ts`, which decodes
the image with `sharp`, crops it to a 256px square (`position: "attention"`), and
stores WebP in `UserAvatar`. Re-encoding rejects non-images, caps decoded size
(50 MP) and strips EXIF, so a photo's GPS position never reaches league-mates.
*Remove* goes back to initials.

**Serving.** `GET /api/avatars/<key>` is public (exempt in `proxy.ts`) but the key
is random and changes on every upload, so it is unguessable and cacheable forever.
A removed or replaced picture's old URL returns 404.

## Account deletion (`/profile`)

The profile page carries a **Delete account** section, collapsed behind a
disclosure and gated on the user retyping their own email address. It is
irreversible — no deactivated state, no grace period — so it takes a deliberate
act to reach.

`lib/accountDeletion.ts` is the single implementation, shared with the mobile
app's `DELETE /api/mobile/v1/me`. In one transaction it removes the user's
predictions, bonus awards, league memberships, push tokens, refresh tokens,
reset tokens and profile picture, then the user. Leagues are **not** deleted with the member — a
league belongs to everyone in it — unless the leaver was the last one, in which
case nothing can reach it any more and it goes too. Deleting signs the session
out and lands on `/login?deleted=1`.

This exists because App Store guideline 5.1.1(v) requires an app that creates
accounts to let people delete them from inside the app. See
[decisions.md](decisions.md) for why leagues survive.

## Privacy policy (`/privacy`)

A public page (in `PUBLIC_PATHS`) stating what is collected, why, which
processors see it, how long it is kept, and how to delete an account. It is the
privacy-policy URL on both store listings, and the App Store privacy-nutrition
answers in
[`store-assets/app-store-listing.md`](../store-assets/app-store-listing.md) must
match it. **If the app starts collecting something new, edit both in the same
change** — Apple treats a mismatch as a rejection.

## Support page (`/support`)

Public FAQ behind the **Support URL** both stores require on a listing. It answers
the questions people actually arrive with — joining a league, invite codes that
won't take, the per-fixture kickoff deadline, autosave, the banker, why points
moved, where a finished competition went, notifications, forgotten passwords,
finding the account screen, and deleting an account — and gives an email address
(`support@scorersonline.uk`) with a stated two-working-day response.

The listing pointed at `/rules` until 2026-09-05. `/rules` is the rules of the
game: it explains the points table perfectly and answers none of the "it isn't
working" questions a support URL exists for.

**Every answer names a specific place in the UI, so it goes stale the moment a
screen moves.** When you move something, fix `/support`, `/privacy` and the
reviewer notes in
[`store-assets/app-store-listing.md`](../store-assets/app-store-listing.md) in the
same change — the account screen moving to the header icon left all three wrong
until it was caught.
