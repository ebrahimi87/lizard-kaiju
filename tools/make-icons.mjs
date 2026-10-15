// Renders the home-screen icons from the game's own gecko model.
//   node tools/make-icons.mjs   (static server on PORT, default 4174)
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const port = process.env.PORT ?? "4174";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
page.on("pageerror", (error) => console.log(`page error: ${error.message}`));
await page.goto(`http://127.0.0.1:${port}/lab.html?app=icon`, { waitUntil: "load" });
await page.waitForFunction(() => window.__ICONS__, null, { timeout: 120_000 });
const icons = await page.evaluate(() => window.__ICONS__);
for (const [size, url] of Object.entries(icons)) {
  writeFileSync(`assets/icons/icon-${size}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(`saved assets/icons/icon-${size}.png`);
}
await browser.close();
