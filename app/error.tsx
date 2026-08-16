"use client"

import { useEffect } from "react"
import Link from "next/link"

/**
 * App-wide error boundary. Without this, a thrown error in any server component
 * (a dropped DB connection, a football-data.org hiccup) shows the raw Next.js
 * error screen.
 *
 * The message itself is deliberately not rendered — it can carry connection
 * strings or internal detail. It goes to the console, which surfaces in Cloud
 * Run logs; players get a recovery path instead.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled error:", error)
  }, [error])

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="mb-4 text-5xl">🥅</p>
      <h1 className="mb-2 text-2xl font-bold text-ink">That one got away</h1>
      <p className="mb-8 text-ink-muted">
        Something went wrong loading this page. Your predictions are safe — try again.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-pitch px-5 py-2.5 font-semibold text-pitch-on shadow-card transition-colors hover:bg-pitch-deep"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-line-strong px-5 py-2.5 font-semibold text-ink-mid transition-colors hover:bg-chip"
        >
          Dashboard
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-ink-faint">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </div>
  )
}
