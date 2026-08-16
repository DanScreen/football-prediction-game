import { describe, it, expect } from "vitest"
import { generateInviteCode, normaliseInviteCode, inviteUrl } from "./inviteCode"

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

describe("normaliseInviteCode", () => {
  // The bug this exists to prevent: registration used .trim() while joining used
  // .trim().toUpperCase(), so a lowercase code was rejected at sign-up but accepted
  // on the join form.
  it("uppercases and trims so both entry points agree", () => {
    expect(normaliseInviteCode("  abc234 ")).toBe("ABC234")
    expect(normaliseInviteCode("ABC234")).toBe("ABC234")
    expect(normaliseInviteCode("aBc234")).toBe("ABC234")
  })

  it("returns an empty string for missing input", () => {
    expect(normaliseInviteCode(null)).toBe("")
    expect(normaliseInviteCode(undefined)).toBe("")
    expect(normaliseInviteCode("   ")).toBe("")
  })
})

describe("inviteUrl", () => {
  it("builds a /register link carrying the code", () => {
    expect(inviteUrl("https://scorersonline.uk", "ABC234")).toBe(
      "https://scorersonline.uk/register?invite=ABC234",
    )
  })

  it("does not double up the slash when the origin has a trailing one", () => {
    expect(inviteUrl("http://localhost:3000/", "ABC234")).toBe(
      "http://localhost:3000/register?invite=ABC234",
    )
  })
})
