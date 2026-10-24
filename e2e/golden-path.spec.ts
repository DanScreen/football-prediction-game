import { expect, test } from "@playwright/test"
import { HOST_EMAIL, PASSWORD } from "./env"
import { addMember, addPrediction, createLeague, createUser, ensureHost, setKickoff, uniqueTag } from "./support/db"
import { linkFromLatestEmail } from "./support/mail"
import { signIn } from "./support/session"

/**
 * The journey the whole product exists for, end to end through the real UI:
 * a friend's invite link → sign up → verify email → predict with a banker →
 * the match kicks off → the host confirms the result → the leaderboard.
 *
 * If this passes, the core loop works. Only the arrangement (a league with
 * fixtures, a rival's pick, the clock moving past kickoff) is done in the DB.
 */
test("invitee signs up, predicts, and tops the table once the host confirms the result", async ({
  page,
  browser,
}) => {
  const { league, fixtures } = await createLeague({ fixtureCount: 2 })
  const [match, otherMatch] = fixtures
  const matchName = `${match.homeTeam} v ${match.awayTeam}`

  const rival = await createUser({ displayName: `Rival ${uniqueTag()}` })
  await addMember(rival.id, league.id)
  await addPrediction(rival.id, match.id, 1, 0)
  await ensureHost()

  const tag = uniqueTag()
  const email = `newcomer-${tag}@e2e.test`
  const displayName = `Newcomer ${tag}`

  await test.step("follow the invite link and register", async () => {
    await page.goto(`/register?invite=${league.inviteCode}`)
    await expect(page.getByRole("heading", { name: `Join ${league.name}` })).toBeVisible()

    await page.getByLabel("Display Name").fill(displayName)
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
    await page.getByLabel("Confirm Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Create Account" }).click()

    await expect(page).toHaveURL(/\/verify-email$/)
    await expect(page.getByText("Check your inbox")).toBeVisible()
  })

  await test.step("the app is gated until the email is verified", async () => {
    await page.goto("/leaderboard")
    await expect(page).toHaveURL(/\/verify-email$/)
  })

  await test.step("click the link in the verification email", async () => {
    const link = await linkFromLatestEmail(email, /confirm your email/i)
    await page.goto(link)
    await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible()
    await page.getByRole("link", { name: "Continue to Scorers" }).click()
    await expect(page.getByRole("heading", { name: "Predictions", level: 1 })).toBeVisible()
  })

  const card = page.getByRole("group", { name: matchName })

  await test.step("predict 2-1 and bank it", async () => {
    await card.getByLabel("Home score").fill("2")
    await card.getByLabel("Away score").fill("1")
    await expect(card.getByRole("status")).toContainText("Saved")

    const noBankerWarning = page.getByText(/no banker set for/i)
    await expect(noBankerWarning).toBeVisible()

    const banker = card.getByRole("button", { name: /banker/i })
    await expect(banker).toHaveAttribute("aria-pressed", "false")
    await banker.click()
    await expect(banker).toHaveAttribute("aria-pressed", "true")
    await expect(noBankerWarning).toBeHidden()
  })

  await test.step("the pick and banker survive a reload", async () => {
    await page.reload()
    await expect(card.getByLabel("Home score")).toHaveValue("2")
    await expect(card.getByLabel("Away score")).toHaveValue("1")
    await expect(card.getByRole("button", { name: /banker/i })).toHaveAttribute("aria-pressed", "true")
  })

  await test.step("once the match kicks off the pick is locked", async () => {
    await setKickoff(match.id, new Date(Date.now() - 2 * 60 * 60 * 1000))
    await page.reload()
    await expect(page.getByRole("group", { name: `${otherMatch.homeTeam} v ${otherMatch.awayTeam}` })).toBeVisible()
    await expect(card).toHaveCount(0)
  })

  await test.step("the host confirms a 2-1 result", async () => {
    const hostContext = await browser.newContext()
    const host = await hostContext.newPage()
    await signIn(host, HOST_EMAIL)

    await host.goto("/host/results")
    const row = host.getByRole("row").filter({ hasText: match.homeTeam })
    // A click landing before React hydrates still runs the action, but the
    // refreshed queue it returns is dropped. Checking again is harmless.
    await expect(async () => {
      await host.getByRole("button", { name: "Check for Updates" }).click()
      await expect(row).toBeVisible({ timeout: 2_000 })
    }).toPass()
    await row.getByRole("link", { name: /Enter Result/ }).click()

    await host.getByLabel(match.homeTeam).fill("2")
    await host.getByLabel(match.awayTeam).fill("1")
    await host.getByRole("button", { name: "Save result" }).click()
    await expect(host).toHaveURL(/\/host\/results$/)
    await hostContext.close()
  })

  await test.step("the leaderboard ranks the newcomer first on 6 points", async () => {
    await page.goto("/leaderboard")
    const rows = page.getByRole("table").getByRole("row")
    // Header, then newcomer (exact 3 × banker 2 = 6), then rival (close = 1.5).
    // The round isn't finished (one fixture left), so no streak bonus yet.
    await expect(rows.nth(1)).toContainText(displayName)
    await expect(rows.nth(1)).toContainText("(you)")
    await expect(rows.nth(1).getByRole("cell").nth(2)).toHaveText("6")
    await expect(rows.nth(2)).toContainText(rival.displayName)
    await expect(rows.nth(2).getByRole("cell").nth(2)).toHaveText("1.5")
  })
})
