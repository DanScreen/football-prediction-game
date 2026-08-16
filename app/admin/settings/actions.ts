"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireCommissioner } from "@/lib/adminAuth"
import { generateInviteCode } from "@/lib/inviteCode"

export type SettingsFormState = { error?: string; success?: boolean }

export async function updateLeagueSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { leagueId } = await requireCommissioner()

  const name = String(formData.get("name") ?? "").trim()

  if (!name) return { error: "League name is required." }
  if (name.length > 50) return { error: "League name must be 50 characters or fewer." }

  // The streak bonus replaced the Grand Slam on 2026-08-16 and is platform-wide,
  // so the name is all a commissioner sets here now.
  await prisma.league.update({ where: { id: leagueId }, data: { name } })

  revalidatePath("/admin/settings")
  revalidatePath("/")
  return { success: true }
}

export async function regenerateInviteCode(): Promise<void> {
  const { leagueId } = await requireCommissioner()
  await prisma.league.update({
    where: { id: leagueId },
    data: { inviteCode: generateInviteCode() },
  })
  revalidatePath("/admin/settings")
  revalidatePath("/leagues")
}
