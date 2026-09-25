import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deadlineReminderEmail, passwordResetEmail, verificationEmail } from "./emailTemplates"

beforeEach(() => {
  vi.stubEnv("AUTH_URL", "https://scorers.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const fixture = {
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  kickoffTime: new Date("2026-09-26T14:00:00Z"),
  competitionName: "Premier League",
  round: "Matchweek 6",
}

describe("email templates", () => {
  it("wrap every email in the branded shell with the hosted logo", () => {
    for (const email of [
      verificationEmail({ displayName: "Alice", link: "https://scorers.test/verify-email/abc" }),
      passwordResetEmail({ displayName: "Alice", link: "https://scorers.test/reset-password/abc" }),
      deadlineReminderEmail({ displayName: "Alice", fixtures: [fixture] }),
    ]) {
      expect(email.html).toMatch(/^<!DOCTYPE html>/)
      expect(email.html).toContain('src="https://scorers.test/brand/email-logo.png"')
      expect(email.html).toContain(">Scorers</div>")
      expect(email.text).not.toContain("<")
    }
  })

  it("make the call-to-action the first link, so it's what the reader lands on", () => {
    const link = "https://scorers.test/verify-email/abc"
    const email = verificationEmail({ displayName: "Alice", link })
    expect(email.html.match(/href="([^"]+)"/)![1]).toBe(link)
    // Also repeated as copyable text, and in the plain-text part
    expect(email.html.split(link).length - 1).toBe(2)
    expect(email.text).toContain(link)
  })

  it("escape user-supplied names in the HTML", () => {
    const html = passwordResetEmail({ displayName: "<b>Bob</b>", link: "https://x" }).html
    expect(html).toContain("&lt;b&gt;Bob&lt;/b&gt;")
    expect(html).not.toContain("<b>Bob</b>")
  })

  it("render each reminder fixture as a card with its London kickoff", () => {
    const email = deadlineReminderEmail({
      displayName: "Alice",
      fixtures: [fixture, { ...fixture, homeTeam: "Brighton & Hove Albion", awayTeam: "Everton" }],
    })
    expect(email.subject).toBe("⚽ 2 predictions closing soon!")
    expect(email.html).toContain("Arsenal")
    expect(email.html).toContain("Brighton &amp; Hove Albion")
    expect(email.html).toContain("Locks Sat 15:00")
    expect(email.html).toContain('href="https://scorers.test"')
    expect(email.text).toContain("- Arsenal vs Chelsea: locks Sat 15:00 (Premier League · Matchweek 6)")
  })

  it("use the singular for one fixture", () => {
    expect(deadlineReminderEmail({ displayName: "A", fixtures: [fixture] }).subject).toBe(
      "⚽ 1 prediction closing soon!",
    )
  })
})
