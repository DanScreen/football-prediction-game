import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"
import { provisionalScore, provisionalPoints } from "@/lib/provisional"

function fixtureStatusFilter(status: string | null) {
  const now = new Date()
  if (status === "open") {
    return { status: "SCHEDULED" as const, kickoffTime: { gt: now } }
  }
  if (status === "locked") {
    return {
      OR: [
        { status: "SCHEDULED" as const, kickoffTime: { lte: now } },
        { status: "AWAITING_RESULT" as const },
      ],
    }
  }
  if (status === "completed") {
    return { status: "COMPLETED" as const }
  }
  // omit, "all", or unknown → no status filter
  return {}
}

export async function GET(request: NextRequest) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id },
    select: { league: { select: { competitionId: true } } },
  })
  const competitionIds = [
    ...new Set(memberships.map((m) => m.league.competitionId)),
  ]
  if (competitionIds.length === 0) {
    return Response.json([])
  }

  const status = request.nextUrl.searchParams.get("status")
  const fixtures = await prisma.fixture.findMany({
    where: {
      competitionId: { in: competitionIds },
      ...fixtureStatusFilter(status),
    },
    orderBy: { kickoffTime: "asc" },
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
      predictions: {
        where: { userId: user.id },
        take: 1,
        select: {
          predictedHomeScore: true,
          predictedAwayScore: true,
          isBanker: true,
          pointsAwarded: true,
        },
      },
    },
  })

  return Response.json(
    fixtures.map((f) => {
      const prov = provisionalScore(f)
      const pred = f.predictions[0]
      return {
        id: f.id,
        competitionId: f.competitionId,
        competitionName: f.competition.name,
        round: f.round,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        kickoffTime: f.kickoffTime,
        status: f.status,
        actualHomeScore: f.actualHomeScore,
        actualAwayScore: f.actualAwayScore,
        provisionalHomeScore: prov?.home ?? null,
        provisionalAwayScore: prov?.away ?? null,
        prediction: pred
          ? {
              homeScore: pred.predictedHomeScore,
              awayScore: pred.predictedAwayScore,
              isBanker: pred.isBanker,
              pointsAwarded: pred.pointsAwarded,
              provisionalPoints: provisionalPoints(pred, f),
            }
          : null,
      }
    }),
  )
}
