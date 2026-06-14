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

/**
 * Returns true if a user correctly predicted the result (W/D/L) for every
 * fixture in a round — used to evaluate Grand Slam bonus eligibility.
 * Pass an empty array and it returns false (no fixtures = no slam).
 */
export function qualifiesForGrandSlam(resultCorrect: boolean[]): boolean {
  return resultCorrect.length > 0 && resultCorrect.every(Boolean)
}
