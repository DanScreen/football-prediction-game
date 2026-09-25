import { expect, test } from "@playwright/test"
import { createUser, ensureHost } from "./support/db"
import { linkFromLatestEmail } from "./support/mail"
import { signIn } from "./support/session"

/**
 * The host's user list: find an unverified player, email them a link from
 * /host/users, and the link they receive works.
 */
test("a host can find an unverified player and send them a verification link", async ({ page }) => {
  const host = await ensureHost()
  const player = await createUser({ verified: false })

  await signIn(page, host.email)
  await page.goto("/host/users?filter=unverified")
  await page.getByRole("searchbox", { name: "Search users" }).fill(player.email)
  await page.getByRole("button", { name: "Search" }).click()

  const row = page.getByRole("row").filter({ hasText: player.email })
  await expect(row.getByText("Unverified", { exact: true })).toBeVisible()
  await expect(row.getByText("No link sent yet")).toBeVisible()

  await row.getByRole("button", { name: "Send verification link" }).click()
  await expect(row.getByText(`Verification link sent to ${player.email}.`)).toBeVisible()

  const link = await linkFromLatestEmail(player.email, /confirm your email/i)
  await page.goto(link)
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible()
})

test("a host can send any player a password reset link", async ({ page }) => {
  const host = await ensureHost()
  const player = await createUser()

  await signIn(page, host.email)
  await page.goto(`/host/users?q=${encodeURIComponent(player.email)}`)

  const row = page.getByRole("row").filter({ hasText: player.email })
  await expect(row.getByText("Verified", { exact: true })).toBeVisible()
  await expect(row.getByRole("button", { name: "Send verification link" })).toHaveCount(0)

  await row.getByRole("button", { name: "Send reset link" }).click()
  await expect(row.getByText(`Reset link sent to ${player.email}.`)).toBeVisible()
  const link = await linkFromLatestEmail(player.email, /reset your/i)
  expect(link).toMatch(/\/reset-password\/[a-f0-9]{64}$/)
})

test("a player can't open the user list", async ({ page }) => {
  const player = await createUser()
  await signIn(page, player.email)
  await page.goto("/host/users")
  await expect(page).not.toHaveURL(/\/host/)
})
