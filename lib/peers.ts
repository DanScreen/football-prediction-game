import { prisma } from "@/lib/prisma"

/**
 * Prisma filter for competitions a host has *not* declared finished.
 *
 * Archived competitions keep every fixture, prediction and standing — they just
 * drop out of the player-facing core pages and the automated sweeps. Spread it
 * into a `competition` relation filter, e.g.
 * `where: { league: { competition: NOT_ARCHIVED } }`.
 */
export const NOT_ARCHIVED = { archivedAt: null } as const

/** League-mates visible on a competition — everyone sharing any league with the viewer. */
export async function resolvePeerContext(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
) {
  const allMemberships = await prisma.leagueMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      leagueId: true,
      league: {
        select: {
          name: true,
          competitionId: true,
          competition: { select: { id: true, name: true, archivedAt: true } },
        },
      },
    },
  })

  // `null` means "you are in no leagues at all" — distinct from "every league
  // you are in sits on a finished competition", which leaves `memberships`
  // empty but `archivedMemberships` populated. Pages tell the two apart so the
  // second case doesn't read as "you haven't joined anything yet".
  if (allMemberships.length === 0) return null

  const archivedMemberships = allMemberships.filter(
    (m) => m.league.competition.archivedAt !== null,
  )
  const memberships = includeArchived
    ? allMemberships
    : allMemberships.filter((m) => m.league.competition.archivedAt === null)

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
    /** Leagues on finished competitions — hidden from the core pages. */
    archivedMemberships,
    myLeagueIds,
    leagueToCompetition,
    competitionIds,
    peersByCompetition,
    allPeerIds,
  }
}
