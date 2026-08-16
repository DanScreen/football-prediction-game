import { type NextRequest } from "next/server"
import { authenticateApiKey, resolveLeagueId } from "@/lib/apiAuth"
import { computeLeaderboard } from "@/lib/leaderboard"

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const leagueIdParam = request.nextUrl.searchParams.get("leagueId")
  const leagueId = await resolveLeagueId(user.id, leagueIdParam)
  if (!leagueId) return Response.json({ error: "No league found" }, { status: 404 })

  const ranked = await computeLeaderboard(leagueId)

  // `totalPoints` remains confirmed points (unchanged meaning for bots);
  // provisional/projected are additive display fields.
  return Response.json(
    ranked.map((e) => ({
      rank: e.rank,
      id: e.id,
      displayName: e.displayName,
      isBot: e.isBot,
      totalPoints: e.confirmedPoints,
      provisionalPoints: e.provisionalPoints,
      projectedPoints: e.confirmedPoints + e.provisionalPoints,
      exactCount: e.exactCount,
      streakPoints: e.streakPoints,
      // Where totalPoints came from; the five sum to totalPoints exactly.
      pointsBreakdown: e.breakdown,
    })),
  )
}
