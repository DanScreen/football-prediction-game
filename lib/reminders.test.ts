import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendDeadlineReminders } from "./reminders"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}))

const fixtureFindMany = vi.mocked(prisma.fixture.findMany)
const fixtureUpdateMany = vi.mocked(prisma.fixture.updateMany)
const fetchMock = vi.fn()

function member(id: string, opts: { isBot?: boolean } = {}) {
  return {
    user: { id, email: `${id}@test.com`, displayName: id, isBot: opts.isBot ?? false },
  }
}

function dueFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "f1",
    competition: "Premier League",
    round: "Matchweek 1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    kickoffTime: new Date(Date.now() + 60 * 60 * 1000),
    predictions: [],
    league: { name: "Test League", memberships: [member("alice"), member("bob")] },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("RESEND_API_KEY", "re_test")
  vi.stubEnv("EMAIL_FROM", "Predictions <test@example.com>")
  fetchMock.mockResolvedValue({ ok: true })
  fixtureUpdateMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("sendDeadlineReminders", () => {
  it("no-ops without email configuration", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const result = await sendDeadlineReminders()
    expect(result.sent).toBe(0)
    expect(result.skipped).toMatch(/not configured/)
    expect(fixtureFindMany).not.toHaveBeenCalled()
  })

  it("sends nothing when no fixtures are due", async () => {
    fixtureFindMany.mockResolvedValue([])
    expect(await sendDeadlineReminders()).toEqual({ sent: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(fixtureUpdateMany).not.toHaveBeenCalled()
  })

  it("claims fixtures via reminderSentAt before emailing", async () => {
    fixtureFindMany.mockResolvedValue([dueFixture()] as never)
    await sendDeadlineReminders()
    expect(fixtureUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["f1"] }, reminderSentAt: null },
        data: { reminderSentAt: expect.any(Date) },
      }),
    )
  })

  it("emails only members who have not predicted, skipping bots", async () => {
    fixtureFindMany.mockResolvedValue([
      dueFixture({
        predictions: [{ userId: "alice" }],
        league: {
          name: "Test League",
          memberships: [member("alice"), member("bob"), member("robo", { isBot: true })],
        },
      }),
    ] as never)

    const result = await sendDeadlineReminders()
    expect(result.sent).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toBe("bob@test.com")
    expect(body.html).toContain("Arsenal vs Chelsea")
  })

  it("sends one email per user covering all their open fixtures", async () => {
    fixtureFindMany.mockResolvedValue([
      dueFixture({ id: "f1" }),
      dueFixture({ id: "f2", homeTeam: "Liverpool", awayTeam: "Everton" }),
    ] as never)

    const result = await sendDeadlineReminders()
    // alice + bob, one email each despite two fixtures
    expect(result.sent).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(firstBody.html).toContain("Arsenal vs Chelsea")
    expect(firstBody.html).toContain("Liverpool vs Everton")
    expect(firstBody.subject).toContain("2 predictions")
  })

  it("authenticates to Resend with the API key", async () => {
    fixtureFindMany.mockResolvedValue([dueFixture()] as never)
    await sendDeadlineReminders()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(init.headers.Authorization).toBe("Bearer re_test")
  })

  it("counts only successful sends", async () => {
    fixtureFindMany.mockResolvedValue([dueFixture()] as never)
    fetchMock.mockResolvedValue({ ok: false })
    expect((await sendDeadlineReminders()).sent).toBe(0)
  })
})
