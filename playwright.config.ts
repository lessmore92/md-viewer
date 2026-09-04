import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const browserPath =
  process.env.CHROMIUM_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  outputDir: '.superpowers/test-results',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 960 },
    colorScheme: 'light',
    launchOptions: { executablePath: browserPath },
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host localhost --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
