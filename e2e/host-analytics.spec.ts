import { expect, test } from "@playwright/test"
import {
  activityDaysOf,
  addMember,
  addPrediction,
  createLeague,
  createUser,
  ensureHost,
} from "./support/db"
import { signIn } from "./support/session"

/**
 * Host analytics: a player's visit is recorded as an active day, and a host
 * can drill from the overview into that player and their group.
 */
test("a player's visit shows up in host analytics, down to the player and group", async ({ page, browser }) => {
  const { league, fixtures } = await createLeague()
  const player = await createUser()
  await addMember(player.id, league.id)
  await addPrediction(player.id, fixtures[0].id, 2, 1)

  // The player visits on the web: the proxy records today as a web day.
  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()
  await signIn(playerPage, player.email)
  await playerPage.goto("/leaderboard")
  await expect.poll(async () => (await activityDaysOf(player.id))[0]?.web).toBe(true)
  await playerContext.close()

  const host = await ensureHost()
  await signIn(page, host.email)
  await page.goto("/host/analytics")
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible()
  await expect(page.getByText("Daily active players")).toBeVisible()

  await page.getByRole("link", { name: "Players", exact: true }).click()
  await page.getByRole("searchbox", { name: "Search players" }).fill(player.email)
  await page.getByRole("button", { name: "Search" }).click()
  const row = page.getByRole("row").filter({ hasText: player.email })
  await expect(row.getByText("Web", { exact: true })).toBeVisible()
  await row.getByRole("link", { name: player.displayName }).click()

  await expect(page.getByRole("heading", { name: player.displayName })).toBeVisible()
  await expect(page.getByText(`${fixtures[0].homeTeam} v ${fixtures[0].awayTeam}`)).toBeVisible()

  await page.getByRole("link", { name: league.name }).click()
  await expect(page.getByRole("heading", { name: league.name })).toBeVisible()
  const member = page.getByRole("row").filter({ has: page.getByRole("link", { name: player.displayName }) })
  await expect(member.getByText("Member", { exact: true })).toBeVisible()
})

test("a player can't open host analytics", async ({ page }) => {
  const player = await createUser()
  await signIn(page, player.email)
  await page.goto("/host/analytics")
  await expect(page).not.toHaveURL(/\/host/)
})
