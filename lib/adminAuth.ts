import { cookies } from "next/headers"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/activeLeague"

/**
 * Throws unless the current user is a site host. Re-checks the DB rather than
 * trusting the JWT so a revocation takes effect immediately.
 */
export async function requireSiteAdmin() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorised")
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSiteAdmin: true },
  })
  if (!user?.isSiteAdmin) throw new Error("Unauthorised")
  return { userId: session.user.id }
}

/** Throws unless the current user is COMMISSIONER of the active league. */
export async function requireCommissioner() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorised")
  const store = await cookies()
  const leagueId = store.get(ACTIVE_LEAGUE_COOKIE)?.value
  if (!leagueId) throw new Error("No active league")
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  })
  if (membership?.role !== "COMMISSIONER") throw new Error("Unauthorised")
  return { userId: session.user.id, leagueId }
}
