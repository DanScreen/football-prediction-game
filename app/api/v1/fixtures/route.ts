import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, resolveLeague } from "@/lib/apiAuth"
import { provisionalScore } from "@/lib/provisional"

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // Scope to requested league (or first membership), then to its competition
  const leagueIdParam = request.nextUrl.searchParams.get("leagueId")
  const league = await resolveLeague(user.id, leagueIdParam)
  if (!league) return Response.json({ error: "No league found" }, { status: 404 })

  const status = request.nextUrl.searchParams.get("status")

  const fixtures = await prisma.fixture.findMany({
    where: {
      competitionId: league.competitionId,
      ...(status === "open" ? { status: "SCHEDULED", kickoffTime: { gt: new Date() } } : {}),
    },
    orderBy: { kickoffTime: "asc" },
    select: {
      id: true,
      round: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      status: true,
      actualHomeScore: true,
      actualAwayScore: true,
      proposedHomeScore: true,
      proposedAwayScore: true,
      competition: { select: { name: true } },
    },
  })

  // Keep `competition` a string for bot compatibility; expose provisional scores.
  const body = fixtures.map((f) => {
    const prov = provisionalScore(f)
    return {
      id: f.id,
      competition: f.competition.name,
      round: f.round,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      kickoffTime: f.kickoffTime,
      status: f.status,
      actualHomeScore: f.actualHomeScore,
      actualAwayScore: f.actualAwayScore,
      provisionalHomeScore: prov?.home ?? null,
      provisionalAwayScore: prov?.away ?? null,
    }
  })

  return Response.json(body)
}
