import { access } from "node:fs/promises";
import { chromium, webkit } from "@playwright/test";

export default async function requireBrowsers() {
  const browsers = [["Chromium", chromium.executablePath()]];
  if (process.env.WEBKIT) {
    browsers.push(["WebKit", webkit.executablePath()]);
  }
  for (const [name, executable] of browsers) {
    try {
      await access(executable);
    } catch {
      throw new Error(
        `Playwright ${name} is not installed at ${executable}. ` +
          'Run "npm install" followed by "npm run install:browser".',
      );
    }
  }
}
