import { teamColours } from "@/lib/teamColours"

/**
 * Small two-tone club colour dot shown beside a team name. Club colours are data,
 * so the inline hex is the one allowed exception to the token rule. Unknown teams
 * get a neutral chip rather than a guessed colour.
 */
export default function TeamChip({ team }: { team: string }) {
  const colours = teamColours(team)
  const base = "inline-block h-3.5 w-3.5 shrink-0 rounded-full border-[2.5px]"

  if (!colours) {
    return <span aria-hidden="true" className={`${base} bg-chip border-line-strong`} />
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} ring-1 ring-line-strong`}
      style={{ backgroundColor: colours.primary, borderColor: colours.secondary }}
    />
  )
}
