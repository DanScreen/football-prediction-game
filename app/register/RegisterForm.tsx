"use client"

import { useActionState } from "react"
import { registerUser, RegisterState } from "./actions"
import Link from "next/link"

const initialState: RegisterState = {}

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerUser, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-ink-mid mb-1">
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-card focus:border-pitch focus:outline-none focus:ring-1 focus:ring-pitch"
          placeholder="Your name"
        />
      </div>

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
        <label htmlFor="password" className="block text-sm font-medium text-ink-mid mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-card focus:border-pitch focus:outline-none focus:ring-1 focus:ring-pitch"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink-mid mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-card focus:border-pitch focus:outline-none focus:ring-1 focus:ring-pitch"
          placeholder="Repeat your password"
        />
      </div>

      <div>
        <label htmlFor="inviteCode" className="block text-sm font-medium text-ink-mid mb-1">
          Invite Code <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          autoComplete="off"
          className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm shadow-card focus:border-pitch focus:outline-none focus:ring-1 focus:ring-pitch"
          placeholder="Leave blank or enter code"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-pitch px-4 py-2 text-sm font-semibold text-white shadow hover:bg-pitch-deep focus:outline-none focus:ring-2 focus:ring-pitch focus:ring-offset-2 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Creating account…" : "Create Account"}
      </button>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-pitch font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
