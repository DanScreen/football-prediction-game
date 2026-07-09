import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, resolveLeague } from "@/lib/apiAuth"
import { upsertPrediction } from "@/lib/predictions"
import { provisionalScore, provisionalPoints } from "@/lib/provisional"

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const leagueIdParam = request.nextUrl.searchParams.get("leagueId")
  const league = await resolveLeague(user.id, leagueIdParam)
  if (!league) return Response.json({ error: "No league found" }, { status: 404 })

  const predictions = await prisma.prediction.findMany({
    where: { userId: user.id, fixture: { competitionId: league.competitionId } },
    orderBy: { fixture: { kickoffTime: "desc" } },
    select: {
      id: true,
      predictedHomeScore: true,
      predictedAwayScore: true,
      pointsAwarded: true,
      submittedVia: true,
      updatedAt: true,
      fixture: {
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
      },
    },
  })

  return Response.json(
    predictions.map((p) => {
      const prov = provisionalScore(p.fixture)
      return {
        id: p.id,
        fixtureId: p.fixture.id,
        competition: p.fixture.competition.name,
        round: p.fixture.round,
        homeTeam: p.fixture.homeTeam,
        awayTeam: p.fixture.awayTeam,
        kickoffTime: p.fixture.kickoffTime,
        fixtureStatus: p.fixture.status,
        actualHomeScore: p.fixture.actualHomeScore,
        actualAwayScore: p.fixture.actualAwayScore,
        provisionalHomeScore: prov?.home ?? null,
        provisionalAwayScore: prov?.away ?? null,
        predictedHomeScore: p.predictedHomeScore,
        predictedAwayScore: p.predictedAwayScore,
        pointsAwarded: p.pointsAwarded,
        provisionalPoints: provisionalPoints(p, p.fixture),
        submittedVia: p.submittedVia,
        updatedAt: p.updatedAt,
      }
    }),
  )
}

export async function POST(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 })
  }

  const { fixtureId, homeScore, awayScore } = body as Record<string, unknown>

  if (typeof fixtureId !== "string" || !fixtureId) {
    return Response.json({ error: "fixtureId is required" }, { status: 400 })
  }
  if (!Number.isInteger(homeScore) || (homeScore as number) < 0) {
    return Response.json({ error: "homeScore must be a non-negative integer" }, { status: 400 })
  }
  if (!Number.isInteger(awayScore) || (awayScore as number) < 0) {
    return Response.json({ error: "awayScore must be a non-negative integer" }, { status: 400 })
  }

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  if (!fixture) return Response.json({ error: "Fixture not found" }, { status: 404 })

  // Ensure the user is in a league subscribed to this fixture's competition
  const membership = await prisma.leagueMembership.findFirst({
    where: { userId: user.id, league: { competitionId: fixture.competitionId } },
  })
  if (!membership) return Response.json({ error: "Fixture not found" }, { status: 404 })

  if (fixture.kickoffTime <= new Date()) {
    return Response.json(
      { error: "Deadline has passed — this fixture is locked" },
      { status: 422 },
    )
  }

  const saved = await upsertPrediction(
    user.id,
    fixture.id,
    homeScore as number,
    awayScore as number,
    "API",
  )

  return Response.json(
    {
      prediction: {
        id: saved.id,
        fixtureId: saved.fixtureId,
        predictedHomeScore: saved.predictedHomeScore,
        predictedAwayScore: saved.predictedAwayScore,
        submittedVia: saved.submittedVia,
        updatedAt: saved.updatedAt,
      },
    },
    { status: 200 },
  )
}
