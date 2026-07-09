import { describe, it, expect, vi, beforeEach } from "vitest"
import { upsertPrediction } from "./predictions"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prediction: { upsert: vi.fn() },
  },
}))

const predictionUpsert = vi.mocked(prisma.prediction.upsert)

beforeEach(() => {
  vi.clearAllMocks()
  predictionUpsert.mockImplementation(
    (async (args: { create: unknown }) => args.create) as never,
  )
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

  it("returns the upserted prediction", async () => {
    const result = (await upsertPrediction("u1", "fx1", 3, 2, "WEB")) as { fixtureId: string }
    expect(result.fixtureId).toBe("fx1")
  })
})
