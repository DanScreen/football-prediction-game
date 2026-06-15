# Football Prediction App — Project Spec

## 1. Overview

A web app where a private group of friends (plus optional "bot" accounts run by
automated prediction models) log in, submit predicted scorelines for upcoming
football fixtures, and earn points based on how accurate those predictions turn
out to be once real results come in. A shared leaderboard tracks standings over
the season/competition.

## 2. Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** SQLite via Prisma ORM — self-contained file-based DB, no
  external service or account needed
- **Auth:** NextAuth.js, credentials provider (email + password), sessions
- **AI result lookup:** Anthropic API (Claude with the web search tool)

Keeping everything self-contained (SQLite, no third-party data APIs) means the
whole stack can be built and run locally tonight with nothing to sign up for
except one thing — see "Prerequisites" below.

## 3. Users & Access

- **Roles:** Commissioner (admin) and Player. Bot accounts are just Players
  that happen to interact only via the API instead of the UI.
- **Registration** requires an invite code (set by the Commissioner) — keeps
  the league private to your group.
- Each user has: display name, optional "bot" flag (for a fun icon in the UI),
  and a personal API key for programmatic prediction submission.

## 4. Data Model

**User**
- id, email, passwordHash, displayName, isAdmin, isBot, apiKey, createdAt

**LeagueSettings** (single row)
- leagueName, inviteCode, grandSlamEnabled (bool), grandSlamPoints (int)

**Fixture**
- id, competition, round, homeTeam, awayTeam, kickoffTime
- status: `SCHEDULED` / `AWAITING_RESULT` / `COMPLETED`
- actualHomeScore, actualAwayScore (nullable)
- resultSource: `MANUAL` / `AI_CONFIRMED` (nullable until completed)

**Prediction**
- id, userId, fixtureId, predictedHomeScore, predictedAwayScore
- pointsAwarded (nullable until fixture completed)
- submittedVia: `WEB` / `API`
- unique on (userId, fixtureId) — one prediction per user per fixture, editable
  until the deadline

## 5. Core Features / Pages

### 5.1 Dashboard
Lists upcoming fixtures with a countdown to each prediction deadline (kickoff
time). Each fixture has a simple "home score / away score" input. Once a
fixture's deadline passes, the prediction locks and other users' picks become
visible (classic prediction-game etiquette).

### 5.2 My Predictions
History of the user's past predictions vs. actual results, with points earned
per fixture and a running total.

### 5.3 Leaderboard
League standings: total points, number of exact predictions, "form" over the
last few rounds. Styled like a real football table for the playful vibe.

### 5.4 Commissioner Panel (admin only)
- Add/edit fixtures (competition, teams, kickoff time)
- View "Pending Results" queue (fixtures past kickoff + buffer, awaiting a
  result)
- Trigger AI result lookup, review/confirm or manually override (see 5.5)
- Manage league settings (invite code, Grand Slam toggle)

### 5.5 Result Resolution (AI-assisted)
1. Once a fixture is ~2.5 hours past kickoff, it moves to `AWAITING_RESULT`
   and appears in the Commissioner's queue.
2. Commissioner clicks "Look up result" → server calls the Anthropic API
   (Claude + web search) with a prompt asking for the final score of
   `{homeTeam} vs {awayTeam}` on `{date}` in `{competition}`, requesting a
   short answer plus source.
3. The result and source are shown to the Commissioner, who can **Accept**
   (locks in the score and triggers scoring for all predictions), **Edit**
   (enter the correct score manually), or **Retry**.
4. This confirmation step exists because AI-sourced results can occasionally
   be wrong (postponements, ambiguous team names, etc.) — a quick human check
   keeps bad data off the leaderboard.

### 5.6 Public Prediction API (for bots)
All endpoints under `/api/v1/`, authenticated via `Authorization: Bearer <apiKey>`.

- `GET /fixtures?status=open` — fixtures still open for predictions, with
  deadlines
- `GET /predictions` — the authenticated user's own predictions
- `POST /predictions` — body `{ fixtureId, homeScore, awayScore }`; creates or
  updates a prediction, rejected if past the deadline
- `GET /leaderboard` — current standings

This lets your automated models submit picks the same way a human would via
the dashboard.

## 6. Scoring Rules (Superbru-style)

For each prediction, once the fixture's real result is confirmed:

| Outcome | Points |
|---|---|
| Exact score correct | 3 |
| Correct result (W/D/L) **and** correct goal difference, but not exact score | 1.5 |
| Correct result (W/D/L) only | 1 |
| Incorrect result | 0 |

**Grand Slam bonus (optional, toggleable in League Settings):** if a user
correctly predicts the *result* of every fixture in a round, they earn a bonus
(default 3 points, configurable). Off by default — flip on in Commissioner
settings if you want it.

## 7. Design Direction — Playful & Creative

- Pitch-green base palette with yellow/red "card" accent colors for fun
  moments (e.g., a red flash for a totally wrong prediction)
- Friendly, rounded headline font paired with a clean body sans-serif
- Light use of football iconography (⚽ 🏆 🟨) for status indicators
- Micro-interactions: a small celebration animation ("Nailed it!") when a user
  hits an exact score, animated point updates on the leaderboard
- Leaderboard table styled like a real league table, with a "form" strip
  (last 5 rounds) per player

## 8. Build Plan (phased checklist)

Have Claude Code turn this into a `TODO.md` it updates as it progresses:

1. **Setup** — Next.js + TS + Tailwind, Prisma + SQLite schema, NextAuth
   credentials provider
2. **Auth & users** — registration with invite code, login, session, profile
   page with API key generation
3. **Fixtures** — Commissioner UI to add/edit fixtures; dashboard list view
4. **Predictions** — submission UI with deadline locking; prediction storage
5. **Scoring engine** — implement the table in Section 6 as a pure function,
   with unit tests covering each tier and edge cases (0-0 draws, etc.)
6. **Result resolution** — manual entry first, then the AI-assisted lookup +
   confirmation flow
7. **Leaderboard** — standings page, points breakdown, form strip
8. **Public API** — `/api/v1/*` endpoints with API key auth
9. **Design pass** — apply the playful theme, animations, responsiveness
10. **Seed data & QA** — seed a handful of real upcoming fixtures, run through
    a full predict → resolve → score cycle end to end

## 9. Prerequisites You Need to Handle

- **`ANTHROPIC_API_KEY`** — needed for the AI result lookup feature. Grab one
  from the Anthropic Console and add it to `.env.local`. If you'd rather skip
  this for tonight, the build can stub this out and use manual result entry
  only — Claude can wire up the AI lookup later once the key is in place.
- **Initial fixtures** — decide on a competition and a few real upcoming
  matches to seed, or let Claude seed placeholder fixtures for testing.

## 10. Future Enhancements (out of scope for tonight)

- Multiple private leagues per user
- Live sports-data API as a fallback/alternative to AI lookups
- Email/push reminders before deadlines
- Social feed / trash talk between rounds
- PWA / mobile-friendly install
