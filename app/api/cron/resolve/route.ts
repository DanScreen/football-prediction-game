import { runResolutionSweep } from "@/lib/resolution"
import { sendDeadlineReminders } from "@/lib/reminders"

/**
 * Called by Cloud Scheduler (see terraform/scheduler.tf). Imports upcoming
 * fixtures for active competitions, moves due fixtures to AWAITING_RESULT,
 * pre-fetches proposed scores for host confirmation, and emails deadline
 * reminders to members who haven't predicted yet.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const resolution = await runResolutionSweep()
  const reminders = await sendDeadlineReminders()
  return Response.json({ ...resolution, reminders })
}
