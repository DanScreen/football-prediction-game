"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme"

/**
 * Persist the theme choice. Not httpOnly — no secret here, and keeping it readable
 * means the preference survives sign-out like any other device setting.
 */
export async function setTheme(theme: Theme): Promise<void> {
  if (!isTheme(theme)) return

  const store = await cookies()
  store.set(THEME_COOKIE, theme, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  // The root layout renders data-theme from this cookie, so every route is stale.
  revalidatePath("/", "layout")
}
