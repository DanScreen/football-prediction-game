import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { lookupAndConfirmResult, confirmResult } from "../actions"
import { canEnterResult } from "@/lib/resultsHost"
import ConfirmResultForm from "./ConfirmResultForm"

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fixture = await prisma.fixture.findUnique({
    where: { id },
    include: { competition: { select: { name: true } } },
  })
  if (!fixture) notFound()
  if (!canEnterResult(fixture.status)) redirect("/host/results")

  const apiEnabled = Boolean(process.env.FOOTBALL_DATA_API_KEY)
  const editing = fixture.status === "COMPLETED"

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">
        {editing ? "Edit Result" : "Enter Result"}
      </h1>
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
        {editing && fixture.actualHomeScore !== null && fixture.actualAwayScore !== null && (
          <p className="text-center text-sm text-ink-muted mt-3">
            Current result:{" "}
            <span className="score-digits font-bold text-ink">
              {fixture.actualHomeScore} – {fixture.actualAwayScore}
            </span>
          </p>
        )}
      </div>

      {editing && (
        <p className="text-sm text-ink-muted mb-4">
          Saving a new score re-scores every prediction on this fixture and updates streak
          bonuses for the round.
        </p>
      )}

      <ConfirmResultForm
        fixtureId={fixture.id}
        homeTeam={fixture.homeTeam}
        awayTeam={fixture.awayTeam}
        apiEnabled={apiEnabled && !editing}
        initialHome={editing ? fixture.actualHomeScore : null}
        initialAway={editing ? fixture.actualAwayScore : null}
        editing={editing}
        lookupAndConfirmResult={lookupAndConfirmResult}
        confirmResult={confirmResult}
      />
    </div>
  )
}
