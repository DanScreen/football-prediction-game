import { prisma } from "@/lib/prisma"
import { touchLastSeen } from "@/lib/lastSeen"

/** Where a visit came from: the website, the native app, or the bot API. */
export type ActivitySurface = "web" | "app" | "api"

/**
 * The day visits started being recorded. Activity before it was reconstructed
 * by the migration from picks, sign-ups and league joins, so it undercounts
 * visits that didn't change anything.
 */
export const ACTIVITY_TRACKING_STARTED = "2026-11-23"

/** Analytics days are Europe/London calendar days, the timezone the game is played in. */
export const ACTIVITY_TIME_ZONE = "Europe/London"

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ACTIVITY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** The London calendar day of `now` as `YYYY-MM-DD`. */
export function activityDayKey(now: Date): string {
  return dayFormatter.format(now)
}

/** The London calendar day of `now` as a UTC-midnight Date, which is how a `@db.Date` column round-trips. */
export function activityDay(now: Date): Date {
  return new Date(`${activityDayKey(now)}T00:00:00.000Z`)
}

// userId:surface → the day already recorded by this instance. A Cloud Run
// instance sees the same user many times a day; only the first visit per
// surface writes. Cleared wholesale when it grows, which only costs a few
// redundant (idempotent) upserts.
const recorded = new Map<string, string>()
const MAX_MEMO = 10_000

/** Test hook: forget what this instance has recorded. */
export function resetActivityMemo(): void {
  recorded.clear()
}

/**
 * Marks `userId` as active today on `surface`. Idempotent and cheap to call on
 * every request: after the first call per user/surface/day it's a map lookup.
 * The first call of the day also bumps `lastSeenAt` (itself throttled), so
 * long-lived web sessions that never log in again still count as present.
 *
 * Never throws — analytics must not break a page or an API call.
 */
export async function recordActivity(
  userId: string,
  surface: ActivitySurface,
  now = new Date(),
): Promise<void> {
  const key = `${userId}:${surface}`
  const dayKey = activityDayKey(now)
  if (recorded.get(key) === dayKey) return
  if (recorded.size >= MAX_MEMO) recorded.clear()
  recorded.set(key, dayKey)

  try {
    const day = activityDay(now)
    await prisma.userActivityDay.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, [surface]: true },
      update: { [surface]: true },
    })
    await touchLastSeen(userId, now)
  } catch (error) {
    // Let the next request retry rather than losing the day.
    recorded.delete(key)
    console.error("[activity] failed to record", surface, error)
  }
}
