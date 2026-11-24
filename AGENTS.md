# AGENTS.md — AI Agent Context & Working Guide

This file provides architectural context, runtime mechanics, and operational notes for AI coding agents working with or extending **Google Flow MCP**.

## What This Project Is
`google-flow-mcp` is a **Model Context Protocol (MCP)** stdio server written in TypeScript (`@modelcontextprotocol/sdk` + `playwright` + `zod`) that automates the **Google Flow** web application (`https://labs.google/fx/tools/flow` / `https://flow.google.com/`) via a persistent, authenticated Google Chrome instance over **Chrome DevTools Protocol (CDP)**.

Instead of calling paid external APIs, it reuses the user's authenticated Google Flow / Google Labs session (including Google Flow Pro / Veo / Imagen / Nano Banana) to generate images and videos and save them locally.

---

## Architecture & File Map

| File | Responsibility |
| :--- | :--- |
| `src/index.ts` | MCP server entrypoint (`StdioServerTransport`). Registers the 5 MCP tools (`flow_status`, `flow_get_credits`, `flow_generate_image`, `flow_generate_video`, `flow_open_browser`) with Zod schemas and handles `SIGINT`/`SIGTERM` graceful disconnects. |
| `src/config.ts` | Loads `.env` via `dotenv`, resolves `USER_DATA_DIR` (`.browser-data-9227` by default), `OUTPUT_DIR` (`./outputs`), `cdpPort` (`9227` by default), `headless` (`false` by default), timeouts (`60s` default, `180s` generation), and DOM selectors. |
| `src/browser.ts` | Singleton `BrowserManager`. Checks `http://localhost:<cdpPort>/json/version` and `http://127.0.0.1:<cdpPort>/json/version`. If Chrome is not running, spawns Chrome with `--remote-debugging-port`, `--user-data-dir`, and `--disable-blink-features=AutomationControlled`. Connects via `chromium.connectOverCDP()` and returns an existing `flow.google` / `labs.google` tab or opens one. Note: `close()` disconnects Playwright without killing the warm Chrome process. |
| `src/flow-controller.ts` | `FlowController` class implementing `ensurePage()`, `checkSession()`, `getCredits()`, and `generateMedia()`. Handles landing-page navigation (`Create with Google Flow` -> project canvas), ProseMirror prompt input, Enter submission, polling for completion, and downloading full-resolution assets (`=s0` master URL rewrite for images, `src` fetch or screenshot fallback for video). |
| `scripts/login.js` | One-time interactive Chrome launcher (`npm run login`) using `chromium.launchPersistentContext` so the user can sign in with Google credentials / 2FA and persist cookies into `USER_DATA_DIR`. |
| `scripts/warm-browser.js` | Detached daemon launcher (`npm run warm`) that pre-starts Chrome on `FLOW_CDP_PORT` so MCP tool calls attach immediately without browser cold-start latency. |
| `scripts/cleanup.js` | Utility script for cleaning temporary/output artifacts. |
| `scripts/dump-dom.js` | Diagnostic script for inspecting current Google Flow DOM selectors when the web UI updates. |

---

## How Execution Works (Runtime Lifecycle)

1. **Startup:** The MCP client launches `node dist/index.js` (or `tsx src/index.ts`) over stdio. Logs go to `stderr` (`console.error`) so `stdout` remains clean for JSON-RPC MCP frames.
2. **Browser Connection (`BrowserManager.getPage()`):**
   - Probes `http://localhost:${cdpPort}/json/version` and `127.0.0.1`.
   - If unreachable, spawns Chrome with the configured `userDataDir` and `cdpPort` and polls up to 15s.
   - Attaches Playwright via `chromium.connectOverCDP()` and selects any open `flow.google` / `labs.google` tab.
3. **Studio Navigation (`FlowController.ensurePage()`):**
   - If already on `flow.google.com/project/...`, reuses the active canvas immediately.
   - Otherwise navigates to `https://flow.google.com/`, clicks `"Create with Google Flow"` if present, and opens the first existing `/project/` link or `"New project"`.
4. **Media Generation (`FlowController.generateMedia()`):**
   - Focuses `div.ProseMirror[contenteditable="true"]` (or `[aria-label*="What do you want to create?" i]`), clears via `Ctrl+A` + `Backspace`, fills the prompt, and submits with `Enter`.
   - Polls for completion (up to 90s for images, 180s for Veo videos).
   - For **images**: grabs `img[src*="flow.google.com/asb/"]`, rewrites `=s\d+.*` to `=s0` to fetch uncompressed master resolution, and writes `outputs/flow_image_<timestamp>.png` (with element/page screenshot fallback).
   - For **videos**: grabs `<video>` `src` and downloads `outputs/flow_video_<timestamp>.mp4`.

---

## Known Quirks & Agent Caveats

- **Prompt box `aria-label` changes when a tile is selected:** When an existing generated image/tile is selected on the Flow canvas, Flow changes the prompt box's `aria-label` from `"What do you want to create?"` to `"What do you want to change?"`. `div.ProseMirror[contenteditable="true"]` still matches both states as long as a project canvas is open.
- **Port conflicts:** Keep `FLOW_CDP_PORT` dedicated (default `9227`). Do not point multiple independent browser automation drivers at the same CDP port.
- **UI updates:** Google Flow is a live web app; if selectors drift, run `scripts/dump-dom.js` against the warm browser and update `src/config.ts` / `src/flow-controller.ts`, then rebuild with `npm run build`.
- **Never commit secrets/profiles:** `.env`, `.browser-data*/`, and `outputs/` are git-ignored and must stay local.
