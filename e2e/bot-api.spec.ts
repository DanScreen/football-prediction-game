import { expect, test } from "@playwright/test"
import { addMember, createLeague, createUser, setKickoff } from "./support/db"
import { signIn } from "./support/session"

/**
 * The public bot API (/api/v1), exercised over real HTTP through proxy.ts.
 * It once shipped answering every call with a redirect to the login page,
 * which route-handler unit tests calling GET() directly could never notice.
 */

async function botInNewLeague() {
  const { league, fixtures } = await createLeague({ fixtureCount: 2 })
  const bot = await createUser({ isBot: true })
  await addMember(bot.id, league.id)
  return { bot, league, fixtures, headers: { Authorization: `Bearer ${bot.apiKey}` } }
}

test("calls without a valid key get a JSON 401, not the login page", async ({ request }) => {
  for (const headers of [{}, { Authorization: "Bearer not-a-real-key" }]) {
    const res = await request.get("/api/v1/fixtures", { headers, maxRedirects: 0 })
    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  }
})

test("a bot lists open fixtures, predicts, and reads its pick back", async ({ request }) => {
  const { fixtures, headers } = await botInNewLeague()
  const [first, second] = fixtures

  const open = await request.get("/api/v1/fixtures?status=open", { headers })
  expect(open.status()).toBe(200)
  expect((await open.json()).map((f: { id: string }) => f.id)).toEqual([first.id, second.id])

  const post = await request.post("/api/v1/predictions", {
    headers,
    data: { fixtureId: first.id, homeScore: 3, awayScore: 1, isBanker: true },
  })
  expect(post.status()).toBe(200)
  expect((await post.json()).prediction).toMatchObject({
    fixtureId: first.id,
    predictedHomeScore: 3,
    predictedAwayScore: 1,
    isBanker: true,
    submittedVia: "API",
  })

  const mine = await request.get("/api/v1/predictions", { headers })
  expect(await mine.json()).toEqual([
    expect.objectContaining({ fixtureId: first.id, predictedHomeScore: 3, predictedAwayScore: 1, isBanker: true }),
  ])
})

test("a pick made over the API shows up on the website", async ({ request, page }) => {
  const { bot, fixtures, headers } = await botInNewLeague()
  const [first] = fixtures
  await request.post("/api/v1/predictions", {
    headers,
    data: { fixtureId: first.id, homeScore: 0, awayScore: 2 },
  })

  await signIn(page, bot.email)
  const card = page.getByRole("group", { name: `${first.homeTeam} v ${first.awayTeam}` })
  await expect(card.getByLabel("Home score")).toHaveValue("0")
  await expect(card.getByLabel("Away score")).toHaveValue("2")
})

test("the API refuses picks after kickoff and on other leagues' fixtures", async ({ request }) => {
  const { fixtures, headers } = await botInNewLeague()
  const [first] = fixtures
  const { fixtures: strangers } = await createLeague({ fixtureCount: 1 })

  await setKickoff(first.id, new Date(Date.now() - 60_000))
  const late = await request.post("/api/v1/predictions", {
    headers,
    data: { fixtureId: first.id, homeScore: 1, awayScore: 0 },
  })
  expect(late.status()).toBe(422)
  expect((await late.json()).error).toMatch(/locked/)

  const elsewhere = await request.post("/api/v1/predictions", {
    headers,
    data: { fixtureId: strangers[0].id, homeScore: 1, awayScore: 0 },
  })
  expect(elsewhere.status()).toBe(404)
})
