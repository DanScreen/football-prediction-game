import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError, readJsonBody } from "@/lib/mobileHttp"
import { upsertPrediction } from "@/lib/predictions"
import { provisionalScore, provisionalPoints } from "@/lib/provisional"
import { setBanker } from "@/lib/banker"

export async function GET(request: NextRequest) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const competitionId = request.nextUrl.searchParams.get("competitionId")

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id },
    select: { league: { select: { competitionId: true } } },
  })
  const allowed = new Set(memberships.map((m) => m.league.competitionId))
  if (allowed.size === 0) return Response.json([])

  if (competitionId && !allowed.has(competitionId)) {
    return jsonError("Competition not found", 404)
  }

  const competitionFilter = competitionId
    ? { competitionId }
    : { competitionId: { in: [...allowed] } }

  const predictions = await prisma.prediction.findMany({
    where: { userId: user.id, fixture: competitionFilter },
    orderBy: { fixture: { kickoffTime: "desc" } },
    select: {
      id: true,
      predictedHomeScore: true,
      predictedAwayScore: true,
      isBanker: true,
      pointsAwarded: true,
      submittedVia: true,
      updatedAt: true,
      fixture: {
        select: {
          id: true,
          competitionId: true,
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
        competitionId: p.fixture.competitionId,
        competitionName: p.fixture.competition.name,
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
        isBanker: p.isBanker,
        pointsAwarded: p.pointsAwarded,
        provisionalPoints: provisionalPoints(p, p.fixture),
        submittedVia: p.submittedVia,
        updatedAt: p.updatedAt,
      }
    }),
  )
}

export async function POST(request: NextRequest) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const { fixtureId, homeScore, awayScore, isBanker } = body

  if (typeof fixtureId !== "string" || !fixtureId) {
    return jsonError("fixtureId is required", 400)
  }
  if (!Number.isInteger(homeScore) || (homeScore as number) < 0) {
    return jsonError("homeScore must be a non-negative integer", 400)
  }
  if (!Number.isInteger(awayScore) || (awayScore as number) < 0) {
    return jsonError("awayScore must be a non-negative integer", 400)
  }
  if (isBanker !== undefined && typeof isBanker !== "boolean") {
    return jsonError("isBanker must be a boolean", 400)
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: {
      id: true,
      competitionId: true,
      kickoffTime: true,
      round: true,
      homeTeam: true,
      awayTeam: true,
      status: true,
      competition: { select: { name: true } },
    },
  })
  if (!fixture) return jsonError("Fixture not found", 404)

  const membership = await prisma.leagueMembership.findFirst({
    where: { userId: user.id, league: { competitionId: fixture.competitionId } },
  })
  if (!membership) return jsonError("Fixture not found", 404)

  if (fixture.kickoffTime <= new Date()) {
    return jsonError("Deadline has passed — this fixture is locked", 422)
  }

  const saved = await upsertPrediction(
    user.id,
    fixture.id,
    homeScore as number,
    awayScore as number,
    "API",
  )

  let bankerFlag = saved.isBanker
  if (isBanker !== undefined) {
    const result = await setBanker(user.id, fixture.id, isBanker)
    if (!result.ok) return jsonError(result.error, 422)
    bankerFlag = isBanker
  }

  return Response.json({
    prediction: {
      id: saved.id,
      fixtureId: saved.fixtureId,
      predictedHomeScore: saved.predictedHomeScore,
      predictedAwayScore: saved.predictedAwayScore,
      isBanker: bankerFlag,
      submittedVia: saved.submittedVia,
      updatedAt: saved.updatedAt,
      fixture: {
        id: fixture.id,
        competitionId: fixture.competitionId,
        competitionName: fixture.competition.name,
        round: fixture.round,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        kickoffTime: fixture.kickoffTime,
        status: fixture.status,
      },
    },
  })
}
