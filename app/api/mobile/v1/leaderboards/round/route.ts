import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"
import { computeLeaderboard } from "@/lib/leaderboard"

/**
 * One league's standings for a single round — the gameweek view behind the
 * Leaderboard tab's Overall/Gameweek toggle.
 *
 * Separate from `/leaderboards` rather than folded into it: a player reads one
 * gameweek at a time, so shipping every round's table with the overall one
 * would multiply that payload by the length of the season to show a table most
 * players never open. The round names come back with `/leaderboards`, so the
 * picker can render its whole range without calling this at all.
 *
 * Unlike `/leaderboards`, this takes a league id from the caller, so it must
 * prove membership itself — otherwise it would serve any league's standings to
 * anyone holding a valid token.
 */
export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const params = new URL(request.url).searchParams
  const leagueId = params.get("leagueId")
  const round = params.get("round")
  if (!leagueId || !round) return jsonError("leagueId and round are required", 400)

  const membership = await prisma.leagueMembership.findFirst({
    where: { userId: user.id, leagueId },
    select: { league: { select: { id: true, name: true } } },
  })
  // 404, not 403: whether a league exists is not something a non-member should
  // be able to probe with this endpoint.
  if (!membership) return jsonError("League not found", 404)

  const ranked = await computeLeaderboard(leagueId, { round })

  return Response.json({
    leagueId: membership.league.id,
    round,
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
      /** No form strip on a round table — form is a trend across rounds. */
      form: [],
    })),
  })
}
