import { describe, it, expect, vi, beforeEach } from "vitest"
import { requestResult } from "./actions"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { confirmResultsFromApi, RESULT_DELAY_MS } from "@/lib/resolution"

vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findUnique: vi.fn(), updateMany: vi.fn() },
    leagueMembership: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/resolution", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/resolution")>()
  return { ...actual, confirmResultsFromApi: vi.fn() }
})

const authMock = vi.mocked(auth)
const fixtureFindUnique = vi.mocked(prisma.fixture.findUnique)
const fixtureUpdateMany = vi.mocked(prisma.fixture.updateMany)
const membershipFindFirst = vi.mocked(prisma.leagueMembership.findFirst)
const confirmFromApiMock = vi.mocked(confirmResultsFromApi)

function fixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "fx1",
    competitionId: "c1",
    status: "AWAITING_RESULT",
    kickoffTime: new Date(Date.now() - RESULT_DELAY_MS - 60_000),
    proposedHomeScore: null,
    proposedAwayScore: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "u1" } } as never)
  membershipFindFirst.mockResolvedValue({ id: "m1" } as never)
  confirmFromApiMock.mockResolvedValue({ confirmed: 0, corrected: 0, errors: [] })
  fixtureUpdateMany.mockResolvedValue({ count: 1 })
})

describe("requestResult", () => {
  it("errors when not signed in", async () => {
    authMock.mockResolvedValue(null as never)
    expect(await requestResult("fx1")).toEqual({ error: "Not signed in." })
  })

  it("hides fixtures from non-members", async () => {
    fixtureFindUnique.mockResolvedValue(fixture() as never)
    membershipFindFirst.mockResolvedValue(null)
    expect(await requestResult("fx1")).toEqual({ error: "Fixture not found." })
    expect(confirmFromApiMock).not.toHaveBeenCalled()
  })

  it("is a no-op for completed fixtures", async () => {
    fixtureFindUnique.mockResolvedValue(fixture({ status: "COMPLETED" }) as never)
    expect(await requestResult("fx1")).toEqual({ found: true })
    expect(confirmFromApiMock).not.toHaveBeenCalled()
  })

  it("rejects requests before kickoff + 1h45m", async () => {
    fixtureFindUnique.mockResolvedValue(
      fixture({ kickoffTime: new Date(Date.now() - RESULT_DELAY_MS + 60_000) }) as never,
    )
    const result = await requestResult("fx1")
    expect(result.error).toMatch(/1h 45m/)
    expect(confirmFromApiMock).not.toHaveBeenCalled()
  })

  it("transitions a due SCHEDULED fixture before confirming from the API", async () => {
    fixtureFindUnique
      .mockResolvedValueOnce(fixture({ status: "SCHEDULED" }) as never)
      .mockResolvedValueOnce(fixture({ status: "COMPLETED" }) as never)

    expect(await requestResult("fx1")).toEqual({ found: true })
    expect(fixtureUpdateMany).toHaveBeenCalledWith({
      where: { id: "fx1", status: "SCHEDULED" },
      data: { status: "AWAITING_RESULT" },
    })
    expect(confirmFromApiMock).toHaveBeenCalled()
  })

  it("reports pending when no result is published yet", async () => {
    fixtureFindUnique
      .mockResolvedValueOnce(fixture() as never)
      .mockResolvedValueOnce(fixture() as never)
    expect(await requestResult("fx1")).toEqual({ pending: true })
  })

  it("surfaces lookup errors", async () => {
    fixtureFindUnique.mockResolvedValue(fixture() as never)
    confirmFromApiMock.mockResolvedValue({ confirmed: 0, corrected: 0, errors: ["API error 429"] })
    expect(await requestResult("fx1")).toEqual({ error: "API error 429" })
  })
})
