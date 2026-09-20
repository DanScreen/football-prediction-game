import { prisma } from "@/lib/prisma"
import {
  takeNearestFixturesByRound,
  VISIBLE_OPEN_ROUNDS,
} from "@/lib/visibleOpenRounds"

export type LeaguePickMember = {
  userId: string
  displayName: string
  isBot: boolean
}

export type LeaguePickFixture = {
  id: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
  competitionId: string
  competitionName: string
  predictedUserIds: string[]
}

export type LeaguePickStatus = {
  leagueName: string
  competitionName: string
  members: LeaguePickMember[]
  fixtures: LeaguePickFixture[]
}

/** Count how many upcoming fixtures each member has predicted. */
export function countMemberPredictions(
  memberIds: string[],
  fixtures: Pick<LeaguePickFixture, "predictedUserIds">[],
): Map<string, { predicted: number; total: number }> {
  const total = fixtures.length
  const counts = new Map<string, { predicted: number; total: number }>()
  for (const userId of memberIds) {
    const predicted = fixtures.filter((f) => f.predictedUserIds.includes(userId)).length
    counts.set(userId, { predicted, total })
  }
  return counts
}

/** Upcoming open fixtures for a league, with who in that league has predicted (not scores). */
export async function getLeagueUpcomingPickStatus(
  leagueId: string,
): Promise<LeaguePickStatus | null> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      name: true,
      competitionId: true,
      competition: { select: { name: true } },
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: {
          user: { select: { id: true, displayName: true, isBot: true } },
        },
      },
    },
  })
  if (!league) return null

  const members: LeaguePickMember[] = league.memberships.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
    isBot: m.user.isBot,
  }))
  const memberIds = members.map((m) => m.userId)
  const now = new Date()

  const rawFixtures = await prisma.fixture.findMany({
    where: {
      competitionId: league.competitionId,
      status: "SCHEDULED",
      kickoffTime: { gt: now },
    },
    orderBy: { kickoffTime: "asc" },
    select: {
      id: true,
      round: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      competitionId: true,
      competition: { select: { name: true } },
      predictions: {
        where: { userId: { in: memberIds } },
        select: { userId: true },
      },
    },
  })

  const fixtures: LeaguePickFixture[] = takeNearestFixturesByRound(
    rawFixtures.map((f) => ({
      id: f.id,
      round: f.round,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      kickoffTime: f.kickoffTime,
      competitionId: f.competitionId,
      competitionName: f.competition.name,
      predictedUserIds: f.predictions.map((p) => p.userId),
    })),
    VISIBLE_OPEN_ROUNDS,
  )

  return {
    leagueName: league.name,
    competitionName: league.competition.name,
    members,
    fixtures,
  }
}
