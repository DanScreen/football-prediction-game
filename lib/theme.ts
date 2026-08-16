/**
 * Pure theme constants — safe to import from Client Components.
 * The server-side cookie read lives in `lib/theme.server.ts`, which pulls in
 * `next/headers` and must never reach the browser bundle.
 */

export const THEME_COOKIE = "theme"

/**
 * "system" follows the OS via `prefers-color-scheme`; the other two override it.
 * Stored in a readable (non-httpOnly) cookie so it survives sign-out — a theme is a
 * device preference, not account data.
 */
export type Theme = "light" | "dark" | "system"

export const THEMES: Theme[] = ["system", "light", "dark"]

export function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}
