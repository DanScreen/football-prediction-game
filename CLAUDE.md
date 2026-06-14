# CLAUDE.md

## Project

"Footy Predictor" — a private football score-prediction game for a small group
of friends, with a public API so automated prediction models can submit picks
alongside human users. The full functional spec, data model, scoring rules,
and phased build plan live in `FOOTY_PREDICTOR_SPEC.md` — read it in full
before starting any work.

## Working agreement

- Turn the Section 8 build plan in the spec into `TODO.md` and keep it updated
  as you go (check off items, split out sub-tasks you discover along the way).
- Work through phases in order. After each phase, run the dev server, build,
  and lint (and any tests you've added) — fix issues before moving on to the
  next phase.
- Commit to git after each completed phase or meaningful sub-task, with a
  clear, descriptive message. This is the main way progress gets reviewed
  later, so commit often.
- If you hit a product decision the spec doesn't cover, make a sensible
  choice, note it under a "Decisions made" section in `TODO.md` with a one-line
  rationale, and keep going rather than stopping to ask — there's nobody
  around to answer tonight.
- If you get properly stuck (not just a design judgment call, but something
  blocking, like a missing credential), note it clearly at the top of
  `TODO.md` under "Blocked" and move on to other phases that aren't affected.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + SQLite (file-based DB, no external service)
- NextAuth.js, credentials provider
- Anthropic API (Claude + web search tool) for AI-assisted result lookups

## Environment

- `.env.local` holds `ANTHROPIC_API_KEY`, `DATABASE_URL`, and NextAuth config —
  never commit this file. See `.env.local.example` for the expected keys.
- If `ANTHROPIC_API_KEY` is missing or empty, build the AI result-lookup
  feature behind a flag/stub so the rest of the app still works — manual
  result entry by the Commissioner should always be available regardless.

## Commands

Node.js (v26) is installed via Homebrew at `/opt/homebrew/bin`. All `npm`/`npx`
commands must be run with `PATH="/opt/homebrew/bin:$PATH"` prepended, or just
run them from a terminal where Homebrew is on the PATH.

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build + type check
- `npm run lint` — ESLint
- `npx prisma migrate dev` — apply schema changes and regenerate client
- `npx prisma generate` — regenerate the Prisma client after schema changes
- `npx prisma studio` — inspect the SQLite DB visually (useful for spot-checks)
