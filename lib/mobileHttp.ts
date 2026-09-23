/** Shared JSON helpers for `/api/mobile/v1` routes. */

export function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status })
}

/**
 * The answer every player endpoint gives an account whose email isn't verified.
 * The app keys off `code`, not the status: a 403 alone is ambiguous. Builds that
 * predate verification just show `error`, which is written to stand on its own.
 */
export function emailUnverifiedError(): Response {
  return Response.json(
    {
      error: "Verify your email address to continue — check your inbox for a link from Scorers.",
      code: "email_unverified",
    },
    { status: 403 },
  )
}

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: jsonError("Invalid JSON body", 400) }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, response: jsonError("Body must be a JSON object", 400) }
  }
  return { ok: true, body: raw as Record<string, unknown> }
}
