import { prisma } from "@/lib/prisma"
import { recordActivity } from "@/lib/activity"

/** Extracts the Bearer token from an Authorization header and returns the matching user, or null. */
export async function authenticateApiKey(request: Request) {
  const auth = request.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const key = auth.slice("Bearer ".length).trim()
  if (!key) return null
  const user = await prisma.user.findUnique({ where: { apiKey: key } })
  // Bot API calls count as a visit on the "api" surface (one write a day).
  if (user) await recordActivity(user.id, "api")
  return user
}

/**
 * Resolves the league an API request is scoped to: the requested league if the
 * user is a member of it, otherwise the user's oldest membership. Null if neither.
 */
export async function resolveLeagueId(
  userId: string,
  requested: string | null,
): Promise<string | null> {
  if (requested) {
    const m = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId, leagueId: requested } },
    })
    return m ? requested : null
  }
  const first = await prisma.leagueMembership.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  })
  return first?.leagueId ?? null
}

/**
 * Like resolveLeagueId, but also returns the league's competitionId so routes
 * can scope fixture queries without a second lookup.
 */
export async function resolveLeague(
  userId: string,
  requested: string | null,
): Promise<{ id: string; competitionId: string } | null> {
  const leagueId = await resolveLeagueId(userId, requested)
  if (!leagueId) return null
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, competitionId: true },
  })
  return league
}
