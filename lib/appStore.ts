/**
 * The Scorers iPhone app on the App Store.
 *
 * `APP_STORE_ID` is the app's Apple ID, the same number as `ascAppId` in
 * `apps/mobile/eas.json`. The store link carries no country or app-name slug:
 * `apps.apple.com/app/id…` redirects to the visitor's own storefront, and the
 * name slug would break if the listing were ever renamed.
 */
export const APP_STORE_ID = "6802136244"

export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`
