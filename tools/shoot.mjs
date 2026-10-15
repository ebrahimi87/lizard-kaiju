// Screenshot helper for visual review. Takes one or more output/path pairs and reuses
// one browser so software WebGL compiles shaders only once per page.
//   node tools/shoot.mjs <out.png> <path-and-query> [<out2.png> <path2> ...]
// Env: PORT (default 4174), WIDTH/HEIGHT (default 1280x720), SETTLE ms (default 1500).
// Start the server first: PORT=4174 node tests/helpers/static-server.mjs
import { chromium } from "@playwright/test";

const pairs = process.argv.slice(2);
const port = process.env.PORT ?? "4174";
const width = Number(process.env.WIDTH ?? 1280);
const height = Number(process.env.HEIGHT ?? 720);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (let i = 0; i < pairs.length; i += 2) {
  const [out, path] = [pairs[i], pairs[i + 1]];
  const page = await browser.newPage({ viewport: { width, height } });
  const problems = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
  });
  await page.goto(`http://127.0.0.1:${port}/${path}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__LAB__?.ready || window.__LIZARD_KAIJU__?.ready, null, { timeout: 90_000 });
  await page.waitForTimeout(Number(process.env.SETTLE ?? 1500));
  await page.screenshot({ path: out });
  await page.close();
  if (problems.length) console.log(problems.join("\n"));
  console.log(`saved ${out}`);
}
await browser.close();
