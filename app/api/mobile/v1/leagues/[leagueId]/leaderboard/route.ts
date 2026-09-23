import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError } from "@/lib/mobileHttp"
import { computeLeaderboard } from "@/lib/leaderboard"

type Ctx = { params: Promise<{ leagueId: string }> }

export async function GET(request: Request, context: Ctx) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const { leagueId } = await context.params
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId } },
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
  if (!membership) return jsonError("League not found", 404)

  const ranked = await computeLeaderboard(leagueId)
  return Response.json({
    leagueId: membership.league.id,
    leagueName: membership.league.name,
    competitionName: membership.league.competition.name,
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
  })
}
