import Link from "next/link"

/**
 * Shown on a core page when every league the viewer belongs to sits on a
 * competition a host has declared finished. Distinct from the "join a league"
 * empty state — these players *have* leagues, there is just nothing live in
 * them, and their history is still one click away.
 */
export default function ArchivedOnlyNotice({
  title,
  leagueNames,
}: {
  title: string
  leagueNames: string[]
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <p className="text-5xl mb-4">🏁</p>
      <h1 className="text-2xl font-bold text-ink mb-2">{title}</h1>
      <p className="text-ink-muted mb-2">
        {leagueNames.length === 1
          ? `${leagueNames[0]} is on a competition that has finished.`
          : `Your ${leagueNames.length} leagues are all on competitions that have finished.`}{" "}
        Their results and final standings are still there.
      </p>
      <Link
        href="/leagues"
        className="mt-6 inline-block bg-pitch text-pitch-on px-6 py-3 rounded-xl font-semibold shadow-card hover:bg-pitch-deep transition-colors"
      >
        View finished leagues →
      </Link>
      <p className="mt-6 text-sm text-ink-muted">
        Ready for the next one?{" "}
        <Link href="/leagues" className="font-medium text-pitch hover:underline">
          Create or join a league
        </Link>
      </p>
    </div>
  )
}
