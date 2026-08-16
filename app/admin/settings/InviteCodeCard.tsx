"use client"

import { useState, useTransition } from "react"
import { regenerateInviteCode } from "./actions"

export default function InviteCodeCard({ inviteCode }: { inviteCode: string }) {
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="bg-surface border border-line rounded-xl p-5 max-w-lg">
      <h2 className="font-semibold text-ink mb-1">Invite Code</h2>
      <p className="text-xs text-ink-muted mb-3">
        Share this code so friends can join your league — from the My Leagues page or when
        they register.
      </p>
      <div className="flex items-center gap-3">
        <code className="text-xl font-bold tracking-[0.3em] bg-ground border border-line rounded-lg px-4 py-2">
          {inviteCode}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inviteCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="text-sm text-ink-muted border border-line-strong rounded-lg px-3 py-2 hover:bg-ground transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-line-soft">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">Old code stops working immediately.</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await regenerateInviteCode()
                  setConfirming(false)
                })
              }
              className="text-sm font-semibold text-bad border border-bad-line rounded-lg px-3 py-1.5 hover:bg-bad-tint disabled:opacity-50 transition-colors"
            >
              {pending ? "Regenerating…" : "Yes, regenerate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-ink-muted hover:text-ink-mid transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-ink-muted hover:text-bad transition-colors"
          >
            Regenerate code…
          </button>
        )}
      </div>
    </div>
  )
}
