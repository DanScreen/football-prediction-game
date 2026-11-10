import Avatar from "@/app/components/Avatar"
import PointsBadge from "@/app/components/PointsBadge"
import { groupPicksByScore, type PickLike } from "@/lib/groupPicks"

export type GroupablePick = PickLike & {
  id: string
  userId: string
  displayName: string
  isBot: boolean
  avatarUrl: string | null
}

/**
 * League-mates' picks collapsed to one row per scoreline — "1–1: Bob, Marcus,
 * Priya" — instead of one row per player. Listing everyone separately made a
 * gameweek a very long scroll that grew with league size; grouping also answers
 * the real question, which is who called what. A ★ marks a banker.
 *
 * The same layout as the app's read-only fixture card, from the same helper.
 * Pass the viewer's own pick separately: this lists everyone else.
 */
export default function PickGroups({
  picks,
  settled,
}: {
  picks: GroupablePick[]
  /** Unsettled fixtures show no points badge. */
  settled: boolean
}) {
  const groups = groupPicksByScore(picks)
  if (groups.length === 0) return null

  return (
    <ul className="space-y-1.5">
      {groups.map((g) => (
        <li key={`${g.homeScore}-${g.awayScore}`} className="flex items-start gap-3 text-sm">
          <span className="score-digits w-12 shrink-0 font-bold text-ink-mid">
            {g.homeScore} – {g.awayScore}
          </span>
          <span className="min-w-0 flex-1 text-ink-muted">
            {g.picks.map((p, i) => (
              <span key={p.id} className="inline-flex items-center align-top">
                {i > 0 && <span className="mr-1.5">,</span>}
                <Avatar
                  userId={p.userId}
                  displayName={p.displayName}
                  avatarUrl={p.avatarUrl}
                  size="xs"
                  className="mr-1"
                />
                {p.isBot && (
                  <span className="mr-1 text-[10px] font-bold tracking-wider text-ink-faint">BOT</span>
                )}
                {p.displayName}
                {p.isBanker && (
                  <span className="ml-0.5 text-clock" title="Banker — points doubled">
                    <span aria-hidden="true">★</span>
                    <span className="sr-only"> (banker)</span>
                  </span>
                )}
              </span>
            ))}
          </span>
          {settled && g.basePoints !== null && (
            <span className="shrink-0">
              <PointsBadge points={g.basePoints} tone={g.basePoints} />
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
