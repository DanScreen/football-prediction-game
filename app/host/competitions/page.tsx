import { prisma } from "@/lib/prisma"
import CompetitionForm from "./CompetitionForm"
import { createCompetition, updateCompetition } from "./actions"

export default async function HostCompetitionsPage() {
  const competitions = await prisma.competition.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { leagues: true, fixtures: true } } },
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">Competitions</h1>
      <p className="text-ink-muted text-sm mb-6">
        Platform-wide competitions that leagues subscribe to. Fixtures and results are managed
        once per competition and shared by every league on it.
      </p>

      <div className="space-y-4 mb-10">
        {competitions.map((c) => (
          <details
            key={c.id}
            className="bg-surface rounded-xl border border-line shadow-card overflow-hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4">
              <span className="flex items-center gap-2 font-semibold text-ink">
                {c.flag && <span>{c.flag}</span>}
                {c.name}
                {c.code ? (
                  <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-medium text-ink-muted">
                    {c.code}
                  </span>
                ) : (
                  <span className="rounded-full bg-clock-tint px-2 py-0.5 text-xs font-medium text-clock">
                    manual only
                  </span>
                )}
                {!c.isActive && (
                  <span className="rounded-full bg-bad-tint px-2 py-0.5 text-xs font-medium text-bad">
                    inactive
                  </span>
                )}
              </span>
              <span className="text-xs text-ink-muted">
                {c._count.leagues} league{c._count.leagues !== 1 ? "s" : ""} ·{" "}
                {c._count.fixtures} fixture{c._count.fixtures !== 1 ? "s" : ""}
              </span>
            </summary>
            <div className="border-t border-line-soft px-5 py-4">
              <CompetitionForm
                action={updateCompetition.bind(null, c.id)}
                defaultValues={{
                  name: c.name,
                  code: c.code ?? "",
                  flag: c.flag,
                  isActive: c.isActive,
                }}
                submitLabel="Save Changes"
              />
            </div>
          </details>
        ))}
      </div>

      <div className="bg-surface rounded-xl border border-line shadow-card px-5 py-4">
        <h2 className="font-semibold text-ink mb-4">Add Competition</h2>
        <CompetitionForm action={createCompetition} submitLabel="Add Competition" />
      </div>
    </div>
  )
}
