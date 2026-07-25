<div align="center">

# 🍸 vodka

**Download Kick VODs as MP4 — any quality, any length, constant memory.**

A Manifest V3 Chrome extension. Detects the VOD you're watching on Kick,
resolves every available quality, and streams it straight to disk as an MP4 —
without ever holding the whole video in memory, no matter how long it is.

[![CI](https://github.com/salih-g/vodka/actions/workflows/ci.yml/badge.svg)](https://github.com/salih-g/vodka/actions/workflows/ci.yml)

</div>

---

## Why it's built this way

Kick serves video over **HLS** (Amazon IVS) — H.264 + AAC in MPEG-TS segments,
no DRM. Downloading a multi-hour VOD "properly" comes down to one rule:
**never hold the video in memory** — not on the way in, not on the way out.

- **Discovery** runs on the `kick.com` origin (content script), so the API call
  rides your own session and never trips Cloudflare. No scraping, no CAPTCHA.
- **The download is owned by a dedicated extension page** (a real tab) — the
  only MV3 context with a DOM, a user gesture, and the File System Access API.
  The service worker is just a coordinator; the popup only launches the job.
- **The engine streams**: parse the master playlist → fetch segments with
  bounded concurrency + an ordered write buffer → remux MPEG-TS to fragmented
  MP4 on the fly (`mux.js`) → write each chunk to disk via
  `showSaveFilePicker()`. Peak memory stays at a few MB whether the VOD is
  10 minutes or 10 hours. No `ffmpeg.wasm`, no 2 GB WASM ceiling.

## Tech

- **[WXT](https://wxt.dev)** — MV3 framework (Vite) · **React** · **TypeScript** · **Tailwind CSS v4**
- **[m3u8-parser](https://github.com/videojs/m3u8-parser)** — HLS manifest parsing
- **[mux.js](https://github.com/videojs/mux.js)** — streaming MPEG-TS → fragmented MP4
- **File System Access API** — constant-memory streamed writes to disk

## Status

| Area | State |
| --- | --- |
| VOD detection + master-playlist resolution | ✅ |
| Quality enumeration (all renditions) | ✅ |
| Constant-memory HLS → MP4 streaming engine | ✅ |
| Capture-deck popup + downloader UI | ✅ |
| Live end-to-end run against a real VOD | 🚧 pending test |

## Development

```bash
bun install
bun run dev        # launches Chrome with the extension + HMR
bun run build      # production build -> .output/chrome-mv3
bun run zip        # packaged .zip
```

To run without the dev server: `bun run build`, then load
`.output/chrome-mv3` via `chrome://extensions` → Developer mode → **Load unpacked**.

### Tests

```bash
bun run compile     # typecheck
bun test            # unit tests (classify, formatting, container, download engine)
bun run verify:mux  # run the real engine against a public HLS stream and
                    # validate the produced fragmented MP4 (network)
```

## Disclaimer

For downloading **your own content**, or content you have permission to save,
for personal offline viewing. Not for redistribution. Respect creators' rights
and Kick's Terms of Service.
