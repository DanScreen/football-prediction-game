import { describe, it, expect, vi, beforeEach } from "vitest"
import { countMemberPredictions, getLeagueUpcomingPickStatus } from "./leaguePickStatus"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    fixture: { findMany: vi.fn() },
  },
}))

const leagueFindUnique = vi.mocked(prisma.league.findUnique)
const fixtureFindMany = vi.mocked(prisma.fixture.findMany)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("countMemberPredictions", () => {
  it("counts predicted fixtures per member", () => {
    const fixtures = [
      { predictedUserIds: ["u1", "u2"] },
      { predictedUserIds: ["u1"] },
      { predictedUserIds: [] },
    ]

    const counts = countMemberPredictions(["u1", "u2", "u3"], fixtures)

    expect(counts.get("u1")).toEqual({ predicted: 2, total: 3 })
    expect(counts.get("u2")).toEqual({ predicted: 1, total: 3 })
    expect(counts.get("u3")).toEqual({ predicted: 0, total: 3 })
  })

  it("returns zero totals when there are no fixtures", () => {
    const counts = countMemberPredictions(["u1"], [])
    expect(counts.get("u1")).toEqual({ predicted: 0, total: 0 })
  })
})

describe("getLeagueUpcomingPickStatus", () => {
  it("returns null when the league does not exist", async () => {
    leagueFindUnique.mockResolvedValue(null)
    expect(await getLeagueUpcomingPickStatus("missing")).toBeNull()
  })

  it("loads members and upcoming fixtures with prediction user ids only", async () => {
    leagueFindUnique.mockResolvedValue({
      name: "Office League",
      competitionId: "comp1",
      competition: { name: "Premier League" },
      memberships: [
        { user: { id: "u1", displayName: "Alice", isBot: false } },
        { user: { id: "u2", displayName: "Bob", isBot: true } },
      ],
    } as never)

    fixtureFindMany.mockResolvedValue([
      {
        id: "fx1",
        round: "Matchweek 1",
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        kickoffTime: new Date("2026-09-01T15:00:00Z"),
        competitionId: "comp1",
        competition: { name: "Premier League" },
        predictions: [{ userId: "u1" }],
      },
    ] as never)

    const result = await getLeagueUpcomingPickStatus("league1")

    expect(result).toEqual({
      leagueName: "Office League",
      competitionName: "Premier League",
      members: [
        { userId: "u1", displayName: "Alice", isBot: false },
        { userId: "u2", displayName: "Bob", isBot: true },
      ],
      fixtures: [
        {
          id: "fx1",
          round: "Matchweek 1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          kickoffTime: new Date("2026-09-01T15:00:00Z"),
          competitionId: "comp1",
          competitionName: "Premier League",
          predictedUserIds: ["u1"],
        },
      ],
    })

    expect(fixtureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          competitionId: "comp1",
          status: "SCHEDULED",
          kickoffTime: { gt: expect.any(Date) },
        }),
      }),
    )
  })
})
