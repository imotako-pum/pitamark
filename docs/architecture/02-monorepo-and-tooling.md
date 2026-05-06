# 02. Monorepo & Tooling

> [← INDEX](./INDEX.md) | 前: [01-overview](./01-overview.md) | 次: [03-shared-package](./03-shared-package.md)

snap-share は **pnpm workspaces + Turborepo** の monorepo。本章はリポジトリ規約 (catalog / lint / test / 依存追加 HOW) を扱う。

## ワークスペース定義

[pnpm-workspace.yaml](../../pnpm-workspace.yaml):

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

実体:
- `apps/web` → `@pitamark/web`
- `apps/api` → `@pitamark/api`
- `packages/shared` → `@pitamark/shared`

`spikes/` は **意図的に workspace 外**。後述。

## Catalog ポリシー

[pnpm-workspace.yaml](../../pnpm-workspace.yaml) の `catalog:` セクションで共通依存を一元管理する。各 workspace の `package.json` は `"hono": "catalog:"` のように参照する。

### ルール (CLAUDE.md より)

> **2+ workspace で使うなら catalog 必須**。1 workspace 専用なら直接 `package.json` に書いてよいが、将来共有の可能性があるなら catalog 化が推奨。

### 主要な catalog 項目

| パッケージ | 版 | 利用 workspace |
|---|---|---|
| typescript | ^6.0 | web / api / shared |
| vitest / @vitest/coverage-v8 | ^4.1 | web / api / shared |
| zod | ^4.4 | shared (web/api 経由) |
| hono | ^4.12 | api (型は web へ AppType 経由) |
| @hono/zod-openapi / @hono/zod-validator | ^1.3 / ^0.7 | api |
| @scalar/hono-api-reference | ^0.10 | api |
| react / react-dom / @types/react | ^19.2 | web |
| konva / react-konva / use-image | ^10.2 / ^19.2 / ^1.1 | web |
| yjs / y-websocket / y-protocols | ^13.6 / ^3.0 / ^1.0 | web |
| y-durableobjects | ^1.0 | api |
| nanoid | ^5.0 | api |
| lucide-react | ^1.0 | web |

> Phase 8.x で `lucide-react` を 0.460 → 1.0 に bump 済 (named export は v1 境界で互換)。`hono` は web/api の version drift を避けるため後から catalog に移送された。

### 依存を追加 / 更新するときの手順

1. **catalog に入れるか決める** (上記ルール)。
2. **入れる**: `pnpm-workspace.yaml` の `catalog:` を編集 → 各 workspace の `package.json` で `"<pkg>": "catalog:"` 参照。
3. **入れない**: 該当 workspace の `package.json` に直接 version pin。
4. **bump**: catalog 値を編集 → `pnpm install` → 全 workspace に反映。

## Turborepo タスクグラフ

[turbo.json](../../turbo.json):

```json
{
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"], "inputs": ["src/**/*.{ts,tsx}", "tsconfig*.json"] },
    "lint":      { "inputs": ["src/**/*.{ts,tsx,css,json}", "biome.json"] },
    "test":      { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:e2e":  { "dependsOn": ["^build"], "outputs": ["playwright-report/**", "test-results/**"] },
    "dev":       { "cache": false, "persistent": true }
  }
}
```

要点:
- **`^build` 依存**: typecheck / test 系は依存先 workspace の build 後に走る。`packages/shared` は `noEmit: true` だが build タスク自体は通るため、依存解決の起点になる。
- **`outputs` キャッシュ**: build / test 系は出力をキャッシュ。CI で第二回以降が高速。
- **`dev` は no-cache + persistent**: `pnpm dev` で web (5173) + api (8787) が並列起動し、Ctrl+C で両方止まる。

## TypeScript

[tsconfig.base.json](../../tsconfig.base.json) で全 workspace 共通の strict 設定:

```json
{
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true,
  "strict": true
}
```

ハマりやすい点:
- `noUncheckedIndexedAccess`: `arr[0]` の型は `T | undefined` になる。Konva の `points: [number, number, number, number]` のようなタプル型は明示宣言が必須 ([CLAUDE.md](../../CLAUDE.md))。
- `verbatimModuleSyntax`: 型のみ import は `import type` 必須 (混在不可)。

各 workspace の tsconfig は base を継承 + workspace 固有の `paths` / `types` / `lib` を上書き。

## Biome (lint + format)

[biome.json](../../biome.json):

- フォーマット: 2-space / lineWidth 100 / single quote (JS) / double quote (JSX) / trailing comma all / semicolons always
- リンター: `recommended` + 追加で `noUnusedVariables` / `noUnusedImports` / `noConsole` (warn) / `noExplicitAny` (warn) / `noDebugger` (error)
- 除外: `node_modules / dist / .turbo / .wrangler / playwright-report / test-results / spikes`
- override: テストファイルでは `noExplicitAny` を off、`apps/web/src/components/ui/**` (shadcn 系) では `a11y/noLabelWithoutControl` を off

`pnpm lint` は `biome ci .` を直叩き。`pnpm format` は `biome format --write .`。

## テスト

### Vitest (unit / integration)

- web: `apps/web/vite.config.ts` の `test` セクションで `environment: 'happy-dom'` / coverage v8。配置は `src/**/*.test.ts(x)`。
- api: `apps/api/vitest.config.ts` で Workers 環境の `cloudflare:workers` モジュールを Vite plugin で仮想化。配置は `src/__tests__/**/*.test.ts`。
- shared: `packages/shared/vitest.config.ts`。

```sh
pnpm test                                            # 全 workspace
pnpm -F @pitamark/web test -- src/hooks/__tests__/historyReducer.test.ts  # 単一ファイル
pnpm -F @pitamark/web test:coverage                  # カバレッジ
```

### Playwright (E2E)

- chromium のみ (CI / ローカル両方)。
- 配置: `apps/web/e2e/**/*.spec.ts`。
- 起動: `pnpm test:e2e`。`-g "title"` で単一テスト指定可。

詳細な配置規約は `.claude/rules/web/testing.md` 参照。

## なぜ `spikes/` が workspace 外か

`spikes/` は Phase 0 (技術スパイク) で作成した独立 PoC を **凍結保存** する場所。
- `pnpm-workspace.yaml` の `packages:` に含めない → `pnpm install` の対象外。
- `biome.json` で `!spikes` 除外 → lint 対象外。
- 各 spike は内部に独自 `package.json` を持ち、`cd spikes/<name> && pnpm install` で個別に動かす。

これは「現役の本番コードと PoC を混ぜない」設計。spike 結果は [docs/spikes/REPORT.md](../spikes/REPORT.md) に凍結記録され、本番コードは PoC を参照せず spike の結論だけを継承する。

## 次に読むファイル

- 共通型定義 → [03-shared-package](./03-shared-package.md)
- API 構造 → [04-api-anatomy](./04-api-anatomy.md)
- 環境変数 / デプロイ → [09-environment-and-deploy](./09-environment-and-deploy.md)
