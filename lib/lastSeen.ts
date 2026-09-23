import { prisma } from "@/lib/prisma"

/** At most one lastSeenAt write per user inside this window. */
export const LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000

/**
 * Bumps `User.lastSeenAt` if it is null or older than the throttle window.
 * Uses a conditional `updateMany` so concurrent calls don't race into a
 * read-then-write. Safe to call from hot paths (login, predictions, mobile refresh).
 */
export async function touchLastSeen(userId: string, now = new Date()): Promise<void> {
  const threshold = new Date(now.getTime() - LAST_SEEN_THROTTLE_MS)
  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }],
    },
    data: { lastSeenAt: now },
  })
}
