import { prisma } from "@/lib/prisma"

/** League-mates visible on a competition — everyone sharing any league with the viewer. */
export async function resolvePeerContext(userId: string) {
  const memberships = await prisma.leagueMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      leagueId: true,
      league: {
        select: { competitionId: true, competition: { select: { id: true, name: true } } },
      },
    },
  })

  if (memberships.length === 0) return null

  const myLeagueIds = memberships.map((m) => m.leagueId)
  const leagueToCompetition = new Map(memberships.map((m) => [m.leagueId, m.league.competitionId]))
  const competitionIds = [...new Set(memberships.map((m) => m.league.competitionId))]

  const coMemberships = await prisma.leagueMembership.findMany({
    where: { leagueId: { in: myLeagueIds } },
    select: { leagueId: true, userId: true },
  })

  const peersByCompetition = new Map<string, Set<string>>()
  for (const m of coMemberships) {
    const competitionId = leagueToCompetition.get(m.leagueId)
    if (!competitionId) continue
    const set = peersByCompetition.get(competitionId) ?? new Set<string>()
    set.add(m.userId)
    peersByCompetition.set(competitionId, set)
  }
  const allPeerIds = [...new Set(coMemberships.map((m) => m.userId))]

  return {
    memberships,
    myLeagueIds,
    leagueToCompetition,
    competitionIds,
    peersByCompetition,
    allPeerIds,
  }
}
