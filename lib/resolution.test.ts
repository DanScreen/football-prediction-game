import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { transitionDueFixtures, fetchProposals, RESULT_DELAY_MS } from "./resolution"
import { prisma } from "@/lib/prisma"
import { fetchFinishedMatches } from "@/lib/footballData"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock("@/lib/footballData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/footballData")>()
  return { ...actual, fetchFinishedMatches: vi.fn() }
})

const fixtureFindMany = vi.mocked(prisma.fixture.findMany)
const fixtureUpdateMany = vi.mocked(prisma.fixture.updateMany)
const fetchFinished = vi.mocked(fetchFinishedMatches)

function awaitingFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "f1",
    leagueId: "l1",
    competition: "Premier League",
    round: "Matchweek 1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    kickoffTime: new Date("2026-07-04T15:00:00Z"),
    status: "AWAITING_RESULT",
    proposedHomeScore: null,
    proposedAwayScore: null,
    ...overrides,
  }
}

function finishedMatch(home: string, away: string, homeScore: number, awayScore: number) {
  return {
    id: 1,
    utcDate: "2026-07-04T15:00:00Z",
    status: "FINISHED",
    matchday: 1,
    stage: "REGULAR_SEASON",
    group: null,
    homeTeam: { id: 1, name: home, shortName: home, tla: "" },
    awayTeam: { id: 2, name: away, shortName: away, tla: "" },
    score: { fullTime: { home: homeScore, away: awayScore } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("FOOTBALL_DATA_API_KEY", "test-key")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("transitionDueFixtures", () => {
  it("moves SCHEDULED fixtures at least 2.5h past kickoff to AWAITING_RESULT", async () => {
    fixtureUpdateMany.mockResolvedValue({ count: 2 })
    const before = Date.now()
    const count = await transitionDueFixtures()
    expect(count).toBe(2)

    const arg = fixtureUpdateMany.mock.calls[0][0]!
    expect(arg.data).toEqual({ status: "AWAITING_RESULT" })
    const where = arg.where as { status: string; kickoffTime: { lte: Date }; leagueId?: string }
    expect(where.status).toBe("SCHEDULED")
    expect(where.leagueId).toBeUndefined()
    const cutoff = where.kickoffTime.lte.getTime()
    expect(Math.abs(before - RESULT_DELAY_MS - cutoff)).toBeLessThan(5000)
  })

  it("scopes to a league when given one", async () => {
    fixtureUpdateMany.mockResolvedValue({ count: 0 })
    await transitionDueFixtures("league-x")
    const where = fixtureUpdateMany.mock.calls[0][0]!.where as { leagueId?: string }
    expect(where.leagueId).toBe("league-x")
  })
})

describe("fetchProposals", () => {
  it("no-ops without an API key", async () => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "")
    expect(await fetchProposals()).toEqual({ proposed: 0, errors: [] })
    expect(fixtureFindMany).not.toHaveBeenCalled()
  })

  it("no-ops when nothing is awaiting a result", async () => {
    fixtureFindMany.mockResolvedValue([])
    expect(await fetchProposals()).toEqual({ proposed: 0, errors: [] })
    expect(fetchFinished).not.toHaveBeenCalled()
  })

  it("makes one API call per competition and proposes matched scores", async () => {
    fixtureFindMany.mockResolvedValue([
      awaitingFixture({ id: "f1" }),
      awaitingFixture({ id: "f2", leagueId: "l2" }), // cross-league copy, same competition
      awaitingFixture({ id: "f3", competition: "FIFA World Cup 2026", homeTeam: "France", awayTeam: "Brazil" }),
    ] as never)
    fetchFinished
      .mockResolvedValueOnce([finishedMatch("Arsenal", "Chelsea", 2, 1)] as never)
      .mockResolvedValueOnce([finishedMatch("France", "Brazil", 0, 3)] as never)
    fixtureUpdateMany.mockResolvedValue({ count: 1 })

    const result = await fetchProposals()

    expect(fetchFinished).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ proposed: 3, errors: [] })
    expect(fixtureUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1", status: "AWAITING_RESULT" },
        data: { proposedHomeScore: 2, proposedAwayScore: 1 },
      }),
    )
    expect(fixtureUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f3", status: "AWAITING_RESULT" },
        data: { proposedHomeScore: 0, proposedAwayScore: 3 },
      }),
    )
  })

  it("skips fixtures whose result is not in the API response", async () => {
    fixtureFindMany.mockResolvedValue([awaitingFixture()] as never)
    fetchFinished.mockResolvedValue([finishedMatch("Liverpool", "Everton", 1, 0)] as never)

    expect(await fetchProposals()).toEqual({ proposed: 0, errors: [] })
    expect(fixtureUpdateMany).not.toHaveBeenCalled()
  })

  it("keeps going when one competition's lookup fails", async () => {
    fixtureFindMany.mockResolvedValue([
      awaitingFixture({ id: "f1" }),
      awaitingFixture({ id: "f2", competition: "FIFA World Cup 2026", homeTeam: "France", awayTeam: "Brazil" }),
    ] as never)
    fetchFinished
      .mockRejectedValueOnce(new Error("football-data.org API error 429"))
      .mockResolvedValueOnce([finishedMatch("France", "Brazil", 2, 2)] as never)
    fixtureUpdateMany.mockResolvedValue({ count: 1 })

    const result = await fetchProposals()
    expect(result.proposed).toBe(1)
    expect(result.errors).toEqual([expect.stringContaining("429")])
  })

  it("ignores competitions with no API mapping", async () => {
    fixtureFindMany.mockResolvedValue([awaitingFixture({ competition: "Serie A" })] as never)
    expect(await fetchProposals()).toEqual({ proposed: 0, errors: [] })
    expect(fetchFinished).not.toHaveBeenCalled()
  })
})
