import { describe, it, expect } from "vitest"
import { generateInviteCode } from "./inviteCode"

describe("generateInviteCode", () => {
  it("is 6 characters long", () => {
    expect(generateInviteCode()).toHaveLength(6)
  })

  it("only uses the unambiguous alphabet (no I, O, 0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInviteCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    }
  })

  it("produces varied codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()))
    expect(codes.size).toBeGreaterThan(90)
  })
})
