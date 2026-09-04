import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"
import { computeLeaderboard, computeLeagueForm } from "@/lib/leaderboard"

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
      const [ranked, form] = await Promise.all([
        computeLeaderboard(m.league.id),
        computeLeagueForm(m.league.id),
      ])
      return {
        leagueId: m.league.id,
        leagueName: m.league.name,
        competitionName: m.league.competition.name,
        /** Round names behind the form strip, oldest → newest. */
        formRounds: form.rounds,
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
          /** One cell per `formRounds` entry, same order. */
          form: form.byUser.get(e.id) ?? [],
        })),
      }
    }),
  )

  return Response.json(blocks)
}
