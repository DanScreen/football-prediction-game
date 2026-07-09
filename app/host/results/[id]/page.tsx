import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { lookupResult, confirmResult } from "../actions"
import ConfirmResultForm from "./ConfirmResultForm"

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fixture = await prisma.fixture.findUnique({
    where: { id },
    include: { competition: { select: { name: true } } },
  })
  if (!fixture) notFound()

  const apiEnabled = Boolean(process.env.FOOTBALL_DATA_API_KEY)

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">Enter Result</h1>
      <p className="text-ink-muted text-sm mb-6">
        {fixture.competition.name} · {fixture.round}
      </p>

      <div className="bg-surface rounded-xl border border-line shadow-card p-5 mb-6">
        <p className="text-center text-xl font-semibold text-ink">
          {fixture.homeTeam} <span className="text-ink-faint mx-2">vs</span> {fixture.awayTeam}
        </p>
        <p className="text-center text-ink-muted text-sm mt-1">
          {new Date(fixture.kickoffTime).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <ConfirmResultForm
        fixtureId={fixture.id}
        homeTeam={fixture.homeTeam}
        awayTeam={fixture.awayTeam}
        apiEnabled={apiEnabled}
        initialProposed={
          fixture.proposedHomeScore !== null && fixture.proposedAwayScore !== null
            ? { homeScore: fixture.proposedHomeScore, awayScore: fixture.proposedAwayScore }
            : undefined
        }
        lookupResult={lookupResult}
        confirmResult={confirmResult}
      />
    </div>
  )
}
