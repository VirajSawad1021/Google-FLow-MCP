<div align="center">

# Google Flow MCP Server

**Connect AI assistants (Claude Desktop, Cursor, Antigravity IDE, Windsurf) directly to Google Flow & Veo via Model Context Protocol.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.6+-8A2BE2)](https://modelcontextprotocol.io/)
[![Playwright](https://img.shields.io/badge/Playwright-CDP-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

Generate **high-resolution images** and **Veo videos** from natural language prompts using your existing Google Flow / Google Labs session—no separate API billing required.

</div>

---

## Features

- **Image & Video Generation via MCP:** Exposes clean, Zod-validated tools for both image generation (`16:9`, `1:1`, `9:16`) and **Veo** video generation (`16:9`, `9:16`).
- **Warm Chrome CDP Architecture:** Attaches to a persistent local Google Chrome instance over Chrome DevTools Protocol (`FLOW_CDP_PORT`, default `9227`). Disconnecting the MCP server leaves Chrome warm for instant subsequent calls.
- **Full Master Resolution Downloads:** Automatically rewrites Google Flow image URLs to `=s0` to fetch uncompressed original resolution assets directly to `./outputs/`.
- **Zero Credential Storage:** Uses a local Chrome user-data directory (`.browser-data-9227/` by default). You sign in once interactively (`npm run login`); passwords and OAuth tokens are never read or stored by the server.
- **Agent-Ready Context:** Ships with [`AGENTS.md`](AGENTS.md) so AI coding agents immediately understand the architecture, CDP lifecycle, and DOM selector conventions.

---

## Architecture Overview

```text
┌───────────────────────────┐      stdio (JSON-RPC)      ┌──────────────────────────────┐
│   MCP Client / AI Agent   │ ◄────────────────────────► │   Google Flow MCP Server     │
│ (Claude, Cursor, AGY IDE) │                            │  src/index.ts (McpServer)    │
└───────────────────────────┘                            └──────────────┬───────────────┘
                                                                        │
                                                         ┌──────────────▼───────────────┐
                                                         │       FlowController         │
                                                         │  src/flow-controller.ts      │
                                                         └──────────────┬───────────────┘
                                                                        │
                                                          CDP (http://127.0.0.1:9227)
                                                                        │
                                                         ┌──────────────▼───────────────┐
                                                         │   Warm Chrome Instance       │
                                                         │  (Persistent Profile)        │
                                                         │  https://flow.google.com/    │
                                                         └──────────────────────────────┘
```

---

## Exposed MCP Tools

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `flow_status` | *(none)* | Checks if Chrome is connected, authenticated on Google Flow, and returns the active project URL and account tier. |
| `flow_get_credits` | *(none)* | Inspects the Google Flow UI to report account / credit status (e.g., `PRO (Unlimited / Subscribed)` or `Active`). |
| `flow_generate_image` | `prompt` (`string`), `aspectRatio` (`"16:9" \| "1:1" \| "9:16"`, default `"16:9"`) | Submits an image generation prompt to Google Flow and saves the master `.png` to `FLOW_OUTPUT_DIR`. |
| `flow_generate_video` | `prompt` (`string`), `aspectRatio` (`"16:9" \| "9:16"`, default `"16:9"`) | Submits a motion/scene prompt to **Veo** on Google Flow and saves the resulting `.mp4` to `FLOW_OUTPUT_DIR`. |
| `flow_open_browser` | *(none)* | Opens or focuses the Google Flow project canvas in Chrome for manual inspection or prompt iteration. |

---

## Quick Start

### 1. Install & Build

```bash
git clone https://github.com/VirajSawad1021/Google-FLow-MCP.git
cd Google-FLow-MCP
npm install
npm run build
```

### 2. One-Time Google Sign-In

Launch Chrome with the dedicated persistent profile and sign in to your Google account:

```bash
npm run login
```

Once the Google Flow studio loads, your session cookies are saved locally in `.browser-data-9227/`.

### 3. (Optional) Pre-Warm Chrome

Keep a warm Chrome instance listening on the CDP port so MCP tool calls execute without browser launch overhead:

```bash
npm run warm
```

### 4. Configure Your MCP Client

Add the server to your MCP client configuration (Claude Desktop, Cursor, Antigravity IDE, etc.):

```json
{
  "mcpServers": {
    "google-flow": {
      "command": "node",
      "args": ["/absolute/path/to/Google-FLow-MCP/dist/index.js"]
    }
  }
}
```

Or run directly from TypeScript without a build step:

```json
{
  "mcpServers": {
    "google-flow": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/Google-FLow-MCP/src/index.ts"]
    }
  }
}
```

---

## Configuration (`.env`)

Copy `.env.example` to `.env` to customize ports, paths, or headless behavior:

```env
# Set to true for headless operation after logging in (false recommended for reliability)
FLOW_HEADLESS=false

# Dedicated Chrome remote debugging port (default: 9227)
FLOW_CDP_PORT=9227

# Directory for generated images and videos (default: ./outputs)
FLOW_OUTPUT_DIR=./outputs

# Directory for persistent Chrome profile (default: ./.browser-data-9227)
FLOW_USER_DATA_DIR=./.browser-data-9227
```

---

## Project Structure

```text
Google-FLow-MCP/
├── AGENTS.md                 # Architectural & operational context for AI agents
├── scripts/
│   ├── login.js              # Interactive 1-time Google Flow login launcher
│   ├── warm-browser.js       # Detached warm Chrome CDP daemon
│   ├── cleanup.js            # Output/temp cleanup helper
│   └── dump-dom.js           # Selector inspection helper for UI updates
├── src/
│   ├── index.ts              # MCP server entrypoint & Zod tool definitions
│   ├── browser.ts            # Singleton CDP Chrome connection & lifecycle manager
│   ├── flow-controller.ts    # Studio navigation, generation polling & =s0 asset download
│   └── config.ts             # Environment config, timeouts & DOM selectors
├── .env.example
├── package.json
└── tsconfig.json
```

---

## For AI Agents (Context Summary)

If you are an AI agent integrating or maintaining this repository, read [`AGENTS.md`](AGENTS.md) for full details. Key points:
- **Transport:** `StdioServerTransport` — all diagnostic logs use `console.error()` (`stderr`) to keep `stdout` valid for MCP JSON-RPC.
- **Studio Flow:** `FlowController.ensurePage()` automatically navigates from `https://flow.google.com/` into an active `/project/` canvas before interacting with `div.ProseMirror[contenteditable="true"]`.
- **Master Assets:** Generated images are fetched via the `flow.google.com/asb/` source with `=s0` appended for full original resolution.

---

## License

[MIT](LICENSE)
