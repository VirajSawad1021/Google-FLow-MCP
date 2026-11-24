import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const userDataDir = process.env.FLOW_USER_DATA_DIR || path.join(rootDir, ".browser-data-9227");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = Number(process.env.FLOW_CDP_PORT || 9227);

console.log("==================================================");
console.log("       Starting Warm Chrome Daemon for Google Flow ");
console.log("==================================================");
console.log(`Port: ${port}`);
console.log(`Profile: ${userDataDir}`);

if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

// Check if already running
async function isRunning() {
  for (const host of ["127.0.0.1", "localhost"]) {
    try {
      const res = await fetch(`http://${host}:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch (_) {}
  }
  return false;
}

async function start() {
  if (await isRunning()) {
    console.log(`Chrome is already warm and running on port ${port}!`);
    console.log("Your MCP server can connect instantly.");
    return;
  }

  console.log("Launching dedicated Chrome instance with CDP...");
  const args = [
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized",
    "https://flow.google.com/"
  ];

  const proc = spawn(chromePath, args, {
    detached: true,
    stdio: "ignore"
  });
  proc.unref();

  console.log("Waiting for CDP remote debugging to be ready...");
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isRunning()) {
      console.log(`\n>>> Chrome is WARM and READY on port ${port}! <<<`);
      console.log("Keep this Chrome window running or minimized in the background.");
      console.log("All Google Flow MCP generation requests will now execute instantly without browser startup lag!");
      return;
    }
  }

  console.error("Warning: Timed out waiting for Chrome CDP port.");
}

start().catch(console.error);
