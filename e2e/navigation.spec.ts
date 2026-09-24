import { expect, test } from "@playwright/test"
import { addMember, createLeague, createUser } from "./support/db"
import { signIn } from "./support/session"

/**
 * Signed-in routing. A shipped bug bounced every page back to /leagues for
 * anyone without an activeLeagueId cookie — i.e. every fresh sign-in — and
 * unit tests with a mocked cookie store couldn't see it.
 */

const NAV = [
  { link: "Predictions", path: "/" },
  { link: "Results", path: "/results" },
  { link: "Leaderboard", path: "/leaderboard" },
  { link: "My Leagues", path: "/leagues" },
  { link: "Rules", path: "/rules" },
]

async function commissionerOfNewLeague() {
  const { league } = await createLeague()
  const user = await createUser()
  await addMember(user.id, league.id, "COMMISSIONER")
  return { user, league }
}

test("a freshly signed-in member can reach every page in the nav", async ({ page }) => {
  const { user } = await commissionerOfNewLeague()
  await signIn(page, user.email)

  for (const { link, path } of NAV) {
    await page.getByRole("navigation").getByRole("link", { name: link, exact: true }).click()
    await expect(page, `clicking ${link}`).toHaveURL(path)
  }

  await page.getByRole("link", { name: user.displayName }).click()
  await expect(page).toHaveURL("/profile")

  await page.goto("/admin")
  await expect(page).toHaveURL("/admin/picks")
  await expect(page.getByRole("heading", { name: "Pick status" })).toBeVisible()
})

test("a stale active-league cookie doesn't wedge a member on /leagues", async ({ page, context }) => {
  const { user, league } = await commissionerOfNewLeague()
  await signIn(page, user.email)
  // Points at a league this user isn't in (e.g. one they've since left).
  await context.addCookies([
    { name: "activeLeagueId", value: crypto.randomUUID(), url: page.url() },
  ])

  await page.goto("/leaderboard")
  await expect(page).toHaveURL("/leaderboard")
  await expect(page.getByRole("heading", { level: 1, name: league.name })).toBeVisible()
})

test("someone in no league is welcomed rather than shown an empty page", async ({ page }) => {
  const user = await createUser()
  await signIn(page, user.email)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Welcome to Scorers" })).toBeVisible()
})

test("an unverified account is held at /verify-email", async ({ page }) => {
  const user = await createUser({ verified: false })
  await signIn(page, user.email)
  for (const path of ["/", "/leaderboard", "/profile"]) {
    await page.goto(path)
    await expect(page, `visiting ${path}`).toHaveURL("/verify-email")
  }
})

test("a player who isn't the host is turned away from /host", async ({ page }) => {
  const { user } = await commissionerOfNewLeague()
  await signIn(page, user.email)
  await page.goto("/host/results")
  await expect(page).toHaveURL("/")
})
