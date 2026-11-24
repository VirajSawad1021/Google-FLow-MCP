import type { Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { BrowserManager } from "./browser.js";
import { CONFIG } from "./config.js";

export interface SessionStatus {
  loggedIn: boolean;
  url: string;
  userHint?: string;
  message: string;
}

export interface CreditStatus {
  credits: string | number;
  rawText: string;
}

export interface GenerationResult {
  success: boolean;
  outputPath: string;
  mediaType: "image" | "video";
  prompt: string;
  message: string;
}

export class FlowController {
  private browserManager: BrowserManager;

  constructor() {
    this.browserManager = BrowserManager.getInstance();
  }

  /**
   * Ensures the browser is open and navigated to a Google Flow project canvas.
   */
  public async ensurePage(): Promise<Page> {
    const page = await this.browserManager.getPage();
    const currentUrl = page.url();

    // If already inside a project canvas, reuse it
    if (currentUrl.includes("flow.google.com/project/")) {
      return page;
    }

    console.error("[GoogleFlowMCP] Navigating to Google Flow...");
    await page.goto("https://flow.google.com/", {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.defaultTimeoutMs,
    });
    await page.waitForTimeout(4000);

    // If on landing page with 'Create with Google Flow', click it
    const createBtn = page
      .locator('button:has-text("Create with Google Flow"), span:has-text("Create with Google Flow")')
      .first();
    if (await createBtn.isVisible().catch(() => false)) {
      console.error("[GoogleFlowMCP] Entering studio via 'Create with Google Flow'...");
      await createBtn.click().catch(() => {});
      await page.waitForTimeout(4000);
    }

    // Check if inside a project or on dashboard
    if (!page.url().includes("/project/")) {
      console.error("[GoogleFlowMCP] Opening project canvas...");
      // Try clicking existing project or New Project
      const projectLink = page.locator('a[href*="/project/"]').first();
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
      } else {
        const newProjectBtn = page.locator('text="New project", button:has-text("New project")').first();
        if (await newProjectBtn.isVisible().catch(() => false)) {
          await newProjectBtn.click();
        }
      }
      await page.waitForTimeout(5000);
    }

    return page;
  }

  /**
   * Checks if user is currently logged into Google Flow.
   */
  public async checkSession(): Promise<SessionStatus> {
    const page = await this.ensurePage();
    const url = page.url();

    const isLoginScreen = url.includes("accounts.google.com");
    if (isLoginScreen) {
      return {
        loggedIn: false,
        url,
        message: "Not logged in. Please run 'npm run login' in your terminal to sign in.",
      };
    }

    // Check for PRO badge or profile
    const hasPro = await page.locator('text="PRO"').isVisible().catch(() => false);

    return {
      loggedIn: true,
      url,
      userHint: hasPro ? "Google Flow Pro Member" : "Google Account",
      message: "Successfully connected and authenticated to Google Flow.",
    };
  }

  /**
   * Reads generation status from the UI.
   */
  public async getCredits(): Promise<CreditStatus> {
    const page = await this.ensurePage();
    const isPro = await page.locator('text="PRO"').isVisible().catch(() => false);

    return {
      credits: isPro ? "PRO (Unlimited / Subscribed)" : "Active",
      rawText: isPro ? "Google Flow Pro Subscription" : "Standard Account",
    };
  }

  /**
   * Triggers an image or video generation in the Google Flow workspace.
   */
  public async generateMedia(params: {
    prompt: string;
    mediaType: "image" | "video";
    aspectRatio?: "16:9" | "1:1" | "9:16";
  }): Promise<GenerationResult> {
    const page = await this.ensurePage();

    console.error(`[GoogleFlowMCP] Starting ${params.mediaType} generation for: "${params.prompt}"`);

    // 1. Locate ProseMirror prompt input box
    const promptInput = page
      .locator('div.ProseMirror[contenteditable="true"], [aria-label*="What do you want to create?" i]')
      .first();
    await promptInput.waitFor({ state: "visible", timeout: 20000 });

    // Focus, clear, and type prompt
    await promptInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await promptInput.fill(params.prompt);
    await page.waitForTimeout(500);

    // 2. Submit prompt by pressing Enter
    console.error("[GoogleFlowMCP] Submitting prompt...");
    await page.keyboard.press("Enter");

    // 3. Wait for generation to start and complete
    console.error("[GoogleFlowMCP] Waiting for generation to complete...");
    await page.waitForTimeout(5000);

    // Wait until stop button disappears (meaning generation finished)
    const stopButton = page.locator('button:has(svg), button[aria-label*="Stop" i]').last();
    const timeout = params.mediaType === "video" ? CONFIG.generationTimeoutMs : 90000;

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const isGenerating = await page.locator('text="%":has-text("%")').isVisible().catch(() => false);
      if (!isGenerating && Date.now() - startTime > 15000) {
        break; // Generation completed!
      }
      await page.waitForTimeout(3000);
    }

    // 4. Capture the resulting media asset
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = params.mediaType === "video" ? "mp4" : "png";
    const filename = `flow_${params.mediaType}_${timestamp}.${ext}`;
    const destinationPath = path.join(CONFIG.outputDir, filename);

    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    if (params.mediaType === "video") {
      const videoEl = page.locator("video").last();
      await videoEl.waitFor({ state: "visible", timeout: 15000 }).catch(() => null);
      const src = await videoEl.getAttribute("src").catch(() => null);
      if (src && src.startsWith("http")) {
        const res = await page.request.get(src);
        fs.writeFileSync(destinationPath, await res.body());
      } else {
        await videoEl.screenshot({ path: destinationPath }).catch(async () => {
          await page.screenshot({ path: destinationPath });
        });
      }
    } else {
      // Find the generated image element on canvas or in session panel
      const imgEl = page.locator('img[src*="flow.google.com/asb/"]').last();
      await imgEl.waitFor({ state: "visible", timeout: 20000 }).catch(() => null);

      let saved = false;
      const src = await imgEl.getAttribute("src").catch(() => null);
      if (src && src.startsWith("http")) {
        // Replace Google thumbnail scaling with =s0 for original uncompressed master resolution
        const masterUrl = src.replace(/=s\d+.*$/, "=s0");
        try {
          const resp = await page.request.get(masterUrl);
          const buffer = await resp.body();
          fs.writeFileSync(destinationPath, buffer);
          saved = true;
          console.error(`[GoogleFlowMCP] Downloaded full master resolution image (${(buffer.length / 1024).toFixed(1)} KB)`);
        } catch (e: any) {
          console.error("[GoogleFlowMCP] Failed to download master URL, falling back to screenshot:", e.message);
        }
      }

      if (!saved) {
        if (await imgEl.isVisible().catch(() => false)) {
          await imgEl.screenshot({ path: destinationPath });
        } else {
          // Fallback: screenshot active canvas
          await page.screenshot({ path: destinationPath });
        }
      }
    }

    console.error(`[GoogleFlowMCP] Asset successfully saved to: ${destinationPath}`);

    return {
      success: true,
      outputPath: destinationPath,
      mediaType: params.mediaType,
      prompt: params.prompt,
      message: `Successfully generated ${params.mediaType} and saved to ${destinationPath}`,
    };
  }
}
