"use client"

import { useActionState } from "react"
import { loginUser, LoginState } from "./actions"
import Link from "next/link"

const initial: LoginState = {}

export default function LoginForm({
  callbackUrl,
  registered,
  reset,
  deleted,
}: {
  callbackUrl?: string
  registered?: boolean
  reset?: boolean
  deleted?: boolean
}) {
  const [state, formAction, isPending] = useActionState(loginUser, initial)

  return (
    <form action={formAction} className="space-y-4">
      {registered && (
        <div className="rounded-md bg-good-tint border border-good-line text-good px-4 py-3 text-sm">
          Account created! Sign in to continue.
        </div>
      )}
      {reset && (
        <div className="rounded-md bg-good-tint border border-good-line text-good px-4 py-3 text-sm">
          Password reset! Sign in with your new password.
        </div>
      )}
      {deleted && (
        <div className="rounded-md border border-line bg-chip px-4 py-3 text-sm text-ink-mid">
          Your account has been deleted. Thanks for playing.
        </div>
      )}
      {state.error && (
        <div className="rounded-md bg-bad-tint border border-bad-line text-bad px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink-mid mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-card focus:border-pitch focus:outline-none focus:ring-1 focus:ring-pitch"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium text-ink-mid">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs text-pitch hover:underline">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-card focus:border-pitch focus:outline-none focus:ring-1 focus:ring-pitch"
          placeholder="Your password"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-pitch px-4 py-2 text-sm font-semibold text-pitch-on shadow-card hover:bg-pitch-deep focus:outline-none focus:ring-2 focus:ring-pitch focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-60 transition-colors"
      >
        {isPending ? "Signing in…" : "Sign In"}
      </button>

      <p className="text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-pitch font-medium hover:underline">
          Register
        </Link>
      </p>
    </form>
  )
}
