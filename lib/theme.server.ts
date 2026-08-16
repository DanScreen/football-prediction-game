import { cookies } from "next/headers"
import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme"

/**
 * Read on the server so `<html>` is rendered with the right `data-theme` in the
 * initial HTML. Doing this client-side would flash the wrong theme on first paint.
 *
 * Kept out of `lib/theme.ts` because that module is imported by the client-side
 * toggle, and `next/headers` can't be bundled for the browser.
 */
export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value
  return isTheme(value) ? value : "system"
}
