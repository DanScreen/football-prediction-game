"use client"

import { useActionState } from "react"
import { registerUser, RegisterState } from "./actions"
import Link from "next/link"

const initialState: RegisterState = {}

/**
 * `inviteCode` comes from the `?invite=` link and rides along in a hidden field —
 * there is deliberately no visible code box. Sign-up is open, so an optional field
 * most people had to ignore was pure friction; codes are entered on the "Join a
 * league" form instead, once you have an account.
 */
export default function RegisterForm({ inviteCode }: { inviteCode: string }) {
  const [state, formAction, isPending] = useActionState(registerUser, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {inviteCode && <input type="hidden" name="inviteCode" value={inviteCode} />}
      {state.error && (
        <div className="rounded-md bg-bad-tint border border-bad-line text-bad px-4 py-3 text-sm">
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

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-pitch px-4 py-2 text-sm font-semibold text-pitch-on shadow-card hover:bg-pitch-deep focus:outline-none focus:ring-2 focus:ring-pitch focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-60 transition-colors"
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
