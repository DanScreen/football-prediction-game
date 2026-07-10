import RegisterForm from "./RegisterForm"

export const metadata = {
  title: "Register — Scorers",
  description:
    "Create your Scorers account. Scorers is a private, invite-only football score-prediction game for friends.",
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-pitch">Scorers ⚽</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Join the league</h1>
          <p className="mt-2 text-ink-muted text-sm">
            Create your <span className="font-semibold text-ink-mid">Scorers</span> account —
            you&apos;ll need an invite code from your league commissioner.
          </p>
        </div>
        <div className="bg-surface rounded-xl shadow-card border border-line px-8 py-8">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          Scorers is a private, invite-only game where friends predict football scorelines and
          compete on a leaderboard.
        </p>
      </div>
    </div>
  )
}
