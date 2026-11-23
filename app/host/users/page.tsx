import Link from "next/link"
import {
  listHostUsers,
  parseHostUserFilter,
  type HostUserFilter,
  type HostUsersResult,
} from "@/lib/hostUsers"
import UserActions from "./UserActions"

export const metadata = { title: "Users" }

function formatWhen(date: Date | null) {
  if (!date) return "—"
  return date.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function href(data: HostUsersResult, changes: { filter?: HostUserFilter; page?: number }) {
  const params = new URLSearchParams()
  const filter = changes.filter ?? data.filter
  if (filter !== "all") params.set("filter", filter)
  if (data.query) params.set("q", data.query)
  const page = changes.page ?? 1
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `/host/users?${qs}` : "/host/users"
}

const TABS: Array<{ filter: HostUserFilter; label: string }> = [
  { filter: "all", label: "All" },
  { filter: "unverified", label: "Unverified" },
  { filter: "verified", label: "Verified" },
]

function Status({ user }: { user: HostUsersResult["users"][number] }) {
  if (user.isBot) return <span className="text-ink-faint">—</span>
  if (user.emailVerifiedAt) {
    return (
      <>
        <span className="inline-block rounded-full border border-good-line bg-good-tint px-2 py-0.5 text-xs font-semibold text-good">
          Verified
        </span>
        <p className="mt-1 text-xs text-ink-muted">{formatWhen(user.emailVerifiedAt)}</p>
      </>
    )
  }
  return (
    <>
      <span className="inline-block rounded-full border border-bad-line bg-bad-tint px-2 py-0.5 text-xs font-semibold text-bad">
        Unverified
      </span>
      <p className="mt-1 text-xs text-ink-muted">
        {user.lastVerificationSentAt
          ? `Link sent ${formatWhen(user.lastVerificationSentAt)}`
          : "No link sent yet"}
      </p>
    </>
  )
}

export default async function HostUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}) {
  const params = await searchParams
  const data = await listHostUsers({
    filter: parseHostUserFilter(params.filter),
    query: params.q,
    page: Number.parseInt(params.page ?? "1", 10),
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-ink">Users</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Every account, newest first. Unverified players are held on the &ldquo;check your
        inbox&rdquo; screen and get no reminders. Send them a fresh link, fix a mistyped address, or
        send anyone a password reset link (it works for an hour, and completing it also verifies
        the email).
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter users" className="flex gap-1 rounded-lg bg-chip p-1 text-sm">
          {TABS.map((tab) => (
            <Link
              aria-current={data.filter === tab.filter ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                data.filter === tab.filter
                  ? "bg-surface text-ink shadow-card"
                  : "text-ink-muted hover:text-ink"
              }`}
              href={href(data, { filter: tab.filter })}
              key={tab.filter}
            >
              {tab.label} <span className="score-digits text-ink-faint">{data.counts[tab.filter]}</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" method="get">
          {data.filter !== "all" && <input name="filter" type="hidden" value={data.filter} />}
          <input
            aria-label="Search users"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm sm:w-64"
            defaultValue={data.query}
            name="q"
            placeholder="Name or email"
            type="search"
          />
          <button
            className="rounded-md bg-pitch px-3 py-1.5 text-sm font-semibold text-pitch-on hover:bg-pitch-deep transition-colors"
            type="submit"
          >
            Search
          </button>
        </form>
      </div>

      {data.users.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-ink-muted shadow-card">
          {data.query ? `No users match “${data.query}”.` : "No users here."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Email status</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Last seen</th>
                <th className="px-4 py-3 font-semibold text-right">Leagues</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr className="border-b border-line-soft align-top last:border-0" key={u.id}>
                  <td className="min-w-[15rem] px-4 py-3">
                    <p className="font-medium text-ink">
                      <Link
                        className="hover:text-pitch hover:underline"
                        href={`/host/analytics/players/${u.id}`}
                      >
                        {u.displayName}
                      </Link>
                      {u.isBot && <span className="ml-2 text-xs font-normal text-ink-muted">bot</span>}
                      {u.isSiteAdmin && (
                        <span className="ml-2 text-xs font-normal text-ink-muted">host</span>
                      )}
                    </p>
                    <p className="break-all text-xs text-ink-muted">{u.email}</p>
                    {u.lastResetSentAt && (
                      <p className="mt-1 text-xs text-ink-faint">
                        Reset link sent {formatWhen(u.lastResetSentAt)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Status user={u} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                    {formatWhen(u.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                    {formatWhen(u.lastSeenAt)}
                  </td>
                  <td className="px-4 py-3 text-right score-digits text-ink">{u.leagueCount}</td>
                  <td className="px-4 py-3">
                    {u.isBot ? (
                      <span className="text-xs text-ink-faint">—</span>
                    ) : (
                      <UserActions email={u.email} userId={u.id} verified={!!u.emailVerifiedAt} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-muted">
          {data.total} {data.total === 1 ? "user" : "users"} · page {data.page} of {data.totalPages}
        </span>
        <div className="flex gap-2">
          {data.page > 1 && (
            <Link
              className="rounded-md border border-line-strong px-3 py-1.5 text-ink-mid hover:bg-chip"
              href={href(data, { page: data.page - 1 })}
            >
              Previous
            </Link>
          )}
          {data.page < data.totalPages && (
            <Link
              className="rounded-md border border-line-strong px-3 py-1.5 text-ink-mid hover:bg-chip"
              href={href(data, { page: data.page + 1 })}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
