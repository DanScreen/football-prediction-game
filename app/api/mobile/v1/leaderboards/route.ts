import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"
import { computeLeaderboard } from "@/lib/leaderboard"

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: {
      league: {
        select: {
          id: true,
          name: true,
          competition: { select: { name: true } },
        },
      },
    },
  })

  const blocks = await Promise.all(
    memberships.map(async (m) => {
      const ranked = await computeLeaderboard(m.league.id)
      return {
        leagueId: m.league.id,
        leagueName: m.league.name,
        competitionName: m.league.competition.name,
        standings: ranked.map((e) => ({
          rank: e.rank,
          id: e.id,
          displayName: e.displayName,
          isBot: e.isBot,
          totalPoints: e.confirmedPoints,
          provisionalPoints: e.provisionalPoints,
          projectedPoints: e.confirmedPoints + e.provisionalPoints,
          exactCount: e.exactCount,
          streakPoints: e.streakPoints,
          pointsBreakdown: e.breakdown,
        })),
      }
    }),
  )

  return Response.json(blocks)
}
