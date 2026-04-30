# Local Review: Phase 0 — 技術スパイク (uncommitted changes)

**Reviewed**: 2026-04-30
**Branch**: `feat/phase-0-tech-spike` (uncommitted)
**Decision**: ✅ **APPROVE with comments** — commit 可、ただし MEDIUM 4 件を Phase 1 開始前に整理推奨

## Summary

3つのスパイク（Konva / Yjs+DO / shadcn）+ pnpm workspace 基盤 + ドキュメント類、**33 ファイル新規 / 1 ファイル更新**を確認。tsc / vitest / build いずれも通過し、CRITICAL / HIGH 問題なし。Spike C はオーナー実機検証中に `pnpm dlx shadcn@latest init` が実行され、CLI 出力（`@base-ui/react` ベース）で `button.tsx` / `dialog.tsx` / `input.tsx` / `index.css` / `package.json` が上書きされている（採用判断 ✅ の根拠）。

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check (4 spikes) | ✅ Pass | `tsc --noEmit` ゼロエラー (konva-canvas / yjs-durable-object server / yjs-do client / shadcn-vite) |
| Unit Tests (vitest) | ✅ Pass | Spike A の `rect.test.ts` 6/6 GREEN |
| Build (Spike A) | ✅ Pass | `vite build`: 88 modules, gz **152.7 KB** |
| Build (Spike C) | ✅ Pass | `vite build`: 1741 modules, gz **93.18 KB**（Geist フォント + `tw-animate-css` 含む） |
| Lint | ⏭ Skipped | Biome は Phase 1 で導入予定（NOT Building 通り） |
| Integration | ⏭ Owner-verified | Spike A 既知問題以外すべて OK と報告済 |

## Findings

### CRITICAL
**なし**。

### HIGH
**なし**（build / typecheck / tests 全部通る）。

### MEDIUM

**M1. Spike A — 画像エリアでクリックしても矩形が出ない (既知バグ)**
- **File**: `spikes/konva-canvas/src/App.tsx:82-103` + `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx:35-37`
- **原因**: `<KonvaImage image={image} />` が `listening: true` のままで Stage クリックを横取り。`handleStageClick` の `if (e.target !== stage) return;` (App.tsx:87) で弾かれる
- **修正案**:
  ```tsx
  // SpikeStage.tsx:37
  {image && <KonvaImage image={image} listening={false} />}
  ```
  もしくは委譲条件を `e.target === stage || e.target.getClassName() === 'Image'` に拡張
- **対応**: オーナー判断「スパイクとしては合格」、Phase 3 で対応（REPORT.md と spike 引継欄に記録済）

**M2. shadcn-vite — `shadcn` CLI が dependencies に入っている**
- **File**: `spikes/shadcn-vite/package.json:24`
- **問題**: `"shadcn": "^4.6.0"` は CLI ツールでランタイム依存ではない
- **影響**: prod bundle には入らないが論理的に不適切。`pnpm dlx shadcn@latest add ...` で CLI が自動追加した模様
- **修正**:
  ```sh
  pnpm --filter shadcn-vite remove shadcn
  pnpm --filter shadcn-vite add -D shadcn
  ```

**M3. shadcn-vite — dead dependencies (`@radix-ui/*`)**
- **File**: `spikes/shadcn-vite/package.json:14-15`
- **問題**: `@radix-ui/react-dialog ^1.1` と `@radix-ui/react-slot ^1.2` は未使用（CLI 生成版が `@base-ui/react` を使う）
- **検証**: `grep -rn "@radix-ui" spikes/shadcn-vite/src` → 0 件
- **修正**:
  ```sh
  pnpm --filter shadcn-vite remove @radix-ui/react-dialog @radix-ui/react-slot
  ```

**M4. 全 spike — `console.*` を多数使用（typescript/security.md 違反）**
- **File** (該当箇所):
  - `spikes/konva-canvas/src/App.tsx:62, 67, 79`
  - `spikes/konva-canvas/src/main.tsx:9`
  - `spikes/yjs-durable-object/client/src/App.tsx:26, 32`
  - `spikes/yjs-durable-object/client/src/main.tsx:8`
  - `spikes/shadcn-vite/src/main.tsx:8`
- **問題**: `.claude/rules/typescript/security.md` の "No console.log statements in production code" に抵触
- **対応**: スパイク段階で意図的に使用（`[spike:konva]` 等のプレフィックスで識別）、Phase 1 で logging ライブラリ（pino 等）を導入したら一括置換。REPORT.md に明記

### LOW

**L1. Spike A — Konva 矩形色がハードコード**
- **File**: `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx:6-7`
- **問題**: `'rgba(99, 102, 241, 0.20)'` を直書き。CSS 変数 (`tokens.css` の `--color-accent-soft`) と二重管理
- **対応**: Konva Canvas は CSS 変数を直接解釈しないので spike では妥当。Phase 3/6 で CSS-to-Canvas 変換ヘルパー作成（REPORT.md 記録済）

**L2. yjs-durable-object/client — `React.ChangeEvent` 名前空間アクセス**
- **File**: `spikes/yjs-durable-object/client/src/App.tsx:51`
- **問題**: `import type { ChangeEvent } from 'react'` の方が `verbatimModuleSyntax: true` (`tsconfig.base.json:14`) と整合
- **修正**:
  ```tsx
  import { useEffect, useMemo, useState } from 'react';
  import type { ChangeEvent } from 'react';
  // ...
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => { ... };
  ```
- **動作**: tsc 通っているので実害なし

**L3. Spike A — D&D ハイライトなし**
- **File**: `spikes/konva-canvas/src/App.tsx:50-52, 134`
- **問題**: `dragover` 時に drop zone がハイライトされない（操作の手応え弱い）
- **対応**: Phase 3 で `data-dragover` 属性切り替えで CSS 状態を出す

**L4. shadcn-vite — Dialog の「送信」ボタンで Dialog が閉じない**
- **File**: `spikes/shadcn-vite/src/App.tsx:53-58`
- **問題**: 送信後も Dialog が開いたまま
- **対応**: Phase 6 で UI 仕上げ時に `<DialogClose>` でラップ or `onOpenChange` 制御

**L5. shadcn-vite — `dialog.tsx` 158 行（CLI 生成物として許容）**
- **File**: `spikes/shadcn-vite/src/components/ui/dialog.tsx`
- **問題**: 単一ファイル 158 行は coding-style 800 行制限に対して問題なし、関数はすべて 50 行未満
- **対応**: shadcn CLI 生成物として untouched 推奨

### Informational

**I1. shadcn CLI 出力で生成物が更新されていた**
- ユーザーが Spike C 実機検証中に `pnpm dlx shadcn@latest init` を走らせ、私が手動生成した `button.tsx` / `dialog.tsx` / `input.tsx` / `index.css` / `package.json` が CLI 出力で**上書きされた**。これは予定された deviation 解消パスで、PRD Decisions Log の "shadcn/ui 採用" の根拠強化となる。
- 影響:
  - `@radix-ui/react-*` ベースから **`@base-ui/react`** ベースに移行（shadcn の最新 New York スタイル）
  - `index.css` に `@import "shadcn/tailwind.css"` と `@import "@fontsource-variable/geist"` 追加
  - bundle に Geist フォント (3 woff2 + 数十 KB) が追加（Phase 6 で要再評価）
- REPORT.md にこの事実を補足追記すると後の追跡しやすい

**I2. Spike C bundle に Geist フォント同梱で +30〜60 KB**
- 体感: gz 93.18 KB は十分軽量だが、フォントは別ファイル（woff2 で latin / latin-ext / cyrillic 各 14〜28 KB）で配信される。日本語文字は Geist にないので OS フォントに fallback、その挙動を Phase 6 で検証

**I3. `dist/` ディレクトリが build で生成済**
- `spikes/konva-canvas/dist/` と `spikes/shadcn-vite/dist/` が存在。`.gitignore:2 (dist/)` で除外済、git status には現れない

## Files Reviewed

### Source code (TypeScript/TSX) — 14 files
- `spikes/konva-canvas/src/lib/rect.ts` (25行) — ✅ 完全に不変パターン、TDD整合
- `spikes/konva-canvas/src/lib/__tests__/rect.test.ts` (53行) — ✅ AAA + 6件
- `spikes/konva-canvas/src/App.tsx` (157行) — M1, M4
- `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx` (59行) — M1, L1
- `spikes/konva-canvas/src/main.tsx` (15行) — M4
- `spikes/konva-canvas/vite.config.ts` (14行) — ✅
- `spikes/yjs-durable-object/server/index.ts` (20行) — ✅
- `spikes/yjs-durable-object/wrangler.toml` (12行) — ✅
- `spikes/yjs-durable-object/client/src/App.tsx` (76行) — M4, L2
- `spikes/yjs-durable-object/client/src/main.tsx` (14行) — M4
- `spikes/yjs-durable-object/client/vite.config.ts` (22行) — ✅
- `spikes/shadcn-vite/src/App.tsx` (71行) — L4
- `spikes/shadcn-vite/src/components/ui/{button,dialog,input}.tsx` (58/158/20行) — CLI 生成物、L5
- `spikes/shadcn-vite/src/lib/utils.ts` (6行) — CLI 生成物
- `spikes/shadcn-vite/src/main.tsx` (14行) — M4
- `spikes/shadcn-vite/vite.config.ts` (11行) — ✅

### CSS — 4 files
- `spikes/konva-canvas/src/styles/{tokens,global}.css` — ✅
- `spikes/shadcn-vite/src/index.css` (131行) — CLI 生成物 ✅
- `spikes/yjs-durable-object/client/src/styles.css` (12行) — ✅

### Config — 12 files
- ルート: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.npmrc`, `.nvmrc` — ✅
- 各 spike の `package.json`, `tsconfig.*.json`, `index.html` — ✅
- `spikes/shadcn-vite/components.json` — CLI 形式 ✅
- `spikes/shadcn-vite/package.json` — M2, M3
- `spikes/yjs-durable-object/wrangler.toml` — ✅

### Documentation — 5 files
- `spikes/konva-canvas/README.md` (44行) — ✅
- `spikes/yjs-durable-object/README.md` (50行) — ✅
- `spikes/shadcn-vite/README.md` (66行) — ✅（shadcn CLI 実行で deviation が解消された旨を追記すると◎）
- `docs/spikes/REPORT.md` (170行) — ✅
- `.claude/PRPs/reports/phase-0-tech-spike-report.md` (155行) — ✅

### PRD update — 1 file
- `.claude/PRPs/prds/snap-share.prd.md` — Phase 0 行 + Decisions Log 3行追記

## Recommended actions before commit

優先度順:

1. **(M2 + M3 同時)** dead deps 整理:
   ```sh
   pnpm --filter shadcn-vite remove @radix-ui/react-dialog @radix-ui/react-slot shadcn
   pnpm --filter shadcn-vite add -D shadcn
   ```
   → 不要な依存3件削除 + shadcn を devDependencies へ移動

2. **(I1)** REPORT.md (Spike C セクション) に「ユーザー検証時に CLI 実行で生成物上書き、`@base-ui/react` ベースに移行」を追記

3. (任意) **(L2)** `verbatimModuleSyntax` 厳密化のための `import type` 整理

M1 / M4 / L1 / L3 / L4 / L5 は Phase 1 以降で対応可。spike としては問題なし。

## Decision rationale

- **CRITICAL/HIGH なし** → block しない
- **MEDIUM 4 件** はいずれも commit 前に簡単に修正可能、または spike として許容範囲
- **validation 全 4 種パス**（typecheck / tests / Spike A build / Spike C build）

→ **APPROVE with comments**。M2 + M3 は commit 前に修正、それ以外は Phase 1 開始時の宿題に残す。
