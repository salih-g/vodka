/**
 * MAIN-world discovery fallback. Built as `inject.js` and exposed via
 * web_accessible_resources; the content script injects it if Kick's JSON API
 * shape ever drifts. It will hook window.fetch / XMLHttpRequest to capture the
 * HLS master URL and request headers directly from the page's own requests
 * (the isolated content-script world cannot see those).
 *
 * Primary VOD discovery uses the same-origin JSON API, so this is a no-op
 * placeholder wired up in the download-engine milestone.
 */
export default defineUnlistedScript(() => {
  // Intentionally empty for now — see the download-engine milestone.
});
