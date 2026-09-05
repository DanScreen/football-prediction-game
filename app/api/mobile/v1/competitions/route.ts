import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const competitions = await prisma.competition.findMany({
    where: { isActive: true, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return Response.json(competitions)
}
