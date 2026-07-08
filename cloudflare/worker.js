// Proxies scorersonline.uk to the Cloud Run service.
//
// Cloud Run's built-in domain mappings don't support europe-west2, so this
// Worker (deployed via the Cloudflare dashboard, custom domain scorersonline.uk)
// forwards every request to the *.run.app origin instead. This file is the
// source of truth — if you edit the Worker, update this copy too.
//
// X-Forwarded-Host carries the public hostname through to Next.js so Server
// Actions' origin check and any host-based logic see the real domain.

const ORIGIN_HOST = "football-prediction-app-lze2bvdarq-nw.a.run.app";
const PUBLIC_HOST = "scorersonline.uk";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = ORIGIN_HOST;

    const proxied = new Request(url, request);
    proxied.headers.set("X-Forwarded-Host", PUBLIC_HOST);

    return fetch(proxied, { redirect: "manual" });
  },
};
