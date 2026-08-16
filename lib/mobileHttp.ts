/** Shared JSON helpers for `/api/mobile/v1` routes. */

export function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status })
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
