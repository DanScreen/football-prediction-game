import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { resolveCommissionerLeagueId } from "@/lib/activeLeague"
import {
  countMemberPredictions,
  getLeagueUpcomingPickStatus,
} from "@/lib/leaguePickStatus"
import { groupByRound } from "@/app/FixtureRoundGroup"

export const metadata = { title: "Pick Status" }

function fixtureKickoffLabel(kickoff: Date) {
  return kickoff.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function AdminPicksPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await resolveCommissionerLeagueId(session.user.id)
  if (!activeLeagueId) redirect("/leagues")

  const status = await getLeagueUpcomingPickStatus(activeLeagueId)
  if (!status) redirect("/leagues")

  const { leagueName, competitionName, members, fixtures } = status
  const memberIds = members.map((m) => m.userId)
  const memberCounts = countMemberPredictions(memberIds, fixtures)
  const rounds = groupByRound(
    fixtures.map((f) => ({
      ...f,
      competition: { name: f.competitionName },
    })),
  )

  const membersFullyPredicted = members.filter((m) => {
    const c = memberCounts.get(m.userId)
    return c && c.total > 0 && c.predicted === c.total
  }).length

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">Pick status</h1>
      <p className="text-ink-muted text-sm mb-6">
        {leagueName} · {competitionName}
      </p>

      <p className="text-sm text-ink-muted mb-8">
        See who has submitted predictions for upcoming fixtures. Scores stay hidden until
        kickoff — only whether each member has picked is shown here.
      </p>

      {fixtures.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium">No upcoming fixtures.</p>
          <p className="text-sm mt-2">
            New rounds appear automatically when they are announced.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap gap-3">
            <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Members fully predicted
              </p>
              <p className="mt-1 text-lg font-bold text-ink">
                {membersFullyPredicted}{" "}
                <span className="text-sm font-medium text-ink-muted">/ {members.length}</span>
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Upcoming fixtures
              </p>
              <p className="mt-1 text-lg font-bold text-ink">{fixtures.length}</p>
            </div>
          </div>

          <div className="space-y-8">
            {rounds.map((group) => {
              const roundFixtures = group.fixtures
              const roundFullyPredicted = members.filter((m) =>
                roundFixtures.every((f) => f.predictedUserIds.includes(m.userId)),
              ).length

              return (
                <section key={group.key}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-ink">{group.round}</h2>
                      <p className="text-xs text-ink-muted">
                        {group.competitionName} · {roundFixtures.length} fixture
                        {roundFixtures.length !== 1 ? "s" : ""} · from{" "}
                        {group.kickoff.toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <span
                      className={
                        roundFullyPredicted === members.length
                          ? "text-xs font-medium text-pitch"
                          : "rounded-full border border-clock-line bg-clock-tint px-2.5 py-0.5 text-xs font-semibold text-clock"
                      }
                    >
                      {roundFullyPredicted === members.length
                        ? "Everyone picked ✓"
                        : `${members.length - roundFullyPredicted} member${
                            members.length - roundFullyPredicted !== 1 ? "s" : ""
                          } missing picks`}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {roundFixtures.map((f) => {
                      const predictedCount = f.predictedUserIds.length
                      return (
                        <div
                          key={f.id}
                          className="overflow-hidden rounded-xl border border-line bg-surface shadow-card"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">
                                {f.homeTeam}{" "}
                                <span className="font-normal text-ink-faint">vs</span>{" "}
                                {f.awayTeam}
                              </p>
                              <p className="text-xs text-ink-muted">
                                {fixtureKickoffLabel(f.kickoffTime)}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-ink-muted">
                              {predictedCount}/{members.length} picked
                            </span>
                          </div>

                          <ul className="divide-y divide-line-soft">
                            {members.map((m) => {
                              const picked = f.predictedUserIds.includes(m.userId)
                              return (
                                <li
                                  key={m.userId}
                                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                                >
                                  <span className="min-w-0 truncate text-ink">
                                    {m.isBot ? "🤖 " : ""}
                                    {m.displayName}
                                  </span>
                                  <span
                                    className={
                                      picked
                                        ? "shrink-0 font-semibold text-good"
                                        : "shrink-0 font-semibold text-clock"
                                    }
                                  >
                                    {picked ? "Picked ✓" : "Not yet"}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          <div className="mt-10 overflow-x-auto rounded-xl border border-line shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-ground text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-right">Predicted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {members.map((m) => {
                  const c = memberCounts.get(m.userId) ?? { predicted: 0, total: 0 }
                  const complete = c.total > 0 && c.predicted === c.total
                  return (
                    <tr key={m.userId} className="hover:bg-ground transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">
                        {m.isBot ? "🤖 " : ""}
                        {m.displayName}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          complete ? "text-good" : "text-clock"
                        }`}
                      >
                        {c.predicted}/{c.total}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
