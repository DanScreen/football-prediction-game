import { auth } from "@/auth"
import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { resolveActiveLeagueId } from "@/lib/activeLeague"
import { NOT_ARCHIVED } from "@/lib/peers"
import { computeLeaderboard } from "@/lib/leaderboard"
import { describeStanding, type Standing } from "./standing"
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

  // Where you stand in each league, so a card says more than its name and code.
  const userId = session.user.id
  const standings = new Map<string, Standing | null>(
    await Promise.all(
      memberships.map(
        async (m) =>
          [m.leagueId, describeStanding(await computeLeaderboard(m.leagueId), userId)] as const,
      ),
    ),
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">My Leagues</h1>
      <p className="text-ink-muted text-sm mb-8">
        {memberships.length > 0
          ? "Where you stand in each league you play in."
          : "Create a new league or join one with an invite code."}
      </p>

      {liveMemberships.length > 0 && (
        <div className="space-y-3 mb-10">
          {liveMemberships.map((m) => (
            <LeagueCard
              key={m.leagueId}
              membership={m}
              activeLeagueId={activeLeagueId}
              standing={standings.get(m.leagueId) ?? null}
            />
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
              <LeagueCard
              key={m.leagueId}
              membership={m}
              activeLeagueId={activeLeagueId}
              standing={standings.get(m.leagueId) ?? null}
            />
            ))}
          </div>
        </details>
      )}

      {/* Joining and creating are rare once you're in a league, so they sit behind
          one control instead of taking most of the page. With no leagues they are
          the whole point, so the form is shown outright. */}
      {memberships.length > 0 ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-center rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-pitch-on hover:bg-pitch-deep [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Join or create a league</span>
            <span className="hidden group-open:inline">Close</span>
          </summary>
          <div className="mt-4">
            <LeaguesClient hasLeagues competitions={competitions} />
          </div>
        </details>
      ) : (
        <LeaguesClient hasLeagues={false} competitions={competitions} />
      )}
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
  standing,
}: {
  membership: MembershipCard
  activeLeagueId: string | null
  standing: Standing | null
}) {
  const archived = m.league.competition.archivedAt !== null

  return (
    <div
      className={`bg-surface rounded-xl border shadow-card px-5 py-4 ${
        m.leagueId === activeLeagueId && !archived ? "border-pitch" : "border-line"
      }`}
    >
      {/* Name and where you stand, side by side; everything else runs full width
          underneath so the card holds up at phone width. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink truncate">{m.league.name}</p>
            {archived && (
              <span className="text-xs bg-chip text-ink-muted border border-line rounded-full px-2 py-0.5 font-medium shrink-0">
                Finished
              </span>
            )}
            {m.leagueId === activeLeagueId && m.role === "COMMISSIONER" && !archived && (
              <span className="text-xs bg-good-tint text-good border border-good-line rounded-full px-2 py-0.5 font-medium shrink-0">
                Managing
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted">
            {m.league.competition.name}
            {m.role === "COMMISSIONER" && " · You run this league"}
          </p>
          {standing?.line && <p className="mt-1.5 text-sm text-ink-mid">{standing.line}</p>}
        </div>
        {standing ? (
          <div className="shrink-0 text-right">
            <p className="text-2xl font-extrabold leading-none text-ink">{standing.position}</p>
            <p className="mt-1 text-xs text-ink-muted tabular-nums">
              of {standing.players} · {standing.points} pts
            </p>
          </div>
        ) : (
          <p className="shrink-0 text-xs text-ink-muted">
            {m.league._count.memberships} player{m.league._count.memberships !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/leaderboard${archived ? "?archived=1" : ""}#league-${m.leagueId}`}
          className="text-sm font-semibold text-pitch hover:underline"
        >
          Open table
        </Link>
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
            <button type="submit" className="text-sm font-semibold text-pitch hover:underline">
              Manage →
            </button>
          </form>
        )}
        {/* Any member can invite, not just the commissioner. A finished league
            can't be joined, so its code is noise. */}
        {!archived && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto">
            <span className="text-xs text-ink-faint">
              Code <span className="font-mono font-semibold">{m.league.inviteCode}</span>
            </span>
            <CopyInvite inviteCode={m.league.inviteCode} />
          </span>
        )}
      </div>
    </div>
  )
}
