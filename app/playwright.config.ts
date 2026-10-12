import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the web build. Before running: `npm run build:web`.
 * The config starts the API in local mode (no accounts, throwaway data folder, rate limits off)
 * and serves the exported site the way a static host would, with every path falling back to
 * index.html.
 */
export const ADMIN_TOKEN = 'e2e-admin-token';
// Not 8081: that is the Expo dev server's port, which is often already running.
const WEB_PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `bash -c 'cd ../backend && LOCAL_STATE_DIR=$(mktemp -d) ADMIN_TOKEN=${ADMIN_TOKEN} RATE_LIMIT_ENABLED=0 CORS_ORIGINS=http://localhost:${WEB_PORT} \${PYTHON:-.venv/bin/python} -m uvicorn main:app --port 8000 --log-level warning'`,
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx serve dist --single --listen ${WEB_PORT} --no-clipboard`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
