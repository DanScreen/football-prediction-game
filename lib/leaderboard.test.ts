import { describe, it, expect, vi, beforeEach } from "vitest"
import { computeLeaderboard, listPlayedRounds } from "./leaderboard"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    prediction: { findMany: vi.fn() },
    bonusAward: { findMany: vi.fn() },
    fixture: { findMany: vi.fn() },
  },
}))

const leagueFindUnique = vi.mocked(prisma.league.findUnique)
const userFindMany = vi.mocked(prisma.user.findMany)
const predictionFindMany = vi.mocked(prisma.prediction.findMany)
const bonusFindMany = vi.mocked(prisma.bonusAward.findMany)
const fixtureFindMany = vi.mocked(prisma.fixture.findMany)

function user(id: string) {
  return { id, displayName: id, isBot: false }
}

function confirmedPrediction(userId: string, points: number, exact = false) {
  return {
    userId,
    pointsAwarded: points,
    predictedHomeScore: exact ? 2 : 9,
    predictedAwayScore: exact ? 1 : 9,
    fixture: {
      status: "COMPLETED",
      actualHomeScore: 2,
      actualAwayScore: 1,
      proposedHomeScore: null,
      proposedAwayScore: null,
    },
  }
}

function awaitingPrediction(userId: string, predHome: number, predAway: number) {
  return {
    userId,
    pointsAwarded: null,
    predictedHomeScore: predHome,
    predictedAwayScore: predAway,
    fixture: {
      status: "AWAITING_RESULT",
      actualHomeScore: null,
      actualAwayScore: null,
      proposedHomeScore: 1,
      proposedAwayScore: 0,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  leagueFindUnique.mockResolvedValue({
    competitionId: "comp-pl",
    memberships: [{ userId: "alice" }, { userId: "bob" }],
  } as never)
  bonusFindMany.mockResolvedValue([])
})

describe("computeLeaderboard", () => {
  it("returns empty for an unknown league", async () => {
    leagueFindUnique.mockResolvedValue(null)
    expect(await computeLeaderboard("nope")).toEqual([])
  })

  it("scopes predictions to league members and the league's competition", async () => {
    userFindMany.mockResolvedValue([user("alice"), user("bob")] as never)
    predictionFindMany.mockResolvedValue([])

    await computeLeaderboard("league-a")

    expect(predictionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: { in: ["alice", "bob"] },
          fixture: { competitionId: "comp-pl" },
        },
      }),
    )
  })

  it("separates confirmed points (incl. bonuses) from provisional points", async () => {
    userFindMany.mockResolvedValue([user("alice"), user("bob")] as never)
    predictionFindMany.mockResolvedValue([
      confirmedPrediction("alice", 3, true),
      awaitingPrediction("alice", 1, 0), // exact vs proposed 1-0 → +3 provisional
      confirmedPrediction("bob", 1),
      awaitingPrediction("bob", 0, 1), // wrong result vs proposed → +0 provisional
    ] as never)
    bonusFindMany.mockResolvedValue([{ userId: "alice", points: 3 }] as never)

    const board = await computeLeaderboard("league-a")

    const alice = board.find((e) => e.id === "alice")!
    const bob = board.find((e) => e.id === "bob")!
    expect(alice.confirmedPoints).toBe(6) // 3 + 3 bonus
    expect(alice.provisionalPoints).toBe(3)
    expect(alice.streakPoints).toBe(3)
    expect(alice.exactCount).toBe(1)
    expect(bob.confirmedPoints).toBe(1)
    expect(bob.provisionalPoints).toBe(0)
  })

  it("ranks by confirmed points only, sharing rank on ties", async () => {
    leagueFindUnique.mockResolvedValue({
      competitionId: "comp-pl",
      memberships: [{ userId: "alice" }, { userId: "bob" }, { userId: "carol" }],
    } as never)
    userFindMany.mockResolvedValue([user("alice"), user("bob"), user("carol")] as never)
    predictionFindMany.mockResolvedValue([
      confirmedPrediction("alice", 3),
      confirmedPrediction("bob", 3),
      // carol has fewer confirmed but a huge provisional haul — rank unaffected
      confirmedPrediction("carol", 1),
      awaitingPrediction("carol", 1, 0),
    ] as never)

    const board = await computeLeaderboard("league-a")

    expect(board.map((e) => [e.id, e.rank])).toEqual([
      ["alice", 1],
      ["bob", 1],
      ["carol", 3],
    ])
  })
})

describe("points breakdown", () => {
  // The breakdown is derived from the stored pointsAwarded + isBanker, not from
  // the scoreline, so these fixtures only need those two fields.
  const scored = (points: number, isBanker = false) => ({
    userId: "alice",
    pointsAwarded: points,
    isBanker,
    predictedHomeScore: 9,
    predictedAwayScore: 9,
    fixture: {
      status: "COMPLETED",
      actualHomeScore: 2,
      actualAwayScore: 1,
      proposedHomeScore: null,
      proposedAwayScore: null,
    },
  })

  it("splits confirmed points by source and always sums to the total", async () => {
    leagueFindUnique.mockResolvedValue({
      competitionId: "comp-pl",
      memberships: [{ userId: "alice" }],
    } as never)
    userFindMany.mockResolvedValue([user("alice")] as never)
    predictionFindMany.mockResolvedValue([
      scored(3), //          exact
      scored(6, true), //    exact, bankered → 3 exact + 3 banker
      scored(1.5), //        right result + goal difference
      scored(1), //          right result only
      scored(0), //          wrong — lands in no bucket
    ] as never)
    bonusFindMany.mockResolvedValue([{ userId: "alice", points: 2 }] as never)

    const [alice] = await computeLeaderboard("league-a")

    expect(alice.breakdown).toEqual({
      result: 1,
      close: 1.5,
      exact: 6,
      banker: 3,
      streak: 2,
    })

    // The invariant the UI leans on: the parts account for the whole.
    const { result, close, exact, banker, streak } = alice.breakdown
    expect(result + close + exact + banker + streak).toBe(alice.confirmedPoints)
  })

  it("credits a bankered pick to its own tier plus the doubling", async () => {
    leagueFindUnique.mockResolvedValue({
      competitionId: "comp-pl",
      memberships: [{ userId: "alice" }],
    } as never)
    userFindMany.mockResolvedValue([user("alice")] as never)
    // One bankered right-result pick: stored 2 = 1 base + 1 doubled.
    predictionFindMany.mockResolvedValue([scored(2, true)] as never)
    bonusFindMany.mockResolvedValue([] as never)

    const [alice] = await computeLeaderboard("league-a")

    expect(alice.breakdown).toEqual({ result: 1, close: 0, exact: 0, banker: 1, streak: 0 })
    expect(alice.confirmedPoints).toBe(2)
  })
})

describe("computeLeaderboard, scoped to one round", () => {
  beforeEach(() => {
    leagueFindUnique.mockResolvedValue({
      competitionId: "comp-pl",
      memberships: [{ userId: "alice" }],
    } as never)
    userFindMany.mockResolvedValue([user("alice")] as never)
    predictionFindMany.mockResolvedValue([] as never)
    bonusFindMany.mockResolvedValue([] as never)
  })

  it("filters predictions to that round, still inside the competition", async () => {
    await computeLeaderboard("league-a", { round: "Matchday 5" })

    expect(predictionFindMany.mock.calls[0][0]?.where?.fixture).toEqual({
      competitionId: "comp-pl",
      round: "Matchday 5",
    })
  })

  it("filters the streak bonuses to the same round", async () => {
    await computeLeaderboard("league-a", { round: "Matchday 5" })

    // A round table that carried the whole season's bonuses would show points
    // the round's fixtures cannot account for.
    expect(bonusFindMany.mock.calls[0][0]?.where).toEqual({
      leagueId: "league-a",
      round: "Matchday 5",
    })
  })

  it("is unfiltered when no round is given", async () => {
    await computeLeaderboard("league-a")

    expect(predictionFindMany.mock.calls[0][0]?.where?.fixture).toEqual({
      competitionId: "comp-pl",
    })
    expect(bonusFindMany.mock.calls[0][0]?.where).toEqual({ leagueId: "league-a" })
  })

  it("ranks on the round's points alone", async () => {
    userFindMany.mockResolvedValue([user("alice"), user("bob")] as never)
    predictionFindMany.mockResolvedValue([
      // Bob out-scores Alice in this round; the season total is irrelevant here
      // because the query already excluded every other round.
      confirmedPrediction("alice", 1),
      confirmedPrediction("bob", 3),
    ] as never)

    const ranked = await computeLeaderboard("league-a", { round: "Matchday 5" })

    expect(ranked.map((r) => [r.id, r.rank, r.confirmedPoints])).toEqual([
      ["bob", 1, 3],
      ["alice", 2, 1],
    ])
  })
})

describe("listPlayedRounds", () => {
  beforeEach(() => {
    leagueFindUnique.mockResolvedValue({ competitionId: "comp-pl" } as never)
  })

  it("orders newest first on each round's latest kickoff", async () => {
    fixtureFindMany.mockResolvedValue([
      // Matchday 1 starts before Matchday 2 but finishes after it: ordering on
      // the earliest kickoff would put them the wrong way round.
      { round: "Matchday 1", kickoffTime: new Date("2026-08-01T12:00:00Z") },
      { round: "Matchday 1", kickoffTime: new Date("2026-08-05T20:00:00Z") },
      { round: "Matchday 2", kickoffTime: new Date("2026-08-03T15:00:00Z") },
    ] as never)

    expect(await listPlayedRounds("league-a")).toEqual(["Matchday 1", "Matchday 2"])
  })

  it("asks only for fixtures that have kicked off", async () => {
    fixtureFindMany.mockResolvedValue([] as never)
    const now = new Date("2026-09-06T10:00:00Z")

    await listPlayedRounds("league-a", now)

    expect(fixtureFindMany.mock.calls[0][0]?.where).toEqual({
      competitionId: "comp-pl",
      kickoffTime: { lte: now },
    })
  })

  it("is empty for a league that does not exist", async () => {
    leagueFindUnique.mockResolvedValue(null as never)
    expect(await listPlayedRounds("nope")).toEqual([])
    expect(fixtureFindMany).not.toHaveBeenCalled()
  })
})
