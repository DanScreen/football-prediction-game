import { describe, it, expect, vi, beforeEach } from "vitest"
import { DELETE, PUT } from "./route"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { removeAvatar, saveAvatar } from "@/lib/avatarUpload"

vi.mock("@/lib/mobileAuth", () => ({ authenticateMobileAccess: vi.fn() }))
vi.mock("@/lib/avatarUpload", () => ({
  MAX_AVATAR_UPLOAD_BYTES: 300,
  saveAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}))

const authMock = vi.mocked(authenticateMobileAccess)
const saveMock = vi.mocked(saveAvatar)
const user = {
  id: "u1",
  email: "a@b.c",
  displayName: "A",
  isBot: false,
  emailVerified: true,
  avatarUrl: null,
}

function put(body: unknown) {
  return new Request("http://t/api/mobile/v1/me/avatar", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(user)
})

describe("PUT /api/mobile/v1/me/avatar", () => {
  it("401s without a valid token", async () => {
    authMock.mockResolvedValue(null)
    expect((await PUT(put({ image: "aGk=" }))).status).toBe(401)
  })

  it("decodes the base64 and returns the new URL", async () => {
    saveMock.mockResolvedValue({ ok: true, avatarKey: "k1" })
    const res = await PUT(put({ image: Buffer.from("pixels").toString("base64") }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ avatarUrl: "/api/avatars/k1" })
    expect(saveMock.mock.calls[0][0]).toBe("u1")
    expect(saveMock.mock.calls[0][1].toString()).toBe("pixels")
  })

  it("400s on a missing image or one the server can't read", async () => {
    expect((await PUT(put({}))).status).toBe(400)
    saveMock.mockResolvedValue({ ok: false, error: "nope" })
    const res = await PUT(put({ image: "aGk=" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "nope" })
  })

  it("413s on an oversized body before decoding it", async () => {
    expect((await PUT(put({ image: "A".repeat(500) }))).status).toBe(413)
    expect(saveMock).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/mobile/v1/me/avatar", () => {
  it("removes the picture", async () => {
    const res = await DELETE(new Request("http://t/api/mobile/v1/me/avatar", { method: "DELETE" }))
    expect(await res.json()).toEqual({ avatarUrl: null })
    expect(removeAvatar).toHaveBeenCalledWith("u1")
  })
})
