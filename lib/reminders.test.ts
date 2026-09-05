import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendDeadlineReminders } from "./reminders"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findMany: vi.fn(), updateMany: vi.fn() },
    mobileDeviceToken: { findMany: vi.fn() },
  },
}))

const fixtureFindMany = vi.mocked(prisma.fixture.findMany)
const fixtureUpdateMany = vi.mocked(prisma.fixture.updateMany)
const deviceFindMany = vi.mocked(prisma.mobileDeviceToken.findMany)
const fetchMock = vi.fn()

function member(id: string, opts: { isBot?: boolean } = {}) {
  return {
    user: { id, email: `${id}@test.com`, displayName: id, isBot: opts.isBot ?? false },
  }
}

function dueFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "f1",
    round: "Matchweek 1",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    kickoffTime: new Date(Date.now() + 60 * 60 * 1000),
    predictions: [],
    competition: {
      name: "Premier League",
      leagues: [{ memberships: [member("alice"), member("bob")] }],
    },
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
  deviceFindMany.mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("sendDeadlineReminders", () => {
  it("skips email without configuration but still scans for push", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    fixtureFindMany.mockResolvedValue([dueFixture()] as never)
    const result = await sendDeadlineReminders()
    expect(result.sent).toBe(0)
    expect(result.pushSent).toBe(0)
    expect(result.skipped).toMatch(/not configured/)
    expect(fixtureFindMany).toHaveBeenCalled()
    expect(fixtureUpdateMany).toHaveBeenCalled()
  })

  it("sends nothing when no fixtures are due", async () => {
    fixtureFindMany.mockResolvedValue([])
    expect(await sendDeadlineReminders()).toEqual({ sent: 0, pushSent: 0 })
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
        competition: {
          name: "Premier League",
          leagues: [
            { memberships: [member("alice"), member("bob"), member("robo", { isBot: true })] },
          ],
        },
      }),
    ] as never)

    const result = await sendDeadlineReminders()
    expect(result.sent).toBe(1)
    const emailCalls = fetchMock.mock.calls.filter((c) => c[0] === "https://api.resend.com/emails")
    expect(emailCalls).toHaveLength(1)
    const body = JSON.parse(emailCalls[0]![1].body)
    expect(body.to).toBe("bob@test.com")
    expect(body.html).toContain("Arsenal vs Chelsea")
  })

  it("skips fixtures on a competition a host has declared finished", async () => {
    fixtureFindMany.mockResolvedValue([])
    await sendDeadlineReminders()

    const where = fixtureFindMany.mock.calls[0][0]!.where as Record<string, unknown>
    expect(where.competition).toEqual({ archivedAt: null })
  })

  it("emails a user once even when they belong to several leagues on the competition", async () => {
    fixtureFindMany.mockResolvedValue([
      dueFixture({
        competition: {
          name: "Premier League",
          leagues: [
            { memberships: [member("alice")] },
            { memberships: [member("alice"), member("bob")] },
          ],
        },
      }),
    ] as never)

    const result = await sendDeadlineReminders()
    expect(result.sent).toBe(2)
    const bodies = fetchMock.mock.calls
      .filter((c) => c[0] === "https://api.resend.com/emails")
      .map((c) => JSON.parse(c[1].body))
    const aliceEmails = bodies.filter((b) => b.to === "alice@test.com")
    expect(aliceEmails).toHaveLength(1)
    expect(aliceEmails[0].html.match(/Arsenal vs Chelsea/g)).toHaveLength(1)
  })

  it("sends one email per user covering all their open fixtures", async () => {
    fixtureFindMany.mockResolvedValue([
      dueFixture({ id: "f1" }),
      dueFixture({ id: "f2", homeTeam: "Liverpool", awayTeam: "Everton" }),
    ] as never)

    const result = await sendDeadlineReminders()
    expect(result.sent).toBe(2)
    const emailCalls = fetchMock.mock.calls.filter((c) => c[0] === "https://api.resend.com/emails")
    expect(emailCalls).toHaveLength(2)
    const firstBody = JSON.parse(emailCalls[0]![1].body)
    expect(firstBody.html).toContain("Arsenal vs Chelsea")
    expect(firstBody.html).toContain("Liverpool vs Everton")
    expect(firstBody.subject).toContain("2 predictions")
  })

  it("authenticates to Resend with the API key", async () => {
    fixtureFindMany.mockResolvedValue([dueFixture()] as never)
    await sendDeadlineReminders()
    const emailCall = fetchMock.mock.calls.find((c) => c[0] === "https://api.resend.com/emails")
    expect(emailCall![1].headers.Authorization).toBe("Bearer re_test")
  })

  it("counts only successful sends", async () => {
    fixtureFindMany.mockResolvedValue([dueFixture()] as never)
    fetchMock.mockResolvedValue({ ok: false })
    expect((await sendDeadlineReminders()).sent).toBe(0)
  })

  it("sends Expo push to registered devices", async () => {
    fixtureFindMany.mockResolvedValue([dueFixture()] as never)
    deviceFindMany.mockResolvedValue([
      { userId: "alice", expoPushToken: "ExponentPushToken[aaa]" },
    ] as never)

    const result = await sendDeadlineReminders()
    expect(result.pushSent).toBe(1)
    const pushCall = fetchMock.mock.calls.find(
      (c) => c[0] === "https://exp.host/--/api/v2/push/send",
    )
    expect(pushCall).toBeTruthy()
    const payload = JSON.parse(pushCall![1].body)
    expect(payload[0].to).toBe("ExponentPushToken[aaa]")
    expect(payload[0].title).toMatch(/closing soon/i)
  })
})
