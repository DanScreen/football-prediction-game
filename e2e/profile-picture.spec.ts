import { expect, test } from "@playwright/test"
import sharp from "sharp"
import { createUser } from "./support/db"
import { signIn } from "./support/session"

/**
 * Profile pictures: initials by default, upload replaces them everywhere the
 * header renders, and removing one takes the old URL offline.
 */
test("a player can upload and remove a profile picture", async ({ page }) => {
  const user = await createUser({ displayName: "Avery Tester" })
  await signIn(page, user.email)
  await page.goto("/profile")

  const header = page.getByRole("banner")
  // No picture yet: initials, in the header and on the profile card.
  await expect(header.getByText("AT", { exact: true })).toBeVisible()
  await expect(page.getByText("Upload picture")).toBeVisible()

  // A landscape photo bigger than the stored size, as a phone would give.
  const photo = await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: { r: 20, g: 120, b: 60 } },
  })
    .jpeg()
    .toBuffer()
  await page.locator('input[type="file"]').setInputFiles({
    name: "me.jpg",
    mimeType: "image/jpeg",
    buffer: photo,
  })

  const headerPicture = header.locator('img[src^="/api/avatars/"]')
  await expect(headerPicture).toBeVisible()
  await expect(header.getByText("AT", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Change picture")).toBeVisible()

  const src = await headerPicture.getAttribute("src")
  const served = await page.request.get(src!)
  expect(served.status()).toBe(200)
  expect(served.headers()["content-type"]).toBe("image/webp")
  const meta = await sharp(await served.body()).metadata()
  expect([meta.width, meta.height]).toEqual([256, 256])

  await page.getByRole("button", { name: "Remove" }).click()
  await expect(header.getByText("AT", { exact: true })).toBeVisible()
  expect((await page.request.get(src!)).status()).toBe(404)
})
