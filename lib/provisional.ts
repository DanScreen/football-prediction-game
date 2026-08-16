import { scoreOnePrediction, awardedPoints } from "@/lib/scoring"
import { FixtureStatus } from "@/app/generated/prisma/client"

export type ProvisionalFixture = {
  status: FixtureStatus
  proposedHomeScore: number | null
  proposedAwayScore: number | null
}

/**
 * The provisional (pre-confirmation) score for a fixture: the sweep's proposed
 * score while the fixture awaits host confirmation, else null.
 */
export function provisionalScore(
  f: ProvisionalFixture,
): { home: number; away: number } | null {
  if (
    f.status === FixtureStatus.AWAITING_RESULT &&
    f.proposedHomeScore !== null &&
    f.proposedAwayScore !== null
  ) {
    return { home: f.proposedHomeScore, away: f.proposedAwayScore }
  }
  return null
}

/**
 * Points a prediction would earn if the proposed score is confirmed as-is.
 * Never stored — computed at read time and shown badged as provisional.
 */
export function provisionalPoints(
  pred: { predictedHomeScore: number; predictedAwayScore: number; isBanker?: boolean },
  f: ProvisionalFixture,
): number | null {
  const score = provisionalScore(f)
  if (!score) return null
  const base = scoreOnePrediction(
    pred.predictedHomeScore,
    pred.predictedAwayScore,
    score.home,
    score.away,
  )
  return awardedPoints(base, pred.isBanker ?? false)
}
