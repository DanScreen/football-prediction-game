# Changelog

What shipped, newest first. Add a dated entry whenever you ship something; keep it
short and link to detail in the reference docs. Phases 1–20 are collapsed as the
initial build; later work is listed individually.

---

## 2026-11-23 — Host analytics

Site hosts get **`/host/analytics`**: headline engagement, daily active players
(returning vs first visit), a sign-up-to-picking funnel, player segments (core →
never picked), return frequency, platform reach, weekly retention cohorts,
gameweek participation, group sizes and health, and players slipping away. **Groups**
and **Players** tabs list every league and player and drill down to a page each.
Visits are now recorded as one `UserActivityDay` row per user per day (migration
`20261123000000_user_activity_day`, backfilled from existing picks and joins). The
privacy policy discloses it; **the App Store privacy answers need _Product
Interaction_ adding by hand** ([listing](../store-assets/app-store-listing.md)).
Details: [features.md](features.md#host-analytics), rationale in
[decisions.md](decisions.md).

## 2026-11-10 — Profile pictures

Players can upload a profile picture on the web (`/profile`) and in the app
(Account). Until they do, they get their initials on a coloured disc. Avatars show
in the web header, on leaderboards and podiums, and beside league-mates' picks.
Uploads are cropped, resized and stripped of metadata on the server, and stored in
the new `UserAvatar` table (migration `20261110000000_user_avatar`). The app needs
a new build for the upload button (`expo-image-picker` is native); the API fields
are optional, so older builds keep working. Details:
[features.md](features.md#profile-pictures-profile-app-account-screen), rationale in
[decisions.md](decisions.md).

## 2026-11-10 — Homepage font is self-hosted

The homepage headline font (Big Shoulders) is now a file in the repo
(`app/welcome/fonts/`, loaded with `next/font/local`) instead of a build-time
download from Google Fonts. That download failed twice in one day, once in CI and
once in the production deploy after the web redesign merged, each time on that
font only. A re-run passed both times, but the build should not depend on it.

## 2026-11-10 — Web Results, Leaderboard and Leagues match the app

Closes the parity gap left by the 2026-11-09 refresh.

- **Results and Kicked Off:** the scoreline is the headline, your points come with a
  reason, and league-mates' picks are grouped by scoreline
  ([details](features.md#results-results)).
- **Leaderboard:** a podium above each table, form as bars (the printed key is gone),
  plain ranks with your row tinted. Below `md` the breakdown opens on tap; desktop keeps
  its columns ([details](features.md#leaderboard-leaderboard)).
- **Leagues:** cards show your position, points and the gap to the player above; join
  and create sit behind one control ([details](features.md#leagues-leagues)).

---

## 2026-11-10 — iOS app version 1.1.0

`expo.version` is now **1.1.0** (`apps/mobile/app.json`, `package.json`), a minor bump
because it carries the redesigned screens from the 2026-11-09 UI refresh and the new
`expo-haptics` native module. Merging it makes CI build and upload to App Store Connect
([store-release.md](store-release.md#submitting)). Still manual: add version 1.1.0 in App
Store Connect with the *What's New* text from `store-assets/app-store-listing.md`, pick
the build once Apple has processed it, and press **Submit for Review**.

---

## 2026-11-09 — UI refresh: homepage, faster score entry, simpler app screens

- **Public homepage** at `/` for signed-out visitors, with a playable scoring demo
  ([details](features.md#homepage--when-signed-out)).
- **Score steppers** on web and app; one press makes a complete pick. Countdowns are
  neutral until the last 24 hours. Club colour chips beside team names.
- **App Predictions:** a gameweek header with a picked-progress bar replaces the
  greeting; open fixtures are compact rows, six to a screen instead of four.
- **App Results:** the scoreline is the headline, your points come with a reason, and
  league-mates' picks are grouped by scoreline.
- **App Leaderboard:** a podium, one line per player, breakdown on tap, form as bars.
- **App Leagues:** cards show your position and the gap above; join and create sit behind
  one button. **Rules** moved from the tab bar to Account (four tabs).
- Disabled buttons in the app are readable in dark mode.

**Parity gap, closed 2026-11-10:** the Results, Leaderboard and Leagues redesigns were
app-only in this change; the web versions followed the next day (entry above).

**The app changes need a new store build** — `expo-haptics` is a native module. Nothing
reaches phones until `expo.version` is bumped (1.0.2 or higher) and merged.

Store screenshots in `store-assets/` predate this and need regenerating before the next
listing update (`npm run store:shots`).

---

## 2026-10-24 — Warning when you haven't picked a banker

The Predictions page shows an amber "No banker set for Gameweek N" nudge when the nearest
open gameweek in a competition has no banker, and it goes away once you set one
([details](features.md#predictions-)). Bankers are now looked up including finished
fixtures, so a round whose banker was an earlier match that has already finished no longer
reads "no banker yet". The golden-path E2E test checks the nudge appears and clears.

---

## 2026-10-23 — Security dependency updates

Upgrades the packages with known critical advisories:

- `next` 16.2.9 → 16.4.2, fixing a proxy bypass and a Server Actions denial of service.
- `next-auth` beta.31 → beta.32 (`@auth/core` 0.41.3), fixing an auth check that could
  fail open, a homoglyph email bypass and a crash on malformed Bearer headers.
- Prisma 7.8 → 7.10.1, Tailwind 4.3.3, Vitest 4.1.12, plus transitive bumps
  (`sharp`, `postcss`, `vite`, `mysql2`, `shell-quote`).

The mobile app takes the latest SDK 57 patch releases. Next 16.4 type-checks test files
during `next build`, so five test mocks got the casts they were missing. The golden-path
E2E spec now finds "Check your inbox" by heading, because the Next route announcer
repeats that text. What `npm audit` still reports, and why, is in
[decisions](decisions.md#2026-10-23--residual-npm-audit-findings-are-build-tooling-with-no-upstream-fix).

---

## 2026-09-25 — Branded emails

Every email now uses the Scorers theme: a scoreboard-green header with the logo and
wordmark, a card with a clear button, and a plain-text alternative. Previously they
were bare HTML, and the reset email still said "Football Prediction App". Deadline
reminders show each fixture as a mini scoreboard with an amber "Locks" chip. There's
one template module for every email, and `npm run email:preview` renders them
([details](features.md#email-design-every-email-is-branded)).

---

## 2026-09-25 — Host user list with verification and reset links

`/host/users` lists every account with its verification status, searchable and split
into All / Unverified / Verified tabs. Hosts can send a verification link, send a
password reset link, or fix a mistyped address on an unverified account
([details](features.md#host-user-management)). There are 3 new E2E tests, so the suite now
has 34.

---

## 2026-09-25 — Verification emails are sent without being asked for

Fixes reports of verification emails not arriving. Accounts from before verification,
and anyone whose sign-up send failed or whose link expired, were held on a "check your
inbox" screen that had never emailed them. The web `/verify-email` page and the app's
`GET /me` now send a link whenever no live one is out
([decision](decisions.md#2026-09-25--send-the-verification-link-automatically-where-users-are-held)).
There's a new E2E test for it, so the suite now has 31.

---

## 2026-09-24 — End-to-end tests with Playwright

A Playwright suite (`e2e/`, `npm run e2e`) runs a real browser against a production
build, a real Postgres database and a fake email service. It has 30 tests:

- **The golden path:** follow an invite, sign up, click the verification email,
  predict with a banker, the pick locks at kickoff, the host confirms the result, and
  the leaderboard ranks the player first.
- **Routing:** which pages are public and which are protected, plus nav for a
  freshly signed-in member.
- **The bot API** over real HTTP.
- **Password reset**, using the emailed link.

These are the kinds of bugs that previously shipped past the unit tests. A new CI job
runs the suite on every pull request.

Small app changes made along the way:

- The login form no longer clears the email after a wrong password. The test found it.
- Fixture cards are labelled groups ("Home v Away").
- The host's result form links its labels to its inputs.
- `lib/email.ts` accepts `RESEND_API_URL`, so tests can capture mail.

Detail: [development.md](development.md#end-to-end-tests).

## 2026-09-24 — iOS 1.0.1 live on the App Store

Build **1.0.1 (8)** passed review and is live, so App Store users now get the
email-verification screen. 1.0.1's version train is closed: the next iOS release
bumps `expo.version` to **1.0.2** (or 1.1.0). See [store-release.md](store-release.md).

## 2026-09-23 — iOS builds ship from CI

New workflow `.github/workflows/mobile-release.yml`: after Deploy succeeds on
`main`, EAS builds the iOS app and auto-submits it to App Store Connect — only when
`expo.version` in `apps/mobile/app.json` hasn't been built yet. Needs the
`EXPO_TOKEN` GitHub secret. Detail: [deployment.md](deployment.md#mobile-release),
[decisions.md](decisions.md).

## 2026-09-23 — Build 1.0.1 (8) uploaded

iOS build from `8f43628` (the version bump on `main`), uploaded to App Store
Connect with `eas submit`. First 1.0.1 build; carries the verify-email screen and
the sign-up format check. This is the build to submit for review. See
[store-release.md](store-release.md).

## 2026-09-23 — iOS app version 1.0.1

iOS 1.0.0 is reviewed and live, so its version train is closed: an upload still
marked 1.0.0 was rejected by App Store Connect (ITMS-90186 / ITMS-90062). The app
version is now **1.0.1** (`apps/mobile/app.json`, `package.json`), the release that
carries the email-verification screen. EAS only auto-increments the build number,
so the version must be raised by hand after each approved release — see
[store-release.md](store-release.md#submitting).

## 2026-09-23 — Email format checks and required email verification

Junk sign-ups (addresses with no domain, one-letter TLDs, typos) were getting in.
Sign-up now checks the address format on web and app, and sends a verification
link; **every account — including all existing ones — must click it before using
Scorers.** Unverified web sessions are held on `/verify-email`, which can resend
the link, fix a mistyped address, or sign out; the app gets a matching verify
screen, and player endpoints return 403 `email_unverified`. The session picks up a
click from any device without signing in again. A completed password reset also
verifies, unverified accounts get no reminders, and the App Store reviewer's demo
account is backfilled as verified. New `EmailVerificationToken` table and
`User.emailVerifiedAt` (migration `20260923120000_email_verification`). The live
iOS 1.0.0 predates this — it ships in 1.0.1. Detail:
[features.md](features.md#email-format-check--verification-verify-email),
[mobile.md](mobile.md#email-verification), [decisions.md](decisions.md).

## 2026-09-23 — Host overview: user counts and activity

`/host` is no longer a redirect to Results — it shows platform metrics for site
hosts: user totals (humans/bots), DAU/WAU/MAU from a throttled `User.lastSeenAt`
(bumped on web login, prediction upsert, mobile login/refresh), signup and
prediction volume, mobile reach, and a recent-users table. Counts come from
Postgres, not a product-analytics SaaS. Commissioners stay on league-scoped pick
status. See [features.md](features.md#host-area-host--site-hosts-only),
[data-model.md](data-model.md), and [decisions.md](decisions.md).

## 2026-09-20 — Cap open gameweeks on mobile (and pick status)

The website Predictions tab already hid anything past the current and next gameweek
(`VISIBLE_OPEN_ROUNDS`), but the mobile fixtures API and Predictions tab still returned
every scheduled round — so Matchweek 8 / 9 could sit alongside the live deadline again.
The same shared helper (`lib/visibleOpenRounds.ts`) now caps `status=open` on
`/api/mobile/v1/fixtures` (so shipped app builds pick it up without a store update), the
mobile client, and commissioner pick status. See [features.md](features.md#predictions-)
and [mobile.md](mobile.md).

## 2026-09-19 — Reconcile AI results after disallowed goals

The 10-minute resolve sweep now re-checks recent `AI_CONFIRMED` scores against
football-data.org for 24 hours after kickoff. If the published scoreline changes
(e.g. a goal disallowed after the feed first marked the match finished), Scorers
re-applies the new score, re-scores predictions, and updates streak bonuses —
without waiting for a host edit. Host `MANUAL` corrections are left alone. Cron
responses gain a `corrected` count. See [features.md](features.md#result-resolution)
and [decisions.md](decisions.md).

## 2026-09-06 — Build 1.0.0 (6) uploaded

iOS **1.0.0 (6)** from `28ee059`, carrying the podium fix. It supersedes (5) for
submission: the gameweek picker opens on the most recent round that has kicked
off, which is usually the one a host has not confirmed yet, so the medal bug was
the *default* thing a player — or a reviewer — saw on tapping Gameweek, not an
edge case.

## 2026-09-06 — Gameweek leaderboards on the web, and honest medals

The web leaderboard gets the Overall / Gameweek toggle and the ‹ › round stepper
the app shipped this morning, closing the gap the app-only version opened. The
selection lives in the URL — one `gw-<leagueId>` param per league — so a gameweek
table can be linked to and the back button walks the rounds. No new endpoint: the
page is a server component and calls `computeLeaderboard(leagueId, { round })`
directly.

Building it surfaced a real bug in both clients. Medals were handed out by row
position, so an unconfirmed gameweek — every player on zero, all tied — awarded
🥇🥈🥉 to whichever three names sorted first, inventing a winner for a round
nobody had been scored on. `podiumRank` now reads `rank` and refuses to medal a
zero, on the web and in the app. Joint-first is two golds with silver skipped,
which is also what the season table should have been doing all along.

Documented the rule this came from in [product.md](product.md) and
[decisions.md](decisions.md): **every player-facing feature ships on both web and
app; admin tools stay web-only.**

## 2026-09-06 — Build 1.0.0 (5) uploaded

iOS **1.0.0 (5)** built from `5a4f483` and uploaded to App Store Connect. It
carries the gameweek leaderboards and the Results-tab scroll fix, so it — not
(4) — is the build to submit for review. See
[store-release.md](store-release.md#submitting).

## 2026-09-06 — Gameweek leaderboards in the app

The Leaderboard tab now toggles each league between **Overall** and **Gameweek**,
with ‹ › arrows to step back through previous rounds. It opens on the latest round
that has kicked off. New `GET /api/mobile/v1/leaderboards/round`; `playedRounds`
added to each `/leaderboards` block as the picker's range.

A round table is `computeLeaderboard(leagueId, { round })` — the existing function
with the predictions and the bonus awards filtered to one round, so the gameweek
and season tables cannot disagree. Web leaderboard unchanged; the shared function
is ready if it wants the same view. See [mobile.md](mobile.md) and
[features.md](features.md#leaderboard-leaderboard).

## 2026-09-06 — Fix: the Results tab could not scroll

The Results rewrite passed `screenPadding.pad` as the ScrollView's
`contentContainerStyle`. That style sets `flex: 1`, which pins the content
container to the viewport height, so the list could never grow and everything
past the first screenful was unreachable. Now uses `scrollContent`
(`flexGrow: 1`), which fills a short screen and grows past a long one.

The login and register screens had the same style on a scrollable form — no
report against them, but a form that cannot scroll under a keyboard on a small
phone is the same bug, so they moved too. `lib/mobileScreenPadding.test.ts`
now fails if `pad` is used as a scroll container's style anywhere in the app.

## 2026-09-05 — First build uploaded to App Store Connect

iOS **1.0.0 (4)** built from `1b662b1` and uploaded via `eas submit`. It is the
first binary Apple has seen — the August production build was never uploaded — so
it carries everything since: the support page, finished competitions, the
reorganised Results tab and the account icon. Submitting for review remains a
human pressing a button in App Store Connect. See
[store-release.md](store-release.md#submitting).

## 2026-09-05 — Support page for the store listings

New public `/support`: a real FAQ (leagues and invite codes, the kickoff deadline,
autosave, the banker, why points can move, finished competitions, notifications,
password resets, account deletion) plus `support@scorersonline.uk` with a stated
two-working-day reply. Both stores require a Support URL; ours pointed at `/rules`,
which is the rules of the game and answers none of the questions a support URL is
for. Linked from the login footer and the app's Account screen.

Inbound email now exists at all: the apex domain had **no MX records**, so
`privacy@scorersonline.uk` — printed on the live privacy policy — had been bouncing
since that page shipped. Cloudflare Email Routing now forwards `support@` and
`privacy@`. See [deployment.md](deployment.md#inbound-email).

Also corrected three places that still described the account screen as a button at
the bottom of the Leagues tab after it moved to the header icon — the privacy page,
the store readiness table, and the **App Review notes**, where a reviewer following
a dead path to account deletion is a rejection risk. See
[features.md](features.md#support-page-support).

## 2026-09-05 — Finished competitions, and a Results tab that reads like the web's

Hosts can tick **Finished** on a competition at `/host/competitions`. It then drops out
of Predict, Results, the leaderboard, auto-import and reminder emails — on the website
and in the app — while keeping every fixture, prediction and standing; its leagues move
to a "Finished leagues" section and the final table stays at `/leaderboard?archived=1`.
New column `Competition.archivedAt`, filtered in one place (`resolvePeerContext()`).
See [features.md](features.md#finishing-a-competition-host-only).

In the app: the Results tab now mirrors the web page — flat always-open sections,
newest round first, newest fixture first within a round, and a per-round subtotal
including the streak bonus (new `GET /api/mobile/v1/bonuses`). It had been sorting
oldest-first and capping at 12 rounds, so recent results could vanish entirely behind
a collapsed accordion. The Account screen moved from a button at the bottom of Leagues
to a person icon in the top-right header. See [mobile.md](mobile.md).

## 2026-09-05 — Expo Go does run the app (docs were wrong)

`store-release.md` and `apps/mobile/README.md` both claimed App Store Expo Go could
not run SDK 57, sending anyone who wanted to try the app on a phone through an Apple
Developer enrolment first. It is no longer true: Expo Go ships the latest SDK, which
is 57, and the iOS bundle builds and serves with `runtimeVersion: exposdk:57.0.0`.
Added `npm run start:go` in `apps/mobile` and rewrote both docs — Expo Go for everyday
on-device testing, an EAS development build only for push notifications, `scorers://`
deep links and TestFlight. No app code changed. See
[store-release.md](store-release.md#test-on-your-iphone).

## 2026-09-04 — Mobile app reconciled for store submission

The store-prep work and `main` had diverged: one had account deletion, the privacy page
and the scoreboard UI, the other had league-mate picks, autosave and the
Predictions/Results tab split. Merged them — `FixtureCard` keeps `main`'s behaviour in
the branch's visual language — and fixed `results.tsx`, whose `onSave` prop had not been
updated when autosave landed, leaving the mobile app failing `tsc` on `main`. Privacy
policy is now linked from the Account screen and the sign-up form. Store screenshots
recaptured against the merged app. See [store-release.md](store-release.md).

## 2026-09-04 — Host gameweek editor

New `/host/fixtures/editor`: every fixture for one competition, grouped by gameweek,
with bulk move-to-gameweek and bulk delete. Built for rounds that don't divide evenly
later in a season. Refuses to touch settled fixtures or delete fixtures carrying
predictions, and resolves the duplicate-banker case a move can create. See
[features.md](features.md#gameweek-editor-guards).

## 2026-09-04 — Predict tab shows only the current and next gameweek

The Open section rendered every scheduled fixture in the database, so gameweeks months
out (Matchweek 8, 9) sat on the predict tab alongside the round with a live deadline.
The auto-import only tops up two rounds, but nothing pruned or hid rounds that arrived
another way. Now capped at two rounds per competition at render time
(`takeNearestRounds`), applied before the banker header and deadline nudge derive from
it. See [features.md](features.md#predictions-).

## 2026-08-30 — Alerting on cron failures and 5xx

Neither GCP project had any notification channel or alert policy. `/api/cron/resolve`
runs every 10 minutes and nothing watched it, so a silent failure would have stopped
scores updating indefinitely. Added two log-based Cloud Monitoring policies emailing the
site owner — scheduler job failures and Cloud Run 5xx — rate-limited to one email per
30 minutes. See [deployment.md](deployment.md#alerting).

## 2026-08-29 — Enable database backups; prune Artifact Registry

- **Cloud SQL backups enabled.** Prod had run with `backup_configuration.enabled = false`
  and no deletion protection — a live database with no recovery path. Now daily backups
  at 03:00, 7 retained backups, 7-day transaction log retention (PITR), and deletion
  protection at both the Terraform and API layers (~£0.50/month).
- **Artifact Registry cleanup policy.** Keeps the 5 most recent versions plus anything
  under 30 days; collects the rest.
- Documented that Cloud SQL `disk_type` is fixed at creation — changing it forces
  destroy-and-recreate of the instance.

Requires a manual `terraform apply` from `terraform/` (state is local; no Terraform CI).

## 2026-08-28 — Store submission readiness (Phase 5)
Closed the two hard App Store blockers and produced the listing. **Account
deletion** (guideline 5.1.1(v)): one `deleteUserAccount` shared by the web
`/profile` page and `DELETE /api/mobile/v1/me`, plus a new mobile Account
screen. **A real privacy policy** at `/privacy` — the store URL previously
pointed at `/rules`. Brought the native app's scoreboard UI in line with the
website (countdown chips, banker tag, outcome accents, points badges, "Nailed
it!", and a leaderboard with the form strip, podium ramp and exact counts);
`computeLeagueForm` is now shared by the web page and the mobile API. Added the
screenshot pipeline (`npm run store:shots`) and
[`store-assets/app-store-listing.md`](../store-assets/app-store-listing.md).
See [store-release.md](store-release.md).
## 2026-08-28 — League admins can see pick status on upcoming fixtures
Commissioners get `/admin/picks`: per-fixture and per-member views of who has predicted
on upcoming matches in their league. Scores stay hidden until kickoff — only picked vs
not yet. See [features.md](features.md#league-admin-admin--commissioners-only).
## 2026-08-22 — Auto-save predictions (web + mobile)
Open fixture score inputs save automatically once both sides are valid integers
(debounced ~450ms, also on blur). No Save button. Brief Saving / ✓ Saved feedback;
Banker enables after the first successful save. Same behaviour on the Expo Predictions
tab. See [features.md](features.md#predictions-).
## 2026-08-22 — Auto-confirm results from API; hosts can edit after
Results from football-data.org are applied automatically when the sweep finds them —
no provisional state or host **Accept All** step. Site hosts can enter missing results
or edit confirmed scores from `/host/results` and `/host/fixtures`; saving re-scores
predictions and streak bonuses. See [features.md](features.md#result-resolution).
## 2026-08-22 — Split Predictions and Results into separate tabs

Predictions (`/`) now holds **Open** and **Kicked Off** only; settled history moved to
**Results** (`/results`). The combined page had grown unbounded once every league-mate's
pick appeared on each settled fixture. Mobile mirrors the split with a fifth tab bar
destination. See [features.md](features.md#navigation--shell).
## 2026-08-22 — Results show every league-mate's picks (web + mobile)
The Predictions **Results** section now lists all league-mates' settled picks per
fixture (same peer visibility as Kicked Off), not just your own. Round headers still
show your subtotal and streak bonus. The mobile app matches: **Kicked off** and
**Results** fixture cards list every league-mate's pick once the fixture has kicked off.
See [features.md](features.md#predictions-) and [mobile.md](mobile.md).
## 2026-08-17 — Logo system (one source, every platform)
Picked the scoreline mark ("2–1", gold dash) from a three-concept pitch and redrew it as
geometry in `lib/mark.ts`. `npm run brand:assets` generates all ten raster assets from
it: favicon, apple-icon, OG image, iOS icon, the three Android adaptive layers, splash,
and the in-app lockup. The mobile app had been shipping the **stock Expo icon** on every
platform. See [design-system.md](design-system.md#logo).

## 2026-08-16 — Mobile Phases 3–4 (player app + push)
Expo app: predictions with banker, stacked leaderboards, create/join/share leagues,
forgot-password, invite deep link `scorers://join?code=`. Server: `MobileDeviceToken`,
`/api/mobile/v1/devices`, deadline reminders also send Expo push. Store checklist in
[store-release.md](store-release.md). 206 tests.

## 2026-08-16 — Mobile Phase 2 Expo skeleton
`apps/mobile` Expo Router app: login/register, SecureStore tokens, API client with
refresh, tabs (Predictions / Leaderboard / Leagues / Rules), Quiet Product tokens.
Rules tab hits live `/api/mobile/v1/rules`. Bundle id `uk.scorersonline.app`. See
[mobile.md](mobile.md) and `apps/mobile/README.md`.

## 2026-08-16 — Mobile Phase 1 API (`/api/mobile/v1`)
Player API for the future Expo apps: register/login, access JWT (30m) + rotating
DB-backed refresh tokens (30d), me/rules/fixtures/predictions/leagues/competitions/
leaderboards. Bots keep `/api/v1` unchanged. Migration adds `MobileRefreshToken`.
202 tests. Contract: [mobile.md](mobile.md).

## 2026-08-16 — Native apps planned (Expo + mobile API contract)
Agreed to build iOS/Android with Expo in a monorepo. Documented stack, v1 scope, and
Phase 1 `/api/mobile/v1` auth + player endpoints in [mobile.md](mobile.md). No app or
API code yet — next implementation step is the mobile API.

## 2026-08-16 — Close points now follow the real Superbru rule
`scoreOnePrediction` was awarding 1.5 for *any* matching goal difference. The actual
Superbru rule is the right result **and** a scoreline within one goal: one side exact and
the other out by one (2–0 for a 2–1), or both out by one the same way (3–2 for a 2–1).
Equivalent to Superbru's Closeness Index ≤ 1.5. The old rule was wrong both ways — it
paid 1.5 for 5–4 on a 2–1 or 4–4 on a 1–1, and only 1 for 2–0 on a 2–1. Existing
`pointsAwarded` values are **not** rescored. 178 tests.

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
