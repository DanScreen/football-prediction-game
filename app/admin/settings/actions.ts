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
  const grandSlamEnabled = formData.get("grandSlamEnabled") === "on"
  // The points input doesn't submit while the toggle is off (disabled input)
  const pointsStr = String(formData.get("grandSlamPoints") ?? "").trim()
  const grandSlamPoints = Number(pointsStr)

  if (!name) return { error: "League name is required." }
  if (name.length > 50) return { error: "League name must be 50 characters or fewer." }
  const pointsValid =
    pointsStr !== "" && Number.isInteger(grandSlamPoints) && grandSlamPoints >= 1 && grandSlamPoints <= 20
  if (grandSlamEnabled && !pointsValid) {
    return { error: "Grand Slam points must be a whole number between 1 and 20." }
  }

  await prisma.league.update({
    where: { id: leagueId },
    data: { name, grandSlamEnabled, ...(pointsValid ? { grandSlamPoints } : {}) },
  })

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
