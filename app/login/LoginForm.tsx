"use client"

import { useActionState } from "react"
import { loginUser, LoginState } from "./actions"
import Link from "next/link"

const initial: LoginState = {}

export default function LoginForm({
  callbackUrl,
  registered,
  reset,
}: {
  callbackUrl?: string
  registered?: boolean
  reset?: boolean
}) {
  const [state, formAction, isPending] = useActionState(loginUser, initial)

  return (
    <form action={formAction} className="space-y-4">
      {registered && (
        <div className="rounded-md bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          Account created! Sign in to continue.
        </div>
      )}
      {reset && (
        <div className="rounded-md bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          Password reset! Sign in with your new password.
        </div>
      )}
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
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
        className="w-full rounded-md bg-pitch px-4 py-2 text-sm font-semibold text-white shadow hover:bg-pitch-deep focus:outline-none focus:ring-2 focus:ring-pitch focus:ring-offset-2 disabled:opacity-60 transition-colors"
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
