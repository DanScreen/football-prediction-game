"use client"

import Link from "next/link"
import { LINKS, useIsActive } from "./NavLinks"

/**
 * Bottom tab bar — the only navigation on mobile.
 *
 * The top-bar nav is `hidden sm:flex`, so below 640px there was previously no
 * way to reach Predictions, the Leaderboard or Leagues at all. A bottom bar
 * (rather than a hamburger) keeps every destination one thumb-tap away, which
 * suits a game people check between matches.
 *
 * `pb-safe` padding clears the iOS home indicator; `app/layout.tsx` adds
 * matching bottom padding to <main> so content can still scroll clear of it.
 */
export default function MobileNav() {
  const isActive = useIsActive()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {LINKS.map(({ href, short, icon }) => {
          const active = isActive(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-pitch" : "text-ink-muted"
                }`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {icon}
                </span>
                {short}
                {/* The active tab also gets a bar, so the cue isn't colour alone. */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-0.5 w-6 rounded-full ${active ? "bg-pitch" : "bg-transparent"}`}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
