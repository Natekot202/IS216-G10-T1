import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.js',
  // All tests share one database, so run them one at a time (no race between accept/decline).
  fullyParallel: false,
  workers: 1,
  retries: 0,                       // a flaky test should fail, not be hidden
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  // Starts the app for you if it isn't already running (pnpm dev in both folders)
  webServer: [
    { command: 'pnpm dev', cwd: '../server', url: 'http://localhost:5000/api/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm dev', cwd: '../client', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 }
  ],
  projects: [
    // logs in once per role and saves the cookie, so other tests start already logged in
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    // Graders check responsiveness from iPhone 6 up (project FAQ #17), so run the mobile spec there too
    { name: 'iphone-6', use: { ...devices['iPhone 6'], browserName: 'chromium' }, dependencies: ['setup'], testMatch: /responsive\.spec\.js/ }
  ]
})