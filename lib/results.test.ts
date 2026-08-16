import { describe, it, expect, vi, beforeEach } from "vitest"
import { confirmFixtureResult, acceptAllProposed } from "./results"
import { prisma } from "@/lib/prisma"
import { ResultSource } from "@/app/generated/prisma/client"

const tx = {
  fixture: { update: vi.fn(), findMany: vi.fn() },
  prediction: { findMany: vi.fn(), update: vi.fn() },
  league: { findMany: vi.fn() },
  bonusAward: { deleteMany: vi.fn(), upsert: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    fixture: { findMany: vi.fn() },
  },
}))

const transaction = vi.mocked(prisma.$transaction)
const outerFixtureFindMany = vi.mocked(prisma.fixture.findMany)

function completedFixture(id: string, home: number, away: number, overrides = {}) {
  return {
    id,
    competitionId: "comp-pl",
    round: "Matchweek 1",
    status: "COMPLETED",
    actualHomeScore: home,
    actualAwayScore: away,
    ...overrides,
  }
}

function prediction(
  userId: string,
  fixtureId: string,
  home: number,
  away: number,
  isBanker = false,
) {
  return {
    id: `${userId}-${fixtureId}`,
    userId,
    fixtureId,
    predictedHomeScore: home,
    predictedAwayScore: away,
    isBanker,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) as never)
  tx.fixture.update.mockResolvedValue(
    completedFixture("f1", 2, 1) as never,
  )
  tx.prediction.findMany.mockResolvedValue([])
  tx.prediction.update.mockResolvedValue({} as never)
  tx.fixture.findMany.mockResolvedValue([completedFixture("f1", 2, 1)] as never)
  tx.league.findMany.mockResolvedValue([])
  tx.bonusAward.deleteMany.mockResolvedValue({ count: 0 } as never)
  tx.bonusAward.upsert.mockResolvedValue({} as never)
})

describe("confirmFixtureResult", () => {
  it("saves the result, completes the fixture, and clears proposals", async () => {
    await confirmFixtureResult("f1", 2, 1, ResultSource.MANUAL)

    expect(tx.fixture.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: {
        actualHomeScore: 2,
        actualAwayScore: 1,
        status: "COMPLETED",
        resultSource: "MANUAL",
        proposedHomeScore: null,
        proposedAwayScore: null,
      },
    })
  })

  it("scores every prediction for the fixture once", async () => {
    tx.prediction.findMany
      .mockResolvedValueOnce([
        prediction("alice", "f1", 2, 1), // exact = 3
        prediction("bob", "f1", 4, 1),   // right result, two goals out = 1
      ] as never)
      .mockResolvedValueOnce([]) // round predictions pass

    await confirmFixtureResult("f1", 2, 1, ResultSource.AI_CONFIRMED)

    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "alice-f1" },
      data: { pointsAwarded: 3 },
    })
    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "bob-f1" },
      data: { pointsAwarded: 1 },
    })
  })

  it("doubles a banker's points", async () => {
    tx.prediction.findMany
      .mockResolvedValueOnce([
        prediction("alice", "f1", 2, 1, true), // exact = 3, bankered = 6
        prediction("bob", "f1", 4, 1, true),   // result only = 1, bankered = 2
        prediction("carol", "f1", 0, 2, true), // wrong = 0, still 0
      ] as never)
      .mockResolvedValueOnce([])

    await confirmFixtureResult("f1", 2, 1, ResultSource.MANUAL)

    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "alice-f1" },
      data: { pointsAwarded: 6 },
    })
    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "bob-f1" },
      data: { pointsAwarded: 2 },
    })
    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "carol-f1" },
      data: { pointsAwarded: 0 },
    })
  })

  // The round-completion pass re-derives every prediction's points. Normalising
  // to base points there would silently strip the double off the whole round.
  it("keeps the banker double when the completed round is re-derived", async () => {
    const roundFixtures = [completedFixture("f1", 2, 1), completedFixture("f2", 0, 0)]
    tx.fixture.findMany.mockResolvedValue(roundFixtures as never)
    tx.prediction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        prediction("alice", "f1", 2, 1, true), // exact, bankered → 6
        prediction("alice", "f2", 0, 0),       // exact, normal → 3
      ] as never)

    await confirmFixtureResult("f2", 0, 0, ResultSource.MANUAL)

    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "alice-f1" },
      data: { pointsAwarded: 6 },
    })
    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "alice-f2" },
      data: { pointsAwarded: 3 },
    })
  })

  it("skips bonus processing while the round is incomplete", async () => {
    tx.fixture.findMany.mockResolvedValue([
      completedFixture("f1", 2, 1),
      completedFixture("f2", 0, 0, { status: "AWAITING_RESULT", actualHomeScore: null, actualAwayScore: null }),
    ] as never)

    await confirmFixtureResult("f1", 2, 1, ResultSource.MANUAL)

    expect(tx.league.findMany).not.toHaveBeenCalled()
    expect(tx.bonusAward.upsert).not.toHaveBeenCalled()
  })

  it("awards streak bonuses by tier and fans them out per league", async () => {
    // A 10-fixture round: everyone drew 0-0, so a predicted draw is a correct result.
    const roundFixtures = Array.from({ length: 10 }, (_, i) => completedFixture(`f${i + 1}`, 0, 0))
    tx.fixture.findMany.mockResolvedValue(roundFixtures as never)

    const picks = (userId: string, correct: number) =>
      roundFixtures.map((f, i) =>
        // 0-0 is a correct result; 1-0 is not.
        i < correct ? prediction(userId, f.id, 0, 0) : prediction(userId, f.id, 1, 0),
      )

    tx.prediction.findMany
      .mockResolvedValueOnce([]) // fixture predictions
      .mockResolvedValueOnce([
        ...picks("alice", 10), // 10 correct → 3
        ...picks("bob", 8), //    8 correct → 2
        ...picks("carol", 5), //  5 correct → 1
        ...picks("dan", 4), //    4 correct → nothing
      ] as never)

    tx.league.findMany.mockResolvedValue([
      {
        id: "league-a",
        memberships: [{ userId: "alice" }, { userId: "bob" }, { userId: "dan" }],
      },
      {
        id: "league-b",
        memberships: [{ userId: "carol" }], // alice is NOT a member here
      },
    ] as never)

    await confirmFixtureResult("f1", 0, 0, ResultSource.MANUAL)

    // Every league on the competition now qualifies — there is no enabled flag.
    expect(tx.league.findMany).toHaveBeenCalledWith({
      where: { competitionId: "comp-pl" },
      include: { memberships: { select: { userId: true } } },
    })

    const awarded = (userId: string, leagueId: string) =>
      tx.bonusAward.upsert.mock.calls
        .map((c) => c[0] as { create: { userId: string; leagueId: string; points: number } })
        .find((a) => a.create.userId === userId && a.create.leagueId === leagueId)?.create.points

    expect(awarded("alice", "league-a")).toBe(3)
    expect(awarded("bob", "league-a")).toBe(2)
    expect(awarded("carol", "league-b")).toBe(1)
    // dan fell below the lowest tier
    expect(awarded("dan", "league-a")).toBeUndefined()
    // alice isn't in league B, so her bonus doesn't leak into it
    expect(awarded("alice", "league-b")).toBeUndefined()

    // Anyone not earning is cleared, so a re-confirmation can demote someone.
    expect(tx.bonusAward.deleteMany).toHaveBeenCalledWith({
      where: { leagueId: "league-a", round: "Matchweek 1", userId: { notIn: ["alice", "bob"] } },
    })
  })

  it("counts correct results, not fixtures predicted", async () => {
    // Six fixtures, all 0-0. Alice predicts five and gets all five right; she
    // reaches the 5+ tier despite skipping one.
    const roundFixtures = Array.from({ length: 6 }, (_, i) => completedFixture(`f${i + 1}`, 0, 0))
    tx.fixture.findMany.mockResolvedValue(roundFixtures as never)
    tx.prediction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        roundFixtures.slice(0, 5).map((f) => prediction("alice", f.id, 0, 0)) as never,
      )
    tx.league.findMany.mockResolvedValue([
      { id: "league-a", memberships: [{ userId: "alice" }] },
    ] as never)

    await confirmFixtureResult("f1", 0, 0, ResultSource.MANUAL)

    expect(tx.bonusAward.upsert).toHaveBeenCalledWith({
      where: {
        userId_leagueId_round: { userId: "alice", leagueId: "league-a", round: "Matchweek 1" },
      },
      create: { userId: "alice", leagueId: "league-a", round: "Matchweek 1", points: 1 },
      update: { points: 1 },
    })
  })
})

describe("acceptAllProposed", () => {
  it("confirms every fixture with a proposal, isolating failures", async () => {
    outerFixtureFindMany.mockResolvedValue([
      { id: "f1", proposedHomeScore: 2, proposedAwayScore: 1 },
      { id: "f2", proposedHomeScore: 0, proposedAwayScore: 0 },
      { id: "f3", proposedHomeScore: 1, proposedAwayScore: 3 },
    ] as never)
    // f2's transaction blows up; others succeed
    transaction
      .mockImplementationOnce((async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) as never)
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementationOnce((async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) as never)

    const result = await acceptAllProposed()

    expect(outerFixtureFindMany).toHaveBeenCalledWith({
      where: {
        status: "AWAITING_RESULT",
        proposedHomeScore: { not: null },
        proposedAwayScore: { not: null },
      },
      select: { id: true, proposedHomeScore: true, proposedAwayScore: true },
    })
    expect(result).toEqual({ confirmed: 2, failed: 1 })
  })

  it("does nothing when no proposals are waiting", async () => {
    outerFixtureFindMany.mockResolvedValue([])
    expect(await acceptAllProposed()).toEqual({ confirmed: 0, failed: 0 })
    expect(transaction).not.toHaveBeenCalled()
  })
})
