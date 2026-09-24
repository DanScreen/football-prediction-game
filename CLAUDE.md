# CLAUDE.md

Operating instructions for AI agents working in this repo. (This file is auto-loaded
into context; the real documentation lives in [`docs/`](docs/README.md).)

## Start here

**Read [`docs/README.md`](docs/README.md) before doing anything.** It's the project
wiki's entry point and tells you exactly what to read and in what order. The minimum
orientation is:

1. [docs/product.md](docs/product.md) — what Scorers is and its goals
2. [docs/state.md](docs/state.md) — current state / what's live
3. [docs/roadmap.md](docs/roadmap.md) — what's next
4. [docs/architecture.md](docs/architecture.md) — stack + code map

Then load reference docs (`data-model`, `features`, `api`, `development`, `deployment`,
`design-system`, `decisions`, `changelog`) as your task requires.

## The golden rule: keep the docs current

**Whenever you change the codebase, update the docs the change affects, in the same
session.** A stale wiki is worse than none. The mapping (feature→`features.md`,
schema→`data-model.md`, infra→`deployment.md`, a rationale→`decisions.md`, anything
shipped→`changelog.md` + `state.md`/`roadmap.md`) is spelled out in
[docs/README.md](docs/README.md#3-the-golden-rule-update-the-docs-with-every-change).
If you finished a task and touched no docs, check that mapping — usually one applies.

## Working agreement

- Work in phases; run `npm run build` and `npx vitest run` before calling a change done,
  and fix issues before moving on. If the change touches routing, auth, forms or a user
  journey, also run `npm run e2e` (Playwright; needs `docker compose up -d`).
- Commit after each completed phase or meaningful sub-task, with a clear message. For
  outward-facing or destructive actions (pushing to `main`, running a destructive
  migration on prod), confirm with the user first.
- If you make a product decision the docs don't cover, make a sensible choice, record it
  in [docs/decisions.md](docs/decisions.md), and keep going.
- If you get blocked on something external (a missing credential, etc.), note it in
  [docs/state.md](docs/state.md) and move to unaffected work.

## Must-know gotchas (detail in the docs)

- **Homebrew Node:** prepend `PATH="/opt/homebrew/bin:$PATH"` to `npm`/`npx` commands.
- **Prisma 7:** import the client from `@/app/generated/prisma/client`; run
  `npx prisma generate` after schema edits. Migrations are authored offline
  (`prisma migrate diff --from-schema/--to-schema`) and applied by CI; verify them
  against the local Docker Postgres (`docker compose up -d`, port 55432) first.
- **Next.js 16:** route middleware is `proxy.ts` (not `middleware.ts`); new public pages
  must be added to `PUBLIC_PATHS`. It's a newer Next.js than your training data — check
  `node_modules/next/dist/docs/` when unsure.
- **`"use server"` files export functions only** (Turbopack constraint).
- Two auth tiers: `requireSiteAdmin()` (`/host`) and `requireCommissioner()` (`/admin`).

See [docs/development.md](docs/development.md) for the full list.
