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
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a7a3c] focus:outline-none focus:ring-1 focus:ring-[#1a7a3c]"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-[#1a7a3c] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#155e2f] focus:outline-none focus:ring-2 focus:ring-[#1a7a3c] focus:ring-offset-2 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Remembered your password?{" "}
        <Link href="/login" className="text-[#1a7a3c] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
