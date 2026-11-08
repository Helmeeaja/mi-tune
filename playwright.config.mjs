import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const executable = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (existsSync('/usr/bin/brave-browser') ? '/usr/bin/brave-browser' : undefined)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 75000,
  expect: { timeout: 8000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-report.json' }]],
  use: {
    headless: true,
    viewport: { width: 1366, height: 900 },
    launchOptions: { ...(executable ? { executablePath: executable } : {}), args: ['--mute-audio'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },
})
