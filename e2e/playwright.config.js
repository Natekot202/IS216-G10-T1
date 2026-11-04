// Playwright settings for the PetSociety E2E tests.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',

  // Before anything else: reset the database to the seed data (see global-setup.js)
  globalSetup: './global-setup.js',

  // All tests share ONE database, so run them one at a time.
  // (Two tests at once could both try to accept the same request.)
  fullyParallel: false,
  workers: 1,

  // Don't re-run failed tests: a flaky test should show up as a failure, not be hidden
  retries: 0,

  // Each test gets 30 seconds before it counts as failed
  timeout: 30_000,

  // 'list' prints ✓/✗ in the terminal, 'html' makes the report you open with: pnpm report
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // page.goto('/login') becomes http://localhost:5173/login
    baseURL: 'http://localhost:5173',
    // When a test fails, keep a screenshot and a step-by-step recording (trace) to look at
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },

  // Starts the app for you. If it's already running (pnpm dev in another terminal), it uses that one.
  webServer: [
    { command: 'pnpm dev', cwd: '../server', url: 'http://localhost:5000/api/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm dev', cwd: '../client', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 }
  ],

  projects: [
    // 1) Log in as each test user once and save the logins (tests/auth.setup.js)
    { name: 'setup', testMatch: /auth\.setup\.js/ },

    // 2) Every test on a laptop-sized Chrome, except the phone-only test
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /responsive\.spec\.js/
    },

    // 3) The phone-only test, on an iPhone 6 sized screen (graders check from iPhone 6 up)
    {
      name: 'iphone-6',
      use: { ...devices['iPhone 6'], browserName: 'chromium' },
      dependencies: ['setup'],
      testMatch: /responsive\.spec\.js/
    }
  ]
})