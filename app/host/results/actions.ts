"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { lookupResult as fetchResult } from "@/lib/footballData"
import { ResultSource } from "@/app/generated/prisma/client"
import { requireSiteAdmin } from "@/lib/adminAuth"
import { transitionDueFixtures, fetchProposals } from "@/lib/resolution"
import { confirmFixtureResult, acceptAllProposed } from "@/lib/results"

export type ResultFormState = {
  error?: string
  proposed?: { homeScore: number; awayScore: number }
}

/** Move due fixtures to AWAITING_RESULT and pre-fetch proposals, platform-wide */
export async function checkTransitions(): Promise<void> {
  await requireSiteAdmin()
  await transitionDueFixtures()
  await fetchProposals().catch(() => {}) // best-effort; manual lookup remains available
  revalidatePath("/host/results")
}

/** Confirm every fixture with a proposed score in one click */
export async function acceptAllAction(): Promise<void> {
  await requireSiteAdmin()
  await acceptAllProposed()
  revalidatePath("/host/results")
  revalidatePath("/")
}

/** API lookup — returns proposed score in form state without saving anything */
export async function lookupResult(
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  await requireSiteAdmin()

  const fixtureId = String(formData.get("fixtureId") ?? "")
  if (!fixtureId) return { error: "Missing fixture ID." }

  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return { error: "FOOTBALL_DATA_API_KEY is not configured — use manual entry." }
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: { competition: { select: { code: true, name: true } } },
  })
  if (!fixture) return { error: "Fixture not found." }
  if (!fixture.competition.code) {
    return { error: `${fixture.competition.name} has no football-data.org code — use manual entry.` }
  }

  try {
    const result = await fetchResult(
      fixture.homeTeam,
      fixture.awayTeam,
      fixture.competition.code,
      fixture.kickoffTime,
    )
    return { proposed: result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Result lookup failed." }
  }
}

/** Confirm result: save scores, score predictions, fan out Grand Slam per league */
export async function confirmResult(
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  await requireSiteAdmin()

  const fixtureId = String(formData.get("fixtureId") ?? "")
  const homeStr = String(formData.get("homeScore") ?? "").trim()
  const awayStr = String(formData.get("awayScore") ?? "").trim()
  const sourceRaw = String(formData.get("source") ?? "MANUAL")

  if (!fixtureId) return { error: "Missing fixture ID." }
  if (!homeStr || !awayStr) return { error: "Please enter both scores." }
  const homeRaw = Number(homeStr)
  const awayRaw = Number(awayStr)
  if (!Number.isInteger(homeRaw) || !Number.isInteger(awayRaw) || homeRaw < 0 || awayRaw < 0) {
    return { error: "Scores must be non-negative whole numbers." }
  }

  const source = sourceRaw === "AI_CONFIRMED" ? ResultSource.AI_CONFIRMED : ResultSource.MANUAL

  await confirmFixtureResult(fixtureId, homeRaw, awayRaw, source)

  revalidatePath("/host/results")
  revalidatePath("/")
  redirect("/host/results")
}
