# Changelog

What shipped, newest first. Add a dated entry whenever you ship something; keep it
short and link to detail in the reference docs. Phases 1–20 are collapsed as the
initial build; later work is listed individually.

---

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
