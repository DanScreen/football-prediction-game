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
  return resolveLeagueId(userId, {})
}

/**
 * The league whose settings `/admin` manages.
 *
 * Predictions and leaderboards now cover every league at once, so the active-league
 * cookie only survives for the commissioner area. Resolving with a COMMISSIONER
 * filter matters: a user can be a plain member of the league they joined first and
 * commissioner of another, and falling back to the earliest league would bounce them
 * out of /admin entirely.
 */
export async function resolveCommissionerLeagueId(userId: string): Promise<string | null> {
  return resolveLeagueId(userId, { role: "COMMISSIONER" })
}

async function resolveLeagueId(
  userId: string,
  filter: { role?: string },
): Promise<string | null> {
  const cookieLeagueId = await getActiveLeagueId()

  if (cookieLeagueId) {
    const membership = await prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId, leagueId: cookieLeagueId } },
      select: { leagueId: true, role: true },
    })
    // The cookie only wins if it still satisfies the filter — a commissioner
    // looking at /admin shouldn't land on a league where they're a plain member.
    if (membership && (!filter.role || membership.role === filter.role)) {
      return membership.leagueId
    }
  }

  const fallback = await prisma.leagueMembership.findFirst({
    where: { userId, ...(filter.role ? { role: filter.role } : {}) },
    orderBy: { joinedAt: "asc" },
    select: { leagueId: true },
  })

  return fallback?.leagueId ?? null
}
