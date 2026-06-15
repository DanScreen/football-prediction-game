import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey } from "@/lib/apiAuth"

async function resolveLeagueId(userId: string, requested: string | null): Promise<string | null> {
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

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const leagueIdParam = request.nextUrl.searchParams.get("leagueId")
  const leagueId = await resolveLeagueId(user.id, leagueIdParam)
  if (!leagueId) return Response.json({ error: "No league found" }, { status: 404 })

  const predictions = await prisma.prediction.findMany({
    where: { userId: user.id, fixture: { leagueId } },
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
          competition: true,
          round: true,
          homeTeam: true,
          awayTeam: true,
          kickoffTime: true,
          status: true,
          actualHomeScore: true,
          actualAwayScore: true,
        },
      },
    },
  })

  return Response.json(
    predictions.map((p) => ({
      id: p.id,
      fixtureId: p.fixture.id,
      competition: p.fixture.competition,
      round: p.fixture.round,
      homeTeam: p.fixture.homeTeam,
      awayTeam: p.fixture.awayTeam,
      kickoffTime: p.fixture.kickoffTime,
      fixtureStatus: p.fixture.status,
      actualHomeScore: p.fixture.actualHomeScore,
      actualAwayScore: p.fixture.actualAwayScore,
      predictedHomeScore: p.predictedHomeScore,
      predictedAwayScore: p.predictedAwayScore,
      pointsAwarded: p.pointsAwarded,
      submittedVia: p.submittedVia,
      updatedAt: p.updatedAt,
    })),
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

  // Ensure this fixture belongs to a league the user is in
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId: fixture.leagueId } },
  })
  if (!membership) return Response.json({ error: "Fixture not found" }, { status: 404 })

  if (fixture.kickoffTime <= new Date()) {
    return Response.json(
      { error: "Deadline has passed — this fixture is locked" },
      { status: 422 },
    )
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_fixtureId: { userId: user.id, fixtureId } },
    create: {
      userId: user.id,
      fixtureId,
      predictedHomeScore: homeScore as number,
      predictedAwayScore: awayScore as number,
      submittedVia: "API",
    },
    update: {
      predictedHomeScore: homeScore as number,
      predictedAwayScore: awayScore as number,
    },
    select: {
      id: true,
      fixtureId: true,
      predictedHomeScore: true,
      predictedAwayScore: true,
      submittedVia: true,
      updatedAt: true,
    },
  })

  return Response.json({ prediction }, { status: 200 })
}
