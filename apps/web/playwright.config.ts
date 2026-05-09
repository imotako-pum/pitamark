import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5173;
const API_PORT = 8787;

// Phase 7.5: webServer 配列で `wrangler dev` (api) と `vite` (web) を並行起動。
// API readiness probe は既存の `/health` (apps/api/src/index.ts:18) を流用。
//
// `BYPASS_TURNSTILE=true` 等の wrangler `[vars]` は process.env では上書きでき
// ないため、E2E 用の値は `e2e/global-setup.ts` が `.dev.vars` を保証する経路
// で渡す。`.dev.vars` が既存ならそちらが優先される（dev 個人設定を尊重）。
//
// Firefox / WebKit は Phase 7.5 では追加しない（NOT Building 参照）。
// Phase 8 dogfood 後に拡張判断。

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Phase 11 (E2E flake fix): default workers (= cpus / 2) は 10 コア機で 5 並列になり、
  // wrangler dev (single-process Workers runtime) の POST /rooms スループットが頭打ちで
  // 30s timeout が散発する。3 並列に絞ることで wrangler dev の queueing を緩和し、
  // 1m20s 程度の全体 runtime はそのまま (CPU 律速ではなく API I/O 律速のため)。
  workers: process.env.CI ? 1 : 3,
  globalSetup: './e2e/global-setup.ts',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    // Phase 10.E: pin browser locale to ja-JP so the i18n auto-detect picks
    // 'ja' as the default UI language. Existing specs assert against JA
    // labels (`編集ツール` / `矩形` / etc.) — overriding the default Playwright
    // locale (en-US) would surface English UI and break those specs. The
    // dedicated `i18n.spec.ts` toggles language via the in-app LangToggle
    // rather than relying on browser locale, so it works under both pins.
    locale: 'ja-JP',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: 'pnpm -F @pitamark/api dev',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
    {
      command: 'pnpm -F @pitamark/web dev',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
