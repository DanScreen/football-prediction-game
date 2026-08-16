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
 * figure — Grand Slam eligibility (which asks "was the result right?", not "how
 * many points?") and the round normalisation in `confirmFixtureResult`.
 * The minimum score is 0, so a banker is upside-only; the strategy is picking
 * the fixture you're most confident in, not risking anything on it.
 */
export function awardedPoints(base: number, isBanker: boolean): number {
  return isBanker ? base * BANKER_MULTIPLIER : base
}

/**
 * Returns true if a user correctly predicted the result (W/D/L) for every
 * fixture in a round — used to evaluate Grand Slam bonus eligibility.
 * Pass an empty array and it returns false (no fixtures = no slam).
 */
export function qualifiesForGrandSlam(resultCorrect: boolean[]): boolean {
  return resultCorrect.length > 0 && resultCorrect.every(Boolean)
}
