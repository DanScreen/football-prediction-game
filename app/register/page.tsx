import Link from "next/link"
import RegisterForm from "./RegisterForm"
import { prisma } from "@/lib/prisma"
import { normaliseInviteCode, INVITE_PARAM } from "@/lib/inviteCode"

export const metadata = {
  title: "Register",
  description:
    "Create your Scorers account and predict football scorelines against your friends.",
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = params[INVITE_PARAM]
  const inviteCode = normaliseInviteCode(Array.isArray(raw) ? raw[0] : raw)

  // Resolve the league so the invitee can see what they're joining before signing
  // up. An unrecognised code is shown as a notice rather than an error — it must
  // never block account creation.
  const league = inviteCode
    ? await prisma.league.findUnique({
        where: { inviteCode },
        select: { name: true, competition: { select: { name: true } } },
      })
    : null

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-pitch">Scorers ⚽</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">
            {league ? `Join ${league.name}` : "Create your account"}
          </h1>
          <p className="mt-2 text-ink-muted text-sm">
            {league
              ? "Set up your account and you'll be added to the league straight away."
              : "Predict football scorelines and compete with your friends."}
          </p>
        </div>

        {league && (
          <div className="mb-4 rounded-xl border border-good-line bg-good-tint px-4 py-3 text-sm">
            <p className="font-semibold text-good">You&apos;ve been invited to {league.name}</p>
            <p className="mt-0.5 text-good/90">{league.competition.name}</p>
          </div>
        )}

        {inviteCode && !league && (
          <div className="mb-4 rounded-xl border border-clock-line bg-clock-tint px-4 py-3 text-sm">
            <p className="font-semibold text-clock">That invite link isn&apos;t valid</p>
            <p className="mt-0.5 text-clock/90">
              You can still create an account, then join a league with a code.
            </p>
          </div>
        )}

        <div className="bg-surface rounded-xl shadow-card border border-line px-8 py-8">
          <RegisterForm inviteCode={league ? inviteCode : ""} />
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Scorers is a friendly football score-prediction game. Leagues are private — you join
          one with an invite link or code from a friend.{" "}
          <Link href="/rules" className="font-medium text-pitch hover:underline">
            How it works
          </Link>
        </p>
      </div>
    </div>
  )
}
