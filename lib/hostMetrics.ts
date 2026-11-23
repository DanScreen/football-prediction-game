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
    predictions7d,
    predictions30d,
    webLast7d,
    apiLast7d,
    appLast7d,
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
    // updatedAt so edits count as activity, not only first create.
    prisma.prediction.count({ where: { updatedAt: { gte: weekAgo } } }),
    prisma.prediction.count({ where: { updatedAt: { gte: monthAgo } } }),
    prisma.prediction.count({
      where: { updatedAt: { gte: weekAgo }, submittedVia: "WEB" },
    }),
    prisma.prediction.count({
      where: { updatedAt: { gte: weekAgo }, submittedVia: "API" },
    }),
    prisma.prediction.count({
      where: { updatedAt: { gte: weekAgo }, submittedVia: "APP" },
    }),
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
      last7d: predictions7d,
      last30d: predictions30d,
      webLast7d,
      appLast7d,
      apiLast7d,
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
