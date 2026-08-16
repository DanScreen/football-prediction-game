"use client"

import { useTransition } from "react"
import { setTheme } from "@/app/theme-actions"
import { THEMES, type Theme } from "@/lib/theme"

const LABELS: Record<Theme, { icon: string; label: string }> = {
  system: { icon: "◐", label: "Match system theme" },
  light: { icon: "☀", label: "Light theme" },
  dark: { icon: "☾", label: "Dark theme" },
}

/**
 * Cycles System → Light → Dark. A three-state cycle rather than a two-state switch
 * because "follow my OS" is a real preference, and it's the default — a plain
 * light/dark switch would strand anyone who wants to go back to it.
 */
export default function ThemeToggle({ theme }: { theme: Theme }) {
  const [pending, startTransition] = useTransition()

  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
  const current = LABELS[theme]

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setTheme(next))}
      title={`${current.label} — switch to ${LABELS[next].label.toLowerCase()}`}
      aria-label={`${current.label}. Switch to ${LABELS[next].label.toLowerCase()}.`}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-sm text-ink-mid transition-colors hover:bg-chip disabled:opacity-50"
    >
      <span aria-hidden="true">{current.icon}</span>
    </button>
  )
}
