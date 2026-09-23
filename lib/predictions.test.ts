import { describe, it, expect, vi, beforeEach } from "vitest"
import { upsertPrediction } from "./predictions"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prediction: { upsert: vi.fn() },
    user: { updateMany: vi.fn() },
  },
}))

vi.mock("@/lib/lastSeen", () => ({
  touchLastSeen: vi.fn(),
}))

const predictionUpsert = vi.mocked(prisma.prediction.upsert)

beforeEach(async () => {
  vi.clearAllMocks()
  predictionUpsert.mockImplementation(
    (async (args: { create: unknown }) => args.create) as never,
  )
  const { touchLastSeen } = await import("./lastSeen")
  vi.mocked(touchLastSeen).mockResolvedValue(undefined)
})

describe("upsertPrediction", () => {
  it("upserts on the (userId, fixtureId) key with the given source", async () => {
    await upsertPrediction("u1", "fx1", 2, 1, "API")

    expect(predictionUpsert).toHaveBeenCalledTimes(1)
    expect(predictionUpsert).toHaveBeenCalledWith({
      where: { userId_fixtureId: { userId: "u1", fixtureId: "fx1" } },
      create: {
        userId: "u1",
        fixtureId: "fx1",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
        submittedVia: "API",
      },
      update: { predictedHomeScore: 2, predictedAwayScore: 1 },
    })
  })

  it("touches lastSeen after a successful upsert", async () => {
    const { touchLastSeen } = await import("./lastSeen")
    await upsertPrediction("u1", "fx1", 1, 0, "WEB")
    expect(touchLastSeen).toHaveBeenCalledWith("u1")
  })

  it("returns the upserted prediction", async () => {
    const result = (await upsertPrediction("u1", "fx1", 3, 2, "WEB")) as { fixtureId: string }
    expect(result.fixtureId).toBe("fx1")
  })
})
