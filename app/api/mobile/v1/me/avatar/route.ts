import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"
import { avatarPath } from "@/lib/avatar"
import { MAX_AVATAR_UPLOAD_BYTES, removeAvatar, saveAvatar } from "@/lib/avatarUpload"

// Not gated on email verification, like the rest of /me: it is the user's own
// account, and nobody else can see the picture until they're in a league.

/**
 * Set the profile picture — `{ image: "<base64>" }`, any common image format.
 * The app sends base64 JSON rather than multipart because the image picker
 * hands it base64 directly. The server crops, resizes and re-encodes it.
 * Returns `{ avatarUrl }`.
 */
export async function PUT(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const encoded = parsed.body.image
  if (typeof encoded !== "string" || encoded.length === 0) {
    return jsonError("Send the picture as base64 in `image`.", 400)
  }
  // Base64 is 4 chars per 3 bytes; refuse an oversized body before decoding it.
  if (encoded.length > Math.ceil(MAX_AVATAR_UPLOAD_BYTES / 3) * 4 + 4) {
    return jsonError("That picture is too large — the limit is 8 MB.", 413)
  }

  const result = await saveAvatar(user.id, Buffer.from(encoded, "base64"))
  if (!result.ok) return jsonError(result.error, 400)
  return Response.json({ avatarUrl: avatarPath(result.avatarKey) })
}

/** Remove the picture and go back to initials. */
export async function DELETE(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  await removeAvatar(user.id)
  return Response.json({ avatarUrl: null })
}
