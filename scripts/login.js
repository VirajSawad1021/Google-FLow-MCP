import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const userDataDir = process.env.FLOW_USER_DATA_DIR || path.join(rootDir, ".browser-data-9227");

if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

console.log("==================================================");
console.log("       Google Flow Login & Session Launcher       ");
console.log("==================================================");
console.log(`Using profile path: ${userDataDir}`);
console.log("Launching Chrome window...");
console.log("The browser will open to Google Sign-in.");
console.log("Please select your Google account and log in.");
console.log("==================================================\n");

async function launch() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: false,
    viewport: null,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox"
    ],
    ignoreDefaultArgs: ["--enable-automation"]
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Navigating to https://flow.google.com/...");
  await page.goto("https://flow.google.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  // Automatically click "Create with Google Flow" so it immediately presents the sign-in screen
  await page.waitForTimeout(2000);
  const createBtn = page.locator('button:has-text("Create with Google Flow"), span:has-text("Create with Google Flow")').first();
  if (await createBtn.isVisible().catch(() => false)) {
    console.log("Entering login / studio screen...");
    await createBtn.click().catch(() => {});
  }

  console.log("\n>>> Chrome is open on your screen! <<<");
  console.log("1. Select your Google account and enter your password / 2FA.");
  console.log("2. Once signed in, you will be on the Google Flow studio page.");
  console.log("3. After you see the studio, you can close the browser or press Ctrl+C here.\n");

  context.on("close", () => {
    console.log("Browser window closed. Login session saved!");
    process.exit(0);
  });
}

launch().catch((err) => {
  console.error("Failed to launch Chrome:", err.message);
  process.exit(1);
});
