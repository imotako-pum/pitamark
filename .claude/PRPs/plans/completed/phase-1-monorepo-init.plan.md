# Plan: Phase 1 — モノレポ初期化 (Monorepo Init)

> **Revision: 2026-04-30 ユーザーレビュー反映**: 初版で抜けていた **(1) pnpm catalog による共有依存の一元管理 / (2) Zod v4 採用 / (3) `packages/shared` を Zod スキーマ駆動 SSOT として確立** の 3 点を本改訂で plan に組込み済。NEW MARKER `<!-- v2 -->` の節と Decisions Addendum を参照。

## Summary

snap-share の本実装基盤として `apps/web` (Vite + React 19 + Tailwind v4 + shadcn) / `apps/api` (Hono + Cloudflare Workers + Durable Objects スタブ) / `packages/shared` (Zod v4 スキーマ駆動の Room SSOT) を turborepo で束ね、Biome + Vitest + Playwright + GitHub Actions CI で「pnpm test が CI で通り、空の Vite 画面と Hono `/health` エンドポイントが動く」状態を作る。**共有依存（typescript / vitest / zod / react / @types/* など）は `pnpm-workspace.yaml` の `catalog:` で一元管理する**。

## User Story

As a snap-share の開発オーナー,
I want Phase 2 以降で迷いなく機能実装に取り組める **空の・型安全な・CI green な** turborepo 基盤,
So that 画像アップロード（Phase 2）/ Konva 注釈（Phase 3）/ Yjs+DO 同期（Phase 4）の実装が「土台のヤマカン」なしに進められる.

## Problem → Solution

**Current**: Phase 0 のスパイクで `spikes/konva-canvas` `spikes/yjs-durable-object` `spikes/shadcn-vite` の3つの独立 pnpm workspace に技術疎通コードが存在する。本番ディレクトリ（`apps/web`, `apps/api`, `packages/shared`）は未作成。turborepo / Biome / Playwright / CI 未設定。

**Desired**: turborepo + pnpm workspace の本番ディレクトリ構成が立ち上がり、Biome lint / Vitest unit / Playwright E2E（最小1ケース）/ Hono `/health` レスポンス が GitHub Actions CI で全部 green。spike ディレクトリは reference として git 上に残しつつ pnpm workspace 範囲からは外れる。

## Metadata

- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 1 — モノレポ初期化
- **Estimated Files**: 約 35〜40 ファイル（apps/web 約14 + apps/api 約8 + packages/shared 約4 + ルート設定 約8 + CI 1 + ドキュメント類）
- **Estimated LOC**: 800〜1200 行（依存 lock 除く）

---

## UX Design

このフェーズはエンドユーザー向け機能を作らない。`apps/web` のトップページは「snap-share — 準備中」を表示する最小プレースホルダで、Phase 6 の UI 仕上げで本物のランディングに置き換える。

### Before

```
┌────────────────────────────────────────────────┐
│  GitHub repo:                                  │
│   - spikes/konva-canvas (独立 Vite app)        │
│   - spikes/yjs-durable-object (独立 Workers)   │
│   - spikes/shadcn-vite (独立 Vite app)         │
│  ローカル動作: 3 spike 個別起動のみ            │
│  CI: 無し                                       │
└────────────────────────────────────────────────┘
```

### After

```
┌────────────────────────────────────────────────┐
│  apps/web  → http://localhost:5173             │
│   "snap-share" タイトル + 「準備中」プレースホルダ │
│  apps/api  → http://localhost:8787/health      │
│   { "ok": true, "service": "snap-share-api" }   │
│  pnpm dev  →  turbo run dev で web/api 並行起動 │
│  pnpm ci   →  CI 同等チェック (typecheck/lint/test/build) │
│  GitHub Actions: PR で自動実行 → ✅            │
└────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 開発者の `pnpm dev` | 不存在 | `turbo run dev` で web + api を並行起動 | persistent task |
| 開発者の `pnpm test` | spike A の vitest だけ | `turbo run test` で全 workspace に伝播 | E2E は別タスク |
| 開発者の `pnpm lint` | 不存在 | `biome ci` で全リポジトリ | 速度重視 |
| PR 作成時 | チェックなし | GitHub Actions が typecheck/lint/test/build を実行 | green 必須 |
| spike ディレクトリ | pnpm workspace 内 | workspace 外、コードは reference として保持 | `.claude/PRPs/plans/completed/phase-0-tech-spike.plan.md` 参照可 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 138-174, 207-211 | Phase 1 ゴール・スコープ・Success signal |
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 256-269 | Decisions Log: shadcn 採用、React 19、Konva バンドル |
| P0 | `docs/spikes/REPORT.md` | 全体 | Phase 0 採用バージョン・既知問題・spike 処分方針 |
| P0 | `.claude/PRPs/plans/completed/phase-0-tech-spike.plan.md` | 75-194 | Patterns to Mirror（NAMING/ERROR/LOGGING/IMMUTABILITY/REACT/CSS/TEST/WORKSPACE） |
| P1 | `spikes/konva-canvas/package.json` | 全体 | React 19 / vite 8 / vitest 4 採用バージョン |
| P1 | `spikes/konva-canvas/vite.config.ts` | 全体 | Vite + Vitest 統合パターン（happy-dom / globals false） |
| P1 | `spikes/konva-canvas/tsconfig.json` | 全体 | tsconfig.base.json extends + vite/client types + path alias |
| P1 | `spikes/konva-canvas/src/lib/rect.ts` | 全体 | Phase 3 へ移植する不変パターン（Phase 1 では `packages/shared` への配置候補） |
| P1 | `spikes/konva-canvas/src/lib/__tests__/rect.test.ts` | 全体 | Phase 1 で再活用する vitest AAA パターン |
| P1 | `spikes/yjs-durable-object/server/index.ts` | 全体 | Hono + yRoute パターン（Phase 4 で本実装、Phase 1 はコメントで参照のみ） |
| P1 | `spikes/yjs-durable-object/wrangler.toml` | 全体 | compatibility_date 2026-04-07 / new_classes / nodejs_compat |
| P1 | `spikes/shadcn-vite/components.json` | 全体 | shadcn `style: "base-nova"` / `baseColor: "neutral"` / aliases |
| P1 | `spikes/shadcn-vite/vite.config.ts` | 全体 | `@tailwindcss/vite` + `path.resolve` alias |
| P1 | `spikes/shadcn-vite/tsconfig.json` + `tsconfig.app.json` | 全体 | shadcn が要求する 2-tsconfig 構成（references + paths） |
| P1 | `tsconfig.base.json` | 全体 | strict / noUncheckedIndexedAccess / verbatimModuleSyntax をそのまま継承 |
| P1 | `pnpm-workspace.yaml` | 全体 | Phase 1 で書き換える対象 |
| P1 | `.claude/rules/typescript/coding-style.md` | 全体 | TS 固有: interface vs type / Zod validation / error narrowing |
| P1 | `.claude/rules/web/coding-style.md` | 全体 | CSS 変数 / コンポジター親和プロパティ / セマンティック HTML |
| P1 | `.claude/rules/web/testing.md` | 全体 | Playwright E2E shape / 視覚回帰の優先度 |
| P1 | `.claude/rules/common/coding-style.md` | 全体 | 800 lines max / KISS / 不変性 |
| P1 | `.claude/rules/common/development-workflow.md` | 全体 | リサーチ → 計画 → TDD → レビュー → コミット の流れ |
| P2 | `.claude/rules/web/security.md` | 全体 | Phase 7 でフル実装する CSP / HSTS / Referrer-Policy の前提知識 |
| P2 | `.claude/rules/web/performance.md` | 全体 | Phase 6 の予算確認用（Phase 1 では budget チェック未導入） |
| P2 | `README.md` | 全体 | "# snap-share" のみ。Phase 1 終了時に開発開始手順を最低限追記 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| turbo.json schema | https://turborepo.dev/docs/reference/configuration | `"$schema": "https://turborepo.dev/schema.json"`、`tasks` で `dev: { cache: false, persistent: true }`、`build: { dependsOn: ["^build"], outputs: [...] }`、`test: { dependsOn: ["build"], outputs: ["coverage/**"] }`、`inputs` で型チェックタスクの cache key を絞り込み |
| Biome 2.x basic config | https://biomejs.dev/schemas/2.0.0/schema.json | `root: true` + `files.ignore` + `formatter` (single quote / lf / 2 space / 100 width) + `linter.rules.recommended` + VCS 統合 (`vcs.useIgnoreFile`) |
| Biome CI mode | https://biomejs.dev/reference/cli/#biome-ci | `biome ci` は CI 用ワンショットコマンド。check と異なり apply しない |
| pnpm workspaces | https://pnpm.io/workspaces | `packages: ["apps/*", "packages/*"]`、`workspace:*` で内部 package を参照 |
| Vite + Vitest 統合 | https://vitest.dev/guide/#configuring-vitest | `defineConfig` from `vitest/config` を使えば 1 ファイルで Vite と Vitest 両方を構成可 |
| Tailwind v4 + Vite | https://tailwindcss.com/docs/installation/using-vite | `@tailwindcss/vite` プラグイン + `@import "tailwindcss";` のみ。`tailwind.config.js` は不要 (CSS-based config) |
| shadcn (Tailwind v4) | https://ui.shadcn.com/docs/installation/vite | components.json に `style: "base-nova"` を含む CLI 最新版を採用 (Spike C で確定) |
| Cloudflare Workers + Hono | https://hono.dev/getting-started/cloudflare-workers | `wrangler dev` のローカル DO は `--local`（既定）で OK、Hono を default export |
| wrangler v4 設定 | https://developers.cloudflare.com/workers/wrangler/configuration/ | `compatibility_date = "2026-04-07"` で `web_socket_auto_reply_to_close` 自動有効、`compatibility_flags = ["nodejs_compat"]` を継承 |
| Playwright config | https://playwright.dev/docs/test-configuration | `webServer` オプションで dev サーバを自動起動、`projects` でブラウザマトリクス、`reporter: "html"` |
| GitHub Actions + pnpm | https://github.com/pnpm/action-setup | `pnpm/action-setup@v4` で Node 22 + pnpm の組合せ |

GOTCHA:
- **shadcn の `components.json` `style` は spike で `base-nova` 確定済**。`new-york` ではないので Phase 1 で components 追加するときも合わせる
- **`@base-ui/react` ベースの shadcn コンポーネント**は Radix ではなく Base UI を使う（Spike C 後半の更新点）。同じ `Button.tsx` をコピーすれば良い
- **wrangler v4 + Hono v4.12** で Spike B の `default export` パターンが動作確認済。Phase 1 は `/health` のみ実装、DO バインディングは Phase 4 で
- **turborepo の `dev` task は `persistent: true` 必須**。これがないとサーバが終了しない警告が出る
- **Biome は `console.log` を warn にする**（rule: `suspicious/noConsole`）。Phase 1 ではテンプレート段階なので warn のままで OK、Phase 5 以降で error に昇格を再検討
- **Playwright の baseURL は環境変数化**。CI では `http://localhost:5173`、本番 smoke test は別途 Phase 7
- **`pnpm-workspace.yaml` は YAML**。トップレベル `packages:` のキー名のみ。`overrides` も同ファイルに書ける
- **`packages/shared` の export 方針**は `package.json` の `exports` field で `./types` のように分岐するか、デフォルトの `index.ts` から re-export する。Phase 1 では後者の素直な書き方
- **Biome v2 ではデフォルトで JSX 内のクォートが double**、JS は single（spike A の rect.ts と同じ）。これを `.claude/rules/typescript/coding-style.md` に整合させる

---

## Decisions Addendum (v2 — 2026-04-30 改訂) <!-- v2 -->

### D1. pnpm catalog 採用

`pnpm-workspace.yaml` に `catalog:` セクションを置き、複数 workspace で共有する依存のバージョンを一元管理する。各 `package.json` 側は `"typescript": "catalog:"` のように catalog 参照プロトコルで宣言。

**catalog に入れる初期メンバ**:
- 全 workspace 共有: `typescript` / `vitest` / `@types/node`
- 複数 workspace に広がる予定: `zod`（Phase 2 で api、Phase 5 で web）
- React 系（Phase 6 で web 系拡張に備え事前 catalog 化）: `react` / `react-dom` / `@types/react` / `@types/react-dom`

**catalog に入れない**: ルートだけで使う `@biomejs/biome` `turbo`、単一 workspace 専用の `hono` `wrangler` `vite` `@vitejs/plugin-react` `tailwindcss` `@tailwindcss/vite` `clsx` `tailwind-merge` `@playwright/test` `happy-dom` `@cloudflare/workers-types`。

### D2. Zod v4 採用

Zod は **v4 系（`^4.4`）を採用**。執筆時点 latest=4.4.1（GA）。v3 比で parse 7-14× 高速化、bundle ~50% 削減（`zod/mini` 経由で更に削減可）。`RoomSchema` レベル（`z.string().min(1)` / `z.number().int().positive()` / `z.object().readonly()` / `z.infer`）は v3/v4 共通 API のため移行コストはゼロ。

### D3. `packages/shared` を Zod スキーマ駆動 SSOT に

`packages/shared` は **型と runtime validator の単一ソース**。`RoomSchema = z.object({...}).readonly()` を定義し、`type Room = z.infer<typeof RoomSchema>` で型を導出する。Phase 2 の `POST /rooms` body 検証、Phase 4 の Yjs ペイロード境界検証、Phase 5 のパスワード入力検証は **すべてこのスキーマからの拡張** で済むよう、Phase 1 でこのパターンを固定する。

`apps/api` は Phase 2 で `@hono/zod-validator` を導入予定（Phase 1 では `/health` のみで body なしのため未使用）。

---

## Patterns to Mirror

> Phase 0 spike で確立したパターンを mirror 元として採用する。Phase 1 では新規パターンを追加せず、spike A/B/C のセットアップを再構成して `apps/` `packages/` に再配置する。

### NAMING_CONVENTION
// SOURCE: `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx` + `.claude/rules/web/coding-style.md` + `.claude/rules/typescript/coding-style.md`
```
- workspace package 名: `@snap-share/web`, `@snap-share/api`, `@snap-share/shared` (scope付き)
- ファイル/ディレクトリ: kebab-case (`apps/web/src/components/app-shell/`, `apps/api/src/routes/health.ts`)
- React コンポーネント: PascalCase (`AppShell.tsx`, `LandingHero.tsx`)
- フック: camelCase + use prefix (`useStageSize`, `useReducedMotion`)
- 定数: UPPER_SNAKE_CASE (`MAX_IMAGE_BYTES`, `DEFAULT_ROOM_TTL_MS`)
- ブール: `is`/`has`/`should`/`can` (`isReady`, `hasError`)
- 関数 / 変数: camelCase
- 型 / interface: PascalCase
```

### TS_CONFIG_PATTERN
// SOURCE: `spikes/konva-canvas/tsconfig.json` + `tsconfig.base.json` (現リポジトリ)
```jsonc
// 各 app/package の tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client"]      // web 用
    // "types": ["@cloudflare/workers-types"]  // api 用
  },
  "include": ["src", "vite.config.ts"]
}
```

### IMMUTABILITY_PATTERN
// SOURCE: `spikes/konva-canvas/src/lib/rect.ts` + `.claude/rules/common/coding-style.md`
```ts
// 状態は ReadonlyArray、追加は spread で新配列、map で object update
export const addRoom = (rooms: ReadonlyArray<Room>, r: Room): ReadonlyArray<Room> => [...rooms, r];
```

### CATALOG_PATTERN <!-- v2 -->
// SOURCE: pnpm catalog 公式ドキュメント
```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"

catalog:
  typescript: 5.6.3
  vitest: ^4.1
  zod: ^4.4
  '@types/node': ^22
  react: ^19.2
  react-dom: ^19.2
  '@types/react': ^19.2
  '@types/react-dom': ^19.2
```
```jsonc
// 各 workspace の package.json
{
  "dependencies": {
    "@snap-share/shared": "workspace:*",
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

### ZOD_SSOT_PATTERN <!-- v2 -->
// SOURCE: `.claude/rules/typescript/coding-style.md` "Use Zod for schema-based validation and infer types from the schema"
```ts
// packages/shared/src/room.ts
import { z } from 'zod';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RoomSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.number().int().nonnegative(),
    ttlMs: z.number().int().positive(),
  })
  .readonly();

export type Room = z.infer<typeof RoomSchema>;

export const isExpired = (room: Room, now: number): boolean =>
  now > room.createdAt + room.ttlMs;
```
**SSOT 規約**:
- 型は **必ず `z.infer<typeof XxxSchema>` で導出**。素の `type` `interface` で並行定義しない
- API 境界（Hono ハンドラ / WS メッセージ / フォーム送信）では `XxxSchema.parse(input)` で必ず runtime 検証
- API 失敗時のレスポンスは Zod の `safeParse` 結果を整形して 400 で返す（Phase 2+ の規約）

### ERROR_HANDLING
// SOURCE: `spikes/konva-canvas/src/App.tsx` 50-80 + `.claude/rules/typescript/coding-style.md`
```ts
// 境界では try/catch + getErrorMessage(unknown) + ユーザーメッセージ + console.error
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}
try {
  await loadConfig();
} catch (err: unknown) {
  console.error('[web] config load failed', err);
  setStatus({ kind: 'error', message: getErrorMessage(err) });
}
```

### LOGGING_PATTERN
// SOURCE: `spikes/konva-canvas/src/App.tsx` 62, 67, 79
```ts
// プレフィックスはサービス名: [web], [api], [shared]
console.info('[web] image loaded', { type: file.type, bytes: file.size });
console.warn('[web] oversized image', { bytes: file.size });
console.error('[api] room create failed', err);
// Phase 1 では console.* で十分。Phase 5+ で pino / cloudflare logging を統一
```

### REACT_COMPONENT_PATTERN
// SOURCE: `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx` + `.claude/rules/typescript/coding-style.md`
```tsx
// apps/web/src/components/app-shell/AppShell.tsx
type AppShellProps = Readonly<{ children: React.ReactNode }>;
export const AppShell = ({ children }: AppShellProps) => (
  <main className="app-shell">
    <header className="app-shell-header">snap-share</header>
    {children}
  </main>
);
```

### HONO_ROUTE_PATTERN
// SOURCE: `spikes/yjs-durable-object/server/index.ts`
```ts
// apps/api/src/index.ts
import { Hono } from 'hono';

type Bindings = {
  // Phase 2 で R2_BUCKET, Phase 4 で Y_ROOM, Phase 5 で SECRETS
};
const app = new Hono<{ Bindings: Bindings }>();
app.get('/health', (c) => c.json({ ok: true, service: 'snap-share-api' }));
export default app;
```

### CSS_TOKEN_PATTERN
// SOURCE: `spikes/konva-canvas/src/styles/tokens.css` + `.claude/rules/web/coding-style.md`
```css
/* apps/web/src/styles/tokens.css */
:root {
  --color-surface: oklch(98% 0 0);
  --color-text: oklch(18% 0 0);
  --color-accent: oklch(68% 0.21 250);
  --space-section: clamp(1.5rem, 1rem + 2vw, 3rem);
  --duration-normal: 200ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### TEST_STRUCTURE
// SOURCE: `spikes/konva-canvas/src/lib/__tests__/rect.test.ts` + `.claude/rules/common/testing.md` AAA パターン
```ts
// packages/shared/src/__tests__/room.test.ts
import { describe, it, expect } from 'vitest';
import type { Room } from '../room';
import { isExpired } from '../room';

describe('isExpired', () => {
  it('returns true when now > createdAt + ttlMs', () => {
    // Arrange
    const room: Room = { id: 'a', createdAt: 0, ttlMs: 1000 };
    // Act / Assert
    expect(isExpired(room, 1500)).toBe(true);
  });
});
```

### PLAYWRIGHT_E2E_PATTERN
// SOURCE: `.claude/rules/web/testing.md`
```ts
// apps/web/e2e/landing.spec.ts
import { expect, test } from '@playwright/test';

test('landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('snap-share');
});
```

### TURBO_TASK_PATTERN
// SOURCE: https://turborepo.dev/docs/reference/configuration
```jsonc
// turbo.json (リポジトリルート)
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".turbo/**"] },
    "typecheck": { "dependsOn": ["^build"], "inputs": ["src/**/*.{ts,tsx}", "tsconfig*.json"] },
    "lint": { "inputs": ["src/**/*.{ts,tsx,css,json}", "biome.json"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:e2e": { "dependsOn": ["^build"], "outputs": ["playwright-report/**", "test-results/**"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### WORKSPACE_LAYOUT_PATTERN
// SOURCE: `.claude/PRPs/plans/completed/phase-0-tech-spike.plan.md` の WORKSPACE_LAYOUT_PATTERN を turborepo 化
```
snap-share/
├── apps/
│   ├── web/                       # Vite + React 19 + Tailwind v4 + shadcn
│   │   ├── src/
│   │   │   ├── components/app-shell/AppShell.tsx
│   │   │   ├── styles/{tokens.css,global.css}
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── e2e/landing.spec.ts
│   │   ├── playwright.config.ts
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json + tsconfig.app.json + tsconfig.node.json
│   │   ├── components.json (shadcn)
│   │   ├── index.html
│   │   └── package.json
│   └── api/                       # Hono on Cloudflare Workers
│       ├── src/
│       │   ├── index.ts           # Hono app
│       │   └── __tests__/health.test.ts
│       ├── wrangler.toml
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                    # 型・純関数の SSOT
│       ├── src/
│       │   ├── index.ts
│       │   ├── room.ts
│       │   └── __tests__/room.test.ts
│       ├── tsconfig.json
│       └── package.json
├── spikes/                        # Phase 0 reference (workspace 外)
│   ├── konva-canvas/
│   ├── yjs-durable-object/
│   └── shadcn-vite/
├── .github/workflows/ci.yml
├── biome.json
├── turbo.json
├── pnpm-workspace.yaml            # apps/* と packages/* のみ
├── package.json                   # ルート: turbo + biome + typescript
├── tsconfig.base.json             # 既存維持
├── .gitignore                     # 既存維持
├── .npmrc / .nvmrc                # 既存維持
└── docs/spikes/REPORT.md          # 既存維持
```

### CI_PATTERN
// SOURCE: https://github.com/pnpm/action-setup + `.claude/rules/common/development-workflow.md`
```yaml
# .github/workflows/ci.yml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build --concurrency=4
  e2e:
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @snap-share/web exec playwright install --with-deps chromium
      - run: pnpm turbo run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `pnpm-workspace.yaml` | UPDATE | `spikes/*` を外し、`apps/*` `packages/*` に切り替え |
| `package.json` (root) | UPDATE | scripts を turbo ベースに、biome / turbo / typescript を devDeps に追加 |
| `turbo.json` | CREATE | tasks: dev / build / typecheck / lint / test / test:e2e |
| `biome.json` | CREATE | root: true、formatter / linter / vcs / overrides |
| `.github/workflows/ci.yml` | CREATE | typecheck / lint / test / build / e2e の 2 ジョブ構成 |
| `.gitignore` | UPDATE | `playwright-report/`, `test-results/` を追記 |
| `apps/web/package.json` | CREATE | `@snap-share/web`、Vite 8 / React 19 / Tailwind v4 / shadcn deps |
| `apps/web/index.html` | CREATE | `<title>snap-share</title>` + `#root` |
| `apps/web/vite.config.ts` | CREATE | react + @tailwindcss/vite + path alias `@`、Vitest 設定（happy-dom） |
| `apps/web/tsconfig.json` | CREATE | references で app/node に分岐 + `paths: { "@/*": ["./src/*"] }` |
| `apps/web/tsconfig.app.json` | CREATE | extends `tsconfig.base.json` + `include: ["src"]` |
| `apps/web/tsconfig.node.json` | CREATE | vite.config.ts 用 |
| `apps/web/components.json` | CREATE | shadcn `style: base-nova` (Spike C 同一値) |
| `apps/web/playwright.config.ts` | CREATE | webServer / projects: chromium / baseURL |
| `apps/web/src/main.tsx` | CREATE | React root |
| `apps/web/src/App.tsx` | CREATE | プレースホルダ「snap-share — 準備中」 |
| `apps/web/src/components/app-shell/AppShell.tsx` | CREATE | 最小レイアウトコンポーネント |
| `apps/web/src/lib/utils.ts` | CREATE | shadcn 必須の `cn()`（spike C と同一） |
| `apps/web/src/styles/tokens.css` | CREATE | OKLCH 色トークン（spike A と同一） |
| `apps/web/src/styles/global.css` | CREATE | `@import "tailwindcss";` + reset + body デフォルト |
| `apps/web/e2e/landing.spec.ts` | CREATE | E2E 1 ケース（h1 表示確認） |
| `apps/web/.gitignore` | CREATE | `playwright-report/`, `test-results/`, `.turbo/` ローカル |
| `apps/api/package.json` | CREATE | `@snap-share/api`、Hono 4.12 / wrangler 4 / vitest |
| `apps/api/src/index.ts` | CREATE | Hono app + `/health` エンドポイント |
| `apps/api/src/__tests__/health.test.ts` | CREATE | `app.request('/health')` で 200 と JSON ボディ確認 |
| `apps/api/wrangler.toml` | CREATE | name / main / compatibility_date 2026-04-07 / nodejs_compat（DO バインディングは未定義） |
| `apps/api/tsconfig.json` | CREATE | extends base + Workers types |
| `apps/api/vitest.config.ts` | CREATE | Workers 環境で動かさず Node 環境でユニットテスト（`environment: 'node'`） |
| `packages/shared/package.json` | CREATE | `@snap-share/shared`、type module、main + exports |
| `packages/shared/src/index.ts` | CREATE | 型と関数の barrel re-export |
| `packages/shared/src/room.ts` | CREATE | `Room` 型 + `isExpired` 純関数 + `MAX_IMAGE_BYTES` 定数 |
| `packages/shared/src/__tests__/room.test.ts` | CREATE | 4 ケース（境界 / 期限内 / 過去 / 0 TTL） |
| `packages/shared/tsconfig.json` | CREATE | extends base、`include: ["src"]`、composite なし |
| `README.md` | UPDATE | 「snap-share」+ 起動手順（pnpm install / pnpm dev / pnpm test）+ ディレクトリ構成 1 行 |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 1 行: pending → in-progress、PRP Plan 列にこのファイルパス、完了後 complete |

## NOT Building

- **画像アップロード API / R2 バインディング**（Phase 2）
- **Konva 注釈ツール本実装**（Phase 3、`spikes/konva-canvas/src/lib/rect.ts` の本実装移植も Phase 3）
- **Yjs / Durable Object / Awareness / WebSocket**（Phase 4。Phase 1 の wrangler.toml には DO バインディングを書かない）
- **パスワード保護 / Argon2 / TTL Alarms**（Phase 5）
- **shadcn コンポーネントの追加**（Phase 6 で UI 仕上げ時に Button / Dialog / Input を追加）
- **Tailwind / shadcn のテーマカスタマイズ**（Phase 6）
- **Cloudflare Turnstile / レート制限 / Cloudflare Analytics**（Phase 7）
- **Cloudflare Pages 本番デプロイ / 独自ドメイン**（Phase 7）
- **PWA / Service Worker**（スコープ外）
- **TanStack Router**（PRD 確定スタックだが Phase 1 では 1 ページしか無いため導入を Phase 6 に繰延、本計画の Risks に明記）
- **Visual Regression テスト**（Phase 6 以降）
- **Spike ディレクトリの削除**（reference として保持、`pnpm-workspace.yaml` から外すのみ）
- **`packages/shared` 配下への spike A `rect.ts` 移植**（Phase 3 で Konva 関連型と一緒に持ち込む方が筋が良い。Phase 1 では `Room` 型のみ）
- **Storybook 等のコンポーネントカタログ**（YAGNI）
- **環境変数管理ライブラリ（dotenv-vault 等）**（YAGNI、Phase 5/7 で必要になった時点で）

---

## Step-by-Step Tasks

> 順序は基盤レイヤから上に積み上げる。Task 1〜3 は順次必須、Task 4〜7 は並行可、Task 8〜11 は CI 配線、Task 12 は仕上げ。

### Task 1: pnpm workspace 構成切替 + catalog + ルート package.json <!-- v2 -->
- **ACTION**: ルートの `pnpm-workspace.yaml` に **catalog セクションを含めて**書き換える、`package.json` の scripts を turbo 化
- **IMPLEMENT**:
  - `pnpm-workspace.yaml`（catalog 含む）:
    ```yaml
    packages:
      - "apps/*"
      - "packages/*"

    catalog:
      typescript: 5.6.3
      vitest: ^4.1
      zod: ^4.4
      '@types/node': ^22
      react: ^19.2
      react-dom: ^19.2
      '@types/react': ^19.2
      '@types/react-dom': ^19.2
    ```
    > spike は対象外。catalog の値は workspace 全体で単一ソース。
  - `package.json`:
    ```jsonc
    {
      "name": "snap-share",
      "private": true,
      "version": "0.0.0",
      "description": "snap-share monorepo (turborepo).",
      "packageManager": "pnpm@10.32.1",
      "engines": { "node": ">=22" },
      "scripts": {
        "dev": "turbo run dev",
        "build": "turbo run build",
        "typecheck": "turbo run typecheck",
        "lint": "biome ci .",
        "format": "biome format --write .",
        "test": "turbo run test",
        "test:e2e": "turbo run test:e2e"
      },
      "devDependencies": {
        "@biomejs/biome": "^2.2",
        "turbo": "^2.3",
        "typescript": "5.6.3"
      }
    }
    ```
- **MIRROR**: NAMING_CONVENTION, TURBO_TASK_PATTERN
- **IMPORTS**: なし
- **GOTCHA**:
  - `pnpm install` 実行時に `spikes/` 配下の package が外れるので、ルートで一度 `pnpm install` してから spike を起動すると node_modules が空になる。**spike は今後使わない前提**（reference 用途のみ）
  - turbo は v2 系で `pipeline` から `tasks` に変わっている。`v1` 流用ドキュメントを参照しない
- **VALIDATE**:
  - `pnpm install` がエラーなく完走
  - `pnpm install` 後に `pnpm exec turbo --version` が 2.x を返す
  - `pnpm exec biome --version` が 2.x を返す

### Task 2: turbo.json
- **ACTION**: ルートに `turbo.json` を作成
- **IMPLEMENT**: TURBO_TASK_PATTERN セクションそのまま。`globalEnv` は今は空でよい（Phase 4+ で `CLOUDFLARE_ACCOUNT_ID` 等を追加）
- **MIRROR**: TURBO_TASK_PATTERN
- **IMPORTS**: なし
- **GOTCHA**:
  - `dev: { persistent: true }` が無いと並行 watch でエラー
  - `outputs` を `[".turbo/**"]` で含めない（cache 自体）。`coverage/**`, `dist/**`, `playwright-report/**`, `test-results/**` のみ
- **VALIDATE**: `pnpm exec turbo run typecheck --dry=json` でタスクグラフが解決される

### Task 3: biome.json (2.4 / `useConst` のみ / `includes` neg) <!-- v2 -->
- **ACTION**: ルートに Biome 2.4 設定
- **IMPLEMENT**:
  ```jsonc
  {
    "$schema": "https://biomejs.dev/schemas/2.4.13/schema.json",
    "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true, "defaultBranch": "main" },
    "files": {
      "ignoreUnknown": true,
      "includes": [
        "**",
        "!node_modules", "!**/node_modules",
        "!dist", "!**/dist",
        "!.turbo", "!**/.turbo",
        "!.wrangler", "!**/.wrangler",
        "!playwright-report", "!**/playwright-report",
        "!test-results", "!**/test-results",
        "!spikes",
        "!**/.tsbuildinfo", "!**/*.tsbuildinfo",
        "!**/*.gen.ts"
      ]
    },
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineWidth": 100,
      "lineEnding": "lf"
    },
    "linter": {
      "enabled": true,
      "rules": {
        "recommended": true,
        "correctness": { "noUnusedVariables": "error", "noUnusedImports": "error" },
        "suspicious": { "noDebugger": "error", "noConsole": "warn", "noExplicitAny": "warn" },
        "style": { "useConst": "error" }
      }
    },
    "javascript": {
      "formatter": {
        "quoteStyle": "single",
        "jsxQuoteStyle": "double",
        "semicolons": "always",
        "trailingCommas": "all",
        "arrowParentheses": "always"
      }
    },
    "json": { "formatter": { "trailingCommas": "none" } },
    "assist": { "enabled": true, "actions": { "source": { "organizeImports": "on" } } },
    "overrides": [
      { "includes": ["**/*.test.ts", "**/*.spec.ts"], "linter": { "rules": { "suspicious": { "noExplicitAny": "off" } } } }
    ]
  }
  ```
- **GOTCHA (v2)**:
  - **`noVar` は biome 2.x で削除済**（`useConst` が同等以上をカバー）
  - **`includes` の neg パターンは `!folder` + `!**/folder`** 形式（`useBiomeIgnoreFolder` rule 推奨）
  - `assist.actions.source.organizeImports` で import 順を自動整列
- **MIRROR**: NAMING_CONVENTION（クォート / セミコロン）
- **IMPORTS**: なし
- **GOTCHA**:
  - **`spikes` を `files.ignore` に含める**（spike A の rect.ts は 100 width 超過なし、スタイルも揃っているが、Phase 0 ロックを崩さないため biome 対象外にする）
  - Biome は `useIgnoreFile: true` で `.gitignore` を尊重するので、ほぼ十分。明示 ignore は二重定義の保険
  - `noConsole: "warn"` は Phase 1 では warn のまま。CI は warn を fail にしない
- **VALIDATE**: `pnpm exec biome ci .` が（まだ TS ファイルが少ないので）エラーゼロ

### Task 4: packages/shared (Zod v4 SSOT) <!-- v2 -->
- **ACTION**: Zod v4 スキーマ駆動の SSOT を作る。型は `z.infer` で導出、catalog 経由 deps
- **IMPLEMENT**:
  - `packages/shared/package.json`:
    ```jsonc
    {
      "name": "@snap-share/shared",
      "version": "0.0.0",
      "private": true,
      "type": "module",
      "main": "./src/index.ts",
      "types": "./src/index.ts",
      "exports": { ".": "./src/index.ts" },
      "scripts": {
        "typecheck": "tsc --noEmit",
        "test": "vitest run",
        "test:watch": "vitest"
      },
      "dependencies": {
        "zod": "catalog:"
      },
      "devDependencies": {
        "typescript": "catalog:",
        "vitest": "catalog:"
      }
    }
    ```
    > **`main` を直接 `./src/index.ts` に向ける**: Vite/Vitest はソース直参照で問題なく、ビルドステップを増やさない（KISS）
  - `packages/shared/tsconfig.json`:
    ```jsonc
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": { "noEmit": true },
      "include": ["src"]
    }
    ```
  - `packages/shared/src/room.ts` (ZOD_SSOT_PATTERN):
    ```ts
    import { z } from 'zod';

    export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    export const DEFAULT_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

    export const RoomSchema = z
      .object({
        id: z.string().min(1),
        createdAt: z.number().int().nonnegative(),
        ttlMs: z.number().int().positive(),
      })
      .readonly();

    export type Room = z.infer<typeof RoomSchema>;

    export const isExpired = (room: Room, now: number): boolean =>
      now > room.createdAt + room.ttlMs;
    ```
  - `packages/shared/src/index.ts`:
    ```ts
    export * from './room';
    ```
  - `packages/shared/src/__tests__/room.test.ts`: 9 ケース（`isExpired` 4 件 + `RoomSchema` 5 件: 正常 parse / 空 id reject / 非正 ttlMs reject / 負 createdAt reject / 非整数 reject）
- **MIRROR**: ZOD_SSOT_PATTERN, IMMUTABILITY_PATTERN, TEST_STRUCTURE, NAMING_CONVENTION, CATALOG_PATTERN
- **IMPORTS**: `zod`, `vitest`
- **GOTCHA**:
  - `noUncheckedIndexedAccess: true` を継承するので配列アクセスは narrowing 必須
  - `verbatimModuleSyntax: true` のため `import type` を区別すること
  - **Zod v4 の `z.object({...}).readonly()` は v3/v4 共通 API**。`z.email()` `z.url()` などのスタンドアロン関数を使う場合は v4 専用記法
- **VALIDATE**:
  - `pnpm --filter @snap-share/shared test` で 9 件 GREEN
  - `pnpm --filter @snap-share/shared typecheck` でゼロエラー
  - `pnpm exec node -e "console.log(require('zod/package.json').version)"` で 4.x 系を確認

### Task 5: apps/api（Hono + Workers + /health）
- **ACTION**: Spike B の構造を縮小して `/health` だけの Hono アプリ
- **IMPLEMENT**:
  - `apps/api/package.json` (catalog 参照): <!-- v2 -->
    ```jsonc
    {
      "name": "@snap-share/api",
      "version": "0.0.0",
      "private": true,
      "type": "module",
      "scripts": {
        "dev": "wrangler dev --port 8787",
        "build": "wrangler deploy --dry-run --outdir dist",
        "typecheck": "tsc --noEmit",
        "test": "vitest run"
      },
      "dependencies": {
        "@snap-share/shared": "workspace:*",
        "hono": "^4.12"
      },
      "devDependencies": {
        "@cloudflare/workers-types": "^4.20260430",
        "@types/node": "catalog:",
        "typescript": "catalog:",
        "vitest": "catalog:",
        "wrangler": "^4"
      }
    }
    ```
  - `apps/api/wrangler.toml`:
    ```toml
    name = "snap-share-api"
    main = "src/index.ts"
    compatibility_date = "2026-04-07"
    compatibility_flags = ["nodejs_compat"]
    # Phase 2 で R2 バインディング、Phase 4 で Durable Object を追加する
    ```
  - `apps/api/tsconfig.json`:
    ```jsonc
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "lib": ["ES2022"],
        "types": ["@cloudflare/workers-types"],
        "noEmit": true,
        "jsx": "preserve"
      },
      "include": ["src"]
    }
    ```
  - `apps/api/src/index.ts`:
    ```ts
    import { Hono } from 'hono';

    type Bindings = Record<string, never>;
    const app = new Hono<{ Bindings: Bindings }>();

    app.get('/health', (c) =>
      c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }),
    );

    export default app;
    ```
  - `apps/api/src/__tests__/health.test.ts`:
    ```ts
    import { describe, expect, it } from 'vitest';
    import app from '../index';

    describe('GET /health', () => {
      it('returns 200 and ok payload', async () => {
        const res = await app.request('/health');
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; service: string };
        expect(body.ok).toBe(true);
        expect(body.service).toBe('snap-share-api');
      });
    });
    ```
  - `apps/api/vitest.config.ts`:
    ```ts
    import { defineConfig } from 'vitest/config';
    export default defineConfig({ test: { environment: 'node' } });
    ```
- **MIRROR**: HONO_ROUTE_PATTERN, TEST_STRUCTURE, ERROR_HANDLING（ハンドラ内では throw を避け、Hono の `c.json` で返す）
- **IMPORTS**: `hono`, `vitest`
- **GOTCHA**:
  - **Workers 環境では `Date.now()` が決定論的でない** が、テストでは type 検査のみで OK
  - `wrangler deploy --dry-run --outdir dist` を build に当てると CF アカウントなしでも build 可能（CI で必須）
  - **Phase 1 では DO バインディング・migrations を書かない**。`compatibility_flags = ["nodejs_compat"]` は spike B から継承
- **VALIDATE**:
  - `pnpm --filter @snap-share/api test` で 1 件 GREEN
  - `pnpm --filter @snap-share/api typecheck` でゼロエラー
  - `pnpm --filter @snap-share/api dev` で `curl http://localhost:8787/health` が `{"ok":true,...}` を返す
  - `pnpm --filter @snap-share/api build` がエラーなく `dist/` を生成

### Task 6: apps/web パッケージ雛形（Vite + React 19 + Tailwind v4）
- **ACTION**: Spike A + Spike C の最小構成を `apps/web` に再構成
- **IMPLEMENT**:
  - `apps/web/package.json` (catalog 参照): <!-- v2 -->
    ```jsonc
    {
      "name": "@snap-share/web",
      "version": "0.0.0",
      "private": true,
      "type": "module",
      "scripts": {
        "dev": "vite",
        "build": "tsc --noEmit && vite build",
        "preview": "vite preview",
        "typecheck": "tsc --noEmit",
        "test": "vitest run",
        "test:e2e": "playwright test"
      },
      "dependencies": {
        "@snap-share/shared": "workspace:*",
        "clsx": "^2.1",
        "react": "catalog:",
        "react-dom": "catalog:",
        "tailwind-merge": "^3.0"
      },
      "devDependencies": {
        "@playwright/test": "^1.50",
        "@tailwindcss/vite": "^4.2",
        "@types/node": "catalog:",
        "@types/react": "catalog:",
        "@types/react-dom": "catalog:",
        "@vitejs/plugin-react": "^6.0",
        "happy-dom": "^20.0",
        "tailwindcss": "^4.2",
        "typescript": "catalog:",
        "vite": "^8.0",
        "vitest": "catalog:"
      }
    }
    ```
    > shadcn 本体パッケージは Phase 6 で components 追加時に devDep として導入。Phase 1 ではコンポーネントを 1 つも追加しないため `shadcn` パッケージ・`@base-ui/react` は不要。**plan v1 にあった composite + tsconfig split 構成は単一 tsconfig 化（前セッションで `.d.ts`/`.js` が src 内に emit して biome が拾う問題が出たため）**。
  - `apps/web/vite.config.ts` (vitest e2e exclude を含む): <!-- v2 -->
    ```ts
    import path from 'node:path';
    import tailwindcss from '@tailwindcss/vite';
    import react from '@vitejs/plugin-react';
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      plugins: [react(), tailwindcss()],
      resolve: { alias: { '@': path.resolve(__dirname, './src') } },
      server: { port: 5173 },
      test: {
        environment: 'happy-dom',
        globals: false,
        include: ['src/**/*.test.{ts,tsx}'],
        exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
      },
    });
    ```
    > vitest が `e2e/landing.spec.ts` を unit test として拾うのを防ぐため明示的に exclude
  - `apps/web/tsconfig.json` (単一 tsconfig): <!-- v2 -->
    ```jsonc
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "paths": { "@/*": ["./src/*"] },
        "types": ["vite/client", "node"],
        "noEmit": true
      },
      "include": ["src", "vite.config.ts", "playwright.config.ts"]
    }
    ```
  - `apps/web/components.json`: spike C の `components.json` を `apps/web/` にコピー（`style: "base-nova"`, `baseColor: "neutral"`, aliases そのまま）
  - `apps/web/index.html`:
    ```html
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>snap-share</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body>
    </html>
    ```
  - `apps/web/src/styles/tokens.css`: spike A の `tokens.css` をコピー（変更なし）
  - `apps/web/src/styles/global.css`:
    ```css
    @import "tailwindcss";
    @import "./tokens.css";

    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Helvetica Neue", "Hiragino Kaku Gothic ProN", sans-serif;
      background: var(--color-surface);
      color: var(--color-text);
    }
    ```
  - `apps/web/src/lib/utils.ts`: spike C の `cn()` をそのままコピー
  - `apps/web/src/components/app-shell/AppShell.tsx`:
    ```tsx
    import type { ReactNode } from 'react';

    type AppShellProps = Readonly<{ children: ReactNode }>;

    export const AppShell = ({ children }: AppShellProps) => (
      <main className="app-shell">
        <header className="app-shell-header">
          <h1>snap-share</h1>
        </header>
        <section className="app-shell-body">{children}</section>
      </main>
    );
    ```
  - `apps/web/src/App.tsx`:
    ```tsx
    import { AppShell } from './components/app-shell/AppShell';

    export const App = () => (
      <AppShell>
        <p>準備中 — Phase 1 monorepo init scaffold</p>
      </AppShell>
    );
    ```
  - `apps/web/src/main.tsx`:
    ```tsx
    import { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import './styles/global.css';
    import { App } from './App';

    const rootEl = document.getElementById('root');
    if (!rootEl) {
      throw new Error('Root element #root not found');
    }
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    ```
- **MIRROR**: REACT_COMPONENT_PATTERN, TS_CONFIG_PATTERN, NAMING_CONVENTION, CSS_TOKEN_PATTERN, ERROR_HANDLING（main.tsx の null 検査）
- **IMPORTS**: 上記 deps
- **GOTCHA**:
  - **`tsc -b` (build mode) を使う**: 複数 tsconfig + composite で increment build。`tsconfig.json` は references 親、`tsconfig.app.json` / `tsconfig.node.json` は子
  - **`composite: true` の代償として `.tsbuildinfo`** ファイルが出力される。`.gitignore` で除外
  - **`vite.config.ts` は `vitest/config` から `defineConfig` を import**（spike A 同様）
  - `tailwindcss` パッケージ本体は v4 では `@import` だけで動くが、自動補完用に devDep に残す
  - `index.html` の `<html lang="ja">` が a11y で重要
- **VALIDATE**:
  - `pnpm --filter @snap-share/web typecheck` ゼロエラー
  - `pnpm --filter @snap-share/web dev` でブラウザに「snap-share / 準備中 …」が表示
  - `pnpm --filter @snap-share/web build` で `dist/index.html` が生成される
  - Tailwind ユーティリティが効くか手動確認（`<p className="text-sm">` などを試す → 確認後 commit には残さない）

### Task 7: apps/web の Vitest + 1 件のユニットテスト
- **ACTION**: Vitest が apps/web 単位で動くことを確認するための最小テスト
- **IMPLEMENT**:
  - `apps/web/src/lib/__tests__/utils.test.ts`:
    ```ts
    import { describe, expect, it } from 'vitest';
    import { cn } from '../utils';

    describe('cn', () => {
      it('merges class names with tailwind-merge', () => {
        expect(cn('px-2', 'px-4')).toBe('px-4');
      });
      it('drops falsy values', () => {
        expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
      });
    });
    ```
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: vitest
- **GOTCHA**: shadcn の `cn()` は `clsx` + `tailwind-merge` 合成。挙動を「最後勝ち」で確認するのが基本
- **VALIDATE**: `pnpm --filter @snap-share/web test` で 2 件 GREEN

### Task 8: apps/web の Playwright セットアップ + 1 件の E2E
- **ACTION**: Playwright を最小構成で導入
- **IMPLEMENT**:
  - `apps/web/playwright.config.ts`:
    ```ts
    import { defineConfig, devices } from '@playwright/test';

    const PORT = 5173;

    export default defineConfig({
      testDir: './e2e',
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 2 : 0,
      reporter: [['html', { open: 'never' }], ['list']],
      use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'on-first-retry',
      },
      projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      ],
      webServer: {
        command: 'pnpm dev',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
    });
    ```
  - `apps/web/e2e/landing.spec.ts`:
    ```ts
    import { expect, test } from '@playwright/test';

    test('landing page renders heading', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1')).toContainText('snap-share');
    });
    ```
  - `apps/web/.gitignore`:
    ```
    .turbo
    .tsbuildinfo
    playwright-report/
    test-results/
    ```
- **MIRROR**: PLAYWRIGHT_E2E_PATTERN
- **IMPORTS**: `@playwright/test`
- **GOTCHA**:
  - **CI で `pnpm exec playwright install --with-deps chromium` が必須**。ジョブで実行
  - `webServer.command: 'pnpm dev'` がローカル / CI 双方で動く（`reuseExistingServer` が CI では false）
  - 1 ブラウザのみ（chromium）。`firefox` `webkit` は Phase 6 で UI 仕上げ後に追加
- **VALIDATE**:
  - ローカル: `pnpm --filter @snap-share/web test:e2e` で 1 件 PASS
  - `playwright-report/` が生成される

### Task 9: ルート .gitignore 拡張
- **ACTION**: 既存 `.gitignore` に Playwright / tsbuildinfo を追加
- **IMPLEMENT**:
  ```
  node_modules/
  dist/
  build/
  coverage/
  .wrangler/
  .dev.vars
  .DS_Store
  *.log
  .env
  .env.local
  .vite/
  .cache/
  .turbo/
  playwright-report/
  test-results/
  .tsbuildinfo/
  *.tsbuildinfo
  ```
- **MIRROR**: なし（設定）
- **IMPORTS**: なし
- **GOTCHA**: `*.tsbuildinfo` と `.tsbuildinfo/` の両方を含める（apps/web は dir、apps/api は単体ファイル）
- **VALIDATE**: `git status --ignored` で対象ファイルが ignored 表示

### Task 10: GitHub Actions CI ワークフロー
- **ACTION**: `.github/workflows/ci.yml` を作成
- **IMPLEMENT**: CI_PATTERN セクションそのまま。matrix 化はせず単一 OS / 単一 Node
- **MIRROR**: CI_PATTERN
- **IMPORTS**: なし
- **GOTCHA**:
  - `pnpm/action-setup@v4` は `package.json` の `packageManager` から pnpm バージョンを取る。`packageManager` 設定済（Task 1）
  - `actions/setup-node@v4` の `cache: pnpm` は `pnpm-lock.yaml` をキーに pnpm store をキャッシュ
  - `pnpm turbo run lint typecheck test build --concurrency=4` の 1 行で 4 タスクをタスクグラフで実行
  - **`pnpm turbo run dev` を CI で動かさない**（persistent task。`--filter` でも除外推奨だが、`pnpm turbo run lint typecheck test build` に dev が含まれないので問題なし）
  - E2E ジョブは別ジョブで `needs: check`、Playwright artifact をアップロード
- **VALIDATE**: PR を作成（or `act` で local 検証）して全ジョブ green

### Task 11: README + 開発手順
- **ACTION**: ルート `README.md` を「snap-share」+ 起動手順の最小構成に書き換え
- **IMPLEMENT**:
  ````md
  # snap-share

  > 画像にハイライト・吹き出し・矢印・テキストをオーバーレイし、URL一発で共同編集できる、日本語ファーストの軽量Webアプリ。

  See [PRD](./.claude/PRPs/prds/snap-share.prd.md) for the product context.

  ## Repository layout

  | Path | What |
  |---|---|
  | `apps/web` | Vite + React 19 + Tailwind v4 frontend (`pnpm dev` → http://localhost:5173) |
  | `apps/api` | Hono on Cloudflare Workers (`wrangler dev` → http://localhost:8787/health) |
  | `packages/shared` | Shared types and pure utilities |
  | `spikes/` | Phase 0 reference implementations (kept for reference, not part of the workspace) |
  | `docs/spikes/REPORT.md` | Phase 0 spike findings |

  ## Local development

  ```sh
  pnpm install
  pnpm dev          # starts apps/web and apps/api in parallel via turbo
  pnpm test         # vitest across packages
  pnpm test:e2e     # playwright (Chromium only for now)
  pnpm lint         # biome ci
  pnpm typecheck    # tsc -b across the repo
  ```

  Node 22+ and pnpm 10 (managed via `packageManager`) required.
  ````
- **MIRROR**: なし（ドキュメント）
- **IMPORTS**: なし
- **GOTCHA**: README は「ジョブのリンク先 / バッジ」の追加を Task 12 完了後に検討（Phase 1 では基本情報のみ）
- **VALIDATE**: `pnpm install && pnpm dev` がドキュメントどおりに動く（オーナー手動）

### Task 12: PRD 更新
- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` の Phase 1 行を更新
- **IMPLEMENT**:
  - Phase 1 行: status `pending` → 着手時 `in-progress`、Task 1〜11 完了 + CI green 後 `complete`
  - PRP Plan 列に `.claude/PRPs/plans/phase-1-monorepo-init.plan.md` を記入
  - 完了時、Phase 1 行の隣に「PR # / commit hash」をメモ（任意）
- **MIRROR**: なし
- **IMPORTS**: なし
- **GOTCHA**:
  - **2 回の更新**（in-progress / complete）
  - PRD の Decisions Log 末尾に「Phase 1 で `packages/shared` は `main: src/index.ts` 直参照モデル採用、ビルド省略」を 1 行追記（決定事項として記録）
- **VALIDATE**: `git diff .claude/PRPs/prds/snap-share.prd.md` で Phase 1 行とDecisions Log への追記を確認

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `isExpired` returns false at boundary now == createdAt | `room`, `1000` | `false` | yes |
| `isExpired` returns false within ttl | `room`, `1500` | `false` | no |
| `isExpired` returns true past ttl | `room`, `2500` | `true` | yes |
| `DEFAULT_ROOM_TTL_MS` is 7 days | – | `604_800_000` | constant guard |
| `cn` last class wins (tailwind-merge) | `'px-2'`, `'px-4'` | `'px-4'` | no |
| `cn` drops falsy | `'a'`, false, undefined, `'c'` | `'a c'` | yes |
| `GET /health` returns 200 + ok payload | – | status 200, `{ok:true, service:'snap-share-api', ts:number}` | no |

### E2E Tests

| Test | Steps | Expected | Edge Case? |
|---|---|---|---|
| Landing renders heading | `goto('/')` | h1 contains "snap-share" | smoke only |

### Edge Cases Checklist
- [ ] `pnpm install` をクリーン環境で実行して lockfile 整合性を確認
- [ ] `pnpm turbo run typecheck` で全 workspace の TS が 0 error
- [ ] `pnpm exec biome ci .` で lint/format 違反 0
- [ ] `pnpm dev` で web/api 両方が起動（5173 / 8787）
- [ ] api を停止していても web の dev は独立で動く
- [ ] CI ジョブを GitHub Actions が green で完走（`apps/web/playwright-report/` artifact が落ちている）
- [ ] `apps/web/build` が `dist/index.html` を出力
- [ ] `apps/api/build` (=`wrangler deploy --dry-run`) が CF アカウントなしで成功

> Phase 1 は機能テスト/視覚回帰の優先度低（UI が「準備中」のみ）。本格的な視覚回帰は Phase 6 で導入。

---

## Validation Commands

### Static Analysis（typecheck）
```bash
pnpm install --frozen-lockfile
pnpm turbo run typecheck
```
EXPECT: 全 workspace で 0 エラー

### Lint / Format
```bash
pnpm exec biome ci .
```
EXPECT: 違反 0

### Unit Tests
```bash
pnpm turbo run test
```
EXPECT: shared 4 件 + web 2 件 + api 1 件 = 7 件 GREEN

### Build
```bash
pnpm turbo run build
```
EXPECT: `apps/web/dist/index.html` 出力、`apps/api` の wrangler dry-run 成功

### Dev サーバ起動（手動）
```bash
pnpm dev
# 別ターミナルで
curl -s http://localhost:8787/health | jq .
# ブラウザで http://localhost:5173 を開いて 「snap-share / 準備中 ...」を確認
```
EXPECT:
- `/health` が `{ "ok": true, "service": "snap-share-api", "ts": <number> }`
- web 画面に h1 「snap-share」 + 「準備中」

### E2E
```bash
pnpm --filter @snap-share/web exec playwright install --with-deps chromium
pnpm turbo run test:e2e
```
EXPECT: 1 ケース PASS、`apps/web/playwright-report/` 生成

### CI 同等チェック
```bash
pnpm install --frozen-lockfile
pnpm turbo run lint typecheck test build --concurrency=4
```
EXPECT: 全タスク green

### Manual Validation（最終チェックリスト）
- [ ] `pnpm install` 完走
- [ ] `pnpm dev` で web/api 並行起動、ホットリロード動作
- [ ] `curl http://localhost:8787/health` が ok JSON を返す
- [ ] http://localhost:5173 で 「snap-share / 準備中」が表示
- [ ] `pnpm turbo run lint typecheck test build` が all green
- [ ] `pnpm test:e2e` が all green
- [ ] PR 作成して GitHub Actions が all green
- [ ] PRD の Phase 1 が `complete` になり PRP Plan 列に本ファイルパスが記載
- [ ] README に開発手順が記載

---

## Acceptance Criteria
- [ ] Task 1〜12 すべて完了
- [ ] Validation Commands 全節クリア
- [ ] CI ジョブが PR / main で all green
- [ ] `pnpm dev` で web + api が並行起動し、`/health` 200 + ランディング表示
- [ ] 7 件以上の unit test + 1 件以上の E2E が GREEN
- [ ] PRD Phase 1 行が `complete`、PRP Plan 列が埋まっている
- [ ] `spikes/` は git に保持されつつ `pnpm-workspace.yaml` の対象外

## Completion Checklist
- [ ] コードが Patterns to Mirror に準拠（NAMING / IMMUTABILITY / TS_CONFIG / TEST / ERROR / HONO / CSS_TOKEN）
- [ ] エラーハンドリングが console.error + ユーザー向け表示（apps/web）/ 構造化レスポンス（apps/api）
- [ ] 不変パターン徹底（mutation 無し）
- [ ] テストが `__tests__` 配下、AAA 構成
- [ ] ハードコード禁止（マジックナンバーは `packages/shared` の定数 or CSS変数）
- [ ] `console.log` を本番コード（src/）に残さない（Biome warn が拾う）
- [ ] スコープ外項目（NOT Building）に手を出していない
- [ ] PRD（Phase 1 status / PRP Plan / Decisions Log）が更新済み
- [ ] README に開発手順が記載

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| turbo v2 の `tasks` キーや `inputs` 仕様変更で `dev` が persistent 認識されない | L | M | Task 2 のサンプルに合わせる、`turbo run dev --dry=json` でタスクメタを確認 |
| Biome v2.2 の `noConsole` warn が CI で fail 扱い（`biome ci` の挙動） | M | M | `biome ci` のデフォルトでは warn は exit 0、念のため Task 10 後に CI で確認 |
| `@tailwindcss/vite` v4 と vite 8 / vitest 4 の組合せで peer 警告 | M | L | `auto-install-peers=true` で吸収、出れば spike C と同条件なので解決可 |
| Playwright の chromium ダウンロードに時間がかかり CI が肥大化 | M | M | `cache: pnpm` で node_modules キャッシュ、Playwright は `setup-node` 完了後に都度 install |
| `tsc -b` で composite + references 設定が刺さる（pre-existing tsconfig.base.json と相性） | M | M | `composite: true` を子のみに付け、`tsconfig.json` 親は `files: []` `references` のみ。spike C と同じパターン |
| `wrangler deploy --dry-run --outdir dist` が CI で credential を要求する | M | M | `--dry-run` モードは CF アカウント不要であることを Task 5 で実機確認、ダメなら CI で `apps/api` の build をスキップ＋ typecheck のみに切替 |
| TanStack Router 未導入のまま Phase 6 で焦って入れて UI を壊す | L | M | NOT Building に明記、Phase 6 plan で単独タスクとして導入する想定 |
| spike が workspace から外れて `pnpm install` 後にローカル動作不能になる（オーナーが spike を再起動したい時） | L | L | README に「spike は Phase 0 の reference。再起動には `cd spikes/<name> && pnpm install` を個別に実行」と注記 |
| Biome ignore に `spikes` が無く lint で誤検出 | L | L | Task 3 で明示的に ignore 済 |
| `noUncheckedIndexedAccess: true` で apps/web の `tokens.css` 周りや React コードでのインデックスアクセスがエラー | L | L | サンプルコードは既に narrowing 済、出たら narrowing で対応 |

## Notes

- **本フェーズは「動く土台」を作るフェーズ**: 機能テストの厚みより `tsc -b / biome ci / vitest / playwright / wrangler dry-run / turbo` の **配線** が green であることが最優先。
- Phase 0 spike を **削除しない**: `docs/spikes/REPORT.md` から referenced されており、Phase 4（Yjs+DO）で `spikes/yjs-durable-object/server/index.ts` のパターンに戻る予定。`pnpm-workspace.yaml` から外すだけ。
- `packages/shared` の `Room` 型は **暫定スタブ**。Phase 2 で `imageUrl` `password` `ttlMs` などのフィールドが追加される。Phase 1 では「型の場所がここ」「テストの書き方がこれ」を確立するのが目的で、フィールドは最小。
- shadcn コンポーネントの追加は **Phase 6 で initial 実行 + button/dialog/input 追加**。Phase 1 では `components.json` だけ用意して shadcn CLI が後から動く土台にする。
- TanStack Router は PRD では Frontend スタックに入っているが、Phase 1 ではルーティングが不要（1 ページのみ）。Phase 6 の UI 仕上げで `apps/web` に追加する。これは PRD と本計画の Risk テーブルで明示。
- Playwright の `webServer.command: 'pnpm dev'` は **`apps/web` 内で実行**。turbo の `pnpm turbo run test:e2e` は filter で `@snap-share/web` を選ぶため、`apps/web/` の root で `pnpm dev` が呼ばれる挙動になる（pnpm script の解決ルール）。
- 本計画は Phase 0 の `phase-0-tech-spike.plan.md` を mirror 元として明示する初の本実装フェーズなので、ここで確立したパターン（特に CI / turbo / biome / wrangler dry-run / playwright config）は Phase 2〜7 でも同じ形を踏襲する。
