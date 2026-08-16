import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { resolveActiveLeagueId } from "@/lib/activeLeague"
import LeaguesClient from "./LeaguesClient"

export const metadata = { title: "My Leagues" }

export default async function LeaguesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Resolved, not the raw cookie, so the "Active" badge matches the league the rest
  // of the app is actually using when no cookie has been written yet.
  const activeLeagueId = await resolveActiveLeagueId(session.user.id)

  const [memberships, competitions] = await Promise.all([
    prisma.leagueMembership.findMany({
      where: { userId: session.user.id },
      include: {
        league: {
          include: {
            competition: { select: { name: true } },
            _count: { select: { memberships: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.competition.findMany({
      where: { isActive: true },
      select: { id: true, name: true, flag: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">My Leagues</h1>
      <p className="text-ink-muted text-sm mb-8">
        Create a new league or join one with an invite code.
      </p>

      {memberships.length > 0 && (
        <div className="space-y-3 mb-10">
          {memberships.map((m) => (
            <div
              key={m.leagueId}
              className={`bg-surface rounded-xl border shadow-card px-5 py-4 flex items-center justify-between gap-4 ${
                m.leagueId === activeLeagueId ? "border-pitch" : "border-line"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-ink truncate">{m.league.name}</p>
                  {m.role === "COMMISSIONER" && (
                    <span className="text-xs bg-clock-tint text-clock border border-clock-line rounded-full px-2 py-0.5 font-medium shrink-0">
                      Commissioner
                    </span>
                  )}
                  {m.leagueId === activeLeagueId && (
                    <span className="text-xs bg-good-tint text-good border border-good-line rounded-full px-2 py-0.5 font-medium shrink-0">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted">
                  <span className="mr-2">{m.league.competition.name}</span>
                  {m.league._count.memberships} member{m.league._count.memberships !== 1 ? "s" : ""}
                  {" · "}
                  Code: <span className="font-mono font-semibold">{m.league.inviteCode}</span>
                </p>
              </div>
              {m.leagueId !== activeLeagueId && (
                <form action={async () => {
                  "use server"
                  const { selectLeague } = await import("./actions")
                  await selectLeague(m.leagueId)
                }}>
                  <button
                    type="submit"
                    className="text-sm text-pitch font-semibold hover:underline shrink-0"
                  >
                    Switch →
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <LeaguesClient hasLeagues={memberships.length > 0} competitions={competitions} />
    </div>
  )
}
