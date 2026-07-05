import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, resolveLeagueId } from "@/lib/apiAuth"
import { scoreOnePrediction } from "@/lib/scoring"

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const leagueIdParam = request.nextUrl.searchParams.get("leagueId")
  const leagueId = await resolveLeagueId(user.id, leagueIdParam)
  if (!leagueId) return Response.json({ error: "No league found" }, { status: 404 })

  const memberIds = (
    await prisma.leagueMembership.findMany({
      where: { leagueId },
      select: { userId: true },
    })
  ).map((m) => m.userId)

  const [users, scoredPredictions, bonusAwards] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, displayName: true, isBot: true },
    }),
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        fixture: { leagueId },
        pointsAwarded: { not: null },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        fixture: { select: { actualHomeScore: true, actualAwayScore: true } },
      },
    }),
    prisma.bonusAward.findMany({
      where: { leagueId },
      select: { userId: true, points: true },
    }),
  ])

  const predsByUser = new Map<string, typeof scoredPredictions>()
  for (const p of scoredPredictions) {
    const arr = predsByUser.get(p.userId) ?? []
    arr.push(p)
    predsByUser.set(p.userId, arr)
  }

  const bonusByUser = new Map<string, { points: number; count: number }>()
  for (const b of bonusAwards) {
    const s = bonusByUser.get(b.userId) ?? { points: 0, count: 0 }
    bonusByUser.set(b.userId, { points: s.points + b.points, count: s.count + 1 })
  }

  const entries = users
    .map((u) => {
      const preds = predsByUser.get(u.id) ?? []
      const bonus = bonusByUser.get(u.id) ?? { points: 0, count: 0 }
      const totalPoints =
        preds.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0) + bonus.points
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
        id: u.id,
        displayName: u.displayName,
        isBot: u.isBot,
        totalPoints,
        exactCount,
        grandSlams: bonus.count,
      }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)

  let currentRank = 1
  const ranked = entries.map((entry, i) => {
    if (i > 0 && entries[i - 1].totalPoints !== entry.totalPoints) currentRank = i + 1
    return { rank: currentRank, ...entry }
  })

  return Response.json(ranked)
}
