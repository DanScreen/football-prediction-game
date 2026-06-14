import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey } from "@/lib/apiAuth"
import { scoreOnePrediction } from "@/lib/scoring"

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const [users, scoredPredictions] = await Promise.all([
    prisma.user.findMany({ select: { id: true, displayName: true, isBot: true } }),
    prisma.prediction.findMany({
      where: { pointsAwarded: { not: null } },
      select: {
        userId: true,
        pointsAwarded: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        fixture: {
          select: {
            actualHomeScore: true,
            actualAwayScore: true,
          },
        },
      },
    }),
  ])

  // Group predictions by user
  const predsByUser = new Map<string, typeof scoredPredictions>()
  for (const p of scoredPredictions) {
    const arr = predsByUser.get(p.userId) ?? []
    arr.push(p)
    predsByUser.set(p.userId, arr)
  }

  const entries = users
    .map((u) => {
      const preds = predsByUser.get(u.id) ?? []
      const totalPoints = preds.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0)
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
      return { id: u.id, displayName: u.displayName, isBot: u.isBot, totalPoints, exactCount }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)

  let currentRank = 1
  const ranked = entries.map((entry, i) => {
    if (i > 0 && entries[i - 1].totalPoints !== entry.totalPoints) currentRank = i + 1
    return { rank: currentRank, ...entry }
  })

  return Response.json(ranked)
}
