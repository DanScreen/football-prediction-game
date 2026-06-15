import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { lookupResult, confirmResult } from "../actions"
import ConfirmResultForm from "./ConfirmResultForm"

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fixture = await prisma.fixture.findUnique({ where: { id } })
  if (!fixture) notFound()

  const apiEnabled = Boolean(process.env.FOOTBALL_DATA_API_KEY)

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Enter Result</h1>
      <p className="text-gray-500 text-sm mb-6">
        {fixture.competition} · {fixture.round}
      </p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <p className="text-center text-xl font-semibold text-gray-900">
          {fixture.homeTeam} <span className="text-gray-400 mx-2">vs</span> {fixture.awayTeam}
        </p>
        <p className="text-center text-gray-500 text-sm mt-1">
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
        lookupResult={lookupResult}
        confirmResult={confirmResult}
      />
    </div>
  )
}
