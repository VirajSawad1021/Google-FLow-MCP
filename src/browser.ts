import { chromium, type Browser, type Page } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { CONFIG } from "./config.js";

const CDP_PORT = CONFIG.cdpPort;

export class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private activePage: Page | null = null;
  private activeCdpUrl: string = `http://localhost:${CDP_PORT}`;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Checks if Chrome is already listening on the CDP debugging port (testing localhost and 127.0.0.1).
   */
  private async isCDPAvailable(): Promise<boolean> {
    for (const host of ["localhost", "127.0.0.1"]) {
      try {
        const url = `http://${host}:${CDP_PORT}`;
        const res = await fetch(`${url}/json/version`, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          this.activeCdpUrl = url;
          return true;
        }
      } catch {
        // Continue trying next host
      }
    }
    return false;
  }

  /**
   * Spawns a dedicated Chrome process with CDP remote debugging.
   */
  private async spawnChrome(): Promise<void> {
    if (!fs.existsSync(CONFIG.userDataDir)) {
      fs.mkdirSync(CONFIG.userDataDir, { recursive: true });
    }
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    console.error(`[GoogleFlowMCP] Starting warm Chrome instance on port ${CDP_PORT}...`);

    const args = [
      `--remote-debugging-port=${CDP_PORT}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${CONFIG.userDataDir}`,
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      CONFIG.headless ? "--headless=new" : "--start-maximized",
      CONFIG.flowUrl
    ];

    const proc = spawn(chromePath, args, {
      detached: true,
      stdio: "ignore"
    });
    proc.unref();

    // Poll until CDP becomes available (up to 15 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      if (await this.isCDPAvailable()) {
        console.error(`[GoogleFlowMCP] Chrome CDP port is ready on ${this.activeCdpUrl}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    throw new Error("Timed out waiting for warm Chrome to start with remote debugging.");
  }

  /**
   * Connects to the warm Chrome instance over CDP.
   */
  public async getPage(): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }

    const cdpReady = await this.isCDPAvailable();
    if (!cdpReady) {
      await this.spawnChrome();
    }

    if (!this.browser || !this.browser.isConnected()) {
      console.error(`[GoogleFlowMCP] Connecting to warm Chrome via CDP: ${this.activeCdpUrl}`);
      this.browser = await chromium.connectOverCDP(this.activeCdpUrl);
    }

    const contexts = this.browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();

    // Find existing Google Flow page or pick first page
    const pages = context.pages();
    for (const p of pages) {
      const url = p.url();
      if (url.includes("flow.google") || url.includes("labs.google")) {
        this.activePage = p;
        this.activePage.setDefaultTimeout(CONFIG.defaultTimeoutMs);
        return this.activePage;
      }
    }

    this.activePage = pages.length > 0 ? pages[0] : await context.newPage();
    this.activePage.setDefaultTimeout(CONFIG.defaultTimeoutMs);
    return this.activePage;
  }

  /**
   * Disconnects from the warm browser without killing the Chrome process.
   */
  public async close(): Promise<void> {
    if (this.browser) {
      // Disconnect instead of close so Chrome stays warm for subsequent requests
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.activePage = null;
    }
  }
}
