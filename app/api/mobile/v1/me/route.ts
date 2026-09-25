import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"
import { deleteUserAccount } from "@/lib/accountDeletion"
import { changeUnverifiedEmail, ensureVerificationEmailSent } from "@/lib/emailVerification"

// Not gated on email verification: this is how the app learns the account is
// unverified (and, after the link is clicked, that it now is).

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  // The app's verify screen says "tap the link we emailed" without asking for
  // one, and this fetch is what puts the app on that screen — so make it true.
  if (!user.emailVerified) await ensureVerificationEmailSent(user.id)

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      league: {
        select: {
          id: true,
          name: true,
          competitionId: true,
          competition: { select: { name: true } },
        },
      },
    },
  })

  return Response.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isBot: user.isBot,
    emailVerified: user.emailVerified,
    leagues: memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      role: m.role,
      competitionId: m.league.competitionId,
      competitionName: m.league.competition.name,
    })),
  })
}

/**
 * Correct a mistyped address before verifying it — `{ email }`. Only allowed
 * while unverified (see `changeUnverifiedEmail`); a verified address stays put.
 * Sends a fresh link to the new address.
 */
export async function PATCH(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const result = await changeUnverifiedEmail(user.id, parsed.body.email)
  if (!result.email) return jsonError(result.error ?? "Couldn't update your email.", 400)

  // Changed, but the link may not have gone out — the app shows `warning` and
  // the user can resend.
  return Response.json({
    email: result.email,
    emailVerified: false,
    ...(result.error ? { warning: result.error } : {}),
  })
}

/**
 * Permanent account deletion from inside the app — App Store guideline
 * 5.1.1(v). Shares `deleteUserAccount` with the web profile page, so the two
 * routes cannot end up meaning different things by "delete".
 *
 * The caller's access token stays syntactically valid until it expires, but
 * every request it makes now resolves to no user, and its refresh tokens are
 * gone with the account.
 */
export async function DELETE(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  await deleteUserAccount(user.id)
  return new Response(null, { status: 204 })
}
