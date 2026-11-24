import { BrowserManager } from "../dist/browser.js";
import fs from "node:fs";

async function main() {
  const page = await BrowserManager.getInstance().getPage();
  await page.goto("https://flow.google.com/about", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const html = await page.content();
  fs.writeFileSync("./outputs/page_dom.html", html, "utf-8");
  console.log("DOM written to ./outputs/page_dom.html");

  // Also log all iframes if any
  const frames = page.frames();
  console.log(`Frames count: ${frames.length}`);
  for (let i = 0; i < frames.length; i++) {
    console.log(`Frame ${i}: ${frames[i].url()}`);
  }

  await BrowserManager.getInstance().close();
}

main().catch(console.error);
