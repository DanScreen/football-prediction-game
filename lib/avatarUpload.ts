import { randomBytes } from "node:crypto"
import sharp from "sharp"
import { prisma } from "@/lib/prisma"

/**
 * Profile-picture storage, shared by the web profile page and the app's
 * `/api/mobile/v1/me/avatar`.
 *
 * Pictures live in Postgres (`UserAvatar`), not a bucket: once re-encoded they
 * are a few KB each, and keeping them in the database means no new
 * infrastructure, and account deletion and backups cover them for free.
 *
 * Every upload is decoded and re-encoded server-side, whatever the client did
 * first. That makes the stored file small and square, rejects anything that
 * isn't really an image, and drops EXIF metadata — a phone photo's GPS
 * position would otherwise be handed to every league-mate.
 */

/** Largest upload accepted, before resizing. Phone photos fit comfortably. */
export const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024

/** Stored pictures are this many pixels square — 2–3× the largest display size. */
export const AVATAR_SIZE = 256

export type AvatarResult = { ok: true; avatarKey: string } | { ok: false; error: string }

/** Decode, square-crop, resize and re-encode an upload. Null if it isn't an image. */
export async function normaliseAvatar(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input, {
      // Refuse decompression bombs: 50 megapixels is above any phone camera.
      limitInputPixels: 50_000_000,
      // Animated GIF/WebP: take the first frame only.
      pages: 1,
    })
      .rotate() // honour the EXIF orientation before it's stripped
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    return null
  }
}

/** Replace the user's picture. The new key makes a new URL, so caches never serve the old one. */
export async function saveAvatar(userId: string, input: Buffer): Promise<AvatarResult> {
  if (input.length === 0) return { ok: false, error: "Choose a picture to upload." }
  if (input.length > MAX_AVATAR_UPLOAD_BYTES) {
    return { ok: false, error: "That picture is too large — the limit is 8 MB." }
  }
  const encoded = await normaliseAvatar(input)
  if (!encoded) return { ok: false, error: "That file isn't a picture we can read. Try a JPEG or PNG." }

  const image = new Uint8Array(encoded)
  const avatarKey = randomBytes(18).toString("base64url")
  await prisma.$transaction([
    prisma.userAvatar.upsert({
      where: { userId },
      create: { userId, image },
      update: { image },
    }),
    prisma.user.update({ where: { id: userId }, data: { avatarKey } }),
  ])
  return { ok: true, avatarKey }
}

/** Go back to initials. */
export async function removeAvatar(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.userAvatar.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { avatarKey: null } }),
  ])
}
