import { describe, it, expect, vi, beforeEach } from "vitest"
import sharp from "sharp"
import { prisma } from "@/lib/prisma"
import { AVATAR_SIZE, MAX_AVATAR_UPLOAD_BYTES, normaliseAvatar, saveAvatar } from "./avatarUpload"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    userAvatar: { upsert: vi.fn() },
    user: { update: vi.fn() },
  },
}))

function photo(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
}

beforeEach(() => vi.clearAllMocks())

describe("normaliseAvatar", () => {
  it("crops and resizes any shape to a small square WebP", async () => {
    const out = await normaliseAvatar(await photo(1200, 800).jpeg().toBuffer())
    expect(out).not.toBeNull()
    const meta = await sharp(out!).metadata()
    expect(meta.format).toBe("webp")
    expect(meta.width).toBe(AVATAR_SIZE)
    expect(meta.height).toBe(AVATAR_SIZE)
  })

  it("strips EXIF metadata (a phone photo's location)", async () => {
    const tagged = await photo(400, 400)
      .withExif({ IFD0: { Copyright: "secret" }, IFD3: { GPSLatitudeRef: "N" } })
      .jpeg()
      .toBuffer()
    expect((await sharp(tagged).metadata()).exif).toBeDefined()
    const meta = await sharp((await normaliseAvatar(tagged))!).metadata()
    expect(meta.exif).toBeUndefined()
  })

  it("rejects something that isn't an image", async () => {
    expect(await normaliseAvatar(Buffer.from("<script>alert(1)</script>"))).toBeNull()
  })
})

describe("saveAvatar", () => {
  it("refuses an empty or oversized upload without decoding it", async () => {
    expect(await saveAvatar("u1", Buffer.alloc(0))).toMatchObject({ ok: false })
    expect(await saveAvatar("u1", Buffer.alloc(MAX_AVATAR_UPLOAD_BYTES + 1))).toMatchObject({
      ok: false,
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("stores the picture under a fresh random key each time", async () => {
    const png = await photo(300, 300).png().toBuffer()
    const first = await saveAvatar("u1", png)
    const second = await saveAvatar("u1", png)
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.avatarKey).toMatch(/^[A-Za-z0-9_-]{24}$/)
    expect(first.avatarKey).not.toBe(second.avatarKey)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { avatarKey: second.avatarKey },
    })
  })
})
