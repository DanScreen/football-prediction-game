"use client"

import { useState, useTransition } from "react"
import {
  fixUnverifiedEmail,
  sendResetLink,
  sendVerificationLink,
  type HostUserActionResult,
} from "./actions"

const buttonClass =
  "rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-mid hover:bg-chip disabled:opacity-50 transition-colors"

/** Per-row buttons on /host/users. Each reports its outcome inline under the row. */
export default function UserActions({
  userId,
  email,
  verified,
}: {
  userId: string
  email: string
  verified: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"verify" | "reset" | "fix" | null>(null)
  const [result, setResult] = useState<HostUserActionResult>({})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(email)

  function run(kind: "verify" | "reset" | "fix", action: () => Promise<HostUserActionResult>) {
    setBusy(kind)
    setResult({})
    startTransition(async () => {
      const outcome = await action()
      setResult(outcome)
      setBusy(null)
      if (kind === "fix" && !outcome.error) setEditing(false)
    })
  }

  return (
    <div className="space-y-2">
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run("fix", () => fixUnverifiedEmail(userId, draft))
          }}
        >
          <input
            aria-label="Corrected email"
            className="w-56 rounded-md border border-line-strong bg-surface px-2 py-1 text-xs"
            onChange={(e) => setDraft(e.target.value)}
            required
            type="email"
            value={draft}
          />
          <button className={buttonClass} disabled={pending} type="submit">
            {busy === "fix" ? "Saving…" : "Save & send link"}
          </button>
          <button
            className="text-xs text-ink-muted hover:underline"
            onClick={() => {
              setEditing(false)
              setDraft(email)
            }}
            type="button"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!verified && (
            <button
              className={buttonClass}
              disabled={pending}
              onClick={() => run("verify", () => sendVerificationLink(userId))}
              type="button"
            >
              {busy === "verify" ? "Sending…" : "Send verification link"}
            </button>
          )}
          <button
            className={buttonClass}
            disabled={pending}
            onClick={() => run("reset", () => sendResetLink(userId))}
            type="button"
          >
            {busy === "reset" ? "Sending…" : "Send reset link"}
          </button>
          {!verified && (
            <button
              className={buttonClass}
              disabled={pending}
              onClick={() => setEditing(true)}
              type="button"
            >
              Fix email
            </button>
          )}
        </div>
      )}
      {result.error && <p className="text-xs text-bad">{result.error}</p>}
      {result.message && <p className="text-xs text-good">{result.message}</p>}
    </div>
  )
}
