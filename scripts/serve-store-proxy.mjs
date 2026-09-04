// Screenshot-harness only: serves the Expo web dev server (8082) and the Next
// mobile API (3000) on ONE origin, so the app can be driven in a browser
// without CORS. Nothing in the repo depends on this.
import http from "node:http"

const route = (url) =>
  url.startsWith("/api/") ? { port: 3000 } : { port: 8082 }

http
  .createServer((req, res) => {
    const { port } = route(req.url)
    const proxied = http.request(
      { host: "127.0.0.1", port, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      },
    )
    proxied.on("error", (e) => {
      res.writeHead(502, { "content-type": "text/plain" })
      res.end(`proxy error: ${e.message}`)
    })
    req.pipe(proxied)
  })
  .listen(8090, () => console.log("proxy on http://localhost:8090"))
