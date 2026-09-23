import Link from "next/link"
import LoginForm from "./LoginForm"

export const metadata = {
  title: "Sign in",
  description:
    "Sign in to Scorers, a private football score-prediction game where friends predict match results and compete on a leaderboard.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string
    reset?: string
    deleted?: string
  }>
}) {
  const { callbackUrl, reset, deleted } = await searchParams

  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-pitch">Scorers ⚽</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Welcome back</h1>
          <p className="mt-2 text-ink-muted text-sm">
            Sign in to <span className="font-semibold text-ink-mid">Scorers</span> to make your
            predictions.
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow-card border border-line px-8 py-8">
          <LoginForm callbackUrl={callbackUrl} reset={reset === "1"} deleted={deleted === "1"} />
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          Scorers is a friendly game where you predict football scorelines and compete with
          friends on a leaderboard. Leagues are private — you join one with an invite link or
          code. We only ask for your email and a password to sign you in.
        </p>
        <p className="mt-3 text-center text-xs text-ink-faint">
          <Link href="/privacy" className="hover:underline">
            Privacy policy
          </Link>
          {" · "}
          <Link href="/rules" className="hover:underline">
            How it works
          </Link>
          {" · "}
          <Link href="/support" className="hover:underline">
            Support
          </Link>
        </p>
      </div>
    </div>
  )
}
