import { prisma } from "@/lib/prisma"
import { activityDay, activityDayKey } from "@/lib/activity"
import { addDays, type AnalyticsDataset } from "./compute"

/** How far back activity days are loaded: enough for a 26-week calendar and 12 weekly cohorts. */
export const ACTIVITY_WINDOW_DAYS = 26 * 7 + 7

/**
 * Loads the lean snapshot the analytics functions run on. Whole-platform by
 * default; pass `userIds` to scope everything to those users (a player or a
 * league's members) so drill-down pages don't read the whole database.
 *
 * Everything is aggregated in memory: Scorers is a friends' game with
 * hundreds of users, not millions (see decisions.md). Revisit with SQL
 * aggregates if predictions pass ~200k rows.
 */
export async function loadAnalyticsDataset(
  options: { now?: Date; userIds?: string[] } = {},
): Promise<AnalyticsDataset> {
  const now = options.now ?? new Date()
  const activitySince = addDays(activityDayKey(now), -(ACTIVITY_WINDOW_DAYS - 1))
  const userWhere = options.userIds ? { id: { in: options.userIds } } : {}
  const byUser = options.userIds ? { userId: { in: options.userIds } } : {}

  const [users, competitions, memberships, predictions, activity] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        displayName: true,
        email: true,
        isBot: true,
        isSiteAdmin: true,
        createdAt: true,
        emailVerifiedAt: true,
        lastSeenAt: true,
        avatarKey: true,
      },
    }),
    prisma.competition.findMany({ select: { id: true, name: true, flag: true, archivedAt: true } }),
    prisma.leagueMembership.findMany({
      where: byUser,
      select: { userId: true, leagueId: true, role: true, joinedAt: true },
    }),
    prisma.prediction.findMany({
      where: byUser,
      select: {
        userId: true,
        fixtureId: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        isBanker: true,
        pointsAwarded: true,
        submittedVia: true,
        createdAt: true,
      },
    }),
    prisma.userActivityDay.findMany({
      where: { ...byUser, day: { gte: activityDay(new Date(`${activitySince}T12:00:00Z`)) } },
      select: { userId: true, day: true, web: true, app: true, api: true },
    }),
  ])

  const leagueIds = [...new Set(memberships.map((m) => m.leagueId))]
  const leagues = await prisma.league.findMany({
    where: options.userIds ? { id: { in: leagueIds } } : {},
    select: { id: true, name: true, competitionId: true, createdAt: true },
  })
  const competitionIds = [...new Set(leagues.map((l) => l.competitionId))]
  const fixtures = await prisma.fixture.findMany({
    where: { competitionId: { in: competitionIds } },
    select: {
      id: true,
      competitionId: true,
      round: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      actualHomeScore: true,
      actualAwayScore: true,
    },
  })

  return {
    now,
    users,
    competitions,
    leagues,
    memberships,
    fixtures,
    predictions,
    activity: activity.map((a) => ({ ...a, day: a.day.toISOString().slice(0, 10) })),
    activitySince,
  }
}
