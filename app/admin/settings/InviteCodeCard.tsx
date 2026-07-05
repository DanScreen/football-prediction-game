"use client"

import { useState, useTransition } from "react"
import { regenerateInviteCode } from "./actions"

export default function InviteCodeCard({ inviteCode }: { inviteCode: string }) {
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-lg">
      <h2 className="font-semibold text-gray-900 mb-1">Invite Code</h2>
      <p className="text-xs text-gray-500 mb-3">
        Share this code so friends can join your league — from the My Leagues page or when
        they register.
      </p>
      <div className="flex items-center gap-3">
        <code className="text-xl font-bold tracking-[0.3em] bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          {inviteCode}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inviteCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Old code stops working immediately.</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await regenerateInviteCode()
                  setConfirming(false)
                })
              }
              className="text-sm font-semibold text-red-600 border border-red-300 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {pending ? "Regenerating…" : "Yes, regenerate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Regenerate code…
          </button>
        )}
      </div>
    </div>
  )
}
