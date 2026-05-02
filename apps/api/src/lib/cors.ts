/**
 * Phase 7.5: API の CORS middleware が使う origin allowlist のパーサ / マッチャ。
 *
 * 入力文字列は `env.CORS_ALLOWED_ORIGINS`（`wrangler.toml [vars]` または
 * `.dev.vars` から供給）。カンマ区切りで、各エントリは以下のいずれか:
 *   - 完全オリジン      `https://snap-share.pages.dev`
 *   - ワイルドカード接尾辞 `*.snap-share.pages.dev`
 *
 * ワイルドカードは `https://` 限定（http ダウングレード防止）。http の dev
 * origin を許可したい場合は完全オリジン形式で書く（例 `http://localhost:5173`）。
 */

export type AllowRule = { type: 'exact'; origin: string } | { type: 'suffix'; suffix: string };

export const parseAllowedOrigins = (raw: string): AllowRule[] => {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) =>
      entry.startsWith('*.')
        ? ({ type: 'suffix', suffix: entry.slice(1) } as const)
        : ({ type: 'exact', origin: entry } as const),
    );
};

export const matchOrigin = (origin: string, rules: ReadonlyArray<AllowRule>): boolean => {
  for (const rule of rules) {
    if (rule.type === 'exact') {
      if (rule.origin === origin) return true;
      continue;
    }
    if (origin.startsWith('https://') && origin.endsWith(rule.suffix)) return true;
  }
  return false;
};
