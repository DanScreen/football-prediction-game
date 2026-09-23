import { prisma } from "@/lib/prisma"

/**
 * Permanently delete a user and everything that belongs to them.
 *
 * Required by App Store guideline 5.1.1(v): an app that lets people create an
 * account must let them delete it from inside the app, not by emailing support.
 * The web profile page and `DELETE /api/mobile/v1/me` both funnel here so the
 * two can't diverge on what "deleted" means.
 *
 * None of the `User` relations declare `onDelete: Cascade`, so the children are
 * removed explicitly, innermost first, inside one transaction — a partial
 * delete would leave a leaderboard row pointing at a user that no longer exists.
 *
 * Leagues themselves survive. A league is a shared object owned by its members
 * collectively; deleting one member's account must not destroy other players'
 * standings. If the leaver was the last member the league is removed too, since
 * nothing can reach it any more — its invite code is the only way in and nobody
 * holds it.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const memberships = await tx.leagueMembership.findMany({
      where: { userId },
      select: { leagueId: true },
    })
    const leagueIds = memberships.map((m) => m.leagueId)

    await tx.prediction.deleteMany({ where: { userId } })
    await tx.bonusAward.deleteMany({ where: { userId } })
    await tx.leagueMembership.deleteMany({ where: { userId } })
    await tx.mobileDeviceToken.deleteMany({ where: { userId } })
    await tx.mobileRefreshToken.deleteMany({ where: { userId } })
    await tx.passwordResetToken.deleteMany({ where: { userId } })
    await tx.emailVerificationToken.deleteMany({ where: { userId } })
    await tx.user.delete({ where: { id: userId } })

    for (const leagueId of leagueIds) {
      const remaining = await tx.leagueMembership.count({ where: { leagueId } })
      if (remaining > 0) continue
      await tx.bonusAward.deleteMany({ where: { leagueId } })
      await tx.league.delete({ where: { id: leagueId } })
    }
  })
}
