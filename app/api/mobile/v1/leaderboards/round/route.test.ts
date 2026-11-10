import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { computeLeaderboard } from "@/lib/leaderboard"

vi.mock("@/lib/prisma", () => ({
  prisma: { leagueMembership: { findFirst: vi.fn() } },
}))
vi.mock("@/lib/mobileAuth", () => ({ authenticateMobileAccess: vi.fn() }))
vi.mock("@/lib/leaderboard", () => ({ computeLeaderboard: vi.fn() }))

const authMock = vi.mocked(authenticateMobileAccess)
const membershipFindFirst = vi.mocked(prisma.leagueMembership.findFirst)
const computeMock = vi.mocked(computeLeaderboard)

const user = { id: "u1", email: "a@b.c", displayName: "Alice", isBot: false, emailVerified: true, avatarUrl: null }
const url = (query: string) => new Request(`http://test/api/mobile/v1/leaderboards/round${query}`)
const validRequest = url("?leagueId=l1&round=Matchday+5")

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(user)
  membershipFindFirst.mockResolvedValue({ league: { id: "l1", name: "The Sunday League" } } as never)
  computeMock.mockResolvedValue([])
})

describe("GET /api/mobile/v1/leaderboards/round", () => {
  it("401s without an access token", async () => {
    authMock.mockResolvedValue(null)
    expect((await GET(validRequest)).status).toBe(401)
  })

  it("400s when leagueId or round is missing", async () => {
    expect((await GET(url("?round=Matchday+5"))).status).toBe(400)
    expect((await GET(url("?leagueId=l1"))).status).toBe(400)
    expect(computeMock).not.toHaveBeenCalled()
  })

  it("404s for a league the viewer is not in, without computing anything", async () => {
    membershipFindFirst.mockResolvedValue(null as never)
    const res = await GET(url("?leagueId=someone-elses&round=Matchday+5"))
    expect(res.status).toBe(404)
    // The important half: a non-member must not get standings back.
    expect(computeMock).not.toHaveBeenCalled()
  })

  it("scopes the membership lookup to the caller", async () => {
    await GET(validRequest)
    expect(membershipFindFirst.mock.calls[0][0]?.where).toEqual({ userId: "u1", leagueId: "l1" })
  })

  it("passes the round through to the shared leaderboard calculation", async () => {
    await GET(validRequest)
    // Decoded, so a round label with a space is not looked up as "Matchday+5".
    expect(computeMock).toHaveBeenCalledWith("l1", { round: "Matchday 5" })
  })

  it("returns the round's standings without a form strip", async () => {
    computeMock.mockResolvedValue([
      {
        id: "u1",
        displayName: "Alice",
        isBot: false,
        confirmedPoints: 7,
        provisionalPoints: 3,
        exactCount: 1,
        breakdown: { result: 1, close: 0, exact: 3, banker: 3, streak: 0 },
        streakPoints: 0,
        avatarUrl: null,
        rank: 1,
      },
    ])
    const body = await (await GET(validRequest)).json()
    expect(body.round).toBe("Matchday 5")
    expect(body.standings[0]).toMatchObject({
      rank: 1,
      totalPoints: 7,
      provisionalPoints: 3,
      projectedPoints: 10,
      form: [],
    })
  })
})
