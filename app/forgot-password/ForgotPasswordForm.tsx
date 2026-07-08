"use client"

import { useActionState } from "react"
import { requestReset, ForgotPasswordState } from "./actions"
import Link from "next/link"

const initial: ForgotPasswordState = {}

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestReset, initial)

  if (state.submitted) {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
        If an account exists for that email, we&apos;ve sent a link to reset your password.
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

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

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-pitch px-4 py-2 text-sm font-semibold text-white shadow hover:bg-pitch-deep focus:outline-none focus:ring-2 focus:ring-pitch focus:ring-offset-2 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-ink-muted">
        Remembered your password?{" "}
        <Link href="/login" className="text-pitch font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
