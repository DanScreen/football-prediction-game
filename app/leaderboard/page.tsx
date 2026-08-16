import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import LeagueBoard, { FORM_LEGEND } from "./LeagueBoard"

export const metadata = { title: "Leaderboard" }

/**
 * Every league the user belongs to, stacked one after another.
 *
 * Standings are the one surface that is genuinely per-league — predictions are
 * shared across all leagues on a competition — so this is where seeing several
 * at once is worth the page length. It also removes the need to switch the
 * "active league" just to look at a different table.
 */
export default async function LeaderboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      league: {
        select: { id: true, name: true, competition: { select: { name: true } } },
      },
    },
  })

  if (memberships.length === 0) redirect("/leagues")

  const leagues = memberships.map((m) => m.league)
  const multiple = leagues.length > 1

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">
        {multiple ? "Leaderboards" : leagues[0].name}
      </h1>
      <p className="text-ink-muted text-sm mb-6">
        {multiple
          ? `Standings across your ${leagues.length} leagues.`
          : leagues[0].competition.name}
      </p>

      {/* With several tables the page gets long, so offer a jump list. */}
      {multiple && (
        <nav aria-label="Jump to league" className="mb-6 flex flex-wrap gap-2">
          {leagues.map((l) => (
            <a
              key={l.id}
              href={`#league-${l.id}`}
              className="rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-mid transition-colors hover:bg-chip"
            >
              {l.name}
            </a>
          ))}
        </nav>
      )}

      <div className="space-y-10">
        {leagues.map((l) => (
          <LeagueBoard
            key={l.id}
            leagueId={l.id}
            leagueName={l.name}
            competitionName={l.competition.name}
            currentUserId={userId}
            showHeading={multiple}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-ink-muted">
        <span className="font-semibold text-ink-mid">
          Form key <span className="font-normal">(oldest → newest)</span>:
        </span>
        {(
          [
            ["strong", ">40% of pts"],
            ["mixed", "21–40%"],
            ["poor", "≤20%"],
            ["none", "No picks"],
          ] as const
        ).map(([tier, label]) => (
          <span key={tier} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[8px] leading-none ${FORM_LEGEND[tier].class}`}
            >
              {FORM_LEGEND[tier].glyph}
            </span>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
