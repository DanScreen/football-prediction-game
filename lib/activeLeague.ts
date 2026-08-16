import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export const ACTIVE_LEAGUE_COOKIE = "activeLeagueId"

/** Raw cookie read. Prefer `resolveActiveLeagueId` — this does no validation. */
export async function getActiveLeagueId(): Promise<string | null> {
  const store = await cookies()
  return store.get(ACTIVE_LEAGUE_COOKIE)?.value ?? null
}

/**
 * The active league for a user, falling back sensibly.
 *
 * The cookie is only written when someone creates, joins or switches a league, so it
 * is routinely absent — a fresh sign-in, a new browser, cleared cookies. It can also
 * be stale, pointing at a league the user has since left. Pages redirect to /leagues
 * whenever they can't resolve a league, so without this fallback every destination
 * bounces to /leagues and the app looks like it has no working navigation.
 *
 * Resolution order:
 *   1. the cookie, if the user is still a member of that league
 *   2. their earliest-joined league
 *   3. null — they genuinely have no leagues yet
 *
 * Note this does not write the cookie back: Server Components can't set cookies during
 * render. It resolves per request instead, and the cookie is written the next time the
 * user explicitly picks a league.
 */
export async function resolveActiveLeagueId(userId: string): Promise<string | null> {
  const cookieLeagueId = await getActiveLeagueId()

  if (cookieLeagueId) {
    const membership = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId, leagueId: cookieLeagueId } },
      select: { leagueId: true },
    })
    if (membership) return membership.leagueId
  }

  const fallback = await prisma.leagueMembership.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { leagueId: true },
  })

  return fallback?.leagueId ?? null
}
