"use client"

import { useActionState, useState } from "react"
import { deleteAccount, type DeleteAccountState } from "./actions"

/**
 * Account deletion, required in-app by App Store guideline 5.1.1(v).
 *
 * Collapsed behind a disclosure and gated on retyping the email: it is the only
 * destructive control on the page and there is no undo, so it should take a
 * deliberate act to reach, not one stray tap.
 */
export default function DeleteAccountSection({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    {},
  )
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-xl border border-bad-line bg-surface p-6 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-bad">
        Delete account
      </h2>
      <p className="mt-2 text-xs text-ink-muted">
        This permanently removes your account, your predictions and your standings in
        every league. It cannot be undone, and leagues you started stay open for the
        other players.
      </p>

      {open ? (
        <form action={formAction} className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-ink-mid" htmlFor="confirmEmail">
            Type <span className="font-semibold text-ink">{email}</span> to confirm
          </label>
          <input
            id="confirmEmail"
            name="confirmEmail"
            type="email"
            autoComplete="off"
            required
            className="w-full rounded-md border border-line-strong bg-ground px-3 py-2 text-sm text-ink"
          />
          {state.error && <p className="text-xs text-bad">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-bad px-4 py-2 text-sm font-semibold text-white shadow-card transition-opacity disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete my account permanently"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-mid"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-md border border-bad-line bg-bad-tint px-4 py-2 text-sm font-semibold text-bad shadow-card"
        >
          Delete account…
        </button>
      )}
    </section>
  )
}
