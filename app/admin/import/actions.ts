"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { lookupFixtures } from "@/lib/ai"
import type { ProposedFixture } from "@/lib/ai"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.isAdmin) throw new Error("Unauthorised")
}

export type FetchProposalState = {
  error?: string
  proposed?: { competition: string; round: string; fixtures: ProposedFixture[] }
}

export async function fetchImportProposal(
  _prev: FetchProposalState,
  formData: FormData,
): Promise<FetchProposalState> {
  await requireAdmin()

  const competition = String(formData.get("competition") ?? "").trim()
  const round = String(formData.get("round") ?? "").trim()
  const season = String(formData.get("season") ?? "").trim()

  if (!competition || !round || !season) return { error: "All fields are required." }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY is not configured." }
  }

  try {
    const fixtures = await lookupFixtures(competition, round, season)
    if (fixtures.length === 0) {
      return { error: "AI found no fixtures. Try rephrasing the competition or round name." }
    }
    return { proposed: { competition, round, fixtures } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI lookup failed." }
  }
}

export type ConfirmImportState = { error?: string }

export async function confirmImport(
  _prev: ConfirmImportState,
  formData: FormData,
): Promise<ConfirmImportState> {
  await requireAdmin()

  const competition = String(formData.get("competition") ?? "").trim()
  const round = String(formData.get("round") ?? "").trim()
  const rawFixtures = String(formData.get("fixtures") ?? "")

  if (!competition || !round || !rawFixtures) return { error: "Missing required data." }

  let fixtures: ProposedFixture[]
  try {
    fixtures = JSON.parse(rawFixtures) as ProposedFixture[]
  } catch {
    return { error: "Invalid fixture data." }
  }

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return { error: "No fixtures selected." }
  }

  for (const f of fixtures) {
    const kickoffTime = new Date(f.kickoffTime)
    if (isNaN(kickoffTime.getTime())) {
      return { error: `Invalid kickoff time for ${f.homeTeam} vs ${f.awayTeam}.` }
    }
    await prisma.fixture.create({
      data: { competition, round, homeTeam: f.homeTeam, awayTeam: f.awayTeam, kickoffTime },
    })
  }

  revalidatePath("/admin/fixtures")
  revalidatePath("/")
  redirect("/admin/fixtures")
}
