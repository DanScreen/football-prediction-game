import { describe, it, expect, vi, beforeEach } from "vitest"
import { touchLastSeen, LAST_SEEN_THROTTLE_MS } from "./lastSeen"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { updateMany: vi.fn() },
  },
}))

const userUpdateMany = vi.mocked(prisma.user.updateMany)

beforeEach(() => {
  vi.clearAllMocks()
  userUpdateMany.mockResolvedValue({ count: 1 } as never)
})

describe("touchLastSeen", () => {
  it("writes when lastSeenAt is null or older than the throttle", async () => {
    const now = new Date("2026-09-23T12:00:00.000Z")
    await touchLastSeen("u1", now)

    expect(userUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "u1",
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date(now.getTime() - LAST_SEEN_THROTTLE_MS) } },
        ],
      },
      data: { lastSeenAt: now },
    })
  })
})
