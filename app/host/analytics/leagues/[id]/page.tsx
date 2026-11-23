import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { activityDayKey } from "@/lib/activity"
import {
  RECENT_ROUNDS,
  addDays,
  buildIndex,
  computeLeagueStats,
  computePlayerStats,
  dayRange,
  leagueMemberStats,
  leagueRoundStats,
} from "@/lib/analytics/compute"
import { loadAnalyticsDataset } from "@/lib/analytics/load"
import { avatarPath } from "@/lib/avatar"
import Avatar from "@/app/components/Avatar"
import {
  BackLink,
  Card,
  ColumnChart,
  HealthBadge,
  Section,
  SegmentBadge,
  StatTile,
  TableView,
  daysAgo,
  formatDate,
  formatDay,
  pct,
  share,
} from "../../ui"

export const metadata = { title: "Group · Analytics" }

const ROUNDS = 12
const PULSE_DAYS = 28

export default async function AnalyticsLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const league = await prisma.league.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      createdAt: true,
      competition: { select: { name: true, flag: true, archivedAt: true } },
      memberships: { select: { userId: true } },
    },
  })
  if (!league) notFound()

  const ds = await loadAnalyticsDataset({ userIds: league.memberships.map((m) => m.userId) })
  const index = buildIndex(ds)
  const today = activityDayKey(ds.now)
  const stats = computeLeagueStats(ds, index).find((l) => l.league.id === id)
  const rounds = leagueRoundStats(ds, index, id, ROUNDS)
  const players = new Map(computePlayerStats(ds, index).map((p) => [p.user.id, p]))
  const members = leagueMemberStats(ds, index, id).sort(
    (a, b) =>
      b.recentPlayed - a.recentPlayed ||
      b.roundsPlayed - a.roundsPlayed ||
      (a.user?.displayName ?? "").localeCompare(b.user?.displayName ?? ""),
  )

  const pulseDays = dayRange(addDays(today, -(PULSE_DAYS - 1)), today)
  const activeDays = new Map<string, Set<string>>()
  for (const a of ds.activity) {
    const set = activeDays.get(a.userId) ?? new Set<string>()
    set.add(a.day)
    activeDays.set(a.userId, set)
  }
  const dailyMembers = pulseDays.map((d) => members.filter((m) => activeDays.get(m.membership.userId)?.has(d)).length)

  return (
    <>
      <BackLink href="/host/analytics/leagues">All groups</BackLink>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-ink">{league.name}</h2>
        {stats ? <HealthBadge health={stats.health} /> : null}
        <p className="w-full text-sm text-ink-muted">
          {league.competition.flag} {league.competition.name}
          {league.competition.archivedAt ? " (finished)" : ""} · created {formatDate(league.createdAt)} ·
          invite code <span className="font-mono">{league.inviteCode}</span>
        </p>
      </div>

      <Section title="At a glance">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            hint={stats && stats.bots > 0 ? `plus ${stats.bots} bot${stats.bots === 1 ? "" : "s"}` : "No bots"}
            label="Players"
            value={stats?.humans ?? 0}
          />
          <StatTile
            hint={`Picked in the last ${RECENT_ROUNDS} gameweeks`}
            label="Picking"
            value={stats?.activePickers ?? 0}
          />
          <StatTile
            hint="Average share of members who pick each gameweek"
            label="Per gameweek"
            value={pct(stats?.participation)}
          />
          <StatTile hint="Members seen in the last 7 days" label="Active 7d" value={stats?.activeMembers7d ?? 0} />
        </div>
      </Section>

      <Section
        description={`Members who picked at least one fixture, out of those in the group by then (last ${ROUNDS} gameweeks).`}
        title="Gameweek participation"
      >
        <Card>
          {rounds.length === 0 ? (
            <p className="text-sm text-ink-muted">No gameweek has kicked off since this group started.</p>
          ) : (
            <>
              <ColumnChart
                columns={rounds.map((r) => ({
                  label: r.round.key,
                  value: Math.round((share(r.played, r.eligible) ?? 0) * 100),
                  axisLabel: r.round.label.replace(/^Matchday /i, "MD").replace(/^Gameweek /i, "GW"),
                  tooltip: `${r.round.label}: ${r.played} of ${r.eligible} members · ${pct(r.fixtureCoverage)} of fixtures picked`,
                }))}
                format={(n) => `${n}%`}
                height={120}
                max={100}
              />
              <TableView
                headers={["Gameweek", "Members", "Picked", "Share", "Fixtures picked"]}
                rows={rounds.map((r) => [
                  r.round.label,
                  r.eligible,
                  r.played,
                  pct(share(r.played, r.eligible)),
                  pct(r.fixtureCoverage),
                ])}
              />
            </>
          )}
        </Card>
      </Section>

      <Section
        description={`Each square is a day in the last ${PULSE_DAYS} on which that member used Scorers (any surface).`}
        title="Who keeps coming back"
      >
        <Card className="overflow-x-auto">
          <table className="text-xs">
            <tbody>
              {members.map((m) => {
                const days = activeDays.get(m.membership.userId)
                return (
                  <tr key={m.membership.userId}>
                    <td className="max-w-[10rem] truncate py-0.5 pr-3 text-ink-mid">
                      {m.user?.displayName ?? "Deleted"}
                    </td>
                    {pulseDays.map((d) => (
                      <td className="p-[1.5px]" key={d}>
                        <span
                          className={`block size-3 rounded-[3px] ${days?.has(d) ? "bg-chart" : "bg-chip"}`}
                          title={`${m.user?.displayName}: ${formatDay(d)} ${days?.has(d) ? "active" : "—"}`}
                        />
                      </td>
                    ))}
                    <td className="pl-3 tabular-nums text-ink-muted">
                      {pulseDays.filter((d) => days?.has(d)).length}d
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td className="pt-1 pr-3 text-ink-faint">Members active</td>
                {dailyMembers.map((n, i) => (
                  <td className="pt-1 text-center tabular-nums text-ink-faint" key={pulseDays[i]}>
                    {i % 7 === 6 ? n : ""}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-ink-faint">
            {formatDay(pulseDays[0])} → {formatDay(today)}. The bottom row prints the count every 7th
            day.
          </p>
        </Card>
      </Section>

      <Section title="Members">
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Player</th>
                <th className="px-3 py-3 font-semibold">Joined</th>
                <th className="px-3 py-3 text-right font-semibold">Picks</th>
                <th className="px-3 py-3 text-right font-semibold">GWs played</th>
                <th className="px-3 py-3 text-right font-semibold">Last {RECENT_ROUNDS}</th>
                <th className="px-3 py-3 font-semibold">Last pick</th>
                <th className="px-3 py-3 font-semibold">Last seen</th>
                <th className="px-4 py-3 font-semibold">Segment</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const p = players.get(m.membership.userId)
                return (
                  <tr className="border-b border-line-soft last:border-0" key={m.membership.userId}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.user ? (
                          <Avatar
                            avatarUrl={m.user.avatarKey ? avatarPath(m.user.avatarKey) : null}
                            displayName={m.user.displayName}
                            userId={m.user.id}
                          />
                        ) : null}
                        <div>
                          <Link
                            className="font-medium text-ink hover:text-pitch hover:underline"
                            href={`/host/analytics/players/${m.membership.userId}`}
                          >
                            {m.user?.displayName ?? "Deleted"}
                          </Link>
                          <p className="text-xs text-ink-faint">
                            {m.membership.role === "COMMISSIONER" ? "Commissioner" : "Member"}
                            {m.user?.isBot ? " · bot" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{formatDate(m.membership.joinedAt)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{m.picks}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">
                      {m.roundsPlayed}
                      <span className="text-xs text-ink-faint"> /{m.roundsEligible}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">
                      {m.recentPlayed}
                      <span className="text-xs text-ink-faint"> /{m.recentEligible}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">{formatDate(m.lastPickAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                      {daysAgo(p?.lastActiveDay ?? null, today)}
                    </td>
                    <td className="px-4 py-3">{p ? <SegmentBadge segment={p.segment} /> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Picks and gameweeks count this group&apos;s competition since the member joined. The
          segment is across all of a player&apos;s groups.
        </p>
      </Section>
    </>
  )
}
