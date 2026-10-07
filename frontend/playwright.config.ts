import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3100', trace: 'on-first-retry' },
  projects: [
    { name: 'laptop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'NEXT_PUBLIC_DEMO_MODE=true npm run dev -- -p 3100',
    url: 'http://localhost:3100/login',
    reuseExistingServer: !process.env.CI,
  },
});
