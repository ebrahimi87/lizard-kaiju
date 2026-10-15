// Start the shared server separately: node tests/helpers/static-server.mjs
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('assets/models/manifest.json', 'utf8'));
const categories = [...new Set(manifest.map(entry => entry.path.split('/')[0]))];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const stats = [];
const errors = [];
await mkdir('.artifacts/asset-sheets', { recursive: true });
try {
  for (const category of categories) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(`${category}: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(`${category}: ${message.text()}`);
    });
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) errors.push(`${category}: HTTP ${response.status()} ${response.url()}`);
    });
    await page.goto(`http://127.0.0.1:4173/tools/assets/preview.html?category=${category}`);
    await page.waitForFunction(() => window.assetsReady, null, { timeout: 120000 });
    stats.push(...await page.evaluate(() => window.assetStats));
    if (!process.argv.includes('--measure')) {
      await page.screenshot({ path: `.artifacts/asset-sheets/${category}.png`, fullPage: true });
      if (stats.some(entry => entry.path.startsWith(category + '/') && entry.checks.length)) {
        await page.evaluate(() => window.renderAssets(0.7));
        await page.screenshot({ path: `.artifacts/asset-sheets/${category}-motion.png`, fullPage: true });
      }
    }
    console.log(category, 'loaded');
    await page.close();
  }
} finally {
  await browser.close();
}
const output = process.argv.includes('--measure') ? '.artifacts/asset-raw-stats.json' : '.artifacts/asset-validation.json';
await writeFile(output, JSON.stringify({stats, errors}, null, 2) + '\n');
if (errors.length) throw new Error(errors.join('\n'));
console.log(stats.length, 'models validated');
