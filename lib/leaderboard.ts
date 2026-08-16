import { prisma } from "@/lib/prisma"
import { scoreOnePrediction, BANKER_MULTIPLIER } from "@/lib/scoring"
import { provisionalPoints } from "@/lib/provisional"

export type PointsBreakdown = {
  /** Right result only (1 each). */
  result: number
  /** Right result, scoreline within one goal, not exact (1.5 each). */
  close: number
  /** Exact scoreline (3 each). */
  exact: number
  /** The *extra* points doubling produced — not the whole bankered fixture. */
  banker: number
  /** Streak bonuses, which sit outside a prediction's own points. */
  streak: number
}

export type LeaderboardEntry = {
  id: string
  displayName: string
  isBot: boolean
  /** Confirmed points (pointsAwarded + streak bonuses) — authoritative. */
  confirmedPoints: number
  /** Points from proposed-but-unconfirmed results. Display only. */
  provisionalPoints: number
  exactCount: number
  /**
   * Where the confirmed points came from. These five sum to `confirmedPoints`
   * exactly, so the row always adds up on screen.
   *
   * Derived from the *stored* `pointsAwarded` rather than recomputed from the
   * scoreline: the stored figure is what actually counts, so splitting it can't
   * drift away from the total the way a parallel recomputation could.
   */
  breakdown: PointsBreakdown
  /** Total streak-bonus points earned. Tiered 1-3, so a count would hide size. */
  streakPoints: number
  /** Rank by confirmed points (standings never move on provisional data). */
  rank: number
}

/**
 * Compute a league's standings from its members' predictions on the league's
 * competition fixtures. Shared by the leaderboard page and /api/v1/leaderboard.
 */
export async function computeLeaderboard(leagueId: string): Promise<LeaderboardEntry[]> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { competitionId: true, memberships: { select: { userId: true } } },
  })
  if (!league) return []
  const memberIds = league.memberships.map((m) => m.userId)

  const [users, predictions, bonusAwards] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, displayName: true, isBot: true },
    }),
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        fixture: { competitionId: league.competitionId },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        // Needed so provisional points double for a banker, the way confirmed
        // points already do via the stored pointsAwarded.
        isBanker: true,
        fixture: {
          select: {
            status: true,
            actualHomeScore: true,
            actualAwayScore: true,
            proposedHomeScore: true,
            proposedAwayScore: true,
          },
        },
      },
    }),
    prisma.bonusAward.findMany({
      where: { leagueId },
      select: { userId: true, points: true },
    }),
  ])

  const bonusByUser = new Map<string, number>()
  for (const b of bonusAwards) {
    bonusByUser.set(b.userId, (bonusByUser.get(b.userId) ?? 0) + b.points)
  }

  const entries = users
    .map((user) => {
      const preds = predictions.filter((p) => p.userId === user.id)
      const bonus = bonusByUser.get(user.id) ?? 0

      const confirmedPoints =
        preds.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0) + bonus

      const breakdown: PointsBreakdown = {
        result: 0,
        close: 0,
        exact: 0,
        banker: 0,
        streak: bonus,
      }
      for (const p of preds) {
        if (p.pointsAwarded === null) continue
        // Undo the multiplier to recover the base tier, then bank the extra
        // separately — so a bankered exact reads as 3 exact + 3 banker, not 6
        // in a bucket that claims to be "exact score" points.
        const base = p.isBanker ? p.pointsAwarded / BANKER_MULTIPLIER : p.pointsAwarded
        if (base === 3) breakdown.exact += base
        else if (base === 1.5) breakdown.close += base
        else if (base === 1) breakdown.result += base
        breakdown.banker += p.isBanker ? p.pointsAwarded - base : 0
      }

      const provisional = preds.reduce(
        (sum, p) => sum + (provisionalPoints(p, p.fixture) ?? 0),
        0,
      )

      const exactCount = preds.filter(
        (p) =>
          p.fixture.actualHomeScore !== null &&
          p.fixture.actualAwayScore !== null &&
          scoreOnePrediction(
            p.predictedHomeScore,
            p.predictedAwayScore,
            p.fixture.actualHomeScore,
            p.fixture.actualAwayScore,
          ) === 3,
      ).length

      return {
        id: user.id,
        displayName: user.displayName,
        isBot: user.isBot,
        confirmedPoints,
        provisionalPoints: provisional,
        exactCount,
        breakdown,
        streakPoints: bonus,
      }
    })
    .sort((a, b) => b.confirmedPoints - a.confirmedPoints)

  // Equal confirmed points share a rank
  const ranked: LeaderboardEntry[] = []
  entries.forEach((entry, i) => {
    const rank =
      i === 0
        ? 1
        : entries[i - 1].confirmedPoints === entry.confirmedPoints
          ? ranked[i - 1].rank
          : i + 1
    ranked.push({ ...entry, rank })
  })
  return ranked
}
