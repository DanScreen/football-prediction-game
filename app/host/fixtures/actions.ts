"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireSiteAdmin } from "@/lib/adminAuth"

export type FixtureFormState = { error?: string }

function parseForm(formData: FormData) {
  const competitionId = String(formData.get("competitionId") ?? "").trim()
  const round = String(formData.get("round") ?? "").trim()
  const homeTeam = String(formData.get("homeTeam") ?? "").trim()
  const awayTeam = String(formData.get("awayTeam") ?? "").trim()
  const kickoffRaw = String(formData.get("kickoffTime") ?? "").trim()
  return { competitionId, round, homeTeam, awayTeam, kickoffRaw }
}

export async function createFixture(
  _prev: FixtureFormState,
  formData: FormData,
): Promise<FixtureFormState> {
  await requireSiteAdmin()

  const { competitionId, round, homeTeam, awayTeam, kickoffRaw } = parseForm(formData)
  if (!competitionId || !round || !homeTeam || !awayTeam || !kickoffRaw) {
    return { error: "All fields are required." }
  }

  const kickoffTime = new Date(kickoffRaw)
  if (isNaN(kickoffTime.getTime())) {
    return { error: "Invalid kickoff time." }
  }

  await prisma.fixture.create({
    data: { competitionId, round, homeTeam, awayTeam, kickoffTime },
  })

  revalidatePath("/host/fixtures")
  revalidatePath("/")
  redirect("/host/fixtures")
}

export async function updateFixture(
  id: string,
  _prev: FixtureFormState,
  formData: FormData,
): Promise<FixtureFormState> {
  await requireSiteAdmin()

  const { competitionId, round, homeTeam, awayTeam, kickoffRaw } = parseForm(formData)
  if (!competitionId || !round || !homeTeam || !awayTeam || !kickoffRaw) {
    return { error: "All fields are required." }
  }

  const kickoffTime = new Date(kickoffRaw)
  if (isNaN(kickoffTime.getTime())) {
    return { error: "Invalid kickoff time." }
  }

  await prisma.fixture.update({
    where: { id },
    data: { competitionId, round, homeTeam, awayTeam, kickoffTime },
  })

  revalidatePath("/host/fixtures")
  revalidatePath("/")
  redirect("/host/fixtures")
}

export async function deleteFixture(id: string): Promise<void> {
  await requireSiteAdmin()
  await prisma.fixture.delete({ where: { id } })
  revalidatePath("/host/fixtures")
  revalidatePath("/")
}
