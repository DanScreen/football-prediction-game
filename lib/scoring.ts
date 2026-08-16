type Result = "H" | "D" | "A"

function result(home: number, away: number): Result {
  if (home > away) return "H"
  if (away > home) return "A"
  return "D"
}

/**
 * Score a single prediction against the actual result.
 * Returns 3 / 1.5 / 1 / 0 per the Superbru rules.
 *
 * "Close" (1.5) needs the right result *and* a scoreline within one goal:
 * either one side spot-on and the other out by one (2-0 for a 2-1), or both
 * sides out by one in the same direction, which keeps the goal difference
 * (3-2 for a 2-1). Being out by one on both sides in *opposite* directions
 * (3-0 for a 2-1) is two goals away and only pays the result point.
 *
 * Equivalent to Superbru's Closeness Index scoring 1.5 or lower, where
 * CI = |your GD - actual GD| + |your total goals - actual total goals| / 2.
 * Expressed as goal offsets here because that's the rule players reason about.
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

  const homeOff = Math.abs(predictedHome - actualHome)
  const awayOff = Math.abs(predictedAway - actualAway)

  // More than one goal out on either side is never close.
  if (homeOff > 1 || awayOff > 1) return 1

  // Exactly one side out by one.
  if (homeOff + awayOff === 1) return 1.5

  // Both sides out by one: close only if that preserved the goal difference.
  return predictedHome - predictedAway === actualHome - actualAway ? 1.5 : 1
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
