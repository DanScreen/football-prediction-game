import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueMembership: { findMany: vi.fn() },
    bonusAward: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/mobileAuth", () => ({
  authenticateMobileAccess: vi.fn(),
}))

const authMock = vi.mocked(authenticateMobileAccess)
const membershipFindMany = vi.mocked(prisma.leagueMembership.findMany)
const bonusFindMany = vi.mocked(prisma.bonusAward.findMany)

const user = { id: "u1", email: "a@b.c", displayName: "Alice", isBot: false, emailVerified: true }
const request = new Request("http://test/api/mobile/v1/bonuses")

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(user)
})

describe("GET /api/mobile/v1/bonuses", () => {
  it("401s without access token", async () => {
    authMock.mockResolvedValue(null)
    expect((await GET(request)).status).toBe(401)
  })

  it("skips leagues on a competition a host has declared finished", async () => {
    membershipFindMany.mockResolvedValue([] as never)
    const res = await GET(request)
    expect(await res.json()).toEqual([])
    expect(membershipFindMany.mock.calls[0][0]?.where?.league).toEqual({
      competition: { archivedAt: null },
    })
    expect(bonusFindMany).not.toHaveBeenCalled()
  })

  it("sums bonuses across every league the viewer holds on a competition", async () => {
    membershipFindMany.mockResolvedValue([
      { leagueId: "l1", league: { competitionId: "c1" } },
      { leagueId: "l2", league: { competitionId: "c1" } },
      { leagueId: "l3", league: { competitionId: "c2" } },
    ] as never)
    bonusFindMany.mockResolvedValue([
      { leagueId: "l1", round: "GW1", points: 5 },
      { leagueId: "l2", round: "GW1", points: 3 },
      { leagueId: "l3", round: "GW1", points: 2 },
    ] as never)

    expect(await (await GET(request)).json()).toEqual([
      { competitionId: "c1", round: "GW1", points: 8 },
      { competitionId: "c2", round: "GW1", points: 2 },
    ])
  })
})
