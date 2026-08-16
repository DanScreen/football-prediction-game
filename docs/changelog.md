# Changelog

What shipped, newest first. Add a dated entry whenever you ship something; keep it
short and link to detail in the reference docs. Phases 1–20 are collapsed as the
initial build; later work is listed individually.

---

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
