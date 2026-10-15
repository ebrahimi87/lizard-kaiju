// Visits every stage through the debug hooks and saves screenshots of the start, the
// catcher's first attack warning, and fire breath on the catcher.
//   node tools/stagetour.mjs [outDir] [firstStage] [lastStage]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".artifacts/tour";
const first = Number(process.argv[3] ?? 0);
const last = Number(process.argv[4] ?? 4);
mkdirSync(out, { recursive: true });
const port = process.env.PORT ?? "4174";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, hasTouch: true });
const problems = [];
page.on("pageerror", (error) => problems.push(`page error: ${error.message}\n${error.stack}`));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console error: ${message.text()}`);
});

const step = (seconds, input = {}) => page.evaluate(({ seconds, input }) => window.__LIZARD_KAIJU__.step(seconds, input), { seconds, input });
async function shot(name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 180_000 });
  console.log(`saved ${out}/${name}.png`);
}
// Joystick input pointing from the player toward a world point (screen right = world -X).
async function toward(target) {
  return page.evaluate((target) => {
    const game = window.__LIZARD_KAIJU__.game;
    const p = game.player.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const length = Math.hypot(dx, dz) || 1;
    return { x: -dx / length, y: dz / length };
  }, target);
}

await page.goto(`http://127.0.0.1:${port}/?debug=1`, { waitUntil: "load" });
await page.waitForFunction(() => window.__LIZARD_KAIJU__?.ready, null, { timeout: 180_000 });
await page.evaluate(() => {
  localStorage.clear();
  const game = window.__LIZARD_KAIJU__.game;
  game.save.tutorialDone = true;
});

for (let index = first; index <= last; index += 1) {
  let snapshot = await page.evaluate((index) => window.__LIZARD_KAIJU__.jump(index), index);
  console.log(`stage ${index}`, JSON.stringify(snapshot));
  snapshot = await step(1.0);
  await shot(`s${index}-start`);
  if (snapshot.stage === "city") {
    await page.evaluate(() => window.__LIZARD_KAIJU__.addGrowth(99));
  } else {
    await page.evaluate(() => {
      window.__LIZARD_KAIJU__.game.stageTime = 99;
    });
  }
  snapshot = await step(0.5);
  await shot(`s${index}-intro`);
  snapshot = await step(3.5);
  const attackStates = new Set(["windup", "aim", "punchWindup", "cannonAim"]);
  for (let i = 0; i < 40 && !attackStates.has(snapshot.catcher.state) && snapshot.phase === "playing"; i += 1) {
    snapshot = await step(0.25, await toward({ x: snapshot.catcher.x, z: snapshot.catcher.z }));
  }
  snapshot = await step(0.35);
  console.log(`  attack`, snapshot.phase, snapshot.catcher.state);
  await shot(`s${index}-attack`);
  for (let i = 0; i < 6 && snapshot.phase !== "playing"; i += 1) snapshot = await step(0.5, { taps: 3 });
  snapshot = await step(1.5, { ...(await toward({ x: snapshot.catcher.x, z: snapshot.catcher.z })), fire: true });
  snapshot = await step(0.4, { fire: true });
  console.log(`  fire`, snapshot.phase, snapshot.catcher.state, snapshot.bossHealth);
  await shot(`s${index}-fire`);
}
console.log(problems.length ? problems.join("\n") : "no browser errors");
await browser.close();
