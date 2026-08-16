import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { upsertPrediction } from "@/lib/predictions"
import { setBanker } from "@/lib/banker"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findUnique: vi.fn() },
    leagueMembership: { findFirst: vi.fn(), findMany: vi.fn() },
    prediction: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/mobileAuth", () => ({
  authenticateMobileAccess: vi.fn(),
}))
vi.mock("@/lib/predictions", () => ({ upsertPrediction: vi.fn() }))
vi.mock("@/lib/banker", () => ({ setBanker: vi.fn() }))

const authMock = vi.mocked(authenticateMobileAccess)
const fixtureFindUnique = vi.mocked(prisma.fixture.findUnique)
const membershipFindFirst = vi.mocked(prisma.leagueMembership.findFirst)
const upsertMock = vi.mocked(upsertPrediction)
const setBankerMock = vi.mocked(setBanker)

const user = { id: "u1", email: "a@b.c", displayName: "A", isBot: false }
const futureFixture = {
  id: "fx1",
  competitionId: "c1",
  kickoffTime: new Date(Date.now() + 60 * 60 * 1000),
  round: "GW1",
  homeTeam: "Home",
  awayTeam: "Away",
  status: "SCHEDULED",
  competition: { name: "PL" },
}

function post(body: unknown) {
  return new NextRequest("http://test/api/mobile/v1/predictions", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(user)
  setBankerMock.mockResolvedValue({ ok: true })
})

describe("POST /api/mobile/v1/predictions", () => {
  it("401s without access token", async () => {
    authMock.mockResolvedValue(null)
    expect((await POST(post({}))).status).toBe(401)
  })

  it("422s once the fixture has kicked off", async () => {
    fixtureFindUnique.mockResolvedValue({
      ...futureFixture,
      kickoffTime: new Date(Date.now() - 1000),
    } as never)
    membershipFindFirst.mockResolvedValue({ id: "m1" } as never)
    const res = await POST(post({ fixtureId: "fx1", homeScore: 1, awayScore: 0 }))
    expect(res.status).toBe(422)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("saves a prediction and optional banker", async () => {
    fixtureFindUnique.mockResolvedValue(futureFixture as never)
    membershipFindFirst.mockResolvedValue({ id: "m1" } as never)
    upsertMock.mockResolvedValue({
      id: "p1",
      fixtureId: "fx1",
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      isBanker: false,
      submittedVia: "API",
      updatedAt: new Date("2026-08-16T12:00:00Z"),
    } as never)

    const res = await POST(
      post({ fixtureId: "fx1", homeScore: 2, awayScore: 1, isBanker: true }),
    )
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledWith("u1", "fx1", 2, 1, "API")
    expect(setBankerMock).toHaveBeenCalledWith("u1", "fx1", true)
    const json = await res.json()
    expect(json.prediction.isBanker).toBe(true)
    expect(json.prediction.fixture.competitionName).toBe("PL")
  })
})

describe("GET /api/mobile/v1/predictions", () => {
  it("401s without access token", async () => {
    authMock.mockResolvedValue(null)
    const res = await GET(new NextRequest("http://test/api/mobile/v1/predictions"))
    expect(res.status).toBe(401)
  })
})
