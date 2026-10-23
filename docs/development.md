# Development

Local setup, commands, testing, and the gotchas that will bite you.

## Environment gotcha: Homebrew Node

Node.js (v26) is installed via Homebrew at `/opt/homebrew/bin`. **All `npm`/`npx`
commands need Homebrew on the PATH** — prepend `PATH="/opt/homebrew/bin:$PATH"` or run
from a shell where Homebrew is already on PATH.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
docker compose up -d               # local Postgres (see below)
```

### Local database

There is no Postgres installed on the dev machine, so `docker-compose.yml` provides a
throwaway one on port **55432** (avoids clashing with any host Postgres on 5432):

```bash
docker compose up -d
export DATABASE_URL="postgresql://postgres:localdev@localhost:55432/football_prediction_app"
npx prisma migrate deploy   # applies all migrations in order
npx prisma db seed          # test users, competitions, fixtures
```

`docker compose down -v` wipes it for a clean start. This is dev-only — production is
Cloud SQL. Use the same container to verify risky migrations before pushing
(see [Migrations](#migrations)).

`.env.local` (never committed) — see [deployment.md](deployment.md) for the full list:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `FOOTBALL_DATA_API_KEY` | football-data.org key (free) — fixture import + result lookup |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | `openssl rand -base64 32` (both required by NextAuth v5 beta) |
| `SITE_ADMIN_EMAILS` | Comma-separated emails granted the host role on login |

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build **+ type check** |
| `npm run lint` | ESLint |
| `npx vitest run` | Full test suite (prisma/fetch mocked) |
| `npx vitest run <path>` | One test file |
| `npm run e2e` | Playwright end-to-end suite (needs Docker Postgres) — see [below](#end-to-end-tests) |
| `npm run e2e:ui` | The same in Playwright's UI mode, for watching or debugging a test |
| `npm run mobile:typecheck` | Typecheck the Expo app in `apps/mobile` |
| `cd apps/mobile && npm start` | Expo dev server (see `apps/mobile/README.md`) |
| `npx prisma generate` | Regenerate the client after schema edits (→ `app/generated/prisma`) |
| `npx prisma db seed` | Seed test data (competitions, host + members, fixtures) |
| `npx prisma studio` | Visual DB browser |

Test users from the seed (password `password123`): `host@football.test` (site admin),
`commissioner@football.test`, `alice@football.test`, `bob@football.test`,
`robo@football.test` (bot). League invite code: `GOAAALLL`.

## Testing

- Vitest, with `prisma` and `fetch` mocked — no DB needed to run tests.
- Domain logic in `lib/` is the priority for coverage (scoring, results, provisional,
  leaderboard, resolution, footballData, auth). Server actions and API routes are
  tested too.
- **When you change behaviour, add/adjust a test.** Run `npx vitest run` before
  considering a change done; run `npm run build` to catch type errors across pages.
- **If you touched `apps/mobile`, run `npm run mobile:typecheck` too.** It has its own
  lockfile and its own `tsc`, so neither the root build nor the test suite sees it.
- **If you touched routing, auth, forms or a user journey, run `npm run e2e`.** Unit
  tests mock the seams (cookies, `proxy.ts`, the DB) where this app's worst shipped
  bugs lived.

### End-to-end tests

Playwright drives Chromium against a **production build** (`next build` + `next start`)
on port **3217**, backed by a real Postgres database and a fake email service.
Specs live in `e2e/`, and Vitest ignores that folder.

```bash
docker compose up -d        # the same Postgres as local dev, on 55432
npm run e2e                 # build, reset the DB, run everything (~1 min)
E2E_SKIP_BUILD=1 npm run e2e   # reuse the last build when only tests changed
npx playwright test e2e/golden-path.spec.ts   # one file
npx playwright show-trace test-results/<test>/trace.zip   # after a failure
```

What `playwright.config.ts` starts, in order:

1. **`e2e/mail-sink.mjs`** (port 4025) stands in for Resend. The app sends to it
   because `RESEND_API_URL` points there. Tests read what was "sent" with
   `linkFromLatestEmail()` and follow the real links: verify email, password reset.
2. **`e2e/prepare-db.mjs`** drops and re-migrates `football_prediction_e2e` on every
   run. It refuses any database whose name doesn't end in `_e2e`. Your dev database is
   never touched, and each run also proves the migration history still builds.
3. **`next start`** runs with every env var set explicitly in `e2e/env.ts`. Your real
   Resend or football-data.org keys in `.env.local` can't leak in.

Overrides:

| Variable | Default |
|---|---|
| `E2E_SKIP_BUILD` | unset: build first |
| `E2E_APP_PORT` | `3217` |
| `MAIL_SINK_PORT` | `4025` |
| `E2E_DATABASE_URL` | `postgresql://postgres:localdev@localhost:55432/football_prediction_e2e` |

Each test **creates its own data** with the helpers in `e2e/support/db.ts`: a league
with unique team names, users, and picks. Tests then run in parallel on one database
without seeing each other. Arrange state in the DB, but **act and assert through the UI**.
The DB is only for things a player can't do, like moving the clock past kickoff.
`host@e2e.test` is the only site host (`SITE_ADMIN_EMAILS`), and every password is
`password123`.

Gotchas the suite already works around:

- **The helpers use raw SQL (`pg`), not Prisma.** The generated client uses
  `import.meta`, which Playwright's loader can't handle. Quote model and column names
  (`"LeagueMembership"`), and supply `id` and `updatedAt` yourself.
- **Timestamps are UTC in `timestamp without time zone` columns.** `pg` would write
  and read them in the machine's local time, which made a kickoff set "2 hours ago"
  land 1 hour ago during British Summer Time. `e2e/support/db.ts` forces UTC both
  ways, so keep using its pool.
- **Clicking a server-action button right after `goto` can lose the refresh.** If the
  click lands before React hydrates, the action still runs but the page doesn't
  re-render. Retry an idempotent click with `expect(async () => { … }).toPass()`, as in
  the golden path's "Check for Updates".
- **After a client-side navigation, wait for the new page's heading before filling
  fields.** `/login` and `/forgot-password` both have an "Email" field, so a fill can
  land on the old page.
- **Don't use `getByText` for a page's heading.** Since Next 16.4 the route announcer
  (`#__next-route-announcer__`) repeats it after a client-side navigation, so the
  locator matches twice and fails strict mode. Use `getByRole("heading", { name })`.
- **Locate by role and label**, not CSS. The fixture cards are
  `role="group"` named "Home v Away", which scopes the score inputs to one card.

## Continuous integration

Two workflows:

| Workflow | Runs on | Does |
|---|---|---|
| `.github/workflows/ci.yml` | pull requests | `vitest run` + `npm run build`; the Playwright suite against a Postgres service; mobile `tsc --noEmit` — three parallel jobs |
| `.github/workflows/deploy.yml` | push to `main` | the same checks as a gate, then migrations and the Cloud Run deploy |
| `.github/workflows/mobile-release.yml` | Deploy succeeded, or manual | EAS iOS build + auto-submit, only when `expo.version` is new — see [deployment.md](deployment.md#mobile-release) |

Before 2026-09-04 only `deploy.yml` existed, so **nothing gated a pull request** — which
is how `main` came to carry a mobile app that did not compile for two weeks
(`results.tsx` passed an `onSave` prop that autosave had removed).

The E2E job uploads `playwright-report/` and `test-results/` (with traces) as an
artifact when it fails. Download it from the run page, then run `npx playwright
show-report <dir>`. It runs on pull requests only. `deploy.yml` doesn't repeat it, so
a push straight to `main` skips it.

`npx eslint app lib` is **not** in CI yet: it exits 1 on two pre-existing errors
(`lib/mobileAuth.test.ts:76` uses `require()`, and `app/host/results/actions.ts:7`
imports `FixtureStatus` unused). Clear those and add the step.

## Migrations

> Migrations are **authored offline** (by diffing schemas, below) and applied by CI
> (`prisma migrate deploy`) on push to `main`. Nothing is generated against a live dev
> DB — but you can and should *verify* the result against the local Docker Postgres
> from [Setup](#local-database).

Author a migration by diffing schemas into SQL:

```bash
# copy the current (pre-edit) schema aside first, then edit prisma/schema.prisma
npx prisma migrate diff \
  --from-schema <old-schema.prisma> \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_<name>/migration.sql
```

Then hand-edit the SQL as needed (ordering, data backfills, seed inserts). **Gotcha:**
`--from-schema-datamodel` was **removed** in Prisma 7 — use `--from-schema` /
`--to-schema`.

### Verifying a migration against a throwaway Postgres (recommended for risky ones)

Because CI can't be a test bed for destructive SQL, verify locally first — start from a
clean database so you exercise the migration from scratch:

```bash
docker compose down -v && docker compose up -d
export DATABASE_URL="postgresql://postgres:localdev@localhost:55432/football_prediction_app"
npx prisma migrate deploy   # applies all migrations in order
npx prisma db seed          # confirms the seed still works
# ...insert representative legacy rows, re-apply, and assert the end state...
```

The competitions-refactor migration (`20260709000000_platform_competitions`) is a
worked example of a destructive, hand-edited migration with a data backfill — it was
verified exactly this way before shipping. See [decisions.md](decisions.md) and
[changelog.md](changelog.md).

## Conventions

- **`"use server"` files export functions only** — Turbopack errors on exported
  constants in a server-action file. Put shared constants in plain `.ts` files
  (e.g. `app/leagues/data.ts`).
- **New public pages must be added to `PUBLIC_PATHS` in `proxy.ts`** or they redirect
  to `/login`. (Route middleware is `proxy.ts`, not `middleware.ts`, in Next.js 16.)
  API prefixes `/api/v1`, `/api/mobile`, and `/api/cron` are allowlisted separately —
  each enforces its own auth inside the handler.
- **A space directly after a closing JSX tag is dropped** — `</strong> not the start`
  renders as `kickoffnot the start`. Write `</strong>{" "}` whenever inline emphasis is
  followed by more text. It compiles and lints clean, so it only shows up in the browser;
  `/rules` shipped with two of them before they were caught on screen.
- Import the Prisma client from `@/app/generated/prisma/client`.
- Match the surrounding code's style; keep comment density and naming consistent.

## Branches

Work on a branch, open a pull request into `main`, and merge once CI is green.
Don't leave branches behind after merging:

- **Remote:** the repo has **Automatically delete head branches** turned on (GitHub
  → Settings → General, turned on 2026-09-24). Merging a PR on GitHub deletes its
  branch. If you merge some other way, run `git push origin --delete <branch>`.
- **Local:** delete it yourself, and prune the gone remote-tracking refs:

  ```bash
  git fetch --prune origin
  git branch -d <branch>
  ```

  Use `-d`, not `-D`. It refuses a branch with commits that aren't on `main`, and
  that refusal is a useful warning. The one exception is a **squash** merge: its
  commits don't look merged, so check the PR really merged
  (`gh pr list --state merged --head <branch>`) before forcing with `-D`.
- **Worktrees:** git won't delete a branch that a worktree has checked out. Switch
  that worktree to another branch, or remove it (`git worktree remove <path>`), then
  delete the branch.
- **A branch whose PR was closed without merging:** leave it alone. Ask before
  deleting it, because it may hold the only copy of that work.

## Deploying

Push to `main` → GitHub Actions runs migrations then builds & deploys to Cloud Run.
Details, secrets, and the domain proxy are in [deployment.md](deployment.md).
