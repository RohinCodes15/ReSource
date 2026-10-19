import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the web build. The config starts the API in local mode (no accounts,
 * throwaway data folder, rate limits off), then builds and serves the exported site with an
 * isolated API URL and every path falling back to index.html.
 */
export const ADMIN_TOKEN = 'e2e-admin-token-for-playwright';
// Not 8081: that is the Expo dev server's port, which is often already running.
const WEB_PORT = 4173;
const API_PORT = 8001;

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
      command: `bash -c 'cd ../backend && APP_ENV=local SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= ANTHROPIC_API_KEY= LOCAL_STATE_DIR=$(mktemp -d) ADMIN_TOKEN=${ADMIN_TOKEN} RATE_LIMIT_ENABLED=0 CORS_ORIGINS=http://localhost:${WEB_PORT} \${PYTHON:-.venv/bin/python} -m uvicorn main:app --port ${API_PORT} --log-level warning'`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=http://localhost:${API_PORT} npm run build:web && npx serve dist --single --listen ${WEB_PORT} --no-clipboard`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
