import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import FixtureForm from "../../FixtureForm"
import { updateFixture } from "../../actions"

export default async function EditFixturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fixture = await prisma.fixture.findUnique({ where: { id } })
  if (!fixture) notFound()

  const kickoffLocal = new Date(fixture.kickoffTime.getTime() - fixture.kickoffTime.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  const boundUpdate = updateFixture.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin/fixtures" className="text-sm text-ink-muted hover:text-ink-mid">
          ← Back to Fixtures
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Edit Fixture</h1>
        <p className="text-ink-muted text-sm mt-0.5">
          {fixture.homeTeam} vs {fixture.awayTeam}
        </p>
      </div>
      <FixtureForm
        action={boundUpdate}
        defaultValues={{
          competition: fixture.competition,
          round: fixture.round,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          kickoffTime: kickoffLocal,
        }}
        submitLabel="Save Changes"
      />
    </div>
  )
}
