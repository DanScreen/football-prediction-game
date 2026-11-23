import { requireSiteAdmin } from "@/lib/adminAuth"
import AnalyticsTabs from "./AnalyticsTabs"

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  // The host layout already redirects non-hosts; this is belt and braces for
  // pages that read every user's activity.
  await requireSiteAdmin()
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-ink">Analytics</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Who&apos;s playing, which groups are alive, and how often people come back. Bots are left
        out of player numbers unless a table says otherwise.
      </p>
      <AnalyticsTabs />
      {children}
    </div>
  )
}
