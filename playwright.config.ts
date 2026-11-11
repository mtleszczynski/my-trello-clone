import { defineConfig } from '@playwright/test';
import { FAKE_SUPABASE_URL } from './tests/fake-supabase';

const PORT = 3200;

// Tests run a production build of the app, pointed at a fake Supabase (see tests/fake-supabase.ts),
// so they never touch real data and don't need a login.
export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Uses the installed Google Chrome, so no separate browser download is needed
    channel: 'chrome',
    viewport: { width: 1600, height: 900 },
  },
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_DEV_BYPASS_AUTH: 'false',
      NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake-anon-key',
    },
  },
});
