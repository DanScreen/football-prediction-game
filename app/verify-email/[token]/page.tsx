import Link from "next/link"
import { auth } from "@/auth"
import { verifyEmailToken } from "@/lib/emailVerification"

export const metadata = { title: "Verify your email" }

const primaryButton =
  "inline-block w-full rounded-md bg-pitch px-4 py-2 text-center text-sm font-semibold text-pitch-on shadow-card hover:bg-pitch-deep transition-colors"

/**
 * The link from the verification email. Opening it is the act of verifying, so
 * the token is consumed on render. Often opened on a phone that isn't signed in
 * to the website — the app user just needs telling they can go back.
 */
export default async function VerifyEmailTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await verifyEmailToken(token)
  const session = await auth()

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-pitch">Scorers ⚽</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">
            {result === "verified" ? "Email verified" : "Link not valid"}
          </h1>
        </div>
        <div className="bg-surface rounded-xl shadow-card border border-line px-8 py-8 space-y-4 text-center">
          {result === "verified" ? (
            <>
              <p className="text-sm text-ink-muted">
                Thanks — your account is all set. If you signed up in the Scorers app, head back
                to it and carry on.
              </p>
              <Link href={session ? "/" : "/login"} className={primaryButton}>
                {session ? "Continue to Scorers" : "Sign in on the web"}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                This link has expired, was sent to an address you&apos;ve since changed, or
                isn&apos;t complete. Request a new one and use the latest email.
              </p>
              <Link href={session ? "/verify-email" : "/login"} className={primaryButton}>
                {session ? "Send a new link" : "Sign in to send a new link"}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
