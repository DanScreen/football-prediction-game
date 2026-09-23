import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError } from "@/lib/mobileHttp"

/**
 * The viewer's streak bonuses, rolled up per competition + round.
 *
 * The web results page folds these into each round's subtotal. The fixtures
 * payload can't carry them — a bonus is awarded per league, while fixtures are
 * league-agnostic — so the app fetches them alongside and adds them the same
 * way: every league the viewer holds on a competition contributes.
 */
export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id, league: { competition: { archivedAt: null } } },
    select: { leagueId: true, league: { select: { competitionId: true } } },
  })
  if (memberships.length === 0) return Response.json([])

  const leagueToCompetition = new Map(
    memberships.map((m) => [m.leagueId, m.league.competitionId]),
  )

  const awards = await prisma.bonusAward.findMany({
    where: { userId: user.id, leagueId: { in: [...leagueToCompetition.keys()] } },
    select: { leagueId: true, round: true, points: true },
  })

  const totals = new Map<string, { competitionId: string; round: string; points: number }>()
  for (const a of awards) {
    const competitionId = leagueToCompetition.get(a.leagueId)
    if (!competitionId) continue
    const key = `${competitionId}·${a.round}`
    const entry = totals.get(key)
    if (entry) entry.points += a.points
    else totals.set(key, { competitionId, round: a.round, points: a.points })
  }

  return Response.json([...totals.values()])
}
