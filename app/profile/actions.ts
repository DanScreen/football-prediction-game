"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

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
