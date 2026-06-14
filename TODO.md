# TODO — Footy Predictor

## Blocked
_(nothing blocked yet)_

## Decisions Made
- **Node.js installed via Homebrew** — not pre-installed; added via `brew install node` (v26.3.0).
- **Prisma v7 + better-sqlite3 adapter** — Prisma 7 dropped no-adapter mode; `@prisma/adapter-better-sqlite3` is the local SQLite path (avoids libsql/Turso dependency).
- **NextAuth v5 beta** — using JWT sessions (stateless) with credentials provider; no DB adapter needed for auth sessions.
- **Fixture import via AI** — no third-party football API; Commissioner can bulk-import upcoming fixtures using Claude + web search (same Anthropic API used for result resolution in Phase 6).

---

## Phase 1 — Setup ✅
- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind CSS
- [x] Configure Prisma with SQLite (better-sqlite3 adapter for Prisma v7)
- [x] Define Prisma schema (User, LeagueSettings, Fixture, Prediction)
- [x] Set up NextAuth.js v5 credentials provider (`auth.ts`)
- [x] Create `.env.local.example` with required keys
- [x] Initial git commit

## Phase 2 — Auth & Users ✅
- [x] Registration page with invite code gate
- [x] Login page + session handling
- [x] Profile page with API key generation
- [x] Route protection middleware (proxy.ts — Next.js 16 convention)

## Phase 3 — Fixtures ✅
- [x] Commissioner UI to add/edit fixtures
- [x] Dashboard fixture list view with countdown to deadline

## Phase 4 — Predictions ✅
- [x] Prediction submission UI (home/away score inputs per fixture)
- [x] Deadline locking logic (lock at kickoff time)
- [x] Prediction storage — upsert (one per user per fixture)
- [x] Reveal others' picks once deadline passes

## Phase 5 — Scoring Engine ✅
- [x] Pure scoring function implementing Section 6 rules
- [x] Unit tests: exact score (3 pts), correct result + goal diff (1.5 pts), correct result only (1 pt), wrong (0 pt)
- [x] Edge cases: 0-0 draws, same goal diff different result, draws
- [x] Grand Slam bonus logic (per-round, toggleable via LeagueSettings)

## Phase 6 — Result Resolution & Fixture Import ✅
- [x] Manual result entry by Commissioner
- [x] Fixture status transitions: SCHEDULED → AWAITING_RESULT → COMPLETED
- [x] Auto-move fixtures to AWAITING_RESULT ~2.5 h after kickoff (on-demand check)
- [x] AI-assisted result lookup via Anthropic API (Claude + web search tool)
- [x] Review/confirm flow: Accept / Edit / Retry
- [x] Graceful stub when ANTHROPIC_API_KEY is absent (manual-only mode)
- [x] AI-assisted fixture import — Commissioner enters competition + round, Claude fetches upcoming fixtures and proposes a list to confirm before inserting

## Phase 7 — Leaderboard ✅
- [x] Standings page: total points, exact predictions count
- [x] Form strip (last 5 rounds) per player
- [x] Styled as a real league table

## Phase 8 — Public API ✅
- [x] `GET /api/v1/fixtures?status=open`
- [x] `GET /api/v1/predictions`
- [x] `POST /api/v1/predictions`
- [x] `GET /api/v1/leaderboard`
- [x] API key auth middleware (`Authorization: Bearer <apiKey>`)

## Phase 9 — Design Pass ✅
- [x] Pitch-green palette with yellow/red card accent colours
- [x] Rounded headline font + clean body sans-serif
- [x] Football iconography (⚽ 🏆 🟨) for status indicators
- [x] Celebration animation for exact-score predictions ("Nailed it!")
- [x] Animated leaderboard point updates
- [x] Responsive / mobile-friendly layout

## Phase 10 — Seed Data & QA ✅
- [x] Seed real or placeholder upcoming fixtures
- [x] End-to-end cycle: predict → resolve → score
- [x] Final lint + build check
