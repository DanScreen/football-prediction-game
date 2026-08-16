import { BANKER_MULTIPLIER, STREAK_TIERS } from "@/lib/scoring"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  return Response.json({
    exact: 3,
    close: 1.5,
    correctResult: 1,
    bankerMultiplier: BANKER_MULTIPLIER,
    // Ascending for the Rules UI (STREAK_TIERS is highest-first for lookup).
    streakTiers: [...STREAK_TIERS]
      .slice()
      .reverse()
      .map((t) => ({ minCorrect: t.minCorrect, points: t.points })),
  })
}
