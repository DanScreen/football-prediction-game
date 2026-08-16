/**
 * Loading placeholders. Every page is an async server component running several
 * Prisma queries, and Cloud Run runs with `--min-instances 0`, so a cold start is
 * a real wait — these give it a shape instead of a frozen screen.
 *
 * `shimmer` is already reduced-motion aware (see globals.css).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded bg-chip ${className}`} aria-hidden="true" />
}

/** Wraps a skeleton screen so assistive tech announces the wait rather than reading bones. */
export function SkeletonScreen({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="max-w-4xl mx-auto px-4 py-8">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  )
}

/** The fixture/prediction card shape used on the dashboard and predictions pages. */
export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
      <div className="border-b border-line-soft px-5 py-2.5">
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex items-center gap-3 px-5 py-4">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-11 w-24 shrink-0 rounded-lg" />
        <Skeleton className="h-4 flex-1" />
      </div>
    </div>
  )
}

/** Page heading + subtitle. */
export function SkeletonHeading() {
  return (
    <div className="mb-6">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-3.5 w-40" />
    </div>
  )
}
