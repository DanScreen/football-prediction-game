import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { AVATAR_TONE_COUNT, avatarPath, avatarTone, initialsFor } from "./avatar"

describe("initialsFor", () => {
  it("takes the first and last word of a longer name", () => {
    expect(initialsFor("Dan Screen")).toBe("DS")
    expect(initialsFor("Mary Jane Watson")).toBe("MW")
  })

  it("takes one letter from a single word, uppercased", () => {
    expect(initialsFor("priya")).toBe("P")
  })

  it("ignores stray whitespace", () => {
    expect(initialsFor("  bob   smith ")).toBe("BS")
  })

  it("keeps whole characters, not half an emoji", () => {
    expect(initialsFor("⚽ Fan")).toBe("⚽F")
    expect(initialsFor("Émile")).toBe("É")
  })

  it("falls back for an empty name", () => {
    expect(initialsFor("   ")).toBe("?")
  })
})

describe("avatarTone", () => {
  it("is stable and in range", () => {
    for (const id of ["a", "cmabc123", "u1", "x".repeat(40)]) {
      const tone = avatarTone(id)
      expect(tone).toBe(avatarTone(id))
      expect(tone).toBeGreaterThanOrEqual(0)
      expect(tone).toBeLessThan(AVATAR_TONE_COUNT)
    }
  })

  it("spreads ids across the tones", () => {
    const tones = new Set(Array.from({ length: 40 }, (_, i) => avatarTone(`user${i}`)))
    expect(tones.size).toBe(AVATAR_TONE_COUNT)
  })
})

describe("avatarPath", () => {
  it("builds the URL from the key, or null without one", () => {
    expect(avatarPath("abc")).toBe("/api/avatars/abc")
    expect(avatarPath(null)).toBeNull()
  })
})

describe("the app's copy", () => {
  it("is identical to this file", () => {
    const root = readFileSync(new URL("./avatar.ts", import.meta.url), "utf8")
    const app = readFileSync(new URL("../apps/mobile/lib/avatar.ts", import.meta.url), "utf8")
    expect(app).toBe(root)
  })
})
