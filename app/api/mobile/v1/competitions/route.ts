import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError } from "@/lib/mobileHttp"

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const competitions = await prisma.competition.findMany({
    where: { isActive: true, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return Response.json(competitions)
}
