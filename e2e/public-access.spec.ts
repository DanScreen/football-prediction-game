import { expect, test } from "@playwright/test"
import { APP_URL, PASSWORD } from "./env"
import { createUser } from "./support/db"
import { signIn } from "./support/session"

/**
 * What proxy.ts lets through for a signed-out visitor, and what it doesn't.
 * Two shipped bugs lived here: /forgot-password and the bot API were both
 * redirected to /login because they were missing from the allow-list.
 */

const PUBLIC_PAGES = [
  { path: "/login", heading: "Welcome back" },
  { path: "/register", heading: "Create your account" },
  { path: "/forgot-password", heading: "Forgot Password" },
  { path: "/rules", heading: "How it works" },
  { path: "/privacy", heading: "Privacy policy" },
  { path: "/support", heading: "Support" },
]

for (const { path, heading } of PUBLIC_PAGES) {
  test(`${path} is reachable signed out`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveURL(path)
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible()
  })
}

const PROTECTED_PAGES = ["/", "/results", "/leaderboard", "/leagues", "/profile", "/admin", "/host"]

for (const path of PROTECTED_PAGES) {
  test(`${path} sends a signed-out visitor to sign in`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(path)}`)
  })
}

test("the login page links to password reset", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("link", { name: "Forgot password?" }).click()
  await expect(page).toHaveURL("/forgot-password")
  await expect(page.getByRole("heading", { name: "Forgot Password" })).toBeVisible()
})

test("signing in returns you to the page you asked for", async ({ page }) => {
  const user = await createUser()
  await page.goto("/profile")
  await expect(page).toHaveURL(/\/login\?callbackUrl=/)

  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()

  await expect(page).toHaveURL("/profile")
  await expect(page.getByRole("heading", { name: "Your Profile" })).toBeVisible()
})

test("a callbackUrl can't send a signed-in user off-site", async ({ page }) => {
  const user = await createUser()
  await page.goto(`/login?callbackUrl=${encodeURIComponent("https://example.com/phish")}`)
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()

  // Signed in, and still on our own origin.
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible()
  expect(new URL(page.url()).origin).toBe(APP_URL)
})

test("a wrong password is refused with a message", async ({ page }) => {
  const user = await createUser()
  await page.goto("/login")
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill("not-my-password")
  await page.getByRole("button", { name: "Sign In" }).click()

  await expect(page.getByText("Invalid email or password.")).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test("signing out ends the session", async ({ page }) => {
  const user = await createUser()
  await signIn(page, user.email)
  await page.getByRole("button", { name: "Logout" }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.goto("/profile")
  await expect(page).toHaveURL(/\/login\?callbackUrl=/)
})
