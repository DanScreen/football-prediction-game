import { prisma } from "@/lib/prisma"

const DAY_MS = 24 * 60 * 60 * 1000

export type HostOverviewMetrics = {
  users: { total: number; humans: number; bots: number }
  active: { dau: number; wau: number; mau: number }
  signups: { last7d: number; last30d: number }
  leagues: number
  predictions: {
    last7d: number
    last30d: number
    webLast7d: number
    appLast7d: number
    /** The public bot API only — the native app has its own value since 2026-11-23. */
    apiLast7d: number
  }
  mobileUsers: number
  recentUsers: Array<{
    id: string
    displayName: string
    email: string
    isBot: boolean
    createdAt: Date
    lastSeenAt: Date | null
    predictionCount: number
  }>
}

type PickCounts = { last7d: number; last30d: number; web7d: number; app7d: number; api7d: number }

/**
 * Picks players made or changed in each window. A pick's `updatedAt` only counts
 * while it is before kickoff: after that, the only writer is result scoring,
 * which rewrites `pointsAwarded` on every pick in the round each time a result
 * confirms — counting by `updatedAt` alone made every scored pick look like
 * fresh activity. (An edit later overwritten by scoring falls back to
 * `createdAt`.) Needs a column-to-column comparison across the Fixture join,
 * which Prisma's query API can't express — hence raw SQL.
 */
async function countPlayerPicks(weekAgo: Date, monthAgo: Date): Promise<PickCounts> {
  const [row] = await prisma.$queryRaw<
    Array<{ last7d: bigint; last30d: bigint; web7d: bigint; app7d: bigint; api7d: bigint }>
  >`
    SELECT
      count(*) FILTER (WHERE a.at >= ${weekAgo}) AS "last7d",
      count(*) AS "last30d",
      count(*) FILTER (WHERE a.at >= ${weekAgo} AND a.via = 'WEB') AS "web7d",
      count(*) FILTER (WHERE a.at >= ${weekAgo} AND a.via = 'APP') AS "app7d",
      count(*) FILTER (WHERE a.at >= ${weekAgo} AND a.via = 'API') AS "api7d"
    FROM (
      SELECT p."submittedVia"::text AS via,
             GREATEST(p."createdAt",
                      CASE WHEN p."updatedAt" < f."kickoffTime" THEN p."updatedAt" END) AS at
      FROM "Prediction" p
      JOIN "Fixture" f ON f."id" = p."fixtureId"
    ) a
    WHERE a.at >= ${monthAgo}
  `
  return {
    last7d: Number(row?.last7d ?? 0),
    last30d: Number(row?.last30d ?? 0),
    web7d: Number(row?.web7d ?? 0),
    app7d: Number(row?.app7d ?? 0),
    api7d: Number(row?.api7d ?? 0),
  }
}

export async function getHostOverviewMetrics(
  now = new Date(),
): Promise<HostOverviewMetrics> {
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS)

  const [
    totalUsers,
    humanUsers,
    botUsers,
    dau,
    wau,
    mau,
    signups7d,
    signups30d,
    leagues,
    pickCounts,
    mobileUsers,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBot: false } }),
    prisma.user.count({ where: { isBot: true } }),
    prisma.user.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.league.count(),
    countPlayerPicks(weekAgo, monthAgo),
    prisma.user.count({
      where: {
        OR: [
          { mobileDeviceTokens: { some: {} } },
          {
            mobileRefreshTokens: {
              some: { revokedAt: null, expiresAt: { gt: now } },
            },
          },
        ],
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        displayName: true,
        email: true,
        isBot: true,
        createdAt: true,
        lastSeenAt: true,
        _count: { select: { predictions: true } },
      },
    }),
  ])

  return {
    users: { total: totalUsers, humans: humanUsers, bots: botUsers },
    active: { dau, wau, mau },
    signups: { last7d: signups7d, last30d: signups30d },
    leagues,
    predictions: {
      last7d: pickCounts.last7d,
      last30d: pickCounts.last30d,
      webLast7d: pickCounts.web7d,
      appLast7d: pickCounts.app7d,
      apiLast7d: pickCounts.api7d,
    },
    mobileUsers,
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      isBot: u.isBot,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      predictionCount: u._count.predictions,
    })),
  }
}
