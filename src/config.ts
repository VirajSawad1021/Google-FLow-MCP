import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..");
export const USER_DATA_DIR = process.env.FLOW_USER_DATA_DIR || path.join(ROOT_DIR, ".browser-data-9227");
export const OUTPUT_DIR = process.env.FLOW_OUTPUT_DIR || path.join(ROOT_DIR, "outputs");

export const CONFIG = {
  flowUrl: "https://labs.google/fx/tools/flow",
  userDataDir: USER_DATA_DIR,
  outputDir: OUTPUT_DIR,
  cdpPort: Number(process.env.FLOW_CDP_PORT || 9227),
  headless: process.env.FLOW_HEADLESS === "true", // Default false for visibility & anti-bot reliability
  browserChannel: "chrome", // Uses installed Google Chrome
  defaultTimeoutMs: 60000,
  generationTimeoutMs: 180000, // 3 minutes for video / batch images
  selectors: {
    // Selectors are kept modular with fallback queries for Google Flow UI
    loginPrompt: 'text="Sign in"',
    userAvatar: 'img[alt*="Google Account"], [aria-label*="Google Account"]',
    creditsBadge: '[data-testid="credits-badge"], [aria-label*="credit"], [aria-label*="Credit"]',
    promptInput: 'textarea, [contenteditable="true"], input[type="text"][placeholder*="prompt" i]',
    generateButton: 'button:has-text("Generate"), button:has-text("Create"), button[aria-label*="Generate" i]',
    mediaItems: 'video, img[src*="blob:"], img[src*="googleusercontent"]',
    downloadButton: 'button[aria-label*="Download" i], button:has-text("Download")',
  }
};
