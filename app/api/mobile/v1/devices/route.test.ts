import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST, DELETE } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mobileDeviceToken: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock("@/lib/mobileAuth", () => ({
  authenticateMobileAccess: vi.fn(),
}))

const authMock = vi.mocked(authenticateMobileAccess)
const upsert = vi.mocked(prisma.mobileDeviceToken.upsert)
const deleteMany = vi.mocked(prisma.mobileDeviceToken.deleteMany)

function req(method: string, body: unknown) {
  return new Request("http://test/api/mobile/v1/devices", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({
    id: "u1",
    email: "a@b.c",
    displayName: "A",
    isBot: false,
    emailVerified: true,
    avatarUrl: null,
  })
})

describe("POST /api/mobile/v1/devices", () => {
  it("401s without auth", async () => {
    authMock.mockResolvedValue(null)
    expect((await POST(req("POST", { token: "ExponentPushToken[x]" }))).status).toBe(401)
  })

  it("upserts a device token", async () => {
    upsert.mockResolvedValue({} as never)
    const res = await POST(req("POST", { token: "ExponentPushToken[x]", platform: "ios" }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith({
      where: { expoPushToken: "ExponentPushToken[x]" },
      create: { userId: "u1", expoPushToken: "ExponentPushToken[x]", platform: "ios" },
      update: { userId: "u1", platform: "ios" },
    })
  })
})

describe("DELETE /api/mobile/v1/devices", () => {
  it("revokes the token for the user", async () => {
    deleteMany.mockResolvedValue({ count: 1 } as never)
    const res = await DELETE(req("DELETE", { token: "ExponentPushToken[x]" }))
    expect(res.status).toBe(204)
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", expoPushToken: "ExponentPushToken[x]" },
    })
  })
})
