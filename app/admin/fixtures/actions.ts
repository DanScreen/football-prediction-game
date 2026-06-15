"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/activeLeague"

async function requireCommissioner() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorised")
  const store = await cookies()
  const leagueId = store.get(ACTIVE_LEAGUE_COOKIE)?.value
  if (!leagueId) throw new Error("No active league")
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  })
  if (membership?.role !== "COMMISSIONER") throw new Error("Unauthorised")
  return { userId: session.user.id, leagueId }
}

export type FixtureFormState = { error?: string }

export async function createFixture(
  _prev: FixtureFormState,
  formData: FormData,
): Promise<FixtureFormState> {
  const { leagueId } = await requireCommissioner()

  const competition = String(formData.get("competition") ?? "").trim()
  const round = String(formData.get("round") ?? "").trim()
  const homeTeam = String(formData.get("homeTeam") ?? "").trim()
  const awayTeam = String(formData.get("awayTeam") ?? "").trim()
  const kickoffRaw = String(formData.get("kickoffTime") ?? "").trim()

  if (!competition || !round || !homeTeam || !awayTeam || !kickoffRaw) {
    return { error: "All fields are required." }
  }

  const kickoffTime = new Date(kickoffRaw)
  if (isNaN(kickoffTime.getTime())) {
    return { error: "Invalid kickoff time." }
  }

  await prisma.fixture.create({
    data: { leagueId, competition, round, homeTeam, awayTeam, kickoffTime },
  })

  revalidatePath("/admin/fixtures")
  revalidatePath("/")
  redirect("/admin/fixtures")
}

export async function updateFixture(
  id: string,
  _prev: FixtureFormState,
  formData: FormData,
): Promise<FixtureFormState> {
  const { leagueId } = await requireCommissioner()

  const competition = String(formData.get("competition") ?? "").trim()
  const round = String(formData.get("round") ?? "").trim()
  const homeTeam = String(formData.get("homeTeam") ?? "").trim()
  const awayTeam = String(formData.get("awayTeam") ?? "").trim()
  const kickoffRaw = String(formData.get("kickoffTime") ?? "").trim()

  if (!competition || !round || !homeTeam || !awayTeam || !kickoffRaw) {
    return { error: "All fields are required." }
  }

  const kickoffTime = new Date(kickoffRaw)
  if (isNaN(kickoffTime.getTime())) {
    return { error: "Invalid kickoff time." }
  }

  await prisma.fixture.update({
    where: { id, leagueId },
    data: { competition, round, homeTeam, awayTeam, kickoffTime },
  })

  revalidatePath("/admin/fixtures")
  revalidatePath("/")
  redirect("/admin/fixtures")
}

export async function deleteFixture(id: string): Promise<void> {
  const { leagueId } = await requireCommissioner()
  await prisma.fixture.delete({ where: { id, leagueId } })
  revalidatePath("/admin/fixtures")
  revalidatePath("/")
}
