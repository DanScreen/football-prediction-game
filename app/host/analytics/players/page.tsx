import Link from "next/link"
import { activityDayKey } from "@/lib/activity"
import {
  RECENT_ROUNDS,
  SEGMENTS,
  computePlayerStats,
  type PlayerStats,
  type Segment,
} from "@/lib/analytics/compute"
import { loadAnalyticsDataset } from "@/lib/analytics/load"
import { avatarPath } from "@/lib/avatar"
import Avatar from "@/app/components/Avatar"
import { SegmentBadge, Surfaces, daysAgo, formatDate, pct } from "../ui"

export const metadata = { title: "Players · Analytics" }

const PAGE_SIZE = 50
type SegmentFilter = Segment | "all" | "engaged"
const ENGAGED: Segment[] = ["core", "regular", "casual"]

const SORTS = {
  recent: { label: "Last 4", by: (p: PlayerStats) => p.recentPlayed * 1000 + p.roundsPlayed },
  picks: { label: "Picks", by: (p: PlayerStats) => p.picks },
  coverage: { label: "Coverage", by: (p: PlayerStats) => p.fixtureCoverage ?? -1 },
  days: { label: "Days · 30d", by: (p: PlayerStats) => p.activeDays30 },
  seen: { label: "Last seen", by: (p: PlayerStats) => (p.lastActiveDay ? Date.parse(p.lastActiveDay) : 0) },
  joined: { label: "Joined", by: (p: PlayerStats) => p.user.createdAt.getTime() },
} as const
type Sort = keyof typeof SORTS

export default async function AnalyticsPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; sort?: string; q?: string; bots?: string; page?: string }>
}) {
  const params = await searchParams
  const segment: SegmentFilter =
    params.segment === "engaged" || SEGMENTS.some((s) => s.key === params.segment)
      ? (params.segment as SegmentFilter)
      : "all"
  const sort: Sort = params.sort && params.sort in SORTS ? (params.sort as Sort) : "recent"
  const query = params.q?.trim().slice(0, 100) ?? ""
  const showBots = params.bots === "1"

  const ds = await loadAnalyticsDataset()
  const today = activityDayKey(ds.now)
  const everyone = computePlayerStats(ds).filter((p) => showBots || !p.user.isBot)
  const counts = new Map<SegmentFilter, number>([
    ["all", everyone.length],
    ["engaged", everyone.filter((p) => ENGAGED.includes(p.segment)).length],
    ...SEGMENTS.map((s) => [s.key, everyone.filter((p) => p.segment === s.key).length] as const),
  ])

  const q = query.toLowerCase()
  const filtered = everyone
    .filter((p) =>
      segment === "all" ? true : segment === "engaged" ? ENGAGED.includes(p.segment) : p.segment === segment,
    )
    .filter((p) => !q || p.user.displayName.toLowerCase().includes(q) || p.user.email.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        SORTS[sort].by(b) - SORTS[sort].by(a) || a.user.displayName.localeCompare(b.user.displayName),
    )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1), totalPages)
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const href = (changes: { segment?: SegmentFilter; sort?: Sort; page?: number; bots?: boolean }) => {
    const p = new URLSearchParams()
    const s = changes.segment ?? segment
    const o = changes.sort ?? sort
    const b = changes.bots ?? showBots
    if (s !== "all") p.set("segment", s)
    if (o !== "recent") p.set("sort", o)
    if (query) p.set("q", query)
    if (b) p.set("bots", "1")
    if ((changes.page ?? 1) > 1) p.set("page", String(changes.page))
    const qs = p.toString()
    return qs ? `/host/analytics/players?${qs}` : "/host/analytics/players"
  }

  const tabs: Array<{ key: SegmentFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "engaged", label: "Picking" },
    ...SEGMENTS.map((s) => ({ key: s.key, label: s.label })),
  ]

  const sortHeader = (k: Sort, align: "left" | "right" = "right") => (
    <th className={`px-3 py-3 font-semibold ${align === "right" ? "text-right" : ""}`} key={k}>
      <Link className={sort === k ? "text-ink" : "hover:text-ink"} href={href({ sort: k })}>
        {SORTS[k].label}
        {sort === k ? " ↓" : ""}
      </Link>
    </th>
  )

  return (
    <>
      <nav aria-label="Filter players by segment" className="mb-3 flex flex-wrap gap-1 rounded-lg bg-chip p-1 text-sm">
        {tabs.map((t) => (
          <Link
            aria-current={segment === t.key ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              segment === t.key ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
            }`}
            href={href({ segment: t.key })}
            key={t.key}
            title={SEGMENTS.find((s) => s.key === t.key)?.description}
          >
            {t.label} <span className="tabular-nums text-ink-faint">{counts.get(t.key) ?? 0}</span>
          </Link>
        ))}
      </nav>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link className="text-sm text-ink-muted hover:text-ink" href={href({ bots: !showBots })}>
          {showBots ? "☑" : "☐"} Include bots
        </Link>
        <form className="flex gap-2" method="get">
          {segment !== "all" && <input name="segment" type="hidden" value={segment} />}
          {sort !== "recent" && <input name="sort" type="hidden" value={sort} />}
          {showBots && <input name="bots" type="hidden" value="1" />}
          <input
            aria-label="Search players"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm sm:w-64"
            defaultValue={query}
            name="q"
            placeholder="Name or email"
            type="search"
          />
          <button
            className="rounded-md bg-pitch px-3 py-1.5 text-sm font-semibold text-pitch-on transition-colors hover:bg-pitch-deep"
            type="submit"
          >
            Search
          </button>
        </form>
      </div>

      <p className="mb-3 text-xs text-ink-muted">
        <strong className="font-semibold text-ink-mid">Last {RECENT_ROUNDS}</strong> is gameweeks
        picked out of the last {RECENT_ROUNDS} they could play.{" "}
        <strong className="font-semibold text-ink-mid">Coverage</strong> is the share of kicked-off
        fixtures they picked since joining. <strong className="font-semibold text-ink-mid">Days</strong>{" "}
        is how many of the last 30 days they used Scorers.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-ink-muted shadow-card">
          {query ? `No players match “${query}”.` : "No players here."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Player</th>
                <th className="px-3 py-3 text-right font-semibold">Groups</th>
                {sortHeader("picks")}
                {sortHeader("recent")}
                {sortHeader("coverage")}
                {sortHeader("days")}
                {sortHeader("seen", "left")}
                <th className="px-3 py-3 font-semibold">Uses</th>
                <th className="px-3 py-3 font-semibold">Segment</th>
                {sortHeader("joined")}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr className="border-b border-line-soft last:border-0" key={p.user.id}>
                  <td className="min-w-[14rem] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        avatarUrl={avatarPath(p.user.avatarKey)}
                        displayName={p.user.displayName}
                        userId={p.user.id}
                      />
                      <div className="min-w-0">
                        <Link
                          className="font-medium text-ink hover:text-pitch hover:underline"
                          href={`/host/analytics/players/${p.user.id}`}
                        >
                          {p.user.displayName}
                        </Link>
                        {p.user.isBot && <span className="ml-1.5 text-xs text-ink-muted">bot</span>}
                        <p className="truncate text-xs text-ink-faint">{p.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{p.leagueCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{p.picks}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">
                    {p.recentEligible > 0 ? (
                      <>
                        {p.recentPlayed}
                        <span className="text-xs text-ink-faint"> /{p.recentEligible}</span>
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{pct(p.fixtureCoverage)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{p.activeDays30}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{daysAgo(p.lastActiveDay, today)}</td>
                  <td className="px-3 py-3">
                    <Surfaces surfaces={p.surfaces30} />
                  </td>
                  <td className="px-3 py-3">
                    <SegmentBadge segment={p.segment} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-ink-muted">
                    {formatDate(p.user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-muted">
          {filtered.length} {filtered.length === 1 ? "player" : "players"} · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="rounded-md border border-line-strong px-3 py-1.5 text-ink-mid hover:bg-chip"
              href={href({ page: page - 1 })}
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              className="rounded-md border border-line-strong px-3 py-1.5 text-ink-mid hover:bg-chip"
              href={href({ page: page + 1 })}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
