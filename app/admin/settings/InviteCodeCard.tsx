"use client"

import { useState, useTransition } from "react"
import { regenerateInviteCode } from "./actions"
import CopyInvite from "@/app/components/CopyInvite"

export default function InviteCodeCard({ inviteCode }: { inviteCode: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="bg-surface border border-line rounded-xl p-5 max-w-lg">
      <h2 className="font-semibold text-ink mb-1">Invite people</h2>
      <p className="text-xs text-ink-muted mb-3">
        Send the link — it takes them straight to sign-up and adds them to this league.
        The code is for anyone who already has an account, on the My Leagues page.
      </p>
      <div className="flex items-center gap-3">
        <code className="text-xl font-bold tracking-[0.3em] bg-ground border border-line rounded-lg px-4 py-2">
          {inviteCode}
        </code>
      </div>
      <CopyInvite inviteCode={inviteCode} className="mt-3" />

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
