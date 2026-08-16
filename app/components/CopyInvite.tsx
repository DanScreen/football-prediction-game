"use client"

import { useEffect, useState } from "react"
import { inviteUrl } from "@/lib/inviteCode"

type Copied = "link" | "code" | null

/**
 * Share controls for a league invite: the link is the primary action, the raw code
 * the fallback for anywhere a URL is awkward to send.
 *
 * The URL is built from `window.location.origin` at click time rather than baked in
 * server-side, so it's correct on the live domain, the run.app URL and localhost
 * without needing an env var.
 */
export default function CopyInvite({
  inviteCode,
  className = "",
}: {
  inviteCode: string
  className?: string
}) {
  const [copied, setCopied] = useState<Copied>(null)

  // Clear the confirmation from the timer callback, never synchronously in the
  // effect body (see the same pattern in PredictionInput).
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function copy(what: Exclude<Copied, null>) {
    const text = what === "link" ? inviteUrl(window.location.origin, inviteCode) : inviteCode
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      // Clipboard can be blocked (insecure origin, denied permission). Say nothing
      // rather than claim a copy that didn't happen — the code is visible to select.
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => copy("link")}
        className="rounded-lg bg-pitch px-3 py-1.5 text-xs font-semibold text-pitch-on shadow-card transition-colors hover:bg-pitch-deep"
      >
        {copied === "link" ? "Link copied ✓" : "Copy invite link"}
      </button>
      <button
        type="button"
        onClick={() => copy("code")}
        className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-mid transition-colors hover:bg-chip"
      >
        {copied === "code" ? "Code copied ✓" : "Copy code"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied === "link" ? "Invite link copied" : copied === "code" ? "Invite code copied" : ""}
      </span>
    </div>
  )
}
