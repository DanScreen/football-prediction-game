import { describe, it, expect, vi, beforeEach } from "vitest"
import { computeLeaderboard } from "./leaderboard"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    prediction: { findMany: vi.fn() },
    bonusAward: { findMany: vi.fn() },
  },
}))

const leagueFindUnique = vi.mocked(prisma.league.findUnique)
const userFindMany = vi.mocked(prisma.user.findMany)
const predictionFindMany = vi.mocked(prisma.prediction.findMany)
const bonusFindMany = vi.mocked(prisma.bonusAward.findMany)

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
