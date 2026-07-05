import { prisma } from "@/lib/prisma"

/** Extracts the Bearer token from an Authorization header and returns the matching user, or null. */
export async function authenticateApiKey(request: Request) {
  const auth = request.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const key = auth.slice("Bearer ".length).trim()
  if (!key) return null
  return prisma.user.findUnique({ where: { apiKey: key } })
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
