import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  // Baselines are per-platform: WebGL output and CSS layout rounding both differ
  // between macOS and Linux (the canvas lands on 554px tall here, 553px on Linux),
  // and a one-row shift is enough to blow past maxDiffPixelRatio on the detailed
  // fractal scenes. Without {platform}, macOS baselines get diffed against CI's
  // Linux renders and can never match.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}',
  fullyParallel: true,
  // SwiftShader rasterizes WebGL entirely on the CPU, and GitHub's runners have
  // two cores. Two workers each driving a continuously animating canvas starves
  // the box and surfaces as bogus timeouts and browser crashes, not real failures.
  workers: process.env['CI'] ? 1 : 2,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] || undefined,
    },
  },
  webServer: {
    command: 'yarn dev --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
  },
})
