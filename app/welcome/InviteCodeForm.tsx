"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-gold"

/** Takes an invite code and sends the visitor to sign-up with it attached. */
export default function InviteCodeForm() {
  const router = useRouter()
  const [code, setCode] = useState("")

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!code.trim()) return
    router.push("/register?invite=" + encodeURIComponent(code.trim().toUpperCase()))
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor="invite-code" className="text-sm font-bold text-board-fore">
          Invite code
        </label>
        <input
          id="invite-code"
          name="invite"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`min-h-11 w-full rounded-[10px] border border-board-fore/30 bg-board px-3 font-mono text-base tracking-[0.08em] text-board-fore uppercase placeholder:text-board-muted ${focusRing}`}
        />
      </div>
      <button
        type="submit"
        className={`min-h-11 shrink-0 rounded-[10px] border border-board-fore/30 px-4 font-bold text-board-fore hover:bg-board-fore/10 ${focusRing}`}
      >
        Join
      </button>
    </form>
  )
}
