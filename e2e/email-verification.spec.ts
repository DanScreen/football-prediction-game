import { expect, test } from "@playwright/test"
import { createUser } from "./support/db"
import { linkFromLatestEmail } from "./support/mail"
import { signIn } from "./support/session"
import { MAIL_SINK_URL } from "./env"

/**
 * An account from before verification existed has never been sent a link.
 * Nothing on the page asks for one up front — it used to wait for a button
 * press, and players sat waiting for an email that was never coming.
 */
test("an existing unverified account is emailed a link without asking", async ({ page }) => {
  const user = await createUser({ verified: false })
  await signIn(page, user.email)
  await page.goto("/")

  await expect(page).toHaveURL("/verify-email")
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible()
  const link = await linkFromLatestEmail(user.email, /confirm your email/i)

  // Coming back to the page while that link is live mustn't send another.
  await page.reload()
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible()
  const res = await fetch(`${MAIL_SINK_URL}/emails?to=${encodeURIComponent(user.email)}`)
  expect(await res.json()).toHaveLength(1)

  await page.goto(link)
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible()
})
