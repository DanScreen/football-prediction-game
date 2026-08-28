/**
 * A very small headless-Chrome screenshot harness, driven over CDP with Node's
 * built-in WebSocket — no Puppeteer and no Chromium download.
 *
 * It exists because this Mac has Command Line Tools only, so there is no iOS
 * Simulator to shoot store screenshots in. Both `capture-store-shots.mjs` (the
 * real app under react-native-web) and `build-store-promos.mjs` (the framed
 * marketing images) need the same thing: render at an exact CSS size and a
 * chosen device scale factor, then grab a PNG.
 */
import { spawn } from "node:child_process"

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

async function debuggerUrl(port) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      return (await res.json()).webSocketDebuggerUrl
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error("Chrome did not expose a debugging endpoint")
}

/**
 * Open Chrome, hand `fn` a page controller, then always shut Chrome down.
 *
 * The controller exposes `send` (raw CDP), `setTheme`, `goto`, `setContent`,
 * `wait` and `shoot`.
 */
export async function withPage({ device, port = 9333, onNewDocument }, fn) {
  const profile = `/tmp/scorers-shot-profile-${port}`
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    `--window-size=${device.width},${device.height}`,
    "about:blank",
  ])
  chrome.stderr.on("data", () => {})

  const ws = new WebSocket(await debuggerUrl(port))
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true })
    ws.addEventListener("error", reject, { once: true })
  })

  let id = 0
  const pending = new Map()
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id == null) return
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)))
    else p.resolve(msg.result)
  })
  const raw = (method, params = {}, sessionId) => {
    id += 1
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    ws.send(JSON.stringify(payload))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }

  try {
    const { targetId } = await raw("Target.createTarget", { url: "about:blank" })
    const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true })
    const send = (m, p) => raw(m, p, sessionId)

    await send("Page.enable")
    await send("Runtime.enable")
    await send("Emulation.setDeviceMetricsOverride", device)
    if (onNewDocument) {
      await send("Page.addScriptToEvaluateOnNewDocument", { source: onNewDocument })
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms))

    const page = {
      send,
      wait,
      setTheme: (value) =>
        send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-color-scheme", value }],
        }),
      goto: (url) => send("Page.navigate", { url }),
      async setContent(html) {
        const { frameTree } = await send("Page.getFrameTree")
        await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html })
      },
      async shoot() {
        const { data } = await send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        })
        return Buffer.from(data, "base64")
      },
    }

    return await fn(page)
  } finally {
    ws.close()
    chrome.kill()
  }
}
