# Roadmap & Next Steps

> What's planned, known gaps, and parked ideas. When you ship something from here,
> move it to [changelog.md](changelog.md) and update [state.md](state.md).

**Last updated:** 2026-07-09

## Known gaps / near-term

Nothing is currently blocking, and the core product is live. Candidate next work:

- **Node 20 → 24 in CI** — bump `actions/checkout` and `actions/setup-node` in
  `.github/workflows/deploy.yml` to silence the deprecation warning.
- **Local Postgres for dev** — the dev machine has no local PostgreSQL, so
  migrations are authored offline (`prisma migrate diff`) and DB-backed flows can't
  be run locally without spinning up Docker. Documented in
  [development.md](development.md); a `docker compose` for a throwaway Postgres would
  smooth this out.
- **Staging environment** — a second Cloud Run service + DB from a `staging` branch,
  to review changes before they hit the live site instead of pushing straight to prod.

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
