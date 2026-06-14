"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.isAdmin) throw new Error("Unauthorised")
}

export type FixtureFormState = { error?: string }

export async function createFixture(
  _prev: FixtureFormState,
  formData: FormData
): Promise<FixtureFormState> {
  await requireAdmin()

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
    data: { competition, round, homeTeam, awayTeam, kickoffTime },
  })

  revalidatePath("/admin/fixtures")
  revalidatePath("/")
  redirect("/admin/fixtures")
}

export async function updateFixture(
  id: string,
  _prev: FixtureFormState,
  formData: FormData
): Promise<FixtureFormState> {
  await requireAdmin()

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
    where: { id },
    data: { competition, round, homeTeam, awayTeam, kickoffTime },
  })

  revalidatePath("/admin/fixtures")
  revalidatePath("/")
  redirect("/admin/fixtures")
}

export async function deleteFixture(id: string): Promise<void> {
  await requireAdmin()
  await prisma.fixture.delete({ where: { id } })
  revalidatePath("/admin/fixtures")
  revalidatePath("/")
}
