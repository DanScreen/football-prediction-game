import { describe, it, expect, vi, beforeEach } from "vitest"
import { setBanker } from "./banker"
import { prisma } from "@/lib/prisma"

const tx = {
  fixture: { findUnique: vi.fn(), findMany: vi.fn() },
  prediction: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}))

const transaction = vi.mocked(prisma.$transaction)

const FUTURE = new Date(Date.now() + 60 * 60 * 1000)
const PAST = new Date(Date.now() - 60 * 60 * 1000)

function fixture(id: string, kickoffTime: Date, overrides = {}) {
  return {
    id,
    competitionId: "comp-pl",
    round: "Matchweek 1",
    homeTeam: `${id} home`,
    awayTeam: `${id} away`,
    kickoffTime,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  transaction.mockImplementation((async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) as never)
  tx.fixture.findUnique.mockResolvedValue(fixture("f1", FUTURE) as never)
  tx.fixture.findMany.mockResolvedValue([fixture("f1", FUTURE), fixture("f2", FUTURE)] as never)
  tx.prediction.findUnique.mockResolvedValue({ id: "pred-f1" } as never)
  tx.prediction.findMany.mockResolvedValue([] as never)
  tx.prediction.update.mockResolvedValue({} as never)
  tx.prediction.updateMany.mockResolvedValue({ count: 0 } as never)
})

describe("setBanker", () => {
  it("marks the prediction as banker", async () => {
    const result = await setBanker("alice", "f1", true)

    expect(result).toEqual({ ok: true })
    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "pred-f1" },
      data: { isBanker: true },
    })
  })

  it("clears any previous banker in the same round", async () => {
    tx.prediction.findMany.mockResolvedValue([{ id: "pred-f2", fixtureId: "f2" }] as never)

    await setBanker("alice", "f1", true)

    expect(tx.prediction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pred-f2"] } },
      data: { isBanker: false },
    })
  })

  it("only considers bankers on fixtures in the same competition and round", async () => {
    await setBanker("alice", "f1", true)

    expect(tx.fixture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { competitionId: "comp-pl", round: "Matchweek 1" },
      }),
    )
    expect(tx.prediction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "alice",
          isBanker: true,
          fixtureId: { in: ["f1", "f2"] },
        }),
      }),
    )
  })

  it("clears the banker without touching the rest of the round", async () => {
    const result = await setBanker("alice", "f1", false)

    expect(result).toEqual({ ok: true })
    expect(tx.prediction.update).toHaveBeenCalledWith({
      where: { id: "pred-f1" },
      data: { isBanker: false },
    })
    expect(tx.prediction.updateMany).not.toHaveBeenCalled()
  })

  it("refuses a fixture that has already kicked off", async () => {
    tx.fixture.findUnique.mockResolvedValue(fixture("f1", PAST) as never)

    const result = await setBanker("alice", "f1", true)

    expect(result).toEqual({ ok: false, error: "This fixture has kicked off — bankers are locked." })
    expect(tx.prediction.update).not.toHaveBeenCalled()
  })

  // The hindsight case: bank a match, watch it go badly, move the double on.
  it("refuses to move a banker off a fixture that has kicked off", async () => {
    tx.fixture.findMany.mockResolvedValue([fixture("f1", FUTURE), fixture("f2", PAST)] as never)
    tx.prediction.findMany.mockResolvedValue([{ id: "pred-f2", fixtureId: "f2" }] as never)

    const result = await setBanker("alice", "f1", true)

    expect(result).toEqual({
      ok: false,
      error: "Your banker is locked — f2 home v f2 away has already kicked off.",
    })
    expect(tx.prediction.update).not.toHaveBeenCalled()
    expect(tx.prediction.updateMany).not.toHaveBeenCalled()
  })

  it("requires a prediction to attach the banker to", async () => {
    tx.prediction.findUnique.mockResolvedValue(null as never)

    const result = await setBanker("alice", "f1", true)

    expect(result).toEqual({
      ok: false,
      error: "Predict this fixture first, then make it your banker.",
    })
  })

  it("rejects an unknown fixture", async () => {
    tx.fixture.findUnique.mockResolvedValue(null as never)

    expect(await setBanker("alice", "nope", true)).toEqual({
      ok: false,
      error: "Fixture not found.",
    })
  })
})
