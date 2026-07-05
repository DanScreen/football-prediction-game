import { runResolutionSweep } from "@/lib/resolution"

/**
 * Called by Cloud Scheduler (see terraform/scheduler.tf). Moves due fixtures to
 * AWAITING_RESULT and pre-fetches proposed scores for Commissioner confirmation.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await runResolutionSweep()
  return Response.json(summary)
}
