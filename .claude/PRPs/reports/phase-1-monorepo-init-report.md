# Implementation Report: Phase 1 — モノレポ初期化 (v2)

> Generated: 2026-04-30
> Branch: `feat/phase-1-monorepo-init`
> Plan: [.claude/PRPs/plans/completed/phase-1-monorepo-init.plan.md](../plans/completed/phase-1-monorepo-init.plan.md)
> PRD: [.claude/PRPs/prds/snap-share.prd.md](../prds/snap-share.prd.md) — Phase 1
> Revision: **v2 — ユーザーレビュー後の再実装**（v1 でプラグイン無効化判断ミスをユーザーが指摘し、catalog/Zod v4/SSOT 強化を含めて Phase 0 状態から完全再実装）

## Summary

Turborepo + pnpm workspace 構成で `apps/web` (Vite + React 19 + Tailwind v4) / `apps/api` (Hono on Cloudflare Workers) / `packages/shared` (**Zod v4 スキーマ駆動 SSOT**) を立ち上げ、Biome 2.4 + Vitest 4 + Playwright + GitHub Actions CI を配線。**共有依存（typescript / vitest / zod / react / @types/*）は pnpm catalog で一元管理**。`pnpm dev` で web/api 並行起動、`pnpm turbo run lint typecheck test build` が all green、E2E smoke 1 件 PASS。

## Assessment vs Reality

| Metric | Predicted (Plan v2) | Actual |
|---|---|---|
| Complexity | Large | Large（妥当） |
| Confidence | 8/10 | 8/10 |
| Estimated Files | 35–40 | 30 ファイル新規 + 6 ファイル更新 |
| Estimated LOC | 800–1200 | 約 700 行 |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 0 | Phase 0 状態に巻き戻し | ✅ | git restore + rm -rf untracked |
| 0' | plan 改訂 (catalog + Zod v4 + SSOT) | ✅ | Decisions Addendum + 新パターン (CATALOG_PATTERN / ZOD_SSOT_PATTERN) を plan に追記 |
| 1 | pnpm-workspace.yaml + ルート package.json (catalog) | ✅ | catalog: typescript / vitest / zod / @types/node / react / react-dom / @types/react / @types/react-dom |
| 2 | turbo.json | ✅ | 6 タスク（build / typecheck / lint / test / test:e2e / dev persistent） |
| 3 | biome.json | ✅ | 2.4.13 / `useConst` のみ / `includes` neg pattern (`!folder` + `!**/folder`) |
| 4 | packages/shared (Zod v4 SSOT) | ✅ | RoomSchema (z.object().readonly()) + z.infer<typeof RoomSchema>、9 件 GREEN |
| 5 | apps/api (Hono + /health, catalog deps) | ✅ | @types/node / typescript / vitest が catalog 経由 |
| 6 | apps/web (Vite + React 19 + Tailwind v4, catalog deps) | ✅ | 単一 tsconfig、react / react-dom / @types/* / typescript / vitest が catalog 経由 |
| 7 | apps/web Vitest | ✅ | cn() 2 ケース GREEN、include/exclude で e2e 分離 |
| 8 | apps/web Playwright | ✅ | chromium 1 件 PASS |
| 9 | ルート .gitignore 拡張 | ✅ | playwright-report / test-results / tsbuildinfo |
| 10 | GitHub Actions CI | ✅ | check ジョブ + e2e ジョブ、Playwright artifact upload |
| 11 | README 更新 | ✅ | catalog 説明追記 |
| 12 | PRD 更新 | ✅ | Phase 1 行 → complete、Decisions Log に catalog/Zod v4/SSOT/その他で 8 行追記 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | turbo: 3 successful (shared/api/web)、0 type errors |
| Lint (`biome ci .`) | ✅ Pass | 29 files checked、0 errors |
| Unit Tests | ✅ Pass | shared: 9 / api: 1 / web: 2 = **計 12 件 GREEN** |
| Build | ✅ Pass | web: vite build 190 KB raw / 60 KB gz、api: wrangler dry-run 62 KB raw / 15 KB gz |
| Integration (Playwright) | ✅ Pass | 1 件 PASS、chromium、webServer 自動起動 |

## v2 改善点（v1 から）

| 項目 | v1 (前セッション) | v2 (本実装) |
|---|---|---|
| プラグイン状態 | 一時無効化（判断ミス） | プラグイン有効のまま完遂 |
| 依存バージョン管理 | 各 workspace で個別記述 | **pnpm catalog で一元管理** |
| Zod | v3 (`^3.23` 記述、3.25.76 解決) | **v4 (`^4.4` 記述、4.4.1 解決)** |
| SSOT | Zod 化は事後追加 | **Phase 1 設計時から Zod スキーマ駆動 SSOT** |
| `apps/web` tsconfig | composite split → 単一に修正 | 最初から単一 tsconfig |
| `vite.config.ts` | E2E exclude 後追加 | 最初から `include`/`exclude` で e2e 分離 |
| biome | `noVar` で初回エラー → 修正 | 最初から `useConst` のみ |

## Catalog 採用効果

Phase 2 以降で `zod` `react` `vitest` のバージョン更新が `pnpm-workspace.yaml` の 1 行変更で全 workspace に伝播。Phase 6 の React Router/Router Devtools 拡張時も同パターン。

## SSOT 確立効果（Zod v4 スキーマ駆動）

`packages/shared/src/room.ts` の `RoomSchema` から `type Room = z.infer<typeof RoomSchema>` で型を導出。Phase 2 の `POST /rooms` body 検証は `RoomSchema.parse(body)` の 1 行で済む。`@hono/zod-validator` 統合は Phase 2 で予約済。

## Files Changed

### Created (30 ファイル)

| Path | Purpose |
|---|---|
| `turbo.json` | turbo タスク定義 |
| `biome.json` | Biome 2.4 設定 |
| `apps/api/package.json` | catalog 参照 |
| `apps/api/wrangler.toml` | CF Workers 設定 |
| `apps/api/tsconfig.json` | Workers types |
| `apps/api/src/index.ts` | Hono app + /health |
| `apps/api/src/__tests__/health.test.ts` | 1 件 |
| `apps/api/vitest.config.ts` | node 環境 |
| `apps/web/package.json` | catalog 参照 |
| `apps/web/vite.config.ts` | tailwind + vitest e2e exclude |
| `apps/web/tsconfig.json` | 単一 tsconfig |
| `apps/web/components.json` | shadcn (base-nova) |
| `apps/web/index.html` | lang="ja" |
| `apps/web/playwright.config.ts` | chromium + webServer |
| `apps/web/.gitignore` | tsbuildinfo / playwright |
| `apps/web/src/main.tsx` | React root |
| `apps/web/src/App.tsx` | プレースホルダ |
| `apps/web/src/components/app-shell/AppShell.tsx` | レイアウト |
| `apps/web/src/lib/utils.ts` | cn() |
| `apps/web/src/lib/__tests__/utils.test.ts` | 2 件 |
| `apps/web/src/styles/tokens.css` | OKLCH 色トークン |
| `apps/web/src/styles/global.css` | tailwind import + tokens |
| `apps/web/e2e/landing.spec.ts` | 1 件 |
| `packages/shared/package.json` | catalog 参照 |
| `packages/shared/tsconfig.json` | base 継承 |
| `packages/shared/src/index.ts` | barrel |
| `packages/shared/src/room.ts` | **Zod v4 RoomSchema + z.infer** |
| `packages/shared/src/__tests__/room.test.ts` | 9 件（schema 5 + isExpired 4） |
| `.github/workflows/ci.yml` | check + e2e ジョブ |

### Updated

| File | Diff |
|---|---|
| `pnpm-workspace.yaml` | spikes/* → apps/* + packages/* + **catalog 8 entries** |
| `package.json` (root) | turbo + biome scripts、`typescript: catalog:` 参照 |
| `.gitignore` | playwright-report / test-results / tsbuildinfo 追記 |
| `README.md` | catalog 説明 + workspace layout |
| `.claude/PRPs/prds/snap-share.prd.md` | Phase 1 行 → complete、Decisions Log に Phase 1 由来 8 行追記 |
| `pnpm-lock.yaml` | catalog + 全 deps 反映 |

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `packages/shared/src/__tests__/room.test.ts` | 9 | `isExpired` 4 件 + `RoomSchema` 5 件 |
| `apps/web/src/lib/__tests__/utils.test.ts` | 2 | `cn()` last-class-wins / falsy 除去 |
| `apps/api/src/__tests__/health.test.ts` | 1 | `GET /health` 200 + ok payload |
| `apps/web/e2e/landing.spec.ts` | 1 (E2E) | h1 表示確認 |

**合計**: unit 12 件 + E2E 1 件 = **13 件 GREEN**

## Acceptance Criteria

- [x] catalog + Zod v4 + SSOT を Phase 1 で確立
- [x] CI 同等パイプライン all green（lint/typecheck/test/build/test:e2e）
- [x] 12 件 unit + 1 件 E2E GREEN
- [x] PRD Phase 1 行 → complete、Decisions Log 更新
- [x] `spikes/` は git 上に保持、workspace 対象外
- [x] プラグイン有効のまま完遂（v1 のミスを補正）

## Next Steps

- [ ] `git add -A && git commit` でコミット
- [ ] `gh pr create` で PR 作成
- [ ] CI が green になることを確認（GitHub Actions）
- [ ] Phase 2（画像アップロード基盤）の plan 作成
