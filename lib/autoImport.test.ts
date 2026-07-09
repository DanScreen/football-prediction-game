import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { autoImportFixtures, AUTO_IMPORT_ROUNDS } from "./autoImport"
import { prisma } from "@/lib/prisma"
import { fetchUpcomingFixtures } from "@/lib/footballData"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    competition: { findMany: vi.fn() },
    fixture: { createMany: vi.fn() },
  },
}))

vi.mock("@/lib/footballData", () => ({
  fetchUpcomingFixtures: vi.fn(),
}))

const competitionFindMany = vi.mocked(prisma.competition.findMany)
const fixtureCreateMany = vi.mocked(prisma.fixture.createMany)
const fetchUpcoming = vi.mocked(fetchUpcomingFixtures)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("FOOTBALL_DATA_API_KEY", "test-key")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("autoImportFixtures", () => {
  it("no-ops without an API key", async () => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "")
    expect(await autoImportFixtures()).toEqual({ imported: 0, errors: [] })
    expect(competitionFindMany).not.toHaveBeenCalled()
  })

  it("only considers active, code-mapped competitions with subscribing leagues", async () => {
    competitionFindMany.mockResolvedValue([])
    await autoImportFixtures()
    expect(competitionFindMany).toHaveBeenCalledWith({
      where: { isActive: true, code: { not: null }, leagues: { some: {} } },
      select: { id: true, name: true, code: true },
    })
  })

  it("imports upcoming fixtures with skipDuplicates against the canonical key", async () => {
    competitionFindMany.mockResolvedValue([
      { id: "comp-pl", name: "Premier League", code: "PL" },
    ] as never)
    fetchUpcoming.mockResolvedValue([
      {
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        kickoffTime: "2026-08-15T14:00:00Z",
        round: "Matchweek 1",
      },
    ])
    fixtureCreateMany.mockResolvedValue({ count: 1 })

    const result = await autoImportFixtures()

    expect(fetchUpcoming).toHaveBeenCalledWith("PL", AUTO_IMPORT_ROUNDS)
    expect(fixtureCreateMany).toHaveBeenCalledWith({
      data: [
        {
          competitionId: "comp-pl",
          round: "Matchweek 1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          kickoffTime: new Date("2026-08-15T14:00:00Z"),
        },
      ],
      skipDuplicates: true,
    })
    expect(result).toEqual({ imported: 1, errors: [] })
  })

  it("isolates per-competition failures", async () => {
    competitionFindMany.mockResolvedValue([
      { id: "comp-pl", name: "Premier League", code: "PL" },
      { id: "comp-wc", name: "FIFA World Cup 2026", code: "WC" },
    ] as never)
    fetchUpcoming
      .mockRejectedValueOnce(new Error("API error 500"))
      .mockResolvedValueOnce([
        {
          homeTeam: "France",
          awayTeam: "Brazil",
          kickoffTime: "2026-07-10T18:00:00Z",
          round: "Final",
        },
      ])
    fixtureCreateMany.mockResolvedValue({ count: 1 })

    const result = await autoImportFixtures()
    expect(result.imported).toBe(1)
    expect(result.errors).toEqual([expect.stringContaining("500")])
  })

  it("skips the insert when a competition has no upcoming fixtures", async () => {
    competitionFindMany.mockResolvedValue([
      { id: "comp-pl", name: "Premier League", code: "PL" },
    ] as never)
    fetchUpcoming.mockResolvedValue([])

    expect(await autoImportFixtures()).toEqual({ imported: 0, errors: [] })
    expect(fixtureCreateMany).not.toHaveBeenCalled()
  })
})
