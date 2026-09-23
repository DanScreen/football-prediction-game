import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueMembership: { findMany: vi.fn() },
    fixture: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/mobileAuth", () => ({
  authenticateMobileAccess: vi.fn(),
}))

const authMock = vi.mocked(authenticateMobileAccess)
const membershipFindMany = vi.mocked(prisma.leagueMembership.findMany)
const fixtureFindMany = vi.mocked(prisma.fixture.findMany)

const user = { id: "u1", email: "a@b.c", displayName: "Alice", isBot: false, emailVerified: true }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(user)
  membershipFindMany.mockImplementation(async (args) => {
    if (args?.where?.userId === "u1") {
      return [{ leagueId: "l1", league: { competitionId: "c1" } }] as never
    }
    return [
      { leagueId: "l1", userId: "u1" },
      { leagueId: "l1", userId: "u2" },
    ] as never
  })
})

describe("GET /api/mobile/v1/fixtures", () => {
  it("401s without access token", async () => {
    authMock.mockResolvedValue(null)
    const res = await GET(new NextRequest("http://test/api/mobile/v1/fixtures"))
    expect(res.status).toBe(401)
  })

  it("403s with email_unverified until the address is verified", async () => {
    authMock.mockResolvedValue({ ...user, emailVerified: false })
    const res = await GET(new NextRequest("http://test/api/mobile/v1/fixtures"))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("email_unverified")
    expect(fixtureFindMany).not.toHaveBeenCalled()
  })

  it("omits peer predictions before kickoff", async () => {
    fixtureFindMany.mockResolvedValue([
      {
        id: "fx-open",
        competitionId: "c1",
        round: "GW1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        kickoffTime: new Date(Date.now() + 60 * 60 * 1000),
        status: "SCHEDULED",
        actualHomeScore: null,
        actualAwayScore: null,
        proposedHomeScore: null,
        proposedAwayScore: null,
        competition: { name: "PL" },
        predictions: [
          {
            userId: "u1",
            predictedHomeScore: 2,
            predictedAwayScore: 1,
            isBanker: false,
            pointsAwarded: null,
            user: { id: "u1", displayName: "Alice", isBot: false },
          },
          {
            userId: "u2",
            predictedHomeScore: 1,
            predictedAwayScore: 0,
            isBanker: false,
            pointsAwarded: null,
            user: { id: "u2", displayName: "Bob", isBot: false },
          },
        ],
      },
    ] as never)

    const res = await GET(new NextRequest("http://test/api/mobile/v1/fixtures?status=open"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].prediction.homeScore).toBe(2)
    expect(json[0].peerPredictions).toEqual([])
  })

  it("returns league-mate picks after kickoff", async () => {
    fixtureFindMany.mockResolvedValue([
      {
        id: "fx-done",
        competitionId: "c1",
        round: "GW1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        kickoffTime: new Date(Date.now() - 60 * 60 * 1000),
        status: "COMPLETED",
        actualHomeScore: 2,
        actualAwayScore: 1,
        proposedHomeScore: null,
        proposedAwayScore: null,
        competition: { name: "PL" },
        predictions: [
          {
            userId: "u2",
            predictedHomeScore: 1,
            predictedAwayScore: 0,
            isBanker: false,
            pointsAwarded: 0,
            user: { id: "u2", displayName: "Bob", isBot: false },
          },
          {
            userId: "u1",
            predictedHomeScore: 2,
            predictedAwayScore: 1,
            isBanker: true,
            pointsAwarded: 6,
            user: { id: "u1", displayName: "Alice", isBot: false },
          },
        ],
      },
    ] as never)

    const res = await GET(new NextRequest("http://test/api/mobile/v1/fixtures?status=completed"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0].peerPredictions).toHaveLength(2)
    expect(json[0].peerPredictions[0].userId).toBe("u1")
    expect(json[0].peerPredictions[0].displayName).toBe("Alice")
    expect(json[0].peerPredictions[1].displayName).toBe("Bob")
  })

  it("caps open fixtures at the current and next gameweek per competition", async () => {
    const base = Date.now() + 60 * 60 * 1000
    fixtureFindMany.mockResolvedValue(
      ["Matchweek 5", "Matchweek 6", "Matchweek 8", "Matchweek 9"].flatMap((round, i) => [
        {
          id: `fx-${i}`,
          competitionId: "c1",
          round,
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          kickoffTime: new Date(base + i * 7 * 24 * 60 * 60 * 1000),
          status: "SCHEDULED",
          actualHomeScore: null,
          actualAwayScore: null,
          proposedHomeScore: null,
          proposedAwayScore: null,
          competition: { name: "PL" },
          predictions: [],
        },
      ]) as never,
    )

    const res = await GET(new NextRequest("http://test/api/mobile/v1/fixtures?status=open"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.map((f: { round: string }) => f.round)).toEqual([
      "Matchweek 5",
      "Matchweek 6",
    ])
  })
})
