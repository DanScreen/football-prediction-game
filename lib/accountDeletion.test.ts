import { describe, it, expect, vi, beforeEach } from "vitest"
import { deleteUserAccount } from "./accountDeletion"
import { prisma } from "@/lib/prisma"

/**
 * The transaction callback is run against a stub `tx`, so these assert the
 * *order and completeness* of the deletes — which is the whole risk here. None
 * of the `User` relations cascade, so a forgotten child table would leave the
 * production delete failing on a foreign key at runtime with nothing to catch
 * it earlier.
 */
const tx = {
  leagueMembership: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  prediction: { deleteMany: vi.fn() },
  bonusAward: { deleteMany: vi.fn() },
  mobileDeviceToken: { deleteMany: vi.fn() },
  mobileRefreshToken: { deleteMany: vi.fn() },
  passwordResetToken: { deleteMany: vi.fn() },
  user: { delete: vi.fn() },
  league: { delete: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}))

const $transaction = vi.mocked(prisma.$transaction)

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction.mockImplementation((fn: any) => fn(tx))
  tx.leagueMembership.findMany.mockResolvedValue([])
  tx.leagueMembership.count.mockResolvedValue(0)
})

describe("deleteUserAccount", () => {
  it("removes every table that references the user, then the user", async () => {
    await deleteUserAccount("u1")

    for (const model of [
      tx.prediction,
      tx.bonusAward,
      tx.leagueMembership,
      tx.mobileDeviceToken,
      tx.mobileRefreshToken,
      tx.passwordResetToken,
    ]) {
      expect(model.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } })
    }
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } })
  })

  it("leaves a league standing when other members remain", async () => {
    tx.leagueMembership.findMany.mockResolvedValue([{ leagueId: "l1" }])
    tx.leagueMembership.count.mockResolvedValue(2)

    await deleteUserAccount("u1")

    expect(tx.league.delete).not.toHaveBeenCalled()
  })

  it("deletes a league the departing user was the last member of", async () => {
    tx.leagueMembership.findMany.mockResolvedValue([{ leagueId: "l1" }])
    tx.leagueMembership.count.mockResolvedValue(0)

    await deleteUserAccount("u1")

    // The league's own bonus awards go first — they point at the league, not
    // only at the user, so members who already left would otherwise block it.
    expect(tx.bonusAward.deleteMany).toHaveBeenCalledWith({ where: { leagueId: "l1" } })
    expect(tx.league.delete).toHaveBeenCalledWith({ where: { id: "l1" } })
  })
})
