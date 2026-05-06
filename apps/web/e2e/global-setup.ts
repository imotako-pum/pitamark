import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2E では `apps/api` を `wrangler dev` で立ち上げるが、`wrangler.toml` の `[vars]` は
 * process.env で上書きできない。Turnstile bypass などを成立させるために `.dev.vars`
 * を保証する。`.dev.vars` は gitignore 済 — 既存ファイルには触らず、欠落している
 * 場合のみ E2E 用 default を書き出す。
 */
export default async function globalSetup(): Promise<void> {
  const devVarsPath = path.resolve(__dirname, '../../api/.dev.vars');
  if (existsSync(devVarsPath)) return;

  const lines = [
    '# E2E 用に apps/web/e2e/global-setup.ts が自動生成。',
    '# 削除 / 置換は自由 — ファイル欠落時のみ書き直される。',
    'BYPASS_TURNSTILE="true"',
    // 並列実行で 14+ rooms/min を作るため、production の RL (5/60s) を bypass する。
    // 本番 wrangler.toml には書かない (bindings.ts のコメント参照)。
    'BYPASS_RATE_LIMIT="true"',
    'TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"',
    'ROOM_TOKEN_SECRET="e2e-test-token-secret-min-32-bytes-long-enough"',
    '',
  ];
  writeFileSync(devVarsPath, lines.join('\n'));
}
