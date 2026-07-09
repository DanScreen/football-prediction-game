import Link from "next/link"
import { prisma } from "@/lib/prisma"
import FixtureForm from "../FixtureForm"
import { createFixture } from "../actions"

export default async function NewFixturePage() {
  const competitions = await prisma.competition.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, flag: true },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/host/fixtures" className="text-sm text-ink-muted hover:text-ink-mid">
          ← Back to Fixtures
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Add Fixture</h1>
      </div>
      <FixtureForm action={createFixture} competitions={competitions} submitLabel="Add Fixture" />
    </div>
  )
}
