import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  transitionDueFixtures,
  confirmResultsFromApi,
  runResolutionSweep,
  RESULT_DELAY_MS,
  RESULT_RECONCILE_WINDOW_MS,
} from "./resolution"
import { prisma } from "@/lib/prisma"
import { fetchFinishedMatches } from "@/lib/footballData"
import { autoImportFixtures } from "@/lib/autoImport"
import { confirmFixtureResult } from "@/lib/results"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}))

vi.mock("@/lib/footballData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/footballData")>()
  return { ...actual, fetchFinishedMatches: vi.fn() }
})

vi.mock("@/lib/autoImport", () => ({
  autoImportFixtures: vi.fn(),
}))

vi.mock("@/lib/results", () => ({
  confirmFixtureResult: vi.fn(),
}))

const fixtureFindMany = vi.mocked(prisma.fixture.findMany)
const fixtureUpdateMany = vi.mocked(prisma.fixture.updateMany)
const fetchFinished = vi.mocked(fetchFinishedMatches)
const autoImport = vi.mocked(autoImportFixtures)
const confirmResult = vi.mocked(confirmFixtureResult)

function awaitingFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "f1",
    competitionId: "comp-pl",
    competition: { id: "comp-pl", name: "Premier League", code: "PL" },
    round: "Matchweek 1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    kickoffTime: new Date("2026-07-04T15:00:00Z"),
    status: "AWAITING_RESULT",
    proposedHomeScore: null,
    proposedAwayScore: null,
    actualHomeScore: null,
    actualAwayScore: null,
    resultSource: null,
    ...overrides,
  }
}

function completedAiFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return awaitingFixture({
    id: "done",
    status: "COMPLETED",
    actualHomeScore: 2,
    actualAwayScore: 1,
    resultSource: "AI_CONFIRMED",
    kickoffTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
    ...overrides,
  })
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
  autoImport.mockResolvedValue({ imported: 0, errors: [] })
  confirmResult.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("transitionDueFixtures", () => {
  it("uses a 1h45m post-kickoff delay", () => {
    expect(RESULT_DELAY_MS).toBe(1.75 * 60 * 60 * 1000)
  })

  it("moves SCHEDULED fixtures past the delay to AWAITING_RESULT platform-wide", async () => {
    fixtureUpdateMany.mockResolvedValue({ count: 2 })
    const before = Date.now()
    const count = await transitionDueFixtures()
    expect(count).toBe(2)

    const arg = fixtureUpdateMany.mock.calls[0][0]!
    expect(arg.data).toEqual({ status: "AWAITING_RESULT" })
    const where = arg.where as { status: string; kickoffTime: { lte: Date } }
    expect(where.status).toBe("SCHEDULED")
    const cutoff = where.kickoffTime.lte.getTime()
    expect(Math.abs(before - RESULT_DELAY_MS - cutoff)).toBeLessThan(5000)
  })
})

describe("confirmResultsFromApi", () => {
  it("no-ops without an API key", async () => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "")
    expect(await confirmResultsFromApi()).toEqual({ confirmed: 0, corrected: 0, errors: [] })
    expect(fixtureFindMany).not.toHaveBeenCalled()
  })

  it("confirms legacy proposed scores before fetching", async () => {
    fixtureFindMany
      .mockResolvedValueOnce([
        { id: "legacy", proposedHomeScore: 1, proposedAwayScore: 0 },
      ] as never)
      .mockResolvedValueOnce([] as never)

    const result = await confirmResultsFromApi()

    expect(confirmResult).toHaveBeenCalledWith("legacy", 1, 0, "AI_CONFIRMED")
    expect(result).toEqual({ confirmed: 1, corrected: 0, errors: [] })
  })

  it("makes one API call per competition and confirms matched scores", async () => {
    fixtureFindMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        awaitingFixture({ id: "f1" }),
        awaitingFixture({ id: "f2", homeTeam: "Liverpool", awayTeam: "Everton" }),
        awaitingFixture({
          id: "f3",
          competitionId: "comp-wc",
          competition: { id: "comp-wc", name: "FIFA World Cup 2026", code: "WC" },
          homeTeam: "France",
          awayTeam: "Brazil",
        }),
      ] as never)
    fetchFinished
      .mockResolvedValueOnce([
        finishedMatch("Arsenal", "Chelsea", 2, 1),
        finishedMatch("Liverpool", "Everton", 1, 1),
      ] as never)
      .mockResolvedValueOnce([finishedMatch("France", "Brazil", 0, 3)] as never)

    const result = await confirmResultsFromApi()

    expect(fetchFinished).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ confirmed: 3, corrected: 0, errors: [] })
    expect(confirmResult).toHaveBeenCalledWith("f1", 2, 1, "AI_CONFIRMED")
    expect(confirmResult).toHaveBeenCalledWith("f3", 0, 3, "AI_CONFIRMED")
  })

  it("skips fixtures whose result is not in the API response", async () => {
    fixtureFindMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([awaitingFixture()] as never)
    fetchFinished.mockResolvedValue([finishedMatch("Liverpool", "Everton", 1, 0)] as never)

    expect(await confirmResultsFromApi()).toEqual({ confirmed: 0, corrected: 0, errors: [] })
    expect(confirmResult).not.toHaveBeenCalled()
  })

  it("keeps going when one competition's lookup fails", async () => {
    fixtureFindMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        awaitingFixture({ id: "f1" }),
        awaitingFixture({
          id: "f2",
          competitionId: "comp-wc",
          competition: { id: "comp-wc", name: "FIFA World Cup 2026", code: "WC" },
          homeTeam: "France",
          awayTeam: "Brazil",
        }),
      ] as never)
    fetchFinished
      .mockRejectedValueOnce(new Error("football-data.org API error 429"))
      .mockResolvedValueOnce([finishedMatch("France", "Brazil", 2, 2)] as never)

    const result = await confirmResultsFromApi()
    expect(result.confirmed).toBe(1)
    expect(result.corrected).toBe(0)
    expect(result.errors).toEqual([expect.stringContaining("429")])
  })

  it("re-confirms a recent AI result when the API score later changes", async () => {
    fixtureFindMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([completedAiFixture()] as never)
    fetchFinished.mockResolvedValue([finishedMatch("Arsenal", "Chelsea", 1, 1)] as never)

    const result = await confirmResultsFromApi()

    expect(result).toEqual({ confirmed: 0, corrected: 1, errors: [] })
    expect(confirmResult).toHaveBeenCalledWith("done", 1, 1, "AI_CONFIRMED")
  })

  it("does not re-confirm when the stored AI score still matches the API", async () => {
    fixtureFindMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([completedAiFixture()] as never)
    fetchFinished.mockResolvedValue([finishedMatch("Arsenal", "Chelsea", 2, 1)] as never)

    expect(await confirmResultsFromApi()).toEqual({ confirmed: 0, corrected: 0, errors: [] })
    expect(confirmResult).not.toHaveBeenCalled()
  })

  it("queries recent AI_CONFIRMED fixtures inside the reconcile window", async () => {
    const before = Date.now()
    fixtureFindMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never)

    await confirmResultsFromApi()

    const lookupWhere = fixtureFindMany.mock.calls[1]![0]!.where as {
      OR: Array<Record<string, unknown>>
    }
    expect(lookupWhere.OR[0]).toEqual({ status: "AWAITING_RESULT" })
    const completed = lookupWhere.OR[1] as {
      status: string
      resultSource: string
      kickoffTime: { gte: Date }
    }
    expect(completed.status).toBe("COMPLETED")
    expect(completed.resultSource).toBe("AI_CONFIRMED")
    expect(Math.abs(before - RESULT_RECONCILE_WINDOW_MS - completed.kickoffTime.gte.getTime())).toBeLessThan(
      5000,
    )
  })
})

describe("runResolutionSweep", () => {
  it("runs auto-import, transitions, and confirms, merging errors", async () => {
    autoImport.mockResolvedValue({ imported: 4, errors: ["import boom"] })
    fixtureUpdateMany.mockResolvedValue({ count: 1 })
    fixtureFindMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([awaitingFixture()] as never)
    fetchFinished.mockRejectedValue(new Error("lookup boom"))

    const result = await runResolutionSweep()

    expect(result.imported).toBe(4)
    expect(result.transitioned).toBe(1)
    expect(result.confirmed).toBe(0)
    expect(result.corrected).toBe(0)
    expect(result.errors).toEqual([
      "import boom",
      expect.stringContaining("lookup boom"),
    ])
  })
})
