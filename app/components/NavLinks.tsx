"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/predictions", label: "My Predictions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/leagues", label: "My Leagues" },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="hidden sm:flex items-center gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              active
                ? "bg-chip text-ink"
                : "text-ink-muted hover:text-ink hover:bg-chip/60"
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
