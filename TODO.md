# TODO — Footy Predictor

## Blocked
_(nothing blocked yet)_

## Decisions Made
- **Node.js installed via Homebrew** — not pre-installed; added via `brew install node` (v26.3.0).
- **Prisma v7 + better-sqlite3 adapter** — Prisma 7 dropped no-adapter mode; `@prisma/adapter-better-sqlite3` is the local SQLite path (avoids libsql/Turso dependency).
- **NextAuth v5 beta** — using JWT sessions (stateless) with credentials provider; no DB adapter needed for auth sessions.
- **Fixture import via football-data.org** — switched from Claude web search to the football-data.org REST API (free tier covers PL + WC). Claude is still used for AI result lookup only. Key: `FOOTBALL_DATA_API_KEY`.
- **Active league via cookie** — league context stored in `httpOnly` cookie `activeLeagueId` rather than URL segments, keeping all existing routes unchanged.
- **Cross-league prediction sync** — one prediction for a real-world match auto-copies to matching fixtures (same teams + kickoff) in the user's other leagues; no separate junction table needed.
- **Commissioner role per league** — `isAdmin` removed from User/session; admin access is gated by `LeagueMembership.role = "COMMISSIONER"` for the active league.
- **`"use server"` files export functions only** — Turbopack errors if a server-action file exports a constant; shared constants (e.g. `COMPETITIONS`) live in plain `.ts` files.

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

## Phase 11 — Multi-League Architecture ✅
- [x] Remove global invite-code gate — registration is now open; invite code optional (links user to a league on sign-up)
- [x] Schema: `League`, `LeagueMembership` (role: COMMISSIONER / MEMBER); `Fixture.leagueId`
- [x] Active league stored in `httpOnly` cookie; helper `lib/activeLeague.ts`
- [x] League creation: choose competition (Premier League / World Cup 2026), auto-import next round via AI, confirm fixtures before saving
- [x] League join via invite code; invite code shown on My Leagues page
- [x] "My Leagues" tab — list leagues, switch active league, view member/fixture counts
- [x] Dashboard scoped to active league — performance summary (rank, points, exact ⚽), upcoming fixtures with prediction inputs
- [x] `requireCommissioner()` pattern in all admin actions — DB membership check replaces `isAdmin` flag
- [x] Admin layout, fixtures, results, and import all scoped to active league
- [x] Cross-league prediction sync — submitting a prediction auto-copies to matching fixtures in user's other leagues
- [x] Leaderboard and Predictions pages scoped to active league
- [x] Public API endpoints accept optional `?leagueId=` param
- [x] Header shows Admin link only to commissioners of the active league
- [x] Seed updated: league with `competition`, 4 memberships (commissioner + 3 members), league-scoped fixtures

## Phase 12 — Fixture Import via football-data.org ✅
- [x] `lib/footballData.ts` — fetches scheduled matches from football-data.org v4 API
- [x] Competition → API code mapping: Premier League (`PL`), World Cup 2026 (`WC`)
- [x] Rounds selector (1 / 2 / 3) replaces free-text competition / round / season inputs
- [x] Admin import page reads competition from the active league (no user input needed)
- [x] `FOOTBALL_DATA_API_KEY` added to `.env.local.example`
- [x] Claude web search retained only for AI result lookup (not fixture import)
