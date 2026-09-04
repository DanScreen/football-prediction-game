import Link from "next/link"
import { prisma } from "@/lib/prisma"
import FixtureEditor, { type EditorFixture } from "./FixtureEditor"

export const metadata = { title: "Gameweek editor" }

/**
 * Scoped to one competition at a time. Round labels only mean anything within a
 * competition ("Matchweek 8" exists in each), so a cross-competition list would
 * merge groups that aren't the same gameweek.
 */
export default async function FixtureEditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const requested = typeof params.competition === "string" ? params.competition : undefined

  const competitions = await prisma.competition.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, flag: true },
  })

  if (competitions.length === 0) {
    return (
      <Shell>
        <p className="py-16 text-center text-ink-muted">
          No competitions yet —{" "}
          <Link href="/host/competitions" className="text-pitch hover:underline">
            add one
          </Link>{" "}
          first.
        </p>
      </Shell>
    )
  }

  const selected = competitions.find((c) => c.id === requested) ?? competitions[0]

  const fixtures = await prisma.fixture.findMany({
    where: { competitionId: selected.id },
    orderBy: [{ kickoffTime: "asc" }],
    select: {
      id: true,
      round: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      status: true,
      _count: { select: { predictions: true } },
    },
  })

  const editorFixtures: EditorFixture[] = fixtures.map((f) => ({
    id: f.id,
    round: f.round,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    kickoffIso: f.kickoffTime.toISOString(),
    status: f.status,
    predictionCount: f._count.predictions,
  }))

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap gap-2">
        {competitions.map((c) => (
          <Link
            key={c.id}
            href={`/host/fixtures/editor?competition=${c.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              c.id === selected.id
                ? "bg-pitch text-pitch-on"
                : "border border-line-strong text-ink-mid hover:bg-chip"
            }`}
          >
            {c.flag ? `${c.flag} ` : ""}
            {c.name}
          </Link>
        ))}
      </div>

      {editorFixtures.length === 0 ? (
        <p className="py-16 text-center text-ink-muted">
          No fixtures for {selected.name} yet — use{" "}
          <Link href="/host/import" className="text-pitch hover:underline">
            Import
          </Link>{" "}
          or{" "}
          <Link href="/host/fixtures/new" className="text-pitch hover:underline">
            add one by hand
          </Link>
          .
        </p>
      ) : (
        <FixtureEditor fixtures={editorFixtures} />
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Gameweek editor</h1>
        <Link href="/host/fixtures" className="text-sm font-medium text-pitch hover:underline">
          All fixtures →
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-muted">
        Re-cut gameweeks when a round doesn&apos;t divide evenly: tick fixtures, then move them
        to another gameweek or remove them. Settled fixtures and fixtures carrying predictions
        are protected.
      </p>
      {children}
    </div>
  )
}
