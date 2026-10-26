import { defineConfig, devices } from '@playwright/test';

// T20 smoke: Chromium only, with phone emulation. The iPhone descriptor defaults to
// WebKit, so the browser is pinned back to Chromium (viewport, DPR, touch, UA stay).
// E2E_PORT lets parallel worktrees run the suite without reusing each other's server.
const PORT = Number(process.env.E2E_PORT) || 5120;

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'pixel', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    // Defaults to this config's folder; Vite must run from the project root.
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
