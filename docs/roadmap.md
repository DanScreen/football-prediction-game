# Roadmap & Next Steps

> What's planned, known gaps, and parked ideas. When you ship something from here,
> move it to [changelog.md](changelog.md) and update [state.md](state.md).

**Last updated:** 2026-08-16

## Known gaps / near-term

Nothing is currently blocking, and the core product is live. Candidate next work:

- **Staging environment** — a second Cloud Run service + DB from a `staging` branch,
  to review changes before they hit the live site instead of pushing straight to prod.
  Now the only remaining safety gap in the pipeline (CI does gate on tests).
- **Wider accessibility audit** — the polish pass fixed the form strip and `ink-faint`
  contrast; nothing has systematically checked focus order or screen-reader flow.

## Product ideas (parked, not scoped)

These are wishlist items, noted for later:

- **Chips** — one-off boosts/wildcards a user can play on a fixture or round (double
  points, safety net against a wrong score), à la fantasy football. Needs a
  per-user/per-season budget and a way to flag the active chip on a prediction.
- **Double-down pick** — each round a user nominates one fixture for double points.
- **Model arena** — a first-class mode pitting AI models/bot strategies against
  humans on the same leaderboard, for comparison and fun.
- **Downloadable summaries** — end-of-round/season exportable recap (image or PDF)
  with standings, best/worst predictions, streaks — shareable for bragging rights.
- **Nicknames with personality** — generated or user-chosen titles beside leaderboard
  entries instead of plain display names.
- **Social feed / comments** between rounds.
- **More competitions** — beyond PL + World Cup, which needs a paid football-data.org
  tier. The data model already supports arbitrary competitions; the constraint is the
  fixtures/results API coverage.

## Explicitly out of scope

- Public/open sign-up (leagues stay invite-only and private).
- Native mobile apps (responsive web only).
