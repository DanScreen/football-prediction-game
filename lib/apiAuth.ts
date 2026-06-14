import { prisma } from "@/lib/prisma"

/** Extracts the Bearer token from an Authorization header and returns the matching user, or null. */
export async function authenticateApiKey(request: Request) {
  const auth = request.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const key = auth.slice("Bearer ".length).trim()
  if (!key) return null
  return prisma.user.findUnique({ where: { apiKey: key } })
}
