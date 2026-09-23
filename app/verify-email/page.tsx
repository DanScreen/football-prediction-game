import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
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

  // Only a link to the *current* address counts — one sent before a change of
  // address can't be clicked into verifying this one.
  const lastSent = await prisma.emailVerificationToken.findFirst({
    where: { userId: session.user.id, email: user.email },
    select: { id: true },
  })
  const hasSent = !!lastSent

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-pitch">Scorers ⚽</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">
            {hasSent ? "Check your inbox" : "Verify your email"}
          </h1>
          <p className="mt-2 text-ink-muted text-sm">
            {hasSent ? "We sent a link to " : "Before you carry on, confirm that "}
            <span className="font-semibold text-ink-mid break-all">{user.email}</span>
            {hasSent
              ? ". Click it to finish setting up your account."
              : " is your email address. We'll send you a link to click."}
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
