import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { touchLastSeen } from "@/lib/lastSeen"
import { recordActivity } from "@/lib/activity"
import { avatarPath } from "@/lib/avatar"

/** Access JWT lifetime — short enough that theft window is limited. */
export const MOBILE_ACCESS_TTL_SECONDS = 30 * 60 // 30 minutes

/** Refresh token lifetime — long-lived device session. */
export const MOBILE_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export type MobileUserPublic = {
  id: string
  email: string
  displayName: string
  isBot: boolean
  /** False until the user clicks the link in their verification email. */
  emailVerified: boolean
  /** Site-relative URL of their profile picture; null = show initials. */
  avatarUrl: string | null
}

type AccessClaims = {
  sub: string
  typ: "access"
  iat: number
  exp: number
}

function mobileJwtSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is not configured")
  return secret
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

function signHs256(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url")
}

/** Issues a short-lived HS256 access JWT (`typ: "access"`, `sub` = user id). */
export function signMobileAccessToken(userId: string, now = Math.floor(Date.now() / 1000)): string {
  const header = base64urlJson({ alg: "HS256", typ: "JWT" })
  const payload = base64urlJson({
    sub: userId,
    typ: "access",
    iat: now,
    exp: now + MOBILE_ACCESS_TTL_SECONDS,
  } satisfies AccessClaims)
  const data = `${header}.${payload}`
  return `${data}.${signHs256(data, mobileJwtSecret())}`
}

/** Verifies signature, typ, and expiry. Returns user id or null. */
export function verifyMobileAccessToken(token: string): string | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  const data = `${header}.${payload}`
  const expected = signHs256(data, mobileJwtSecret())
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null

  let claims: AccessClaims
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessClaims
  } catch {
    return null
  }
  if (claims.typ !== "access" || typeof claims.sub !== "string" || !claims.sub) return null
  if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null
  return claims.sub
}

export function toMobileUserPublic(user: {
  id: string
  email: string
  displayName: string
  isBot: boolean
  emailVerifiedAt: Date | null
  avatarKey: string | null
}): MobileUserPublic {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isBot: user.isBot,
    emailVerified: !!user.emailVerifiedAt,
    avatarUrl: avatarPath(user.avatarKey),
  }
}

/** Creates a DB-backed opaque refresh token; returns the raw token (show once). */
export async function issueMobileRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url")
  await prisma.mobileRefreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + MOBILE_REFRESH_TTL_MS),
    },
  })
  return raw
}

export async function issueMobileTokenPair(userId: string): Promise<{
  accessToken: string
  refreshToken: string
}> {
  const [accessToken, refreshToken] = await Promise.all([
    Promise.resolve(signMobileAccessToken(userId)),
    issueMobileRefreshToken(userId),
  ])
  return { accessToken, refreshToken }
}

/**
 * Validates a refresh token, revokes it, and issues a new pair (rotation).
 * Returns null if missing, expired, or already revoked.
 */
export async function rotateMobileRefreshToken(
  rawRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  const tokenHash = hashRefreshToken(rawRefreshToken)
  const existing = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash } })
  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) return null

  const newRaw = randomBytes(32).toString("base64url")
  await prisma.$transaction([
    prisma.mobileRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.mobileRefreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashRefreshToken(newRaw),
        expiresAt: new Date(Date.now() + MOBILE_REFRESH_TTL_MS),
      },
    }),
  ])

  await touchLastSeen(existing.userId)

  return {
    userId: existing.userId,
    accessToken: signMobileAccessToken(existing.userId),
    refreshToken: newRaw,
  }
}

/** Revokes one refresh token by raw value. No-op if unknown. */
export async function revokeMobileRefreshToken(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken)
  await prisma.mobileRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Revokes every active refresh token for a user (logout all devices). */
export async function revokeAllMobileRefreshTokens(userId: string): Promise<void> {
  await prisma.mobileRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Resolves `Authorization: Bearer <accessToken>` to the user, or null.
 * Re-checks the DB so deleted users cannot keep calling the API, and so
 * `emailVerified` is always current — player endpoints must refuse an
 * unverified user with `emailUnverifiedError()` (see mobile.md).
 */
export async function authenticateMobileAccess(
  request: Request,
): Promise<MobileUserPublic | null> {
  const auth = request.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const token = auth.slice("Bearer ".length).trim()
  if (!token) return null
  const userId = verifyMobileAccessToken(token)
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      isBot: true,
      emailVerifiedAt: true,
      avatarKey: true,
    },
  })
  if (!user) return null
  // Every authenticated app call is a visit (memoised to one write a day).
  await recordActivity(user.id, "app")
  return toMobileUserPublic(user)
}
