import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./browser",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  globalSetup: "./helpers/require-chromium.mjs",
  outputDir: "../test-results",
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  retries: process.env.CI ? 1 : 0,
  timeout: 600_000,
  use: {
    baseURL,
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "node helpers/static-server.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
      },
    },
    {
      name: "ipad-landscape",
      use: {
        viewport: { width: 1194, height: 834 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "portrait",
      use: {
        viewport: { width: 834, height: 1194 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "ipad-webkit",
      use: {
        browserName: "webkit",
        viewport: { width: 1194, height: 834 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "pages-subpath",
      use: {
        baseURL: `${baseURL}/lizard-kaiju/`,
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
      },
    },
  ].filter((project) => project.name !== "ipad-webkit" || process.env.WEBKIT),
});
