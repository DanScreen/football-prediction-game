import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The public domain is proxied to Cloud Run by a Cloudflare Worker, so the
  // browser's Origin (scorersonline.uk) differs from the Host header Cloud Run
  // receives (*.run.app). Without this, Next.js rejects Server Action requests
  // as cross-origin.
  experimental: {
    serverActions: {
      allowedOrigins: ["scorersonline.uk", "*.run.app"],
    },
  },
};

export default nextConfig;
