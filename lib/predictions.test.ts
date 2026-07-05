import { describe, it, expect, vi, beforeEach } from "vitest"
import { upsertPredictionWithSync } from "./predictions"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prediction: { upsert: vi.fn() },
    leagueMembership: { findMany: vi.fn() },
    fixture: { findMany: vi.fn() },
  },
}))

const predictionUpsert = vi.mocked(prisma.prediction.upsert)
const membershipFindMany = vi.mocked(prisma.leagueMembership.findMany)
const fixtureFindMany = vi.mocked(prisma.fixture.findMany)

const fixture = {
  id: "fx1",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  kickoffTime: new Date("2026-08-15T14:00:00Z"),
}

beforeEach(() => {
  vi.clearAllMocks()
  predictionUpsert.mockImplementation(
    (async (args: { create: unknown }) => args.create) as never,
  )
})

describe("upsertPredictionWithSync", () => {
  it("upserts the primary prediction with the given source", async () => {
    membershipFindMany.mockResolvedValue([{ leagueId: "l1" }] as never)

    await upsertPredictionWithSync("u1", fixture, 2, 1, "API")

    expect(predictionUpsert).toHaveBeenCalledTimes(1)
    expect(predictionUpsert).toHaveBeenCalledWith({
      where: { userId_fixtureId: { userId: "u1", fixtureId: "fx1" } },
      create: {
        userId: "u1",
        fixtureId: "fx1",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
        submittedVia: "API",
      },
      update: { predictedHomeScore: 2, predictedAwayScore: 1 },
    })
  })

  it("skips the sync lookup entirely for single-league users", async () => {
    membershipFindMany.mockResolvedValue([{ leagueId: "l1" }] as never)
    await upsertPredictionWithSync("u1", fixture, 1, 0, "WEB")
    expect(fixtureFindMany).not.toHaveBeenCalled()
  })

  it("copies the pick to matching SCHEDULED fixtures in other leagues", async () => {
    membershipFindMany.mockResolvedValue([{ leagueId: "l1" }, { leagueId: "l2" }] as never)
    fixtureFindMany.mockResolvedValue([{ id: "fx2" }] as never)

    await upsertPredictionWithSync("u1", fixture, 1, 0, "WEB")

    expect(fixtureFindMany).toHaveBeenCalledWith({
      where: {
        leagueId: { in: ["l1", "l2"] },
        id: { not: "fx1" },
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        kickoffTime: fixture.kickoffTime,
        status: "SCHEDULED",
      },
    })
    expect(predictionUpsert).toHaveBeenCalledTimes(2)
    expect(predictionUpsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId_fixtureId: { userId: "u1", fixtureId: "fx2" } },
      }),
    )
  })

  it("returns the primary prediction, not a synced copy", async () => {
    membershipFindMany.mockResolvedValue([{ leagueId: "l1" }, { leagueId: "l2" }] as never)
    fixtureFindMany.mockResolvedValue([{ id: "fx2" }] as never)

    const result = (await upsertPredictionWithSync("u1", fixture, 3, 2, "API")) as {
      fixtureId: string
    }
    expect(result.fixtureId).toBe("fx1")
  })
})
