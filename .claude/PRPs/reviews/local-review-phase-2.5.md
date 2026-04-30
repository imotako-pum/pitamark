# Local Code Review: Phase 2.5 — API モダン化

**Reviewed**: 2026-04-30
**Branch**: `docs/adr-0002-stack-decision` (uncommitted Phase 2.5 implementation on top of `b8bb3d4`)
**Mode**: Local Review (uncommitted changes pre-commit)
**Decision**: **APPROVE with comments** — 0 CRITICAL / 0 HIGH / 3 MEDIUM / 3 LOW

## Summary

Phase 2.5 実装は安全かつ品質基準を満たす。セキュリティ脆弱性・バグ・型エラー・テスト不足はゼロ。Phase 2 の XSS 対策 (SVG `content-disposition`, `x-content-type-options: nosniff`) を完全に維持。3 つの MEDIUM 観点 (DRY 違反、エラー envelope の重複定義、env 検証の挙動設計) は **後続 PR で改善** が望ましいが、Phase 2.5 の merge を妨げるレベルではない。

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

#### M1. `ErrorResponseSchema` / `idParamSchema` が 2 ファイルで重複定義

- **Location**: `apps/api/src/routes/rooms.ts:10-26` と `apps/api/src/routes/images.ts:9-25` で同一の Zod スキーマを 2 回定義
- **問題**:
  - DRY 違反 — 将来エラーコード追加時に 2 箇所の同期更新が必要
  - `ErrorResponseSchema.code` の enum 配列が `apps/api/src/lib/error.ts:5-10` の `ErrorCode` 型と独立しており、将来ドリフトするリスク
- **推奨修正**: `apps/api/src/routes/_schemas.ts` (or `apps/api/src/lib/openapi-schemas.ts`) に集約し、両ルートからインポート。`ErrorCode` 型を再利用し `z.enum` を `error.ts` の型から導出する形が望ましい
- **Severity**: MEDIUM (機能影響なし、保守性のみ)
- **Action**: 別 PR で対応推奨。Phase 2.5 merge 後の cleanup PR として `refactor: extract shared OpenAPI schemas` で扱う

#### M2. `api-client.ts` の `VITE_API_URL` 未設定時に runtime throw

- **Location**: `apps/web/src/lib/api-client.ts:6-9`
  ```ts
  const baseUrl = import.meta.env.VITE_API_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_URL is not configured');
  }
  ```
- **問題**: import 時 (モジュール load 時) に throw が発生する設計 — 開発者が `.env` を作り忘れた場合、Web アプリが完全に起動失敗する。エラーメッセージは UI に伝わらず、コンソールでしか見えない
- **代替案**:
  1. **Soft fallback**: 同一オリジン想定で `'/api'` 等にフォールバック (推奨されないが実装が一番簡単)
  2. **Dev 専用ガード**: `import.meta.env.MODE === 'development'` のときのみ throw、production では `console.error` で警告
  3. **現状維持**: fail-fast を意図した設計として明示 (現状)
- **Severity**: MEDIUM (誤動作はないが onboarding 体験に影響)
- **Action**: `.env.example` の存在で軽減されているため Phase 2.5 では現状維持で OK。Phase 3 で Web 開発を本格化する際に再評価

#### M3. `apps/api/package.json` に `main`/`types`/`exports` を追加 (アプリの「ライブラリ化」)

- **Location**: `apps/api/package.json:5-9`
- **問題**: API は本来「サービス (Cloudflare Worker)」であり、ライブラリではない。`main`/`types`/`exports` を追加することで他 workspace から import 可能になり、誤って runtime コードが Web bundle に混入する事故リスクがある
- **現状の保護**:
  - `apps/web/src/lib/api-client.ts:1` で `import type { AppType }` (type-only)
  - `tsconfig.base.json: verbatimModuleSyntax: true` で type-only import が runtime コード化されないことを強制
- **代替案**:
  1. `apps/api/package.json` の `exports` を `"./types"` のような明示的なサブパスに分離し、`apps/web` からは `import type { AppType } from '@snap-share/api/types'` の形に固定する (誤用防止)
  2. 現状維持 (パターンとして Hono RPC モノレポで広く使われている)
- **Severity**: MEDIUM (型安全機構で保護されているが、規約レベルで脆弱)
- **Action**: 現状維持で OK。Phase 3 着手前に `apps/web/.eslintrc` 等で `import { ... } from '@snap-share/api'` (非 type-only) を禁止する lint ルールを追加検討

### LOW

#### L1. `routes/images.ts:35` バイナリレスポンスの content schema 省略

- **Location**: `apps/api/src/routes/images.ts:35`
  ```ts
  200: { description: 'Image binary (image/png, image/jpeg, image/webp, image/svg+xml)' },
  ```
- **問題**: OpenAPI ドキュメントでサポートする MIME 型を構造化データではなく自然言語 description に書いている。外部 API ツール (例: コードジェネレータ) はこの情報を抽出できない
- **推奨**: `content: { 'image/png': {}, 'image/jpeg': {}, 'image/webp': {}, 'image/svg+xml': {} }` のように content フィールドを使用 (schema は空で OK のはず、ライブラリ依存)
- **Severity**: LOW (現実的に snap-share に外部 API 利用者は当面いない)
- **Action**: 任意。Phase 4 以降の API 拡張時に再考

#### L2. `.env.test` と `.env.example` が同一内容

- **Location**: `apps/web/.env.test` と `apps/web/.env.example` が両方 `VITE_API_URL=http://localhost:8787`
- **問題**: テスト時に「実際の dev server が無くても通る」ことを明示するため `http://test.invalid:1` 等の到達不能な URL を使う方が、誤って実 fetch を呼んだ場合に即失敗するため安全
- **推奨**: `.env.test` のみ `VITE_API_URL=http://test.invalid` に変更
- **Severity**: LOW (現状の smoke test は実 fetch を呼ばないため実害なし)
- **Action**: 任意

#### L3. `openApiDocConfig.info.version` がハードコード `'0.0.0'`

- **Location**: `apps/api/src/lib/openapi.ts:8`
- **問題**: `apps/api/package.json` の `version` (現在 `0.0.0`) と独立して管理されているため、将来バージョン更新時にドリフトする
- **推奨**: ビルド時に `package.json` から読み込む、または明示的に同期する
- **Severity**: LOW (現状 0.0.0 で同期している)
- **Action**: 任意。Phase 7 (公開準備) でリリースバージョニングを導入する際に対応

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check | **Pass** | shared / api / web 3 workspace 全緑 |
| Lint (Biome ci) | **Pass** | 23 files checked, no issues |
| Tests | **Pass** | 63 tests (shared 20 + api 37 + web 6) |
| Build | **Pass** | api wrangler dry-run 712 KiB / gzip 116 KiB、web vite build 190 KiB / gzip 60 KiB |

## Files Reviewed

### Source code (8 files)

- **Modified**: `apps/api/src/index.ts`, `apps/api/src/routes/rooms.ts`, `apps/api/src/routes/images.ts`
- **Added**: `apps/api/src/lib/openapi.ts`, `apps/api/src/__tests__/openapi.test.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/__tests__/api-client.test.ts`

### Configuration (5 files)

- **Modified**: `pnpm-workspace.yaml`, `apps/api/package.json`, `apps/web/package.json`, `apps/web/tsconfig.json`, `pnpm-lock.yaml`

### Env / docs (4 files)

- **Added**: `apps/web/.env.example`, `apps/web/.env.test`, `.claude/PRPs/plans/completed/phase-2.5-api-modernization.plan.md` (archived from active), `.claude/PRPs/reports/phase-2.5-api-modernization-report.md`
- **Modified**: `.claude/PRPs/prds/snap-share.prd.md`

## Decision Rationale

- **Security**: Phase 2 で確立した XSS 対策 (`x-content-type-options: nosniff`, SVG `content-disposition`)、path traversal 対策 (`ROOM_ID_REGEX` validation)、user input echo 防止 (`UNSUPPORTED_MEDIA_TYPE` の固定メッセージ) を全て維持
- **Correctness**: 既存 9 件のテストが無改変で通る (回帰なし)、新規 6 件のテスト追加 (OpenAPI doc, Scalar UI, hc smoke)
- **Type Safety**: `verbatimModuleSyntax: true` 下で `import type` 強制、`hc<AppType>` で末端まで型推論
- **Pattern Compliance**: kebab-case ファイル名、`errorEnvelope` 維持、`logger.warn` 構造化ログ、Hono RPC 標準のチェイン export
- **Performance**: Worker bundle +110 KiB (gzip) — `@hono/zod-openapi` + `@scalar/hono-api-reference` の追加ぶん。許容範囲
- **Completeness**: 既存テスト無改変緑 + 新規 OpenAPI/Scalar/hc smoke テスト追加。Acceptance criteria 全達成

## Recommended Next Actions

1. このまま `feat:` プレフィックスで commit (CRITICAL / HIGH なし)
2. M1 (schema 重複) は別 cleanup PR として Phase 3 着手前に解消推奨
3. M2 (env throw) と M3 (api package のライブラリ化) は規約・lint で守る方針を Phase 3 で検討
4. Manual browser smoke (`pnpm -F @snap-share/api dev` → `/api/docs`) は merge 前に目視推奨
