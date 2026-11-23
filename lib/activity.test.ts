import { describe, it, expect, vi, beforeEach } from "vitest"
import { activityDay, activityDayKey, recordActivity, resetActivityMemo } from "./activity"
import { prisma } from "@/lib/prisma"
import { touchLastSeen } from "@/lib/lastSeen"

vi.mock("@/lib/prisma", () => ({
  prisma: { userActivityDay: { upsert: vi.fn() } },
}))
vi.mock("@/lib/lastSeen", () => ({ touchLastSeen: vi.fn() }))

const upsert = vi.mocked(prisma.userActivityDay.upsert)

beforeEach(() => {
  vi.clearAllMocks()
  resetActivityMemo()
  upsert.mockResolvedValue({} as never)
  vi.mocked(touchLastSeen).mockResolvedValue(undefined)
})

describe("activityDay", () => {
  it("uses the London calendar day, not the UTC one", () => {
    // 23:30 UTC on 1 July is 00:30 BST on 2 July.
    expect(activityDayKey(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02")
    // In winter London is on UTC.
    expect(activityDayKey(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01")
    expect(activityDay(new Date("2026-07-01T23:30:00Z")).toISOString()).toBe(
      "2026-07-02T00:00:00.000Z",
    )
  })
})

describe("recordActivity", () => {
  const now = new Date("2026-11-23T12:00:00Z")

  it("upserts the day with the surface flag and bumps lastSeenAt", async () => {
    await recordActivity("u1", "app", now)
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_day: { userId: "u1", day: new Date("2026-11-23T00:00:00Z") } },
      create: { userId: "u1", day: new Date("2026-11-23T00:00:00Z"), app: true },
      update: { app: true },
    })
    expect(touchLastSeen).toHaveBeenCalledWith("u1", now)
  })

  it("writes once per user, surface and day", async () => {
    await recordActivity("u1", "web", now)
    await recordActivity("u1", "web", new Date("2026-11-23T18:00:00Z"))
    expect(upsert).toHaveBeenCalledTimes(1)

    await recordActivity("u1", "app", now) // another surface
    await recordActivity("u2", "web", now) // another user
    await recordActivity("u1", "web", new Date("2026-11-24T09:00:00Z")) // next day
    expect(upsert).toHaveBeenCalledTimes(4)
  })

  it("swallows database errors and retries on the next call", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    upsert.mockRejectedValueOnce(new Error("db down"))
    await expect(recordActivity("u1", "web", now)).resolves.toBeUndefined()
    await recordActivity("u1", "web", now)
    expect(upsert).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})
