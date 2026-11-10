"use client"

import { useState, useTransition } from "react"
import Avatar from "@/app/components/Avatar"
import { deleteAvatar, uploadAvatar } from "./actions"

/** Longest side, in pixels, of the copy the browser uploads. The server crops to 256. */
const UPLOAD_MAX_SIDE = 1024
/** Server actions accept 1 MB bodies; stay well under it. */
const UPLOAD_BUDGET_BYTES = 900 * 1024

/**
 * Shrink a photo in the browser before upload. A phone photo is often 3–10 MB,
 * over the server-action body limit and slow on mobile data; a 1024px JPEG is
 * a few hundred KB. Returns the original file if the browser can't decode it
 * (some can't read HEIC) and it is already small enough.
 */
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    )
    if (blob && blob.size <= UPLOAD_BUDGET_BYTES) return blob
  } catch {
    // Fall through: maybe the server can read it.
  }
  return file.size <= UPLOAD_BUDGET_BYTES ? file : null
}

export default function AvatarForm({
  userId,
  displayName,
  avatarUrl,
}: {
  userId: string
  displayName: string
  avatarUrl: string | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = "" // so picking the same file again still fires
    if (!file) return
    setError(null)
    startTransition(async () => {
      const blob = await shrink(file)
      if (!blob) {
        setError("We couldn't read that picture. Try a JPEG or PNG.")
        return
      }
      const form = new FormData()
      form.set("avatar", blob, "avatar")
      const result = await uploadAvatar({}, form)
      if (result.error) setError(result.error)
    })
  }

  function onRemove() {
    setError(null)
    startTransition(() => deleteAvatar())
  }

  return (
    <div className="flex items-center gap-5 px-6 py-5">
      <Avatar
        userId={userId}
        displayName={displayName}
        avatarUrl={avatarUrl}
        size="xl"
        className={isPending ? "opacity-50" : ""}
      />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-ink">Profile picture</p>
        <p className="text-xs text-ink-muted">
          League-mates see it next to your name. Without one, they see your initials.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`cursor-pointer rounded-md bg-pitch px-3 py-1.5 text-xs font-semibold text-pitch-on shadow-card transition-colors hover:bg-pitch-deep focus-within:ring-2 focus-within:ring-pitch focus-within:ring-offset-2 focus-within:ring-offset-surface ${
              isPending ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {/* Inside the label so the label shows the input's keyboard focus. */}
            <input
              type="file"
              accept="image/*"
              onChange={onPick}
              className="sr-only"
              disabled={isPending}
            />
            {isPending ? "Saving…" : avatarUrl ? "Change picture" : "Upload picture"}
          </label>
          {avatarUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={isPending}
              className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-mid transition-colors hover:bg-chip disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs font-medium text-bad">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
