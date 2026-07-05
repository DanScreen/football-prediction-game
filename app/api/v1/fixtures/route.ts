import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, resolveLeagueId } from "@/lib/apiAuth"

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // Scope to requested league (or first membership)
  const leagueIdParam = request.nextUrl.searchParams.get("leagueId")
  const leagueId = await resolveLeagueId(user.id, leagueIdParam)
  if (!leagueId) return Response.json({ error: "No league found" }, { status: 404 })

  const status = request.nextUrl.searchParams.get("status")

  const fixtures = await prisma.fixture.findMany({
    where: {
      leagueId,
      ...(status === "open" ? { status: "SCHEDULED", kickoffTime: { gt: new Date() } } : {}),
    },
    orderBy: { kickoffTime: "asc" },
    select: {
      id: true,
      competition: true,
      round: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      status: true,
      actualHomeScore: true,
      actualAwayScore: true,
    },
  })

  return Response.json(fixtures)
}
