import { test, expect } from "@playwright/test";

// Software WebGL is slow; these tests check behavior, not frame rate.
test.setTimeout(600_000);

async function boot(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console error: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto("./?debug=1", { waitUntil: "load" });
  await page.waitForFunction(() => window.__LIZARD_KAIJU__?.ready, null, { timeout: 180_000 });
  return problems;
}

const step = (page, seconds, input = {}) => page.evaluate(({ seconds, input }) => window.__LIZARD_KAIJU__.step(seconds, input), { seconds, input });

test("boots to the title and starts playing", async ({ page }, info) => {
  test.skip(info.project.name === "portrait");
  const problems = await boot(page);
  await expect(page.locator("#title")).toBeVisible();
  await expect(page.locator("#play-button")).toBeVisible();
  // The button pulses gently, so it never counts as "stable"; tap it directly.
  await page.locator("#play-button").click({ force: true });
  await expect(page.locator("#hud")).toBeVisible();
  const snapshot = await step(page, 1, { x: 0, y: 1 });
  expect(snapshot.phase).toBe("playing");
  expect(snapshot.player.z).toBeGreaterThan(0.5);
  expect(problems).toEqual([]);
});

test("every stage loads, the catcher warns before attacking, and breath works", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  const problems = await boot(page);
  for (let index = 0; index < 5; index += 1) {
    let snapshot = await page.evaluate((index) => window.__LIZARD_KAIJU__.jump(index), index);
    expect(snapshot.phase).toBe("playing");
    if (snapshot.stage === "city") await page.evaluate(() => window.__LIZARD_KAIJU__.addGrowth(99));
    else await page.evaluate(() => (window.__LIZARD_KAIJU__.game.stageTime = 99));
    // Stand still from the moment he arrives. The first attack must start only after the
    // arrival cinematic and must be a visible warning, never an instant catch.
    const warnings = new Set(["windup", "aim", "punchWindup", "cannonAim"]);
    let warned = false;
    for (let i = 0; i < 160 && (snapshot.phase === "playing" || snapshot.phase === "intro"); i += 1) {
      snapshot = await step(page, 0.1);
      if (warnings.has(snapshot.catcher.state)) {
        expect(snapshot.phase, `${snapshot.stage} attacks only after the intro`).toBe("playing");
        warned = true;
      }
    }
    expect(snapshot.catcher.state).not.toBe("away");
    expect(warned, `${snapshot.stage} warned before attacking`).toBe(true);
  }
  expect(problems).toEqual([]);
});

test("iPad touch: joystick moves the lizard and the fire button breathes", async ({ page }, info) => {
  test.skip(info.project.name !== "ipad-landscape");
  const problems = await boot(page);
  await page.evaluate(() => {
    window.__LIZARD_KAIJU__.game.save.tutorialDone = true;
    window.__LIZARD_KAIJU__.play();
  });
  const zone = await page.locator("#joystick-zone").boundingBox();
  const startX = zone.x + zone.width * 0.4;
  const startY = zone.y + zone.height * 0.6;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 80, { steps: 4 });
  const before = await page.evaluate(() => window.__LIZARD_KAIJU__.snapshot().player.z);
  // Software WebGL renders only a few frames a second, so wait for distance, not time.
  await page.waitForFunction((before) => window.__LIZARD_KAIJU__.snapshot().player.z > before + 0.5, before, { timeout: 60_000 });
  await page.mouse.up();
  const fire = await page.locator("#fire-button").boundingBox();
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.__LIZARD_KAIJU__.game.breath.active === "fire", null, { timeout: 30_000 });
  await page.mouse.up();
  expect(problems).toEqual([]);
});

test("portrait shows the rotate prompt", async ({ page }, info) => {
  test.skip(info.project.name !== "portrait");
  await page.goto("./?debug=1", { waitUntil: "load" });
  await expect(page.locator("#rotate")).toBeVisible();
});

test("works from the GitHub Pages sub-path", async ({ page }, info) => {
  test.skip(info.project.name !== "pages-subpath");
  const problems = await boot(page);
  await expect(page.locator("#title")).toBeVisible();
  expect(problems).toEqual([]);
});
