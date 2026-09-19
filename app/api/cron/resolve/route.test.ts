import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { POST } from "./route"
import { runResolutionSweep } from "@/lib/resolution"
import { sendDeadlineReminders } from "@/lib/reminders"

vi.mock("@/lib/resolution", () => ({ runResolutionSweep: vi.fn() }))
vi.mock("@/lib/reminders", () => ({ sendDeadlineReminders: vi.fn() }))

const sweep = vi.mocked(runResolutionSweep)
const reminders = vi.mocked(sendDeadlineReminders)

function cronRequest(auth?: string) {
  return new Request("http://test/api/cron/resolve", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("CRON_SECRET", "s3cret")
  sweep.mockResolvedValue({
    transitioned: 1,
    confirmed: 2,
    corrected: 0,
    imported: 4,
    errors: [],
  })
  reminders.mockResolvedValue({ sent: 3, pushSent: 1 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /api/cron/resolve", () => {
  it("returns 503 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const res = await POST(cronRequest("Bearer s3cret"))
    expect(res.status).toBe(503)
    expect(sweep).not.toHaveBeenCalled()
  })

  it("rejects a missing or wrong token", async () => {
    expect((await POST(cronRequest())).status).toBe(401)
    expect((await POST(cronRequest("Bearer wrong"))).status).toBe(401)
    expect(sweep).not.toHaveBeenCalled()
  })

  it("runs the sweep and reminders with the right token", async () => {
    const res = await POST(cronRequest("Bearer s3cret"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      transitioned: 1,
      confirmed: 2,
      corrected: 0,
      imported: 4,
      errors: [],
      reminders: { sent: 3, pushSent: 1 },
    })
  })
})
