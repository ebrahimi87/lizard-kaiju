// Screenshots of the title, Lizard Lab tabs, and sticker book.
//   node tools/menus.mjs [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".artifacts/menus";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, hasTouch: true });
const problems = [];
page.on("pageerror", (error) => problems.push(`page error: ${error.message}\n${error.stack}`));
page.on("console", (message) => message.type() === "error" && problems.push(`console: ${message.text()}`));
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4174}/?debug=1`);
await page.waitForFunction(() => window.__LIZARD_KAIJU__?.ready, null, { timeout: 120_000 });
// Give the save some gems and stickers so the shop shows every state.
await page.evaluate(() => {
  const game = window.__LIZARD_KAIJU__.game;
  Object.assign(game.save, { gems: 140, wins: 1, bestStage: 4 });
  Object.assign(game.save.stickers, { dog: true, cat: true, ladybug: true, beetle: true, "ladybug-gold": true, frog: true });
  game.enterTitle();
});
const shot = async (name) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 180_000 });
  console.log(`saved ${out}/${name}.png`);
};
await shot("title");
await page.evaluate(() => window.__LIZARD_KAIJU__.game.openLab());
await shot("lab-hats");
await page.evaluate(() => {
  const game = window.__LIZARD_KAIJU__.game;
  const card = document.querySelectorAll("#lab-grid .shop-card")[2];
  game.pickLabItem("hats", game.labItems("hats")[2], card);
});
await shot("lab-bought");
for (const tab of ["skins", "upgrades", "buddies"]) {
  await page.evaluate((tab) => window.__LIZARD_KAIJU__.game.openLabTab(tab), tab);
  await shot(`lab-${tab}`);
}
await page.evaluate(() => window.__LIZARD_KAIJU__.game.cycleLabForm(-1));
await shot("lab-kaiju");
await page.evaluate(() => window.__LIZARD_KAIJU__.game.closeOverlay());
await page.evaluate(() => window.__LIZARD_KAIJU__.game.openBook());
await shot("book");
console.log(problems.length ? problems.join("\n") : "no browser errors");
await browser.close();
