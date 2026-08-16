"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * Three destinations, one job each: make your picks, see the standings, manage
 * membership. The old Dashboard/My Predictions split duplicated the same picks
 * and results either side of kickoff, so they merged into `/`.
 */
export const LINKS = [
  { href: "/", label: "Predictions", short: "Predict", icon: "⚽" },
  { href: "/leaderboard", label: "Leaderboard", short: "Table", icon: "🏆" },
  { href: "/leagues", label: "My Leagues", short: "Leagues", icon: "👥" },
] as const

/** Exact match for the dashboard, prefix match for everything else. */
export function useIsActive() {
  const pathname = usePathname()
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
}

/** Top-bar navigation. Hidden on mobile, where MobileNav takes over. */
export default function NavLinks() {
  const isActive = useIsActive()

  return (
    <nav className="hidden sm:flex items-center gap-1 text-sm">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            isActive(href)
              ? "bg-chip text-ink"
              : "text-ink-muted hover:text-ink hover:bg-chip/60"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
