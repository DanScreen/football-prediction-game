import { describe, it, expect, vi, beforeEach } from "vitest"
import { getHostOverviewMetrics } from "./hostMetrics"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    league: { count: vi.fn() },
    prediction: { count: vi.fn() },
  },
}))

const userCount = vi.mocked(prisma.user.count)
const userFindMany = vi.mocked(prisma.user.findMany)
const leagueCount = vi.mocked(prisma.league.count)
const predictionCount = vi.mocked(prisma.prediction.count)

beforeEach(() => {
  vi.clearAllMocks()
  userCount
    .mockResolvedValueOnce(10) // total
    .mockResolvedValueOnce(8) // humans
    .mockResolvedValueOnce(2) // bots
    .mockResolvedValueOnce(3) // dau
    .mockResolvedValueOnce(5) // wau
    .mockResolvedValueOnce(7) // mau
    .mockResolvedValueOnce(1) // signups 7d
    .mockResolvedValueOnce(4) // signups 30d
    .mockResolvedValueOnce(2) // mobile
  leagueCount.mockResolvedValue(3)
  predictionCount
    .mockResolvedValueOnce(40) // 7d
    .mockResolvedValueOnce(120) // 30d
    .mockResolvedValueOnce(30) // web 7d
    .mockResolvedValueOnce(10) // api 7d
    .mockResolvedValueOnce(5) // app 7d
  userFindMany.mockResolvedValue([
    {
      id: "u1",
      displayName: "Alice",
      email: "alice@test",
      isBot: false,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastSeenAt: new Date("2026-09-22T00:00:00.000Z"),
      _count: { predictions: 12 },
    },
  ] as never)
})

describe("getHostOverviewMetrics", () => {
  it("aggregates volume, activity, and recent users", async () => {
    const now = new Date("2026-09-23T12:00:00.000Z")
    const m = await getHostOverviewMetrics(now)

    expect(m.users).toEqual({ total: 10, humans: 8, bots: 2 })
    expect(m.active).toEqual({ dau: 3, wau: 5, mau: 7 })
    expect(m.signups).toEqual({ last7d: 1, last30d: 4 })
    expect(m.leagues).toBe(3)
    expect(m.predictions).toEqual({
      last7d: 40,
      last30d: 120,
      webLast7d: 30,
      appLast7d: 5,
      apiLast7d: 10,
    })
    expect(m.mobileUsers).toBe(2)
    expect(m.recentUsers).toEqual([
      {
        id: "u1",
        displayName: "Alice",
        email: "alice@test",
        isBot: false,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        lastSeenAt: new Date("2026-09-22T00:00:00.000Z"),
        predictionCount: 12,
      },
    ])
  })
})
