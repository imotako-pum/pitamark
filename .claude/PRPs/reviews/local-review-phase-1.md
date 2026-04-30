# Local Review: Phase 1 — モノレポ初期化 (v2)

**Reviewed**: 2026-04-30
**Branch**: `feat/phase-1-monorepo-init`
**Mode**: Local uncommitted changes review
**Decision**: ✅ **APPROVE with comments**（CRITICAL/HIGH なし、MEDIUM 1 件はコミット前修正推奨）

## Summary

Phase 1 (v2) の 36 ファイル (30 新規 + 6 modified) を全件レビュー。catalog / Zod v4 / SSOT 設計は plan v2 通り正しく実装されており、CI 同等パイプラインも all green。**MEDIUM 1 件（`apps/web/vite.config.ts` の `__dirname` ESM 非互換リスク）はコミット前に修正推奨**。LOW 3 件は Phase 2 着手時に拾えば十分。

---

## Findings

### CRITICAL
**None**

### HIGH
**None**

### MEDIUM

#### M1. `apps/web/vite.config.ts:9` — ESM 環境で `__dirname` 使用

```ts
alias: { '@': path.resolve(__dirname, './src') },
```

- **問題**: `apps/web/package.json` が `"type": "module"` のため `vite.config.ts` は ESM として評価される。ESM では `__dirname` は本来未定義
- **現状動作する理由**: Vite v8 + Node 22 の互換 shim で `__dirname` が補完されているが、これは保証されたインターフェイスではない
- **推奨修正**: ESM 標準の `import.meta.dirname` (Node 20.11+) に置換
  ```ts
  alias: { '@': path.resolve(import.meta.dirname, './src') },
  ```
- **影響**: 現状は動くが、Vite/Node のマイナーアップデートで突然壊れるリスク。早期に直すべき
- **Severity 理由**: 動作している ＝ HIGH ではない、潜在的なバージョン依存破綻 ＝ LOW より上、よって MEDIUM

### LOW

#### L1. `apps/api/tsconfig.json:7` — `jsx: "preserve"` が Workers では冗長

```jsonc
"jsx": "preserve"
```

- **問題**: api は JSX を一切使わないため `jsx` 設定自体不要
- **由来**: Phase 0 spike B (`spikes/yjs-durable-object/tsconfig.json`) からのコピー残り
- **推奨修正**: 削除可
- **影響**: 害なし（typecheck は green）。Phase 4 で SSE/HTML レスポンス入れる時に必要なら戻す
- **Severity**: LOW（cleanup nice-to-have）

#### L2. `apps/api/src/index.ts:3` — `Bindings = Record<string, never>` への TODO コメント欠落

```ts
type Bindings = Record<string, never>;
```

- **問題**: Phase 2 で `R2_BUCKET`、Phase 4 で `Y_ROOM`、Phase 5 で `SECRETS` が入る予定。コメントなしだと次のフェーズで上書き忘れる可能性
- **推奨**: 1 行コメント追加
  ```ts
  // Phase 2: R2_BUCKET, Phase 4: Y_ROOM, Phase 5: SECRETS
  type Bindings = Record<string, never>;
  ```
- **Severity**: LOW（plan/wrangler.toml 側に既に同コメントあり、source への重複は強制しない）

#### L3. `packages/shared/src/room.ts:3` — `MAX_IMAGE_BYTES` の forward declaration

```ts
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
```

- **問題**: 現状 Phase 1 の参照箇所なし。biome が `noUnusedExports` を有効化していれば警告対象だが、現状 OFF
- **由来**: Phase 2 で `apps/web` の D&D upload と `apps/api` の R2 upload の上限として使う前提の事前定義
- **推奨**: そのまま保持（Phase 2 で参照される）。または現時点では削除してもよい
- **Severity**: LOW（YAGNI 厳格適用なら削除、Phase 2 plan で「shared に MAX_IMAGE_BYTES を定義」と書くより、ここで宣言済の方がパターン確立しやすい）

---

## ✅ 良かった点

| 観点 | 内容 |
|---|---|
| **SSOT** | `RoomSchema` から `z.infer` で型導出、Phase 2 以降で `RoomSchema.parse(input)` だけで body validation できる土台が整っている |
| **Catalog** | `pnpm-workspace.yaml` の catalog 設計が綺麗（typescript / vitest / zod / react / @types/* の 8 entries）。Phase 6 で React Router 等を catalog に追加するだけで全 ws 統一可 |
| **CI Workflow security** | `${{ github.event.* }}` 由来の untrusted input を `run:` で直接展開していない → command injection 安全 |
| **Hardcoded secrets** | 全 36 ファイル grep 確認、API キー / トークンの hardcode なし |
| **Test 構成** | shared 9 件 / api 1 件 / web 2 件 + E2E 1 件、合計 13 件 GREEN。全件 AAA パターン |
| **Bundle size** | web: 60 KB gz / api: 15 KB gz、PRD 予算（Landing 150 KB）内 |
| **a11y** | `index.html` に `lang="ja"`、AppShell は `<main>` `<header>` `<section>` のセマンティック HTML |
| **Immutability** | shared/api/web ともに mutation なし、`Readonly<T>` パターンで Props 定義 |
| **`console.log` (production)** | src/ に存在せず（biome `suspicious/noConsole: warn` でも 0 件） |

---

## Validation Results

| Check | Result |
|---|---|
| Type check (`turbo run typecheck`) | ✅ Pass — 3 successful (shared/api/web), 0 errors |
| Lint (`biome ci .`) | ✅ Pass — 29 files, 0 errors |
| Unit tests (`turbo run test`) | ✅ Pass — 12 件 GREEN (shared 9, api 1, web 2) |
| Build (`turbo run build`) | ✅ Pass — web 60 KB gz, api 15 KB gz (wrangler dry-run) |
| E2E (`turbo run test:e2e`) | ✅ Pass — chromium 1 件 PASS |

---

## Files Reviewed (36 件)

### Source code (8 件)
- `apps/api/src/index.ts` (Added)
- `apps/api/src/__tests__/health.test.ts` (Added)
- `apps/web/src/main.tsx` (Added)
- `apps/web/src/App.tsx` (Added)
- `apps/web/src/components/app-shell/AppShell.tsx` (Added)
- `apps/web/src/lib/utils.ts` (Added)
- `apps/web/src/lib/__tests__/utils.test.ts` (Added)
- `apps/web/e2e/landing.spec.ts` (Added)
- `packages/shared/src/index.ts` (Added)
- `packages/shared/src/room.ts` (Added)
- `packages/shared/src/__tests__/room.test.ts` (Added)

### Config (15 件)
- `pnpm-workspace.yaml` (Modified, +catalog)
- `package.json` (root, Modified)
- `turbo.json` (Added)
- `biome.json` (Added)
- `.gitignore` (Modified)
- `apps/api/package.json` (Added)
- `apps/api/wrangler.toml` (Added)
- `apps/api/tsconfig.json` (Added) — L1
- `apps/api/vitest.config.ts` (Added)
- `apps/web/package.json` (Added)
- `apps/web/vite.config.ts` (Added) — **M1**
- `apps/web/tsconfig.json` (Added)
- `apps/web/components.json` (Added)
- `apps/web/playwright.config.ts` (Added)
- `apps/web/.gitignore` (Added)
- `apps/web/index.html` (Added)
- `apps/web/src/styles/tokens.css` (Added)
- `apps/web/src/styles/global.css` (Added)
- `packages/shared/package.json` (Added)
- `packages/shared/tsconfig.json` (Added)

### CI/CD (1 件)
- `.github/workflows/ci.yml` (Added)

### Docs (4 件)
- `README.md` (Modified)
- `.claude/PRPs/prds/snap-share.prd.md` (Modified)
- `.claude/PRPs/plans/completed/phase-1-monorepo-init.plan.md` (Added、本セッションで作業領域から completed/ に再アーカイブ)
- `.claude/PRPs/reports/phase-1-monorepo-init-report.md` (Added)

### Lockfile (1 件)
- `pnpm-lock.yaml` (Modified)

---

## Recommended Actions

| 優先度 | アクション |
|---|---|
| 🟡 推奨 | **M1 修正**: `apps/web/vite.config.ts` の `__dirname` → `import.meta.dirname` |
| 🔵 任意 | L1: `apps/api/tsconfig.json` から `jsx: "preserve"` 削除 |
| 🔵 任意 | L2: `apps/api/src/index.ts` の `Bindings` に Phase 2/4/5 TODO コメント |
| ⚪ 不要 | L3: `MAX_IMAGE_BYTES` は Phase 2 で参照されるため保持 |

## Decision

**APPROVE with comments** — M1 を修正してからコミット推奨。L1/L2 は Phase 2 着手時に拾えば良い。

---

## Post-Review Fix (2026-04-30)

### M1 修正済

`apps/web/vite.config.ts:9` を修正:
```diff
-    alias: { '@': path.resolve(__dirname, './src') },
+    alias: { '@': path.resolve(import.meta.dirname, './src') },
```

再検証:
- ✅ `pnpm --filter @snap-share/web typecheck` — 0 errors
- ✅ `pnpm --filter @snap-share/web build` — 60.14 KB gz（変化なし）
- ✅ `pnpm exec biome ci .` — 0 errors

L1 / L2 / L3 は Phase 2 着手時に拾う（保留）。
