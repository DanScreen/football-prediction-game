# Decision Log

Why things are the way they are. Append a new entry when you make a non-obvious choice;
don't rewrite history — if a decision is later reversed, add a new entry that says so.

---

## Platform-owned competitions (hub-and-spoke)
Fixtures/results moved from per-league to a shared `Competition` that leagues subscribe
to (`League.competitionId`, `Fixture.competitionId`). **Why:** every league was
re-importing the same fixtures and re-confirming the same results — duplicated work and
data. Now site hosts own competitions and confirm results once; leagues get them
automatically. This replaced the old cross-league prediction sync — with canonical
fixtures, one prediction per user per fixture already counts across all their leagues.

## Site-host role via `SITE_ADMIN_EMAILS`
`User.isSiteAdmin`, bootstrapped from the `SITE_ADMIN_EMAILS` env var and synced on
login; `requireSiteAdmin()` re-checks the DB per request. **Why:** hosts are a
platform-level role distinct from per-league `COMMISSIONER`. Env-var bootstrapping means
no chicken-and-egg problem granting the first host, and the per-request DB re-check makes
revocation immediate. Gates `/host`; commissioners keep `/admin` (settings only).

## Provisional scores/points shown everywhere, ranked by confirmed
Once the sweep pre-fetches a proposed score, projected scores/points appear across the
predictions page, leaderboard, and API (badged amber), computed at read time
(`lib/provisional.ts`) and **never stored**. Standings rank by confirmed points only.
**Why:** the game should feel live the moment a result is known, but a human host must
still confirm before anything official scores (postponements, TBD teams, ambiguous
names). Provisional gives immediacy without letting unconfirmed data move the table.

## Host confirm queue, not auto-confirm (with Accept All)
Results are pre-fetched automatically but require host confirmation. **Why:** football
data is occasionally wrong; a quick human check keeps bad data off the leaderboard.
**Accept All** keeps it low-effort when the data is clean.

## Score once, fan out round bonuses per league
Confirming a result scores every prediction on the canonical fixture once, then awards
the round bonus per subscribing league (`lib/results.ts`). **Why:** base points are
competition-global (one canonical fixture) but *membership* is per-league, so the bonus
row has to exist once per league even though its value is now identical everywhere.
(Until 2026-08-16 the value varied too — see the streak-bonus entry below.)

## Cron cadence 30 min → 10 min
**Why:** with fixtures/results now automatic, tighter cadence means fresher imports and
faster provisional results. Cloud Scheduler cost at this frequency is negligible.

## Cron `app_url` points at the direct run.app URL
The scheduler calls the Cloud Run URL directly, not `scorersonline.uk`. **Why:** a
machine-to-machine cron call shouldn't depend on the Cloudflare Worker proxy; auth is
via `CRON_SECRET` so the Host header doesn't matter. (Also: the scheduler resource only
exists when `app_url` is set — it had never been created until this was configured.)

## Skip fixtures with undecided (TBD) teams on import
`fetchUpcomingFixtures` drops fixtures whose team names are null. **Why:** knockout
fixtures with undecided teams (e.g. World Cup semi-finals) come back with null names and
violated `Fixture.homeTeam` NOT NULL — this 500'd the entire resolve sweep in prod.

## Fresh-start migration for the refactor
The competitions-refactor migration deletes all Prediction/BonusAward/Fixture rows and
drops leagues that don't match a seeded competition. **Why:** the app was effectively
unused, so a clean cut was simpler and safer than a full data migration. Leagues are
backfilled to their `Competition` by name; unmatched ones (and their memberships) are
removed. Verified against a throwaway Docker Postgres before shipping.

---

## 2026-08-16 — Dark mode via token swap, not `dark:` variants

Tailwind's usual answer is a `dark:` variant per element. That was rejected: the app
had 137 stock colour classes across 26 files, so it would have meant ~137 paired
variants to write and keep in sync forever, and the design system already said "use the
tokens, don't hardcode".

Instead every stock colour became a semantic token (`good`/`bad`/`info` alongside the
existing `pitch`/`clock`), and the dark theme is a single `@media (prefers-color-scheme:
dark)` block redefining the variable *values*. No component has a dark-mode branch, and
new UI is dark-ready for free as long as it uses tokens.

Two consequences worth knowing:
- **`pitch-on`** exists because the accent inverts. In light, labels on a green button
  are white; in dark the green brightens for legibility as text, so labels must go
  near-black. `text-white` on a button is therefore always wrong.
- **`pitch-deep` is lighter than `pitch` in dark mode** — hover should still move toward
  the light.

**Three-state toggle** (System / Light / Dark) in the header, not a two-state switch:
"follow my OS" is a real preference and the default, so a light/dark switch would strand
anyone wanting to return to it. The choice is a non-`httpOnly` `theme` cookie — a device
preference rather than account data, so it survives sign-out — read server-side in the
root layout and rendered into `<html data-theme>`, which avoids a flash of the wrong
theme on first paint. `"system"` sets no attribute at all, letting the media query win.

Consequence: `lib/theme.ts` (pure constants, safe for Client Components) is deliberately
split from `lib/theme.server.ts` (the `next/headers` cookie read). Merging them breaks
the build, because the client toggle imports the constants.

**The board palette went from navy to deep pitch green** (`#0f4527` light, `#061a0f`
dark). The navy was inherited from the original "darker concept" pitch and read as a
borrowed element sitting apart from a product whose accent is green; gold on deep green
is also the more football image. It is *lighter* in light mode than in dark: against a
white page a near-black slab reads as a harsh hole, while against the dark ground it
must go deeper than the surface to stay a raised panel. `board-muted` follows in both
directions. Dropped `board-cyan` at the same time — defined but never used.

## 2026-08-16 — Bottom tab bar for mobile navigation

Chosen over a hamburger drawer. The app has only a handful of destinations and is
checked in short bursts around match times, so keeping them all one thumb-tap away beats
hiding them behind a menu that costs a tap and needs open/close state. The desktop top-bar nav
is unchanged; both render from one link list in `NavLinks.tsx`.

## 2026-08-16 — Merge Dashboard into Predictions, and scope pages by competition

Two changes with one root cause: the app applied "active league" to surfaces that aren't
per-league.

**Dashboard and My Predictions merged into `/`.** They showed the same thing either side
of kickoff — your picks and their results — and Dashboard was the only place you could
actually enter a prediction, so the split forced you between two pages to do one job.
One page now runs Open → Kicked Off → Results. `/predictions` is a permanent redirect.

**Predictions are scoped by competition, not league.** A `Prediction` is unique per
`(userId, fixtureId)` with no `leagueId`, so a pick already counts in every league on
that competition. Rendering this page per-league would have shown the same fixtures with
the same inputs once per league, all writing to the same row. Leagues only decide whose
picks appear beside yours — resolved as "everyone sharing a league with you *on that
competition*".

**The leaderboard stacks every league instead.** Standings are the one genuinely
per-league surface, so that is where seeing several at once pays for the page length,
and it removes the need to switch leagues to read a different table.

**Consequence:** the `activeLeagueId` cookie now only drives `/admin`, so it resolves
with a `COMMISSIONER` filter (`resolveCommissionerLeagueId`). Without the filter, a user
who is a plain member of their earliest league and commissioner of another gets bounced
out of `/admin`. The header's Admin chip likewise keys off commissioning *any* league.

## 2026-08-16 — Invite links, and sign-up is open by design

Sharing a league meant sharing a 6-character code and hoping the recipient found the
site, spotted "Register", and typed the code into an optional box. Now `/register?invite=
CODE` carries it for them and joins the league on account creation.

**The invite field was removed from sign-up entirely.** It was optional, so most people
had to ignore it, and it was the wrong place to ask: someone arriving from a link
shouldn't retype what the link already said, and someone arriving cold has no code. Codes
now belong on the "Join a league" form, where you use them once you have an account.

**Sign-up is open** — no code required to create an account, which is what the code has
always done despite the docs and on-page copy claiming "invite-only". Resolved in favour
of the behaviour: *leagues* are private (link or code required), *accounts* are not. The
login/register copy was corrected to match, which matters because that copy exists partly
to reassure Google Safe Browsing — it should be true.

Two deliberate consequences:
- **A bad invite code never blocks registration.** It arrives from a link the user can't
  see or fix, so failing them at the door would be hostile. They get the account and a
  notice to join a league later.
- **`normaliseInviteCode()` is used at both entry points.** They had drifted: registration
  did `.trim()` while joining did `.trim().toUpperCase()`, so a lowercase code was
  rejected at sign-up but accepted when joining.

## 2026-08-16 — Banker: one double-points pick per gameweek

**It cannot be a per-league toggle** (as the Grand Slam then was). `Prediction.pointsAwarded`
is competition-global — one pick, scored once, counting in every league on that
competition — so a doubling can't apply in one league and not another. The Grand Slam
got to be optional precisely because it lived in a separate per-league `BonusAward`
row. Banker is therefore on for everyone, everywhere. Making it optional would mean
per-league points, which is the design the competitions refactor deliberately removed.

**Stored as `isBanker` on Prediction, not a `BankerPick` table.** The multiplier applies
to one prediction's points, so it belongs on that row: scoring reads it where it already
is, and the leaderboard needs no extra join. The cost is that "one per (user,
competition, round)" can't be a unique index — `round` lives on Fixture — so
`setBanker()` enforces it in a transaction that clears the old pick and sets the new one
together. Acceptable: a single user racing themselves is the only contention.

**Two kickoff locks, both about hindsight.** You can't banker a fixture that has kicked
off, and you can't move a banker *off* one that has — otherwise you could bank the
Saturday lunchtime game, watch it go badly, and shift the double onto Sunday.

**`awardedPoints()` is separate from `scoreOnePrediction()`.** Two callers genuinely
need the undoubled figure: bonus eligibility asks "was the result right?", not "how
many points?", and the round-completion pass in `confirmFixtureResult` re-derives every
prediction in the round. That pass previously normalised to base points — left alone, it
would have silently stripped the double off a whole round the moment it completed. There
is a test pinning exactly that.

**Upside-only, and that's the intent.** The minimum score is 0, so a banker can never
cost points. The decision is which fixture you're most confident in, not how much to
risk — a risk-bearing version (halving a wrong banker) would punish the players who
predict the most fixtures, which runs against a game meant to be light to play.

## 2026-08-16 — Streak bonus replaces the Grand Slam

The Grand Slam paid a fixed bonus for getting *every* result in a round right. The
streak bonus pays **1 / 2 / 3** points for **5–7 / 8–9 / 10+** correct results in a
gameweek.

**Why tiers.** All-or-nothing almost never paid out — one wrong result in ten wiped the
whole bonus — so it was a rule most players read once and then ignored. Tiers give a
good week something to aim at without needing a perfect one, and the top tier still
rewards a clean sweep of a 10-fixture matchweek.

**It is no longer a per-league setting.** `grandSlamEnabled` / `grandSlamPoints` were
dropped from `League` (migration
`20260816010000_streak_bonus_replaces_grand_slam`). Scoring is now identical in every
league, which makes standings comparable and one less thing for a commissioner to get
wrong. `BonusAward` stays per-league because *membership* is per-league — the row must
exist once per league even though its value no longer varies.

**Consequences accepted:**
- **Rounds shorter than 5 fixtures can't pay anything.** Fine for a Premier League
  matchweek; a World Cup knockout round of 4 pays nothing. Judged acceptable rather than
  scaling the tiers to round size, which would make the rule harder to state than it is
  worth.
- **Existing `BonusAward` rows were left alone** by the migration. They record what was
  actually awarded at the time; deleting them would quietly remove points from settled
  rounds. New awards use the tiers from the next confirmed gameweek onwards.
- **`grandSlams` became `streakPoints` in the leaderboard and the public API** — a
  breaking field rename. It reports total bonus points rather than a count, because with
  tiers a count hides whether someone scored three 1s or three 3s.
- **`/rules` stopped being personalised.** Per-league Grand Slam settings were the only
  thing on it that varied.

**Tiers live in `STREAK_TIERS`** and every surface renders from it — the settings page,
`/rules`, and the scoring itself — so the numbers cannot drift apart.

**Close points follow Superbru exactly** (2026-08-16). "Close" is the right result plus
a scoreline within one goal, not merely a matching goal difference. Superbru express it
as a Closeness Index — `|your GD - actual GD| + |your total goals - actual total goals|
/ 2`, close at <= 1.5 — but the code checks per-side goal offsets instead, because the
two are provably equivalent and offsets are what players actually reason about.

Already-scored predictions were **not** rescored. The change moves points in both
directions, the affected rounds are settled, and silently restating finished
leaderboards is worse than a clean cutover. Anything confirmed before this date keeps
the points it was awarded.

---

## 2026-08-16 — Native apps via Expo in a monorepo; separate mobile API

Scorers will ship **iOS and Android** player apps with **Expo (React Native)**, in the
same git repo as the website (`apps/mobile/`, web relocates to `apps/web` later). Full
plan and Phase 1 contract: [mobile.md](mobile.md).

**Why Expo, not Swift+Kotlin or Flutter:** one TypeScript codebase, fits Cursor and the
existing Next stack, one path to both stores. **Why not a WebView/Capacitor shell:** the
product needs a real native client over HTTP, not the website framed in a store binary.

**Why a new `/api/mobile/v1` instead of `/api/v1`:** the bot API is API-key auth and
league-default scoped for automation. Phones need email/password → short-lived access +
rotating refresh tokens, and response shapes closer to the web player UX (competition-
scoped fixtures, stacked leaderboards). Bots stay on `/api/v1` unchanged.

**Why API before Expo UI:** without login and player endpoints, the app cannot do
anything real; scaffolding screens first would invent a fake client against cookies.

Host/commissioner flows remain web-only for v1.

---

## 2026-08-22 — Results section shows all league-mate picks

The Predictions **Results** section lists every league-mate's settled pick per fixture,
not just the viewer's. Same peer filter as Kicked Off (everyone sharing any league on
that competition). Round headers still show **your** subtotal and streak bonus only.
The mobile app mirrors this: `peerPredictions` on `/api/mobile/v1/fixtures` after
kickoff, shown on Kicked off and Results cards. **Why:** comparing picks after a round
settles is part of the social loop; hiding others' picks in Results while showing them
in Kicked Off was inconsistent. Open fixtures stay private until kickoff.

---

## Foundational stack decisions (earlier)

- **Prisma 7 + `@prisma/adapter-pg`** — Prisma 7 dropped no-adapter mode; the runtime
  client needs an explicit `pg.Pool` + `PrismaPg` adapter (`lib/prisma.ts`). Client is
  generated to `app/generated/prisma` (import from `@/app/generated/prisma/client`).
- **NextAuth v5 beta, JWT sessions** — stateless; no DB adapter for sessions. Both
  `AUTH_SECRET` and `NEXTAUTH_SECRET` must be set.
- **football-data.org for fixtures + results** — REST API, free tier covers PL + World
  Cup. No AI/LLM dependency for data. Manual entry is the fallback when unconfigured.
- **Cloud SQL ENTERPRISE edition** — required for `db-f1-micro` (ENTERPRISE_PLUS is the
  default but incompatible).
- **Cloud Run ↔ Cloud SQL via Unix socket** at runtime (`?host=/cloudsql/<instance>`);
  CI migrations use a TCP URL via the Cloud SQL Auth Proxy.
- **Active league in an `httpOnly` cookie** (`activeLeagueId`) rather than URL segments,
  keeping routes unchanged across league switches. Since 2026-08-16 this only affects
  `/admin` — see the IA entry above.
- **Cloudflare Worker for the custom domain** — europe-west2 supports neither Cloud Run
  domain mappings nor Firebase Hosting rewrites, so a Worker proxies the domain.
- **`"use server"` files export functions only** — Turbopack errors on exported
  constants; shared constants live in plain `.ts` files.
- **Route middleware is `proxy.ts`** (Next.js 16 convention), with `PUBLIC_PATHS` for
  unauthenticated routes.
