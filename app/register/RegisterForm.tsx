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
        <label htmlFor="displayName" className="block text-sm font-medium text-zinc-700 mb-1">
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a7a3c] focus:outline-none focus:ring-1 focus:ring-[#1a7a3c]"
          placeholder="Your name"
        />
      </div>

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

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
          Password
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
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a7a3c] focus:outline-none focus:ring-1 focus:ring-[#1a7a3c]"
          placeholder="Repeat your password"
        />
      </div>

      <div>
        <label htmlFor="inviteCode" className="block text-sm font-medium text-zinc-700 mb-1">
          Invite Code <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          autoComplete="off"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a7a3c] focus:outline-none focus:ring-1 focus:ring-[#1a7a3c]"
          placeholder="Leave blank or enter code"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-[#1a7a3c] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#155e2f] focus:outline-none focus:ring-2 focus:ring-[#1a7a3c] focus:ring-offset-2 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Creating account…" : "Create Account"}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-[#1a7a3c] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
