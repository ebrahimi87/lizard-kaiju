// Scripted playtest with screenshots. Drives the game through its debug hooks.
//   node tools/playtest.mjs [outDir]
// Env: PORT (default 4174), WIDTH/HEIGHT (default 1194x834, iPad landscape).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".artifacts/playtest";
mkdirSync(out, { recursive: true });
const port = process.env.PORT ?? "4174";
const width = Number(process.env.WIDTH ?? 1194);
const height = Number(process.env.HEIGHT ?? 834);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
const problems = [];
page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console error: ${message.text()}`);
});
page.on("requestfailed", (request) => problems.push(`request failed: ${request.url()}`));

async function shot(name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 180_000 });
  console.log(`saved ${out}/${name}.png`);
}

// Steps the simulation; input may be a function of the snapshot (re-evaluated each 0.25 s).
async function step(seconds, input = {}) {
  return page.evaluate(
    ({ seconds, input }) => window.__LIZARD_KAIJU__.step(seconds, input),
    { seconds, input },
  );
}

// Walks toward the nearest critter for a while.
async function hunt(seconds) {
  let snapshot = null;
  for (let t = 0; t < seconds; t += 0.25) {
    const direction = await page.evaluate(() => {
      const game = window.__LIZARD_KAIJU__.game;
      const player = game.player.position;
      const critter = game.critters.nearest(player.x, player.z, 99);
      if (!critter) return { x: 0, y: 0 };
      const dx = critter.position.x - player.x;
      const dz = critter.position.z - player.z;
      const length = Math.hypot(dx, dz) || 1;
      // Screen right is world -X; screen up is world +Z.
      return { x: -dx / length, y: dz / length };
    });
    snapshot = await step(0.25, direction);
  }
  return snapshot;
}

await page.goto(`http://127.0.0.1:${port}/?debug=1`, { waitUntil: "load" });
await page.waitForFunction(() => window.__LIZARD_KAIJU__?.ready, null, { timeout: 120_000 });
await page.evaluate(() => localStorage.clear());
await shot("01-title");
await page.evaluate(() => window.__LIZARD_KAIJU__.play());
await step(0.6);
await shot("02-start");
let snapshot = await hunt(6);
console.log("after hunting", JSON.stringify(snapshot));
await shot("03-hunting");
snapshot = await step(0.2, { fire: true });
await step(0.4, { fire: true });
await shot("04-fire");
// Bring the catcher in.
await page.evaluate(() => {
  window.__LIZARD_KAIJU__.game.stageTime = 99;
});
await step(1.2);
await shot("05-catcher-intro");
await step(2);
snapshot = await step(0.1);
console.log("catcher", JSON.stringify(snapshot.catcher));
// Stand still until he winds up.
for (let i = 0; i < 20 && snapshot.catcher.state !== "windup"; i += 1) snapshot = await step(0.25);
await step(0.4);
await shot("06-windup");
for (let i = 0; i < 12 && snapshot.phase !== "caught"; i += 1) snapshot = await step(0.25);
await step(0.3);
await shot("07-caught");
snapshot = await step(0.6, { taps: 2 });
for (let i = 0; i < 8 && snapshot.phase === "caught"; i += 1) snapshot = await step(0.1, { taps: 1 });
console.log("after escape", snapshot.phase, snapshot.hearts);
await step(0.3);
await shot("08-escaped");
await page.evaluate(() => window.__LIZARD_KAIJU__.addGrowth(99));
await step(0.9);
await shot("09-evolving");
await step(0.7);
await shot("10-evolved");
console.log(problems.length ? problems.join("\n") : "no browser errors");
await browser.close();
