import { describe, it, expect, vi, beforeEach } from "vitest"
import { reassignRound, deleteFixtures } from "./fixtureAdmin"
import { prisma } from "@/lib/prisma"

const tx = {
  fixture: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  prediction: { findMany: vi.fn(), updateMany: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }))

const transaction = vi.mocked(prisma.$transaction)

function fx(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    competitionId: "comp-pl",
    round: "Matchweek 8",
    status: "SCHEDULED",
    homeTeam: `${id}H`,
    awayTeam: `${id}A`,
    _count: { predictions: 0 },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) as never)
  tx.fixture.updateMany.mockResolvedValue({ count: 0 } as never)
  tx.fixture.deleteMany.mockResolvedValue({ count: 0 } as never)
  tx.prediction.findMany.mockResolvedValue([] as never)
  tx.prediction.updateMany.mockResolvedValue({ count: 0 } as never)
})

describe("reassignRound", () => {
  it("moves the selected fixtures", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f1"), fx("f2")] as never)
    tx.fixture.findMany.mockResolvedValueOnce([{ id: "f1" }, { id: "f2" }] as never)

    const result = await reassignRound(["f1", "f2"], "Matchweek 9")

    expect(result).toEqual({ ok: true, message: "Moved 2 fixtures to Matchweek 9." })
    expect(tx.fixture.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["f1", "f2"] } },
      data: { round: "Matchweek 9" },
    })
  })

  it("refuses to move a settled fixture", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f1", { status: "COMPLETED" })] as never)

    const result = await reassignRound(["f1"], "Matchweek 9")

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain("already has a result")
    expect(tx.fixture.updateMany).not.toHaveBeenCalled()
  })

  it("rejects an empty gameweek name before touching the database", async () => {
    expect(await reassignRound(["f1"], "   ")).toEqual({
      ok: false,
      error: "Enter a gameweek to move them to.",
    })
    expect(transaction).not.toHaveBeenCalled()
  })

  it("clears the arriving banker when the move creates a duplicate", async () => {
    // f2 moves into Matchweek 9, where the player already bankered f9.
    tx.fixture.findMany.mockResolvedValueOnce([fx("f2")] as never)
    tx.fixture.findMany.mockResolvedValueOnce([{ id: "f9" }, { id: "f2" }] as never)
    tx.prediction.findMany.mockResolvedValueOnce([
      { id: "p-resident", userId: "u1", fixtureId: "f9" },
      { id: "p-arrival", userId: "u1", fixtureId: "f2" },
    ] as never)

    const result = await reassignRound(["f2"], "Matchweek 9")

    expect(tx.prediction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p-arrival"] } },
      data: { isBanker: false },
    })
    expect(result.ok === true && result.message).toContain("Cleared 1 duplicate banker pick")
  })

  it("leaves one banker standing when every banker arrives together", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f1"), fx("f2")] as never)
    tx.fixture.findMany.mockResolvedValueOnce([{ id: "f1" }, { id: "f2" }] as never)
    tx.prediction.findMany.mockResolvedValueOnce([
      { id: "p1", userId: "u1", fixtureId: "f1" },
      { id: "p2", userId: "u1", fixtureId: "f2" },
    ] as never)

    await reassignRound(["f1", "f2"], "Matchweek 9")

    expect(tx.prediction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p2"] } },
      data: { isBanker: false },
    })
  })

  it("does not disturb a player who has a single banker in the round", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f2")] as never)
    tx.fixture.findMany.mockResolvedValueOnce([{ id: "f9" }, { id: "f2" }] as never)
    tx.prediction.findMany.mockResolvedValueOnce([
      { id: "p-a", userId: "u1", fixtureId: "f9" },
      { id: "p-b", userId: "u2", fixtureId: "f2" },
    ] as never)

    const result = await reassignRound(["f2"], "Matchweek 9")

    expect(tx.prediction.updateMany).not.toHaveBeenCalled()
    expect(result.ok === true && result.message).toBe("Moved 1 fixture to Matchweek 9.")
  })

  it("is a no-op when the fixtures are already in the target gameweek", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f1")] as never)

    const result = await reassignRound(["f1"], "Matchweek 8")

    expect(result).toEqual({ ok: true, message: "Already in Matchweek 8 — nothing to do." })
    expect(tx.fixture.updateMany).not.toHaveBeenCalled()
  })

  it("refuses when a selected fixture has vanished", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f1")] as never)

    const result = await reassignRound(["f1", "gone"], "Matchweek 9")

    expect(result).toEqual({
      ok: false,
      error: "Some fixtures no longer exist — reload and try again.",
    })
  })
})

describe("deleteFixtures", () => {
  it("deletes fixtures nobody has predicted", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f1"), fx("f2")] as never)

    const result = await deleteFixtures(["f1", "f2"])

    expect(result).toEqual({ ok: true, message: "Deleted 2 fixtures." })
    expect(tx.fixture.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["f1", "f2"] } } })
  })

  it("refuses a fixture carrying predictions", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([
      fx("f1", { _count: { predictions: 3 } }),
    ] as never)

    const result = await deleteFixtures(["f1"])

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain("3 predictions")
    expect(tx.fixture.deleteMany).not.toHaveBeenCalled()
  })

  it("refuses a settled fixture", async () => {
    tx.fixture.findMany.mockResolvedValueOnce([fx("f1", { status: "COMPLETED" })] as never)

    const result = await deleteFixtures(["f1"])

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toContain("can't be deleted")
  })

  it("requires a selection", async () => {
    expect(await deleteFixtures([])).toEqual({ ok: false, error: "Select at least one fixture." })
    expect(transaction).not.toHaveBeenCalled()
  })
})
