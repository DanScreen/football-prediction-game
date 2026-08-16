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

## Score once, fan out Grand Slam bonuses per league
Confirming a result scores every prediction on the canonical fixture once, then awards
Grand Slam bonuses per subscribing league that has it enabled (`lib/results.ts`).
**Why:** base points are competition-global (one canonical fixture) but Grand Slam
settings and membership are per-league, so only the bonus needs to fan out.

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
