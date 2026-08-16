# Changelog

What shipped, newest first. Add a dated entry whenever you ship something; keep it
short and link to detail in the reference docs. Phases 1–20 are collapsed as the
initial build; later work is listed individually.

---

## 2026-08-16 — Leaderboard points breakdown
Each row now shows where its points came from: **Result** (1s), **Close** (1.5s),
**Exact** (3s), **★** banker doubling and **🔥** streak bonuses. The five sum to the
total exactly — they split the stored `pointsAwarded` rather than recomputing from
scorelines, so they can't drift from it. Banker counts only the *extra* from doubling, so
a bankered exact reads 3 exact + 3 banker. Columns on desktop, a wrapping chip line of
the non-zero parts on mobile. Exposed on the API as `pointsBreakdown`. Replaces the old
exact-*count* column (the count survives as a tooltip). 170 tests.

## 2026-08-16 — Streak bonus replaces the Grand Slam
Bonus points for calling a lot of a gameweek's results right: **+1** for 5–7 correct,
**+2** for 8–9, **+3** for 10 or more. Replaces the all-or-nothing Grand Slam, which one
wrong result in ten wiped out entirely.

**No longer a per-league setting** — `grandSlamEnabled`/`grandSlamPoints` dropped from
`League` (migration `20260816010000_streak_bonus_replaces_grand_slam`, destructive but
config-only), so scoring is identical everywhere and standings are comparable. The
`/admin/settings` toggle became a read-only summary; `/rules` stopped being personalised,
since that setting was the only thing on it that varied.

Tiers live in `STREAK_TIERS` and every surface reads them. Leaderboard and API field
`grandSlams` → **`streakPoints`** (a points total, not a count — a count would hide
whether three bonuses were 1s or 3s). Existing `BonusAward` rows are left as a historical
record. Verified against the local Postgres, including demotion: re-confirming a result
can move a player down a tier or off the bonus. 168 tests.

## 2026-08-16 — "How it works" rules page
`/rules` explains predictions and deadlines, the points table, banker, Grand Slam,
provisional results, the leaderboard and leagues. Public, so an invited player can read
it before signing up; personalised when signed in, listing each league's **actual** Grand
Slam setting — it's per league, so a fixed page would misinform some players. A nav tab on
desktop and mobile, plus links from the Predictions footer and the register page. Numbers come from `RESULT_DELAY_MS` and `BANKER_MULTIPLIER`, not hardcoded prose.

## 2026-08-16 — Banker: double points on one fixture per gameweek
Players pick one fixture per gameweek (per competition) whose points double. New
`Prediction.isBanker` column + migration `20260816000000_add_prediction_banker`;
`awardedPoints()` applies the multiplier at confirm time and in provisional points, so
it reads double on the predictions page, results, leaderboard and API alike. One per
(user, competition, round), enforced transactionally in `lib/banker.ts` — the round
lives on Fixture, so it can't be a unique index. Locked once the fixture kicks off, and
can't be moved off a match that has already started. Bots can set it via
`POST /api/v1/predictions { isBanker }`. New `clock-on` token (white on the dark-mode
amber failed contrast). 168 tests.

## 2026-08-16 — Drop the stat tiles from Predictions
The Points / Exact / To predict tiles came off the top of `/`. Points and exact count are
standings data that the Leaderboard already shows per league and in context; "to predict"
duplicated the amber nudge directly below it and the per-gameweek badges. The nudge stays.

## 2026-08-16 — Group fixtures into gameweeks
Open and Kicked Off fixtures are now grouped by round instead of one flat list — a full
Premier League round is 10 fixtures and several import at once, so the page ran past 20
cards. Only the nearest round needing picks is expanded; the rest collapse to a one-line
summary with a "N to predict" badge. Native `<details>`, so no client JS. Fixture cards
dropped the now-redundant competition/round prefix and show just the kickoff time.

## 2026-08-16 — Invite links
- **`/register?invite=CODE`** — a shareable sign-up link that creates the account and
  joins the league in one step, showing which league you're joining before you sign up.
- **Removed the invite-code field from sign-up.** It was optional and in the wrong
  place; codes now belong on the "Join a league" form, for people who already have an
  account. `CopyInvite` offers both link and code from `/leagues` and `/admin/settings`.
- **Fixed: invite codes were case-sensitive at sign-up but not when joining.**
  Registration did `.trim()` while joining did `.trim().toUpperCase()`, so a lowercase
  code was rejected in one place and accepted in the other. Both now use
  `normaliseInviteCode()`.
- **Corrected the "invite-only" copy.** Sign-up has always been open despite the docs
  and login/register pages saying otherwise; leagues are the private part. 152 tests.

## 2026-08-16 — Information architecture: 3 tabs, no league switching
- **Dashboard merged into Predictions at `/`.** The two pages showed the same picks and
  results either side of kickoff, and only the dashboard could actually take a
  prediction. Now one page: Open → Kicked Off → Results. `/predictions` permanently
  redirects.
- **Predictions scoped by competition, not league** — a pick is unique per
  `(userId, fixtureId)` and already counts in every league on that competition, so
  per-league rendering would have duplicated the same fixtures and inputs.
- **Leaderboard stacks every league** you're in, with a jump list. Standings are the one
  genuinely per-league surface.
- **Nav down to three tabs**: Predictions · Leaderboard · My Leagues.
- `activeLeagueId` now only drives `/admin`, resolved with a `COMMISSIONER` filter so a
  commissioner of a later-joined league isn't bounced out. 3 new tests (148 total).

## 2026-08-16 — Navigation fix + theme toggle
- **Fixed: every page bounced back to `/leagues`.** The `activeLeagueId` cookie is only
  written on create/join/switch, and every page redirected when it was missing — so a
  member signing in without one couldn't navigate anywhere. New
  `resolveActiveLeagueId()` falls back to the earliest-joined league and also recovers
  from a stale cookie pointing at a league the user has left. 5 tests.
- **Theme toggle** — System / Light / Dark in the header, persisted in a cookie and read
  server-side so there's no flash of the wrong theme.
- **Board palette retimed from navy to deep pitch green** (`#0f4527` light, `#061a0f`
  dark). The near-black navy leaderboard header read as a hole punched in the white
  page, and navy was off-brand for a green product. Affects the leaderboard header,
  host/admin nav bars, api-docs code blocks and provisional score chips. Dropped the
  unused `board-cyan` token.

## 2026-08-16 — Polish & UX pass (incl. dark mode)
- **Dark theme.** Follows the OS setting. Added `good`/`bad`/`info` semantic token
  families plus `pitch-on`/`clock-line`, and swept 137 stock Tailwind colour classes
  across 26 files into tokens — so the dark theme is one `prefers-color-scheme` block
  redefining values, with no per-component `dark:` variants.
- **Mobile navigation.** The top nav was `hidden sm:flex` with no mobile alternative,
  leaving Predictions/Leaderboard/Leagues unreachable below 640px. Added a bottom tab bar.
- **Loading / error / not-found boundaries** — the app previously had none.
- **Form strip accessibility** — dual-encoded with glyphs + `aria-label` instead of
  colour alone, and now visible on mobile. Raised `ink-faint` to clear WCAG AA (it was
  2.52:1 on white while carrying real copy).
- **Dashboard** — performance tiles from round one, plus a "N fixtures still to predict"
  nudge with the next deadline and amber edges on the fixtures it means.
- **Titles** — `title.template` in the root layout; two pages still said "Football
  Prediction App" and six had no title at all.

## 2026-08-16 — CI hardening + local Postgres
- **Tests now gate the deploy.** `deploy.yml` runs `prisma generate` + `vitest run`
  before touching Cloud SQL or Cloud Run, so a red suite can't reach production.
- **Actions bumped off Node 20** — `checkout@v7`, `setup-node@v7`,
  `google-github-actions/auth@v3`, `setup-gcloud@v3`. Runner Node stays 22 (matches the
  `Dockerfile`).
- **`docker-compose.yml`** added: a throwaway local Postgres 16 on port 55432. Verified
  by applying all five migrations and the seed from clean. Closes the "no local
  Postgres" gotcha. See [development.md](development.md#local-database).

## 2026-07-10 — Docs reorganised into `docs/` wiki
All markdown consolidated into this `docs/` folder as a human/AI wiki, with an agent
operating protocol (read order + keep-docs-updated rule) in `docs/README.md`. Root
`CLAUDE.md`/`AGENTS.md` reduced to pointers; `TODO.md` and `FOOTBALL_PREDICTION_APP_SPEC.md`
absorbed and removed.

## 2026-07-09 — Platform-owned competitions refactor (phase 23), deployed
The big one. Fixtures/results moved from per-league to platform-owned `Competition`s
that leagues subscribe to. New site-host role (`isSiteAdmin`) + `/host` area;
`/admin` slimmed to settings. Provisional scores/points everywhere (read-time, ranked
by confirmed). Automatic fixture import; cron cadence 30→10 min. Destructive
fresh-start migration (`20260709000000_platform_competitions`), verified against Docker
Postgres before shipping. Seed rewritten with `host@football.test`. 140 tests, clean
build. See [decisions.md](decisions.md) and [data-model.md](data-model.md).

Follow-ups the same day:
- **Cloud Scheduler created for the first time** — `app_url` had never been set, so the
  resolve cron never existed; set it to the direct run.app URL and applied Terraform.
  Job now runs every 10 min.
- **Cron 500 fixed** — `fetchUpcomingFixtures` now skips knockout fixtures with
  undecided (null) team names (World Cup TBD), which had violated `Fixture.homeTeam`
  NOT NULL and failed the whole sweep. First good sweep imported 3 fixtures.

## 2026-07 — Custom domain, redesign, logo
- Served at **scorersonline.uk** via a Cloudflare Worker proxy to Cloud Run.
- **"Quiet Product"** redesign with broadcast-scoreboard moments; app renamed "Scorers".
- New logo: green scoreline chip.

## Phase 22 — Forgot password / reset
`PasswordResetToken` (hashed, single-use, 1h expiry, 5-min cooldown); `/forgot-password`
+ `/reset-password/[token]`; generic responses to avoid account enumeration. Requires
Resend. See [features.md](features.md#forgot-password--reset).

## Phase 21 — Member result requests + faster transitions
"Request result" button on kicked-off fixtures; result-delay buffer set to 1h45m.

## Phases 15–20 — Automation, transparency, docs, tests
- **15** Automated result resolution — Cloud Scheduler + `/api/cron/resolve`, proposal
  pre-fetch.
- **16** Deadline reminder emails via Resend in the cron sweep.
- **17** Grand Slam transparency — `BonusAward` model + leaderboard 🏆 badge.
- **18** Bot API docs — in-app `/api-docs`.
- **19** My Predictions round breakdown — per-round subtotals.
- **20** Unit-test expansion across scoring, football-data matching, auth, cron, API.

## Phases 11–14 — Multi-league, import, infra, settings
- **11** Multi-league architecture — League + LeagueMembership + active-league cookie.
- **12** Fixture import via football-data.org — round selector, import page.
- **13** Infrastructure & deployment — Terraform + Cloud Run + Cloud SQL + GitHub Actions.
- **14** League Settings page — Grand Slam toggle/points, rename, invite code.

## Phases 1–10 — Initial build
Next.js + TS + Tailwind scaffold; Prisma + Postgres schema; NextAuth credentials;
registration/login/profile with API keys; fixtures + dashboard; prediction submission
with deadline locking; the pure scoring engine; leaderboard with form strip; the public
`/api/v1` bot API; a pitch-green design pass; seed data and a full predict→resolve→score
QA cycle.
