"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireSiteAdmin } from "@/lib/adminAuth"

export type CompetitionFormState = { error?: string }

function parseForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim()
  const code = String(formData.get("code") ?? "").trim().toUpperCase()
  const flag = String(formData.get("flag") ?? "").trim()
  const isActive = formData.get("isActive") === "on"
  return { name, code: code || null, flag, isActive }
}

export async function createCompetition(
  _prev: CompetitionFormState,
  formData: FormData,
): Promise<CompetitionFormState> {
  await requireSiteAdmin()

  const data = parseForm(formData)
  if (!data.name) return { error: "Name is required." }

  const existing = await prisma.competition.findUnique({ where: { name: data.name } })
  if (existing) return { error: "A competition with that name already exists." }

  await prisma.competition.create({ data })
  revalidatePath("/host/competitions")
  redirect("/host/competitions")
}

export async function updateCompetition(
  id: string,
  _prev: CompetitionFormState,
  formData: FormData,
): Promise<CompetitionFormState> {
  await requireSiteAdmin()

  const data = parseForm(formData)
  if (!data.name) return { error: "Name is required." }

  await prisma.competition.update({ where: { id }, data })
  revalidatePath("/host/competitions")
  redirect("/host/competitions")
}
