import { describe, it, expect } from "vitest"
import { isValidEmail, normaliseEmail } from "./emailAddress"

describe("normaliseEmail", () => {
  it("trims and lower-cases", () => {
    expect(normaliseEmail("  Alice@Example.COM ")).toBe("alice@example.com")
  })

  it("returns an empty string for non-strings", () => {
    expect(normaliseEmail(undefined)).toBe("")
    expect(normaliseEmail(42)).toBe("")
  })
})

describe("isValidEmail", () => {
  it.each([
    "alice@example.com",
    "alice.smith@example.co.uk",
    "alice+scorers@gmail.com",
    "a_b-c@sub.domain.io",
    "o'neill@example.ie",
    "x@xn--80ak6aa92e.com",
    "user@example.xn--p1ai",
    "1234@example.com",
  ])("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each([
    ["empty", ""],
    ["no @", "alice.example.com"],
    ["no local part", "@example.com"],
    ["no domain", "alice@"],
    ["no domain dot", "alice@gmail"],
    ["one-letter TLD", "alice@example.c"],
    ["numeric TLD", "alice@example.123"],
    ["space inside", "ali ce@example.com"],
    ["two @", "alice@@example.com"],
    ["@ in local part", "a@b@example.com"],
    ["leading dot", ".alice@example.com"],
    ["trailing dot in local", "alice.@example.com"],
    ["double dot in local", "al..ice@example.com"],
    ["double dot in domain", "alice@example..com"],
    ["domain starts with hyphen", "alice@-example.com"],
    ["domain ends with dot", "alice@example.com."],
    ["just a name", "alice"],
    ["angle brackets", "<alice@example.com>"],
    ["local part too long", `${"a".repeat(65)}@example.com`],
    ["address too long", `alice@${"a".repeat(250)}.com`],
  ])("rejects %s", (_label, email) => {
    expect(isValidEmail(email)).toBe(false)
  })
})
