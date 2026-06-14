# TODO — Footy Predictor

## Blocked
_(nothing blocked yet)_

## Decisions Made
- **Node.js installed via Homebrew** — not pre-installed; added via `brew install node` (v26.3.0).
- **Prisma v7 + better-sqlite3 adapter** — Prisma 7 dropped no-adapter mode; `@prisma/adapter-better-sqlite3` is the local SQLite path (avoids libsql/Turso dependency).
- **NextAuth v5 beta** — using JWT sessions (stateless) with credentials provider; no DB adapter needed for auth sessions.

---

## Phase 1 — Setup ✅
- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind CSS
- [x] Configure Prisma with SQLite (better-sqlite3 adapter for Prisma v7)
- [x] Define Prisma schema (User, LeagueSettings, Fixture, Prediction)
- [x] Set up NextAuth.js v5 credentials provider (`auth.ts`)
- [x] Create `.env.local.example` with required keys
- [x] Initial git commit

## Phase 2 — Auth & Users
- [ ] Registration page with invite code gate
- [ ] Login page + session handling
- [ ] Profile page with API key generation
- [ ] Route protection middleware

## Phase 3 — Fixtures
- [ ] Commissioner UI to add/edit fixtures
- [ ] Dashboard fixture list view with countdown to deadline

## Phase 4 — Predictions
- [ ] Prediction submission UI (home/away score inputs per fixture)
- [ ] Deadline locking logic (lock at kickoff time)
- [ ] Prediction storage — upsert (one per user per fixture)
- [ ] Reveal others' picks once deadline passes

## Phase 5 — Scoring Engine
- [ ] Pure scoring function implementing Section 6 rules
- [ ] Unit tests: exact score (3 pts), correct result + goal diff (1.5 pts), correct result only (1 pt), wrong (0 pt)
- [ ] Edge cases: 0-0 draws, same goal diff different result, draws
- [ ] Grand Slam bonus logic (per-round, toggleable via LeagueSettings)

## Phase 6 — Result Resolution
- [ ] Manual result entry by Commissioner
- [ ] Fixture status transitions: SCHEDULED → AWAITING_RESULT → COMPLETED
- [ ] Auto-move fixtures to AWAITING_RESULT ~2.5 h after kickoff (on-demand check)
- [ ] AI-assisted lookup via Anthropic API (Claude + web search tool)
- [ ] Review/confirm flow: Accept / Edit / Retry
- [ ] Graceful stub when ANTHROPIC_API_KEY is absent (manual-only mode)

## Phase 7 — Leaderboard
- [ ] Standings page: total points, exact predictions count
- [ ] Form strip (last 5 rounds) per player
- [ ] Styled as a real league table

## Phase 8 — Public API
- [ ] `GET /api/v1/fixtures?status=open`
- [ ] `GET /api/v1/predictions`
- [ ] `POST /api/v1/predictions`
- [ ] `GET /api/v1/leaderboard`
- [ ] API key auth middleware (`Authorization: Bearer <apiKey>`)

## Phase 9 — Design Pass
- [ ] Pitch-green palette with yellow/red card accent colours
- [ ] Rounded headline font + clean body sans-serif
- [ ] Football iconography (⚽ 🏆 🟨) for status indicators
- [ ] Celebration animation for exact-score predictions ("Nailed it!")
- [ ] Animated leaderboard point updates
- [ ] Responsive / mobile-friendly layout

## Phase 10 — Seed Data & QA
- [ ] Seed real or placeholder upcoming fixtures
- [ ] End-to-end cycle: predict → resolve → score
- [ ] Final lint + build check
