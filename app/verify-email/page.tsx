import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ensureVerificationEmailSent } from "@/lib/emailVerification"
import VerifyEmailActions from "./VerifyEmailActions"

export const metadata = { title: "Verify your email" }

/**
 * Where the proxy holds every signed-in user whose email isn't verified yet.
 * The page itself is public (the proxy lets it through) so it handles the
 * signed-out and already-verified cases by sending people on.
 */
export default async function VerifyEmailPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerifiedAt: true },
  })
  if (!user) redirect("/login")
  if (user.emailVerifiedAt) redirect("/")

  // Landing here is the moment to send a link if none is live — nothing else
  // mails an account that predates verification, or one whose sign-up send
  // failed. False only when that send just failed; the button retries it.
  const hasSent = await ensureVerificationEmailSent(session.user.id)

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-pitch">Scorers ⚽</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">
            {hasSent ? "Check your inbox" : "Verify your email"}
          </h1>
          <p className="mt-2 text-ink-muted text-sm">
            {hasSent ? "We sent a link to " : "We couldn't email a link to "}
            <span className="font-semibold text-ink-mid break-all">{user.email}</span>
            {hasSent
              ? ". Click it to finish setting up your account."
              : " just now. Send one below to confirm it's your address."}
          </p>
        </div>

        <div className="bg-surface rounded-xl shadow-card border border-line px-8 py-8">
          <VerifyEmailActions hasSent={hasSent} />
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Can&apos;t find it? It can take a minute or two, and sometimes lands in spam. Still
          stuck?{" "}
          <Link href="/support" className="font-medium text-pitch hover:underline">
            Get help
          </Link>
        </p>
      </div>
    </div>
  )
}
