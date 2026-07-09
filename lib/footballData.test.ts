import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  isoDate,
  findMatchScore,
  fetchUpcomingFixtures,
  lookupResult,
  fetchFinishedMatches,
} from "./footballData"

function fdTeam(name: string, shortName = name, tla = "") {
  return { id: 1, name, shortName, tla }
}

function fdMatch(overrides: {
  home: ReturnType<typeof fdTeam>
  away: ReturnType<typeof fdTeam>
  score?: { home: number | null; away: number | null }
  stage?: string
  matchday?: number | null
  group?: string | null
  utcDate?: string
}) {
  return {
    id: 1,
    utcDate: overrides.utcDate ?? "2026-08-15T14:00:00Z",
    status: "SCHEDULED",
    matchday: overrides.matchday === undefined ? 1 : overrides.matchday,
    stage: overrides.stage ?? "REGULAR_SEASON",
    group: overrides.group ?? null,
    homeTeam: overrides.home,
    awayTeam: overrides.away,
    ...(overrides.score ? { score: { fullTime: overrides.score } } : {}),
  }
}

describe("isoDate", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-07-05T21:45:00Z"))).toBe("2026-07-05")
  })
})

describe("findMatchScore", () => {
  const arsenal = fdTeam("Arsenal FC", "Arsenal", "ARS")
  const chelsea = fdTeam("Chelsea FC", "Chelsea", "CHE")
  const finished = [fdMatch({ home: arsenal, away: chelsea, score: { home: 2, away: 1 } })]

  it("matches on full name", () => {
    expect(findMatchScore(finished, "Arsenal FC", "Chelsea FC")).toEqual({
      homeScore: 2,
      awayScore: 1,
    })
  })

  it("matches on short name and is case-insensitive", () => {
    expect(findMatchScore(finished, "arsenal", "CHELSEA")).toEqual({ homeScore: 2, awayScore: 1 })
  })

  it("matches when the stored name is a substring of the query", () => {
    expect(findMatchScore(finished, "Arsenal Football Club", "Chelsea FC London")).toEqual({
      homeScore: 2,
      awayScore: 1,
    })
  })

  it("does not match swapped home/away teams", () => {
    expect(findMatchScore(finished, "Chelsea", "Arsenal")).toBeNull()
  })

  it("returns null when no team matches", () => {
    expect(findMatchScore(finished, "Liverpool", "Everton")).toBeNull()
  })

  it("skips matches without a full-time score", () => {
    const noScore = [fdMatch({ home: arsenal, away: chelsea, score: { home: null, away: null } })]
    expect(findMatchScore(noScore, "Arsenal", "Chelsea")).toBeNull()
  })

  it("finds the right match among several", () => {
    const matches = [
      fdMatch({ home: fdTeam("Liverpool FC", "Liverpool"), away: fdTeam("Everton FC", "Everton"), score: { home: 3, away: 0 } }),
      fdMatch({ home: arsenal, away: chelsea, score: { home: 0, away: 0 } }),
    ]
    expect(findMatchScore(matches, "Arsenal", "Chelsea")).toEqual({ homeScore: 0, awayScore: 0 })
  })
})

describe("API-backed fetchers", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "test-key")
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  function respondWith(matches: unknown[]) {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ matches }),
    })
  }

  describe("fetchUpcomingFixtures", () => {
    it("throws when the API key is missing", async () => {
      vi.stubEnv("FOOTBALL_DATA_API_KEY", "")
      await expect(fetchUpcomingFixtures("PL", 1)).rejects.toThrow(
        /FOOTBALL_DATA_API_KEY/,
      )
    })

    it("sends the API key header and requests scheduled matches", async () => {
      respondWith([])
      await fetchUpcomingFixtures("PL", 1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain("/competitions/PL/matches?status=SCHEDULED")
      expect(init.headers["X-Auth-Token"]).toBe("test-key")
    })

    it("keeps only the requested number of rounds", async () => {
      respondWith([
        fdMatch({ home: fdTeam("A"), away: fdTeam("B"), matchday: 1 }),
        fdMatch({ home: fdTeam("C"), away: fdTeam("D"), matchday: 1 }),
        fdMatch({ home: fdTeam("E"), away: fdTeam("F"), matchday: 2 }),
      ])
      const one = await fetchUpcomingFixtures("PL", 1)
      expect(one).toHaveLength(2)
      expect(one.every((f) => f.round === "Matchweek 1")).toBe(true)

      const two = await fetchUpcomingFixtures("PL", 2)
      expect(two).toHaveLength(3)
    })

    it("prefers short names and falls back to full names", async () => {
      respondWith([
        fdMatch({ home: fdTeam("Arsenal FC", "Arsenal"), away: fdTeam("Chelsea FC", "") }),
      ])
      const [fixture] = await fetchUpcomingFixtures("PL", 1)
      expect(fixture.homeTeam).toBe("Arsenal")
      expect(fixture.awayTeam).toBe("Chelsea FC")
    })

    it("skips knockout fixtures with undecided (null) teams", async () => {
      respondWith([
        fdMatch({ home: fdTeam("A"), away: fdTeam("B"), stage: "GROUP_STAGE", group: "GROUP_A", matchday: 1 }),
        // Semi-final teams not yet known — football-data.org returns null names
        fdMatch({
          home: { id: null, name: null, shortName: null, tla: null } as never,
          away: { id: null, name: null, shortName: null, tla: null } as never,
          stage: "SEMI_FINALS",
          matchday: null,
        }),
      ])
      const fixtures = await fetchUpcomingFixtures("WC", 3)
      expect(fixtures).toHaveLength(1)
      expect(fixtures[0].homeTeam).toBe("A")
    })

    it("labels World Cup group and knockout rounds", async () => {
      respondWith([
        fdMatch({ home: fdTeam("A"), away: fdTeam("B"), stage: "GROUP_STAGE", group: "GROUP_A", matchday: 1 }),
        fdMatch({ home: fdTeam("C"), away: fdTeam("D"), stage: "FINAL", matchday: null }),
      ])
      const fixtures = await fetchUpcomingFixtures("WC", 2)
      expect(fixtures.map((f) => f.round)).toEqual(["Group Stage - Group A", "Final"])
    })

    it("surfaces API errors with status code", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" })
      await expect(fetchUpcomingFixtures("PL", 1)).rejects.toThrow(/429/)
    })
  })

  describe("fetchFinishedMatches", () => {
    it("queries finished matches in the date window", async () => {
      respondWith([])
      await fetchFinishedMatches("PL", "2026-07-01", "2026-07-03")
      expect(fetchMock.mock.calls[0][0]).toContain(
        "/competitions/PL/matches?status=FINISHED&dateFrom=2026-07-01&dateTo=2026-07-03",
      )
    })
  })

  describe("lookupResult", () => {
    it("returns the matched score", async () => {
      respondWith([
        fdMatch({
          home: fdTeam("Arsenal FC", "Arsenal"),
          away: fdTeam("Chelsea FC", "Chelsea"),
          score: { home: 4, away: 2 },
        }),
      ])
      await expect(
        lookupResult("Arsenal", "Chelsea", "PL", new Date("2026-07-01T15:00:00Z")),
      ).resolves.toEqual({ homeScore: 4, awayScore: 2 })
    })

    it("throws a helpful error when no result is found", async () => {
      respondWith([])
      await expect(
        lookupResult("Arsenal", "Chelsea", "PL", new Date("2026-07-01T15:00:00Z")),
      ).rejects.toThrow(/No finished result found for Arsenal vs Chelsea/)
    })
  })
})
