"use server"

import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { deleteUserAccount } from "@/lib/accountDeletion"

export async function regenerateApiKey() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")

  const newKey = crypto.randomUUID()
  await prisma.user.update({
    where: { id: session.user.id },
    data: { apiKey: newKey },
  })
  revalidatePath("/profile")
}

export type DeleteAccountState = { error?: string }

/**
 * Wipe the signed-in account. Gated on the user typing their own email back,
 * because this is irreversible and there is no undo or grace period — the App
 * Store requires the deletion to be real, not a deactivation.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")

  const confirmation = String(formData.get("confirmEmail") ?? "").trim()
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  })
  if (!user) throw new Error("Not authenticated")

  if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
    return { error: "That does not match your email address." }
  }

  await deleteUserAccount(session.user.id)
  // The session cookie still names a user row that is gone, so clear it before
  // anything tries to load the profile again.
  await signOut({ redirect: false })
  redirect("/login?deleted=1")
}
