"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { changeEmail, resendVerification, signOutFromVerify, VerifyEmailState } from "./actions"

const initial: VerifyEmailState = {}

function Notice({ state }: { state: VerifyEmailState }) {
  if (state.error) {
    return (
      <div className="rounded-md bg-bad-tint border border-bad-line text-bad px-4 py-3 text-sm">
        {state.error}
      </div>
    )
  }
  if (state.message) {
    return (
      <div className="rounded-md bg-good-tint border border-good-line text-good px-4 py-3 text-sm">
        {state.message}
      </div>
    )
  }
  return null
}

/**
 * The controls under "check your inbox". `hasSent` flips the primary button's
 * wording: an account from before verification existed has never been sent a
 * link, so "Resend" would be confusing.
 */
export default function VerifyEmailActions({ hasSent }: { hasSent: boolean }) {
  const [resendState, resendAction, resendPending] = useActionState(resendVerification, initial)
  const [changeState, changeAction, changePending] = useActionState(changeEmail, initial)
  const [changing, setChanging] = useState(false)

  return (
    <div className="space-y-5">
      <form action={resendAction} className="space-y-3">
        <Notice state={resendState} />
        <button
          type="submit"
          disabled={resendPending}
          className="w-full rounded-md bg-pitch px-4 py-2 text-sm font-semibold text-pitch-on shadow-card hover:bg-pitch-deep focus:outline-none focus:ring-2 focus:ring-pitch focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-60 transition-colors"
        >
          {resendPending ? "Sending…" : hasSent ? "Resend the email" : "Send verification email"}
        </button>
      </form>

      <Link
        href="/"
        className="block w-full rounded-md border border-line-strong px-4 py-2 text-center text-sm font-semibold text-ink-mid hover:bg-chip transition-colors"
      >
        I&apos;ve clicked the link — continue
      </Link>

      <div className="border-t border-line pt-4">
        {changing ? (
          <form action={changeAction} className="space-y-3">
            <Notice state={changeState} />
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-mid mb-1">
                Correct email address
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
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={changePending}
                className="flex-1 rounded-md bg-pitch px-4 py-2 text-sm font-semibold text-pitch-on shadow-card hover:bg-pitch-deep disabled:opacity-60 transition-colors"
              >
                {changePending ? "Saving…" : "Update and send link"}
              </button>
              <button
                type="button"
                onClick={() => setChanging(false)}
                className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-mid hover:bg-chip transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="text-center text-sm text-ink-muted">
            Wrong address?{" "}
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="text-pitch font-medium hover:underline"
            >
              Change it
            </button>
          </p>
        )}
      </div>

      <form action={signOutFromVerify} className="text-center">
        <button type="submit" className="text-xs text-ink-faint hover:underline">
          Sign out
        </button>
      </form>
    </div>
  )
}
