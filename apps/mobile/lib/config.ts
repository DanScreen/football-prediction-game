/**
 * API base URL for `/api/mobile/v1`.
 *
 * Override with `EXPO_PUBLIC_API_URL` (no trailing slash), e.g.:
 * - Local Next: `http://localhost:3000` (iOS sim) / `http://10.0.2.2:3000` (Android emu)
 * - Physical device: `http://<your-lan-ip>:3000`
 * - Default: production site
 */
export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "https://scorersonline.uk")

export const MOBILE_API_PREFIX = "/api/mobile/v1"
