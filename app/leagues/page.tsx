import { auth } from "@/auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { resolveActiveLeagueId } from "@/lib/activeLeague"
import { NOT_ARCHIVED } from "@/lib/peers"
import LeaguesClient from "./LeaguesClient"
import CopyInvite from "@/app/components/CopyInvite"

export const metadata = { title: "My Leagues" }

export default async function LeaguesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Since predictions and leaderboards now cover every league at once, this only
  // marks which league the commissioner area manages.
  const activeLeagueId = await resolveActiveLeagueId(session.user.id)

  const [memberships, competitions] = await Promise.all([
    prisma.leagueMembership.findMany({
      where: { userId: session.user.id },
      include: {
        league: {
          include: {
            competition: { select: { name: true, archivedAt: true } },
            _count: { select: { memberships: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.competition.findMany({
      where: { isActive: true, ...NOT_ARCHIVED },
      select: { id: true, name: true, flag: true },
      orderBy: { name: "asc" },
    }),
  ])

  const liveMemberships = memberships.filter((m) => m.league.competition.archivedAt === null)
  const archivedMemberships = memberships.filter((m) => m.league.competition.archivedAt !== null)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">My Leagues</h1>
      <p className="text-ink-muted text-sm mb-8">
        Create a new league or join one with an invite code.
      </p>

      {liveMemberships.length > 0 && (
        <div className="space-y-3 mb-10">
          {liveMemberships.map((m) => (
            <LeagueCard key={m.leagueId} membership={m} activeLeagueId={activeLeagueId} />
          ))}
        </div>
      )}

      {/* Finished competitions leave the core pages but keep their history, so
          this is where you go back to a completed season. */}
      {archivedMemberships.length > 0 && (
        <details className="mb-10 rounded-xl border border-line bg-surface/50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink-mid">
            Finished leagues ({archivedMemberships.length})
          </summary>
          <p className="mt-1 mb-3 text-xs text-ink-muted">
            These competitions are over. Predictions and results are closed, but the final
            standings are still on the{" "}
            <Link href="/leaderboard?archived=1" className="font-medium text-pitch hover:underline">
              leaderboard
            </Link>
            .
          </p>
          <div className="space-y-3">
            {archivedMemberships.map((m) => (
              <LeagueCard key={m.leagueId} membership={m} activeLeagueId={activeLeagueId} />
            ))}
          </div>
        </details>
      )}

      <LeaguesClient hasLeagues={memberships.length > 0} competitions={competitions} />
    </div>
  )
}

type MembershipCard = {
  leagueId: string
  role: string
  league: {
    name: string
    inviteCode: string
    competition: { name: string; archivedAt: Date | null }
    _count: { memberships: number }
  }
}

function LeagueCard({
  membership: m,
  activeLeagueId,
}: {
  membership: MembershipCard
  activeLeagueId: string | null
}) {
  const archived = m.league.competition.archivedAt !== null

  return (
    <div
      className={`bg-surface rounded-xl border shadow-card px-5 py-4 flex items-center justify-between gap-4 ${
        m.leagueId === activeLeagueId && !archived ? "border-pitch" : "border-line"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-bold text-ink truncate">{m.league.name}</p>
          {archived && (
            <span className="text-xs bg-chip text-ink-muted border border-line rounded-full px-2 py-0.5 font-medium shrink-0">
              Finished
            </span>
          )}
          {m.role === "COMMISSIONER" && (
            <span className="text-xs bg-clock-tint text-clock border border-clock-line rounded-full px-2 py-0.5 font-medium shrink-0">
              Commissioner
            </span>
          )}
          {m.leagueId === activeLeagueId && m.role === "COMMISSIONER" && !archived && (
            <span className="text-xs bg-good-tint text-good border border-good-line rounded-full px-2 py-0.5 font-medium shrink-0">
              Managing
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          <span className="mr-2">{m.league.competition.name}</span>
          {m.league._count.memberships} member{m.league._count.memberships !== 1 ? "s" : ""}
          {/* A finished league can't be joined, so its code is noise. */}
          {!archived && (
            <>
              {" · "}
              Code: <span className="font-mono font-semibold">{m.league.inviteCode}</span>
            </>
          )}
        </p>
        {/* Any member can invite, not just the commissioner. */}
        {!archived && <CopyInvite inviteCode={m.league.inviteCode} className="mt-2" />}
      </div>
      {/* Only commissioners have anything to switch *to* — predictions and
          leaderboards already cover every league at once. */}
      {m.leagueId !== activeLeagueId && m.role === "COMMISSIONER" && !archived && (
        <form
          action={async () => {
            "use server"
            const { selectLeague } = await import("./actions")
            await selectLeague(m.leagueId)
          }}
        >
          <button type="submit" className="text-sm text-pitch font-semibold hover:underline shrink-0">
            Manage →
          </button>
        </form>
      )}
    </div>
  )
}
