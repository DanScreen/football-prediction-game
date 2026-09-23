# Roadmap & Next Steps

> What's planned, known gaps, and parked ideas. When you ship something from here,
> move it to [changelog.md](changelog.md) and update [state.md](state.md).

**Last updated:** 2026-09-23

## Known gaps / near-term

Nothing is currently blocking, and the core product is live. Candidate next work:

- **Mobile Phase 5 — store release** — iOS 1.0.0 is live; **1.0.1 (8)** (email
  verification screen) is uploaded and waiting to be submitted for review. Google Play still to do.
  Checklist: [store-release.md](store-release.md).
- **Staging environment** — a second Cloud Run service + DB from a `staging` branch,
  to review changes before they hit the live site instead of pushing straight to prod.
  Now the only remaining safety gap in the pipeline (CI does gate on tests).
- **Wider accessibility audit** — the polish pass fixed the form strip and `ink-faint`
  contrast; nothing has systematically checked focus order or screen-reader flow.

### Mobile (Expo) — phased

Agreed stack and contract: [mobile.md](mobile.md).

1. **Phase 1** — Mobile API + auth ✅
2. **Phase 2** — Expo skeleton ✅
3. **Phase 3** — Player features ✅
4. **Phase 4** — Push, deep links, polish ✅
5. **Phase 5** — App Store + Play release ⏳ ([store-release.md](store-release.md))

## Product ideas (parked, not scoped)

These are wishlist items, noted for later:

- **Chips** — one-off boosts/wildcards a user can play on a fixture or round (a safety
  net against a wrong score, say), à la fantasy football. Needs a per-user/per-season
  budget and a way to flag the active chip on a prediction. The **banker** shipped on
  2026-08-16 is the always-available version of this; chips would be the scarce,
  strategic ones.
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

- Discovery/browsing of other people's leagues (leagues stay private — you need a link
  or code). Account creation itself is open; see [decisions.md](decisions.md).
- Host/commissioner tooling inside the native apps (web only).
- Wrapping the website in a WebView/Capacitor shell as a substitute for Expo (see
  [mobile.md](mobile.md)).
