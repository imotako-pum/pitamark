# Code Review: Phase 7 — 公開準備

**Reviewed**: 2026-05-02
**Mode**: Local (uncommitted changes)
**Branch**: `feat/phase-7-public-launch`
**Decision**: **APPROVE WITH COMMENTS**（CRITICAL/HIGH なし。MEDIUM 4 件は Phase 7 終盤 or follow-up 推奨）

## Summary

Phase 7（OSS 公開準備）の差分（44 ファイル / 約 +850 / -179 行）は、PRD と plan の意図に沿って
スパム多層防御（Turnstile / Workers Rate Limit ×3 / 画像 SHA-256 ブラックリスト）と OSS 一式
（LICENSE / CONTRIBUTING / Issue・PR テンプレ / 全面改訂 README）を過不足なく実装している。
責務分離・DI・fail-open / fail-closed の選択がすべて WHY コメント付きで残されており、
レビュー時間あたりの読み取りコスト（コードを追うコスト）は他フェーズより低い。

検証は **typecheck / lint / test / build すべて緑**（api 131 / web 154 / shared 71 = 356 件、
gzip 179.14 KiB の wrangler dry-run 通過）。CRITICAL / HIGH の発見はゼロ。
MEDIUM は 4 件で、いずれも Phase 7 のスコープ（README 完了 = 実装完了の判定）と整合する範囲。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

#### MED-1 — Turnstile siteverify への fetch にタイムアウト/AbortSignal が無い

- **File**: `apps/api/src/services/turnstile-service.ts:53`
- **Issue**: `await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });`
  に `signal` が無く、Cloudflare 側 siteverify が遅延した場合、`POST /rooms`
  が siteverify の遅延に直接引きずられる。Workers の CPU/wall-time バジェット
  を消費し、`RL_CREATE_ROOM` の絞り込みより前段でリクエストが詰まる。
- **Impact**: siteverify 障害時に `POST /rooms` 全体のスループットが落ちる。
  `network` reason は捕捉できているがレイテンシ要因にはならない。
- **Suggested fix**: 5s 程度の `AbortSignal.timeout(5_000)` を渡し、タイムアウトも
  `'network'` と同じ branch で吸収する。
  ```ts
  const res = await fetchImpl(SITEVERIFY_URL, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(5_000),
  });
  ```

#### MED-2 — Content-Security-Policy が未設定（rules/web/security.md と乖離）

- **File**: 該当ファイルなし（`apps/web/index.html`, `apps/web/public/_headers` 等）
- **Issue**: `.claude/rules/web/security.md` の「Always configure a production CSP」
  と乖離している。Phase 7 で外部 CDN（`challenges.cloudflare.com` / Turnstile,
  `static.cloudflareinsights.com` / Web Analytics）から script を読み込む構成に
  なったため、CSP の必要性は Phase 6 までより上がっている。Cloudflare Pages なら
  `apps/web/public/_headers` 1 ファイルで配信可能。
- **Impact**: XSS の事故影響半径が広がる。注釈テキスト → SVG → CSS でテキスト
  注入される系統の事故を抑止しにくい。
- **Suggested fix**: 最低限の `script-src 'self' challenges.cloudflare.com static.cloudflareinsights.com;
  img-src 'self' blob:; frame-src challenges.cloudflare.com;` を `_headers` に
  記述。本フェーズでまだ重ければ、Phase 8 dogfood 中の follow-up として
  `chore(phase-8): add CSP headers via _headers` で別 PR 化でも可。

#### MED-3 — `useImageSource.handleLoad` / `useTurnstileToken` の戻り値オブジェクトが毎レンダ新規

- **File**: `apps/web/src/hooks/useTurnstileToken.ts:44`、`apps/web/src/pages/LocalEditor.tsx:64`
- **Issue**: `useTurnstileToken` は `{ state, setToken, setError, reset, consumeToken }`
  を `useMemo` 化せずに毎レンダ生成している。`LocalEditor.tsx` の `handleLoad`
  は `useCallback(..., [protect, password, loadFromFile, turnstile])` でこれに
  依存しているため、`LocalEditor` が再レンダする度に `handleLoad` の参照が変わる。
  現状 `EditorShell` が `React.memo` 化されていないので実害は小さいが、Phase 8 で
  さらに props 経由で渡す可能性を考えると先に潰しておくのが安い。
- **Impact**: 体感的なレンダ性能には影響しない。memo 化最適化への将来罠。
- **Suggested fix**:
  ```ts
  return useMemo(
    () => ({ state, setToken, setError, reset, consumeToken }),
    [state, setToken, setError, reset, consumeToken],
  );
  ```
  `consumeToken` 自体の `[state]` 依存はそのままで OK。

#### MED-4 — LICENSE / README footer の copyright が `imotako-pun` で、リポジトリ URL `imotako-pum` と不一致

- **Files**: `LICENSE:3`, `README.md:243`
- **Issue**: 著作権表示が `imotako-pun` だが、`README.md:9` のバッジ URL や
  `CONTRIBUTING.md:9, 113-115`、`.github/ISSUE_TEMPLATE/config.yml:4` の
  GitHub URL は `imotako-pum/snap-share`。ディレクトリパスも `imotako-pum`
  である一方、git config user は `imotako-pun`（gitStatus より）。
- **Impact**: OSS として外部公開した際に「LICENSE 上の著作権者が誰か」と
  「GitHub の owner」が見た目で別人のように映る。法的有効性は保たれるが、
  公開リポジトリで一貫性が無いとアウトリーチ時の信用を削る。
- **Suggested fix**: どちらかに揃える。GitHub username は `imotako-pum` で
  確定済（ディレクトリ名・URL から）なので、`LICENSE` と `README.md:243` の
  `imotako-pun` を `imotako-pum` に修正するのが最小差分。

### LOW

- **LOW-1**: `apps/api/wrangler.toml:60` の `id = "REPLACE_WITH_PRODUCTION_KV_ID"`
  プレースホルダのまま `wrangler deploy` した場合、`IMAGE_BLOCKLIST` バインド
  が「無いに等しい」状態になる（`createImageBlocklistService` は `kv.get` で
  例外が起きれば fail-open するため、サイレントに 0 件 KV と等価）。
  README にデプロイ手順は書かれているが、誤デプロイ予防には弱い。
  → 別 commit `chore(phase-7): bind production KV namespace` を実機検証
  時に必ず打つフローでカバー、と report に明記済なのでこのまま OK。

- **LOW-2**: `apps/web/index.html:33` の `const t = "%VITE_CF_ANALYTICS_TOKEN%";`
  と `apps/web/vite.config.ts:17` の `html.replace(/%VITE_([A-Z0-9_]+)%/g, ...)`
  はビルド時注入で、注入元はリポジトリ所有者の CI 環境変数。
  `VITE_CF_ANALYTICS_TOKEN` に `"` を含む文字列を入れると JS 文字列脱出が起きる
  が、Cloudflare Analytics token の発行値は固定 16 進形式なので現実的な事故は
  起きにくい。フォーク時のため、将来 `JSON.stringify(t)` 化を検討して良い。

- **LOW-3**: `apps/web/src/components/turnstile/TurnstileWidget.tsx:52` の
  100ms × 50 attempts 上限ポーリングは、Turnstile script のロード時間が
  まれに 5s を超える Wi-Fi 不安定環境で widget が永遠に出ない。`error` 状態に
  落ちて `LocalEditor` が「アップロード不可」になる。Phase 8 で実機計測してから
  しきい値調整で十分。

- **LOW-4**: `apps/api/src/yjs.ts:90` の `c.req.query('token')` は
  WebSocket upgrade 時のクエリ文字列で渡される。`wrangler tail` のリクエスト
  ログは URL を含むので、token がライブログに 24h JWT として現れる可能性がある。
  漏洩半径は 24h の auth scope に限定され、tail はオーナーのみが見られるので
  実害は限定的。Phase 8 で `Sec-WebSocket-Protocol` 経由に切り替える検討余地あり。

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check | ✅ Pass | `pnpm typecheck` 全 4 workspace 0 error |
| Lint | ✅ Pass | `pnpm lint` (biome ci) 144 files clean |
| Tests | ✅ Pass | api 131 / web 154 / shared 71 = 356 件 |
| Build | ✅ Pass | `wrangler deploy --dry-run` 通過、gzip 179.14 KiB |

## Strengths（積極的に良かった点）

1. **DI と fail-open/fail-closed の徹底**：`turnstile-service` / `image-blocklist-service` /
   `withRateLimit` のいずれも `bypass` flag や `binding === undefined` の通過モードを
   持ち、テスト容易性と運用時の安全側挙動が両立されている。WHY コメントもすべての
   分岐に付いており、半年後の自分が読んでも判断ロジックが追える。
2. **Phase 7 plan で予測されていた `OpenAPIHono.use()` の chain 型崩壊リスクを、
   実際に踏んでから `createRoute({ middleware })` フィールドへ即時切り替え**。
   `apps/api/src/routes/rooms.ts:165-168` のコメントが将来の罠回避に効く。
3. **既存テストへの破壊的変更を `formWithImage` ヘルパーに集約**して、Phase 5/6 の
   テスト群がほぼ同じ可読性のまま Phase 7 必須フィールドに追従できている。
4. **`error.ts` の `sanitizePath`** で path injection / log injection を入口で
   塞いでいる。`PUBLIC_PATH_MAX = 80` でログ膨張も予防済。
5. **`packages/shared` の `RoomImageSchema` で `sha256` を optional にして
   後方互換**：Phase 5/6 で書き込まれた meta が Phase 7 デプロイ後に schema
   失敗で 500 に落ちない。

## Files Reviewed

### Source（実装）
- Added: `apps/api/src/lib/{ip.ts,sha256.ts}`, `apps/api/src/middleware/rate-limit.ts`,
  `apps/api/src/services/{turnstile-service,image-blocklist-service}.ts`,
  `apps/web/src/components/turnstile/TurnstileWidget.tsx`,
  `apps/web/src/hooks/useTurnstileToken.ts`
- Modified: `apps/api/src/lib/{bindings.ts,error.ts}`,
  `apps/api/src/routes/rooms.ts`, `apps/api/src/services/room-service.ts`,
  `apps/api/src/yjs.ts`, `apps/api/wrangler.toml`,
  `apps/web/src/lib/api-client.ts`, `apps/web/src/hooks/useImageSource.ts`,
  `apps/web/src/pages/LocalEditor.tsx`,
  `apps/web/src/components/room-gate/RoomGate.tsx`,
  `apps/web/index.html`, `apps/web/vite.config.ts`,
  `packages/shared/src/room.ts`

### Tests
- Added: `apps/api/src/lib/__tests__/{ip,sha256}.test.ts`,
  `apps/api/src/services/__tests__/{turnstile-service,image-blocklist-service}.test.ts`,
  `apps/api/src/middleware/__tests__/rate-limit.test.ts`,
  `apps/api/src/__tests__/helpers/{in-memory-kv,in-memory-rl}.ts`,
  `apps/web/src/hooks/__tests__/useTurnstileToken.test.tsx`
- Modified: `apps/api/src/__tests__/{rooms,images,yjs}.test.ts`,
  `apps/api/src/__tests__/services/room-service.test.ts`,
  `apps/api/src/__tests__/helpers/build-env.ts`,
  `packages/shared/src/__tests__/room.test.ts`

### Config / Docs
- Added: `LICENSE`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`,
  `.github/ISSUE_TEMPLATE/{bug_report.md,feature_request.md,config.yml}`,
  `.claude/PRPs/reports/phase-7-public-launch-report.md`,
  `.claude/PRPs/plans/completed/phase-7-public-launch.plan.md`
- Modified: `README.md`, `apps/api/.dev.vars.example`, `apps/web/.env.example`,
  `apps/web/.env.test`, `.claude/PRPs/prds/snap-share.prd.md`

## Recommendation

差分は merge 可能。MED-4（copyright 表記の不一致）だけは **公開前に必ず修正**
することを推奨。MED-1〜MED-3 と LOW-1〜LOW-4 は本 PR 内で潰しても、Phase 8
dogfood の follow-up に回しても可。

### この PR で潰すなら
- MED-4（LICENSE/README copyright）— 1 文字差分

### Phase 8 follow-up に積むなら
- MED-1（Turnstile timeout）
- MED-2（CSP via `_headers`）
- MED-3（useTurnstileToken の useMemo 化）
