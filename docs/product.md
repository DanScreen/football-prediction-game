# Product

## What Scorers is

**Scorers** is a football score-prediction game for a private group of friends.
Players predict exact scorelines for upcoming fixtures and earn points based on how
close they get once the real results come in. A shared leaderboard tracks standings
across a competition/season, styled like a real football table for a playful feel.

Live at **https://scorersonline.uk**.

## Who it's for

- **Players** — friends who join a league and predict scores through the web UI.
- **Bots** — automated prediction models that submit picks through the public API,
  competing on the same leaderboard as humans. This is a first-class use case, not
  an afterthought: Scorers is deliberately bot-friendly.
- **Site hosts** — the people who run the platform (currently just the owner). They
  own the competitions everyone plays in.
- **League commissioners** — a player who creates a league and manages its settings.

## The core idea (and what makes it different)

Most prediction games make every league re-enter the same fixtures and results.
Scorers separates the two concerns:

- **Site hosts own competitions** (e.g. Premier League, World Cup) and their
  canonical fixtures and results — imported and confirmed **once, centrally**.
- **Leagues subscribe to a competition** and automatically get its fixtures and
  results. From a league's perspective, fixtures and results are fully automatic —
  a commissioner never imports a fixture or confirms a result.

This "hub-and-spoke" model is the defining product decision. See
[decisions.md](decisions.md) for the rationale and [data-model.md](data-model.md)
for how it's modelled.

## Product goals

1. **Effortless for players.** Predict, see the leaderboard, done. No admin burden.
2. **Zero-touch fixtures & results.** Fixtures appear automatically; results are
   fetched automatically and confirmed by a host. Nobody chases spreadsheets.
3. **Trustworthy standings.** Results occasionally go wrong (postponements, TBD
   teams, ambiguous names). A human host confirms every result before it scores —
   but players still see **provisional** scores and points immediately, so the game
   feels live without letting bad data pollute the official table.
4. **Bots welcome.** Anything a human can do in the UI, a bot can do via the API.
5. **Fun, not corporate.** A playful, broadcast-scoreboard aesthetic with small
   celebration moments (an exact score gets a "Nailed it!"), not a dry admin tool.

## Scoring at a glance

| Outcome | Points |
|---|---|
| Exact score | 3 |
| Correct result, scoreline within one goal | 1.5 |
| Correct result only | 1 |
| Wrong result | 0 |

Plus a **banker** — one fixture per gameweek that scores double — and an optional
**streak bonus** of 1-3 points for calling most of a gameweek's results right. Full
detail in [features.md](features.md#scoring).

## Non-goals (for now)

- Paid competitions beyond what football-data.org's free tier covers (PL + World Cup).
- League discovery — you can only join a league with its invite link or code.
- Host/commissioner admin in the native apps — those stay on the web.

Native **player** apps (iOS + Android via Expo) are planned — see
[mobile.md](mobile.md). The site remains the full product; the apps cover the predict /
leaderboard / leagues loop.

See [roadmap.md](roadmap.md) for what's planned next.
