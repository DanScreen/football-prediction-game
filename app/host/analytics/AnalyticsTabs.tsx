"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/host/analytics", label: "Overview" },
  { href: "/host/analytics/leagues", label: "Groups" },
  { href: "/host/analytics/players", label: "Players" },
]

export default function AnalyticsTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Analytics sections" className="mb-6 flex w-fit gap-1 rounded-lg bg-chip p-1 text-sm">
      {TABS.map((tab) => {
        const current =
          tab.href === "/host/analytics" ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link
            aria-current={current ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              current ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
            }`}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
