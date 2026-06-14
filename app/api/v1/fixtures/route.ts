import { type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey } from "@/lib/apiAuth"

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const status = request.nextUrl.searchParams.get("status")

  const fixtures = await prisma.fixture.findMany({
    where:
      status === "open"
        ? { status: "SCHEDULED", kickoffTime: { gt: new Date() } }
        : undefined,
    orderBy: { kickoffTime: "asc" },
    select: {
      id: true,
      competition: true,
      round: true,
      homeTeam: true,
      awayTeam: true,
      kickoffTime: true,
      status: true,
      actualHomeScore: true,
      actualAwayScore: true,
    },
  })

  return Response.json(fixtures)
}
