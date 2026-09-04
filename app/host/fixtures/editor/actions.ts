"use server"

import { revalidatePath } from "next/cache"
import { requireSiteAdmin } from "@/lib/adminAuth"
import {
  deleteFixtures as deleteFixturesInDb,
  reassignRound as reassignRoundInDb,
  type FixtureAdminResult,
} from "@/lib/fixtureAdmin"

export type EditorState = FixtureAdminResult | Record<string, never>

function refresh() {
  revalidatePath("/host/fixtures/editor")
  revalidatePath("/host/fixtures")
  revalidatePath("/")
}

export async function reassignRound(
  _prev: EditorState,
  formData: FormData,
): Promise<EditorState> {
  await requireSiteAdmin()

  const fixtureIds = formData.getAll("fixtureId").map(String)
  const round = String(formData.get("round") ?? "")

  const result = await reassignRoundInDb(fixtureIds, round)
  if (result.ok) refresh()
  return result
}

export async function deleteFixtures(
  _prev: EditorState,
  formData: FormData,
): Promise<EditorState> {
  await requireSiteAdmin()

  const fixtureIds = formData.getAll("fixtureId").map(String)

  const result = await deleteFixturesInDb(fixtureIds)
  if (result.ok) refresh()
  return result
}
