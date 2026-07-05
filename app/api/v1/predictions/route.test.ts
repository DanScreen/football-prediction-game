import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey, resolveLeagueId } from "@/lib/apiAuth"
import { upsertPredictionWithSync } from "@/lib/predictions"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findUnique: vi.fn() },
    leagueMembership: { findUnique: vi.fn() },
    prediction: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/apiAuth", () => ({
  authenticateApiKey: vi.fn(),
  resolveLeagueId: vi.fn(),
}))
vi.mock("@/lib/predictions", () => ({ upsertPredictionWithSync: vi.fn() }))

const authMock = vi.mocked(authenticateApiKey)
const resolveLeagueMock = vi.mocked(resolveLeagueId)
const fixtureFindUnique = vi.mocked(prisma.fixture.findUnique)
const membershipFindUnique = vi.mocked(prisma.leagueMembership.findUnique)
const predictionFindMany = vi.mocked(prisma.prediction.findMany)
const upsertMock = vi.mocked(upsertPredictionWithSync)

const user = { id: "u1" }
const futureFixture = {
  id: "fx1",
  leagueId: "l1",
  kickoffTime: new Date(Date.now() + 60 * 60 * 1000),
}

function post(body: unknown) {
  return new NextRequest("http://test/api/v1/predictions", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(user as never)
})

describe("POST /api/v1/predictions", () => {
  it("401s without a valid API key", async () => {
    authMock.mockResolvedValue(null)
    expect((await POST(post({}))).status).toBe(401)
  })

  it("400s on malformed JSON", async () => {
    expect((await POST(post("not json{"))).status).toBe(400)
  })

  it("400s when the body is not an object", async () => {
    expect((await POST(post("42"))).status).toBe(400)
  })

  it("400s without a fixtureId", async () => {
    const res = await POST(post({ homeScore: 1, awayScore: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/fixtureId/)
  })

  it.each([
    ["missing", undefined],
    ["negative", -1],
    ["fractional", 1.5],
    ["string", "2"],
  ])("400s when homeScore is %s", async (_label, homeScore) => {
    const res = await POST(post({ fixtureId: "fx1", homeScore, awayScore: 0 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/homeScore/)
  })

  it("404s for an unknown fixture", async () => {
    fixtureFindUnique.mockResolvedValue(null)
    const res = await POST(post({ fixtureId: "nope", homeScore: 1, awayScore: 0 }))
    expect(res.status).toBe(404)
  })

  it("404s when the user is not in the fixture's league (no membership leak)", async () => {
    fixtureFindUnique.mockResolvedValue(futureFixture as never)
    membershipFindUnique.mockResolvedValue(null)
    const res = await POST(post({ fixtureId: "fx1", homeScore: 1, awayScore: 0 }))
    expect(res.status).toBe(404)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("422s once the fixture has kicked off", async () => {
    fixtureFindUnique.mockResolvedValue({
      ...futureFixture,
      kickoffTime: new Date(Date.now() - 1000),
    } as never)
    membershipFindUnique.mockResolvedValue({ id: "m1" } as never)
    const res = await POST(post({ fixtureId: "fx1", homeScore: 1, awayScore: 0 }))
    expect(res.status).toBe(422)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("upserts with sync and returns the saved prediction", async () => {
    fixtureFindUnique.mockResolvedValue(futureFixture as never)
    membershipFindUnique.mockResolvedValue({ id: "m1" } as never)
    upsertMock.mockResolvedValue({
      id: "p1",
      fixtureId: "fx1",
      predictedHomeScore: 2,
      predictedAwayScore: 0,
      submittedVia: "API",
      updatedAt: new Date("2026-07-05T12:00:00Z"),
    } as never)

    const res = await POST(post({ fixtureId: "fx1", homeScore: 2, awayScore: 0 }))
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledWith(user.id, futureFixture, 2, 0, "API")
    const { prediction } = await res.json()
    expect(prediction).toMatchObject({
      id: "p1",
      fixtureId: "fx1",
      predictedHomeScore: 2,
      predictedAwayScore: 0,
      submittedVia: "API",
    })
  })

  it("accepts 0-0 predictions", async () => {
    fixtureFindUnique.mockResolvedValue(futureFixture as never)
    membershipFindUnique.mockResolvedValue({ id: "m1" } as never)
    upsertMock.mockResolvedValue({ id: "p1" } as never)
    expect((await POST(post({ fixtureId: "fx1", homeScore: 0, awayScore: 0 }))).status).toBe(200)
  })
})

describe("GET /api/v1/predictions", () => {
  function get(query = "") {
    return new NextRequest(`http://test/api/v1/predictions${query}`)
  }

  it("401s without a valid API key", async () => {
    authMock.mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it("404s when the user has no league", async () => {
    resolveLeagueMock.mockResolvedValue(null)
    expect((await GET(get())).status).toBe(404)
  })

  it("returns the user's predictions flattened with fixture details", async () => {
    resolveLeagueMock.mockResolvedValue("l1")
    predictionFindMany.mockResolvedValue([
      {
        id: "p1",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
        pointsAwarded: 3,
        submittedVia: "API",
        updatedAt: new Date("2026-07-05T12:00:00Z"),
        fixture: {
          id: "fx1",
          competition: "Premier League",
          round: "Matchweek 1",
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          kickoffTime: new Date("2026-07-04T15:00:00Z"),
          status: "COMPLETED",
          actualHomeScore: 2,
          actualAwayScore: 1,
        },
      },
    ] as never)

    const res = await GET(get("?leagueId=l1"))
    expect(res.status).toBe(200)
    expect(resolveLeagueMock).toHaveBeenCalledWith("u1", "l1")
    const [row] = await res.json()
    expect(row).toMatchObject({
      id: "p1",
      fixtureId: "fx1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      fixtureStatus: "COMPLETED",
      pointsAwarded: 3,
    })
  })
})
