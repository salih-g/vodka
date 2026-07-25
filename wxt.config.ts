import { defineConfig } from 'wxt';

// WXT config — https://wxt.dev/api/config.html
// Tailwind v4 is wired via postcss.config.mjs (@tailwindcss/postcss), which is
// robust across Vite versions, instead of the @tailwindcss/vite plugin.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Vodka — Kick VOD Downloader',
    description:
      'Download Kick VODs as MP4 in any available quality — any length, constant memory.',
    // storage: persist jobs/settings. tabs: open the downloader page.
    // scripting: MAIN-world hook fallback. cookies: authed (sub-only) VODs.
    permissions: ['storage', 'tabs', 'scripting', 'cookies'],
    // Extension pages/SW bypass CORS only for hosts listed here: kick.com (API,
    // same-origin from the content script) and the Amazon IVS media CDNs that
    // serve the master playlist and .ts segments for VODs.
    host_permissions: [
      '*://kick.com/*',
      '*://*.kick.com/*',
      '*://*.live-video.net/*',
      '*://*.cloudfront.net/*',
    ],
    // inject.js is the MAIN-world fetch/XHR hook used as a discovery fallback.
    web_accessible_resources: [
      {
        resources: ['inject.js'],
        matches: ['*://*.kick.com/*'],
      },
    ],
  },
});
