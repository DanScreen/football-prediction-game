import { expect, test } from "@playwright/test"
import { PASSWORD } from "./env"
import { createUser } from "./support/db"
import { linkFromLatestEmail } from "./support/mail"

/**
 * The whole forgotten-password loop, following the link in the real email.
 * Every piece of it — the public route, the token, the email, the new hash —
 * has to work for a locked-out player to get back in.
 */
test("a player who forgot their password resets it from the emailed link", async ({ page }) => {
  const user = await createUser()
  const newPassword = "a-brand-new-password"

  await page.goto("/login")
  await page.getByRole("link", { name: "Forgot password?" }).click()
  await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible()
  await page.getByLabel("Email").fill(user.email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByText(/we've sent a link to reset your password/)).toBeVisible()

  const link = await linkFromLatestEmail(user.email, /reset your/i)
  await page.goto(link)
  await page.getByLabel("New Password", { exact: true }).fill(newPassword)
  await page.getByLabel("Confirm New Password").fill(newPassword)
  await page.getByRole("button", { name: "Reset Password" }).click()

  await expect(page).toHaveURL("/login?reset=1")
  await expect(page.getByText("Password reset! Sign in with your new password.")).toBeVisible()

  await test.step("the old password no longer works", async () => {
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page.getByText("Invalid email or password.")).toBeVisible()
    // React resets the form after the action; the email must survive it.
    await expect(page.getByLabel("Email")).toHaveValue(user.email)
  })

  await test.step("the new one does", async () => {
    await page.getByLabel("Password").fill(newPassword)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible()
  })

  await test.step("the link can't be used twice", async () => {
    await page.goto(link)
    await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible()
  })
})

test("asking for a reset doesn't reveal whether an account exists", async ({ page }) => {
  await page.goto("/forgot-password")
  await page.getByLabel("Email").fill("nobody-here@e2e.test")
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByText(/If an account exists for that email/)).toBeVisible()
})
