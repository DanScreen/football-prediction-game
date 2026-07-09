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

function prediction(userId: string, fixtureId: string, home: number, away: number) {
  return { id: `${userId}-${fixtureId}`, userId, fixtureId, predictedHomeScore: home, predictedAwayScore: away }
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
        prediction("bob", "f1", 3, 1),   // correct result, different diff = 1
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

  it("skips Grand Slam processing while the round is incomplete", async () => {
    tx.fixture.findMany.mockResolvedValue([
      completedFixture("f1", 2, 1),
      completedFixture("f2", 0, 0, { status: "AWAITING_RESULT", actualHomeScore: null, actualAwayScore: null }),
    ] as never)

    await confirmFixtureResult("f1", 2, 1, ResultSource.MANUAL)

    expect(tx.league.findMany).not.toHaveBeenCalled()
    expect(tx.bonusAward.upsert).not.toHaveBeenCalled()
  })

  it("fans Grand Slam bonuses out per league with per-league settings and membership", async () => {
    const roundFixtures = [completedFixture("f1", 2, 1), completedFixture("f2", 0, 0)]
    tx.fixture.findMany.mockResolvedValue(roundFixtures as never)
    tx.prediction.findMany
      .mockResolvedValueOnce([]) // fixture predictions
      .mockResolvedValueOnce([
        // alice: correct results on both fixtures → qualifies
        prediction("alice", "f1", 3, 2),
        prediction("alice", "f2", 1, 1),
        // bob: wrong result on f2 → does not qualify
        prediction("bob", "f1", 2, 1),
        prediction("bob", "f2", 1, 0),
        // carol: only predicted one fixture → does not qualify
        prediction("carol", "f1", 2, 1),
      ] as never)
    tx.league.findMany.mockResolvedValue([
      {
        id: "league-a",
        grandSlamPoints: 3,
        memberships: [{ userId: "alice" }, { userId: "bob" }],
      },
      {
        id: "league-b",
        grandSlamPoints: 10,
        memberships: [{ userId: "carol" }], // alice is NOT a member here
      },
    ] as never)

    await confirmFixtureResult("f1", 2, 1, ResultSource.MANUAL)

    // Only grandSlamEnabled leagues on this competition are considered
    expect(tx.league.findMany).toHaveBeenCalledWith({
      where: { competitionId: "comp-pl", grandSlamEnabled: true },
      include: { memberships: { select: { userId: true } } },
    })

    // League A: alice qualifies at league A's points value
    expect(tx.bonusAward.upsert).toHaveBeenCalledWith({
      where: {
        userId_leagueId_round: { userId: "alice", leagueId: "league-a", round: "Matchweek 1" },
      },
      create: { userId: "alice", leagueId: "league-a", round: "Matchweek 1", points: 3 },
      update: { points: 3 },
    })
    // League B: alice is not a member, carol didn't qualify → no upserts for league B
    const leagueBUpserts = tx.bonusAward.upsert.mock.calls.filter(
      (c) => (c[0] as { create: { leagueId: string } }).create.leagueId === "league-b",
    )
    expect(leagueBUpserts).toHaveLength(0)
    // Non-qualifiers are cleaned up in both leagues
    expect(tx.bonusAward.deleteMany).toHaveBeenCalledWith({
      where: { leagueId: "league-a", round: "Matchweek 1", userId: { notIn: ["alice"] } },
    })
    expect(tx.bonusAward.deleteMany).toHaveBeenCalledWith({
      where: { leagueId: "league-b", round: "Matchweek 1", userId: { notIn: [] } },
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
