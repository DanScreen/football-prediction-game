import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError } from "@/lib/mobileHttp"
import { provisionalScore, provisionalPoints } from "@/lib/provisional"
import { avatarPath } from "@/lib/avatar"
import {
  takeNearestFixturesByRound,
  VISIBLE_OPEN_ROUNDS,
} from "@/lib/visibleOpenRounds"

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

type RawPrediction = {
  userId: string
  predictedHomeScore: number
  predictedAwayScore: number
  isBanker: boolean
  pointsAwarded: number | null
  user: { id: string; displayName: string; isBot: boolean; avatarKey: string | null }
}

function mapPrediction(
  pred: RawPrediction,
  fixture: Parameters<typeof provisionalPoints>[1],
) {
  return {
    userId: pred.userId,
    displayName: pred.user.displayName,
    isBot: pred.user.isBot,
    avatarUrl: avatarPath(pred.user.avatarKey),
    homeScore: pred.predictedHomeScore,
    awayScore: pred.predictedAwayScore,
    isBanker: pred.isBanker,
    pointsAwarded: pred.pointsAwarded,
    provisionalPoints: provisionalPoints(pred, fixture),
  }
}

function sortPeerPredictions<T extends { userId: string; displayName: string }>(
  predictions: T[],
  viewerUserId: string,
) {
  return [...predictions].sort((a, b) => {
    if (a.userId === viewerUserId) return -1
    if (b.userId === viewerUserId) return 1
    return a.displayName.localeCompare(b.displayName, "en")
  })
}

export async function GET(request: NextRequest) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  // Finished competitions drop off the app's core tabs, exactly as they drop
  // off the website's. Their fixtures and predictions are untouched.
  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id, league: { competition: { archivedAt: null } } },
    select: {
      leagueId: true,
      league: { select: { competitionId: true } },
    },
  })
  const competitionIds = [...new Set(memberships.map((m) => m.league.competitionId))]
  if (competitionIds.length === 0) {
    return Response.json([])
  }

  const myLeagueIds = memberships.map((m) => m.leagueId)
  const leagueToCompetition = new Map(memberships.map((m) => [m.leagueId, m.league.competitionId]))
  const coMemberships = await prisma.leagueMembership.findMany({
    where: { leagueId: { in: myLeagueIds } },
    select: { leagueId: true, userId: true },
  })
  const peersByCompetition = new Map<string, Set<string>>()
  for (const m of coMemberships) {
    const competitionId = leagueToCompetition.get(m.leagueId)
    if (!competitionId) continue
    const set = peersByCompetition.get(competitionId) ?? new Set<string>()
    set.add(m.userId)
    peersByCompetition.set(competitionId, set)
  }
  const allPeerIds = [...new Set(coMemberships.map((m) => m.userId))]

  const status = request.nextUrl.searchParams.get("status")
  const now = new Date()
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
        where: { userId: { in: allPeerIds } },
        select: {
          userId: true,
          predictedHomeScore: true,
          predictedAwayScore: true,
          isBanker: true,
          pointsAwarded: true,
          user: { select: { id: true, displayName: true, isBot: true, avatarKey: true } },
        },
      },
    },
  })

  // Same cap as the web predict tab: current + next gameweek per competition.
  // Applied here so already-shipped app builds pick it up without a store update.
  const visible =
    status === "open" ? takeNearestFixturesByRound(fixtures, VISIBLE_OPEN_ROUNDS) : fixtures

  return Response.json(
    visible.map((f) => {
      const prov = provisionalScore(f)
      const myPred = f.predictions.find((p) => p.userId === user.id)
      const kickedOff = f.kickoffTime <= now
      const peers = peersByCompetition.get(f.competitionId) ?? new Set<string>()
      const peerPredictions = kickedOff
        ? sortPeerPredictions(
            f.predictions.filter((p) => peers.has(p.userId)).map((p) => mapPrediction(p, f)),
            user.id,
          )
        : []

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
        prediction: myPred ? mapPrediction(myPred, f) : null,
        peerPredictions,
      }
    }),
  )
}
