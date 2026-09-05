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
  const archived = formData.get("archived") === "on"
  return { name, code: code || null, flag, isActive, archived }
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

  const { archived, ...fields } = data
  await prisma.competition.create({
    data: { ...fields, archivedAt: archived ? new Date() : null },
  })
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

  const current = await prisma.competition.findUnique({
    where: { id },
    select: { archivedAt: true },
  })
  if (!current) return { error: "That competition no longer exists." }

  // Keep the original archive date when a competition stays finished, so
  // re-saving the form for an unrelated edit doesn't restamp it as finished today.
  const { archived, ...fields } = data
  await prisma.competition.update({
    where: { id },
    data: { ...fields, archivedAt: archived ? (current.archivedAt ?? new Date()) : null },
  })

  // Archiving changes what every player sees, not just this host page.
  revalidatePath("/", "layout")
  revalidatePath("/host/competitions")
  redirect("/host/competitions")
}
