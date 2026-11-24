import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const userDataDir = path.join(rootDir, ".browser-data");

console.log("Cleaning up lingering Chrome processes...");
try {
  execSync(
    'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = \'chrome.exe\'\\" | Where-Object { $_.CommandLine -like \'*browser-data*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host $_.ProcessId }"',
    { stdio: "inherit" }
  );
} catch (e) {
  // Ignore
}

// Remove lock files if left behind
const lockFiles = ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"];
for (const lock of lockFiles) {
  const p = path.join(userDataDir, lock);
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
      console.log(`Removed lock file: ${lock}`);
    } catch (_) {}
  }
}
console.log("Cleanup done.");
