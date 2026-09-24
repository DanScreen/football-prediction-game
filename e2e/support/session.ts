import { expect, type Page } from "@playwright/test"
import { PASSWORD } from "../env"

/** Signs in through the real login form and waits to land past it. */
export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).not.toHaveURL(/\/login/)
}
