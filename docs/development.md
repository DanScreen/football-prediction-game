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

## Deploying

Push to `main` → GitHub Actions runs migrations then builds & deploys to Cloud Run.
Details, secrets, and the domain proxy are in [deployment.md](deployment.md).
