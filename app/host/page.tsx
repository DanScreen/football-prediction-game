import { getHostOverviewMetrics } from "@/lib/hostMetrics"

export const metadata = { title: "Host overview" }

function formatWhen(date: Date | null) {
  if (!date) return "—"
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 score-digits text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}

export default async function HostOverviewPage() {
  const m = await getHostOverviewMetrics()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-ink">Overview</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Platform-wide user counts and activity. Derived from the database — no third-party
        analytics.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Users
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={m.users.total} />
          <StatCard label="Humans" value={m.users.humans} />
          <StatCard label="Bots" value={m.users.bots} />
          <StatCard label="Leagues" value={m.leagues} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Active
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="DAU" value={m.active.dau} hint="Seen in last 24h" />
          <StatCard label="WAU" value={m.active.wau} hint="Seen in last 7d" />
          <StatCard label="MAU" value={m.active.mau} hint="Seen in last 30d" />
          <StatCard
            label="Mobile"
            value={m.mobileUsers}
            hint="Device or active refresh token"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Activity
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Signups · 7d" value={m.signups.last7d} />
          <StatCard label="Signups · 30d" value={m.signups.last30d} />
          <StatCard
            label="Picks · 7d"
            value={m.predictions.last7d}
            hint={`${m.predictions.webLast7d} web · ${m.predictions.apiLast7d} API`}
          />
          <StatCard label="Picks · 30d" value={m.predictions.last30d} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Recent users
        </h2>
        {m.recentUsers.length === 0 ? (
          <p className="text-sm text-ink-muted">No users yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                  <th className="px-4 py-3 font-semibold text-right">Picks</th>
                </tr>
              </thead>
              <tbody>
                {m.recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {u.displayName}
                      {u.isBot ? (
                        <span className="ml-2 text-xs font-normal text-ink-muted">bot</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatWhen(u.createdAt)}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatWhen(u.lastSeenAt)}</td>
                    <td className="px-4 py-3 text-right score-digits text-ink">
                      {u.predictionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
