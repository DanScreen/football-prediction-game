import { prisma } from "@/lib/prisma"
import { scoreOnePrediction } from "@/lib/scoring"
import { provisionalPoints } from "@/lib/provisional"

export type LeaderboardEntry = {
  id: string
  displayName: string
  isBot: boolean
  /** Confirmed points (pointsAwarded + Grand Slam bonuses) — authoritative. */
  confirmedPoints: number
  /** Points from proposed-but-unconfirmed results. Display only. */
  provisionalPoints: number
  exactCount: number
  grandSlams: number
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

  const bonusByUser = new Map<string, { points: number; count: number }>()
  for (const b of bonusAwards) {
    const s = bonusByUser.get(b.userId) ?? { points: 0, count: 0 }
    bonusByUser.set(b.userId, { points: s.points + b.points, count: s.count + 1 })
  }

  const entries = users
    .map((user) => {
      const preds = predictions.filter((p) => p.userId === user.id)
      const bonus = bonusByUser.get(user.id) ?? { points: 0, count: 0 }

      const confirmedPoints =
        preds.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0) + bonus.points

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
        grandSlams: bonus.count,
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
