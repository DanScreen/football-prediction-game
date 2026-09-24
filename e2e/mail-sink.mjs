// A stand-in for the Resend API, for the Playwright suite only.
//
// The app under test is started with RESEND_API_URL pointing here, so every
// email it sends (verification, password reset) lands in memory instead of a
// real inbox. Tests read them back with GET /emails?to=<address> and follow the
// links inside — which exercises AUTH_URL and the token pages, not just the
// function that builds the link.
//
//   POST /emails           Resend's send endpoint shape: { from, to, subject, html }
//   GET  /emails?to=addr   everything sent to that address, oldest first
//   GET  /health           readiness probe for Playwright's webServer

import http from "node:http"

const port = Number(process.env.MAIL_SINK_PORT ?? 4025)
/** @type {{ id: string, from: string, to: string, subject: string, html: string, sentAt: string }[]} */
const sent = []

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`)
  const reply = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(JSON.stringify(body))
  }

  if (req.method === "GET" && url.pathname === "/health") return reply(200, { ok: true })

  if (req.method === "GET" && url.pathname === "/emails") {
    const to = url.searchParams.get("to")?.toLowerCase()
    return reply(200, to ? sent.filter((m) => m.to === to) : sent)
  }

  if (req.method === "POST" && url.pathname === "/emails") {
    let raw = ""
    req.on("data", (chunk) => (raw += chunk))
    req.on("end", () => {
      try {
        const { from, to, subject, html } = JSON.parse(raw)
        const id = `sink_${sent.length + 1}`
        const recipient = String(Array.isArray(to) ? to[0] : to).toLowerCase()
        sent.push({ id, from, to: recipient, subject, html, sentAt: new Date().toISOString() })
        reply(200, { id })
      } catch {
        reply(400, { error: "Invalid JSON" })
      }
    })
    return
  }

  reply(404, { error: "Not found" })
})

server.listen(port, () => console.log(`mail sink listening on :${port}`))
