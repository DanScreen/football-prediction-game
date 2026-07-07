"use client"

import { useActionState } from "react"
import { submitNewPassword, ResetPasswordState } from "./actions"

const initial: ResetPasswordState = {}

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(submitNewPassword, initial)

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
          New Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a7a3c] focus:outline-none focus:ring-1 focus:ring-[#1a7a3c]"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 mb-1">
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a7a3c] focus:outline-none focus:ring-1 focus:ring-[#1a7a3c]"
          placeholder="Repeat your new password"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-[#1a7a3c] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#155e2f] focus:outline-none focus:ring-2 focus:ring-[#1a7a3c] focus:ring-offset-2 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Resetting…" : "Reset Password"}
      </button>
    </form>
  )
}
