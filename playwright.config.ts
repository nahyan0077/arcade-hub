import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.E2E_PORT ?? 5199);
const wsProvider = process.env.E2E_WS ?? 'node';

const relayServer =
  wsProvider === 'cf'
    ? {
        // Explicit empty env-file overrides wrangler's auto-load of `.env`,
        // which may carry LIVEKIT_* and would defeat the voice-unavailable test.
        command: 'npx wrangler dev --port 8788 --env-file /dev/null',
        port: 8788,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : {
        command: 'npm run relay',
        port: 8787,
        reuseExistingServer: true,
        timeout: 15_000,
      };

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${e2ePort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    relayServer,
    {
      command: `npm run dev -- --port ${e2ePort} --strictPort`,
      url: `http://localhost:${e2ePort}`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
