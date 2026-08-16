type Result = "H" | "D" | "A"

function result(home: number, away: number): Result {
  if (home > away) return "H"
  if (away > home) return "A"
  return "D"
}

/**
 * Score a single prediction against the actual result.
 * Returns 3 / 1.5 / 1 / 0 per the Superbru-style rules in the spec.
 */
export function scoreOnePrediction(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (predictedHome === actualHome && predictedAway === actualAway) return 3

  const predictedResult = result(predictedHome, predictedAway)
  const actualResult = result(actualHome, actualAway)

  if (predictedResult !== actualResult) return 0

  const predictedDiff = predictedHome - predictedAway
  const actualDiff = actualHome - actualAway

  return predictedDiff === actualDiff ? 1.5 : 1
}

/** How much a banker pick multiplies its fixture's points by. */
export const BANKER_MULTIPLIER = 2

/**
 * Points as they actually count: base score, doubled if this was the user's
 * banker for the round.
 *
 * Kept separate from `scoreOnePrediction` because two callers need the *base*
 * figure — the streak bonus (which asks "was the result right?", not "how many
 * points?") and the round normalisation in `confirmFixtureResult`.
 * The minimum score is 0, so a banker is upside-only; the strategy is picking
 * the fixture you're most confident in, not risking anything on it.
 */
export function awardedPoints(base: number, isBanker: boolean): number {
  return isBanker ? base * BANKER_MULTIPLIER : base
}

/**
 * Streak bonus tiers: how many *results* (W/D/L) you got right in a gameweek,
 * and what that's worth on top of your base points.
 *
 * Ordered highest-first so the lookup returns the best tier reached. Replaced
 * the old all-or-nothing Grand Slam on 2026-08-16 — see decisions.md.
 */
export const STREAK_TIERS = [
  { minCorrect: 10, points: 3 },
  { minCorrect: 8, points: 2 },
  { minCorrect: 5, points: 1 },
] as const

/**
 * The streak bonus for getting `correctCount` results right in one gameweek.
 * Returns 0 below the lowest tier.
 */
export function streakPoints(correctCount: number): number {
  return STREAK_TIERS.find((t) => correctCount >= t.minCorrect)?.points ?? 0
}
