# Phase 0 Spike Report

> **Status:** complete (オーナー実機検証 2026-04-30) — 数値の一部は未計測欄として残す（Phase 1 開始前に必要なら測る）
> **Date started:** 2026-04-30
> **Branch:** `feat/phase-0-tech-spike`
> **PRD:** [.claude/PRPs/prds/snap-share.prd.md](../../.claude/PRPs/prds/snap-share.prd.md) — Phase 0
> **Plan:** [.claude/PRPs/plans/phase-0-tech-spike.plan.md](../../.claude/PRPs/plans/phase-0-tech-spike.plan.md)

---

## Spike A — Konva Canvas

**Path:** [`spikes/konva-canvas/`](../../spikes/konva-canvas/)

### Versions actually installed

- react / react-dom: 19.2.0
- react-konva: 19.2.3
- konva: 10.2.5
- use-image: 1.1.4
- vite: 5.4.20
- vitest: 2.1.9

> Plan の指示は「React 18.3 + react-konva 18.x」だったが、調査時点で react-konva は 19.x のみ最新提供で 18.x は LTS 化されていない。React 19 + react-konva 19 にアップデートした。

### Verification

- [x] 動作: ⚠️（軽微な既知問題あり、後述）
- [x] 単体テスト 6 件 GREEN（vitest 4 / 206ms）
- [x] 画像 D&D / 矩形CRUD（画像外クリック時）/ Delete 削除 動作確認
- [x] resize 追従

### Owner's Observations

**結論**: スパイクとしては合格。Phase 3 本実装で挙動修正必要。

**既知問題（Phase 3 で要修正）**:
- 画像エリア上をクリックしても矩形が追加されない。原因は `KonvaImage` の `listening` がデフォルト `true` のため、Stage の `onClick` の `e.target === stage` 判定で画像クリックが弾かれる。修正方針は `<KonvaImage image={image} listening={false} />` を付ける、もしくはイベント委譲を `e.target === stage || e.target.getClassName() === 'Image'` に拡張する。
- 画像の外側（背景）でのクリックは想定通り矩形を追加できる。

**確認できたこと**:
- 画像 D&D アップロード / URL.createObjectURL クリーンアップ
- 矩形のドラッグ移動 / Delete キー削除

### Measurements

| 観点 | 値 | メモ |
|---|---|---|
| Bundle gz size (`dist/assets/*.js`) | **152.7 KB gz** (raw 501 KB) | PRD 期待値 ~80KB gz は Konva 単体の話。react + react-konva + use-image 含めて 150KB 前後。`.claude/rules/web/performance.md` の Landing 150KB 目標をわずかに超過 → Phase 6 でコード分割 (dynamic import) 必須 |
| 初期化 → 画像表示までのms | _未計測_ | LCP 相当 |
| 30矩形時のドラッグFPS | _未計測_ | Konva Layer 単発描画がボトルネックになるか |

### Phase 3 への引継

- [ ] `rect.ts` の不変パターンをそのまま使う / 書き直す（どちら？）
- [ ] color tokens: 現スパイクは `rgba(99,102,241,*)` 直書き → Phase 3/6 で oklch CSS変数 → Konva 変換層を作る必要あり（Canvas 2D は oklch を限定的にしか解釈しない）
- [ ] Stage の resize 戦略をそのまま流用するか / ResizeObserver に切り替えるか

---

## Spike B — Yjs + Cloudflare Durable Objects

**Path:** [`spikes/yjs-durable-object/`](../../spikes/yjs-durable-object/)

### Versions actually installed

- y-durableobjects: **1.0.5**（公開名は `y-durableobjects`、スコープなし。`@napolab/...` ではない）
- hono: 4.12.15（peer ≥4.3 を満たす）
- yjs: 13.6.30 / y-websocket: 3.0.0
- wrangler: 4.86.0
- compatibility_date: 2026-04-07（`web_socket_auto_reply_to_close` 有効化）

> Plan の wrangler.toml 例で `new_sqlite_classes` を指示していたが、`y-durableobjects` v1.0.5 の公式 README は `new_classes` を使用。Plan を修正して `new_classes` を採用。

### Verification

- [x] 動作: ✅
- [x] 2 タブで Y.Text 同期 確認
- [x] Hibernation / 再接続 確認
- [x] `wrangler tail` のエラーゼロ

### Owner's Observations

**結論**: 問題なし。Phase 4 本実装にそのまま進める。

**確認できたこと**:
- `y-durableobjects` v1.0.5 + Hono 4.12 + wrangler 4.86 で localhost 同期動作
- 2 タブ間の Y.Text が同期される
- WebSocket Hibernation 復帰確認
- `wrangler tail` でランタイムエラー無し

### Measurements

| 観点 | 値 | メモ |
|---|---|---|
| 同期遅延（操作 → 他クライアント反映） | _未計測_ | PRD 目標 200ms（同一リージョン） |
| Hibernation 突入 → 復帰の所要 | _未計測_ | 初回再接続のラウンドトリップ |
| `wrangler tail` のエラー | _未確認_ | 0 が期待値 |

### Phase 4 への引継

- [ ] `yRoute` shorthand のままで Awareness（カーソル / 色）を載せられるか / 拡張点はあるか
- [ ] room ID 採番（NanoID 21文字）の生成位置: クライアント / サーバ
- [ ] DO Storage への spline スナップショット保存と TTL（7日）の実装方針
- [ ] `--local` mode と `--remote` mode の Hibernation 挙動差

---

## Spike C — shadcn/ui + Vite + Tailwind v4

**Path:** [`spikes/shadcn-vite/`](../../spikes/shadcn-vite/)

### Versions actually installed

- tailwindcss: 4.2.4 / @tailwindcss/vite: 4.2.4
- @radix-ui/react-dialog: 1.1.7 / @radix-ui/react-slot: 1.1.2
- class-variance-authority: 0.7.1 / clsx: 2.1.1 / tailwind-merge: 3.0.1
- lucide-react: 0.474.0
- tw-animate-css: 1.2.5（shadcn New York の最新では `tailwindcss-animate` から置き換え）

### DEVIATION from Plan Task 10

`pnpm dlx shadcn@latest init` は対話 CLI のため auto mode で実行できなかった。代替として:

- `components.json` を CLI 出力相当の値で手動生成
- `src/lib/utils.ts` の `cn()` を手動実装
- `src/components/ui/button.tsx` / `dialog.tsx` / `input.tsx` を shadcn New York スタイルの最新パターンで手動実装
- `src/index.css` の OKLCH テーマトークンを Tailwind v4 + `@theme inline` で記述

**最終採用判断には**:
1. オーナー手元で `cd spikes/shadcn-vite && pnpm dlx shadcn@latest init` を実行
2. 生成された `components.json` と `src/index.css` を本スパイクの手動生成版と diff
3. 差分が許容範囲なら **採用**、CLI が破綻するなら **不採用** で 自前 Tailwind v4 + 手書きコンポーネントへ

### Update 2026-04-30: CLI 出力で上書き済

オーナー実機検証中に上記手順 1 が実行され、shadcn CLI（最新版）が以下のファイルを生成し、AI が手動生成したものを上書きした:

- `src/components/ui/button.tsx` / `dialog.tsx` / `input.tsx`
- `src/index.css`（`@import "shadcn/tailwind.css"` + `@import "@fontsource-variable/geist"` 追加）
- `package.json`（`@base-ui/react` `@fontsource-variable/geist` `shadcn` を依存追加）
- `components.json`（CLI 公式形式）

**変化点**:
- 旧: `@radix-ui/react-dialog` + `@radix-ui/react-slot` ベース（AI 手動生成）
- 新: **`@base-ui/react`** ベース（shadcn 公式の最新 New York スタイル）
- bundle: gz **93.18 KB**（Geist フォント 別ファイル: latin / latin-ext / cyrillic 各 14〜28 KB woff2）

このアップデート後の状態で、Phase 0 code review でも CRITICAL/HIGH 問題なしを確認。**shadcn 採用は CLI 生成版で確定** とする。

> 後始末: AI が初期に追加した不要な `@radix-ui/react-dialog` / `@radix-ui/react-slot` は code review 後の dead-deps 整理で削除済。`shadcn` パッケージは `dependencies` → `devDependencies` に移動済。

### Verification

- [x] 動作: ✅
- [x] 6 種 Button バリアント描画 確認
- [x] Dialog の Esc クローズ・フォーカストラップ 確認
- [x] 日本語 placeholder / Title / Description 表示 確認
- [x] `tsc --noEmit` ゼロエラー

### Measurements

| 観点 | 値 | メモ |
|---|---|---|
| `pnpm install` 所要時間 | _未計測_ | |
| dev server 初期 boot 時間 | _未計測_ | |
| `pnpm dlx shadcn@latest init` の体感 | _未実行_ | オーナーが実行する |

### Adoption Decision

> **本欄はオーナーが手で埋める。AI が先取りしない。**

- [x] **採用**
- [ ] ~~不採用~~

オーナー実機検証で問題なし。Tailwind v4 + shadcn 互換コンポーネントで Phase 6 UI 仕上げを進める。

### PRD Decisions Log への反映

- 上記の採用 / 不採用が確定したら、`.claude/PRPs/prds/snap-share.prd.md` の Decisions Log セクションに 1 行追記する。
- 不採用の場合は Phase 6 の Should `shadcn適用` を「自前UIコンポーネント」に書き換え (Phase 6 タスクで対応、Phase 0 では PRD 注記のみ)。

---

## Cross-cutting findings

### Versions diverged from plan

| Plan指示 | 採用バージョン | 理由 |
|---|---|---|
| react 18.x / react-konva 18.x | 19.2.0 / 19.2.3 | react-konva 18 は LTS 化されておらず、19.x のみ最新提供 |
| `new_sqlite_classes` | `new_classes` | y-durableobjects 公式 README の正しい指示 |
| shadcn CLI 対話初期化 | 等価ファイル手動生成 | auto mode で対話 CLI 不可 |

### Decisions to update in PRD

- [x] **shadcn 採用** （Phase 6 で Tailwind v4 + shadcn 互換コンポーネントで UI 仕上げ）
- [x] **Konva bundle 152.7 KB gz** で Phase 6 でコード分割を必須項目化
- [x] **React 19 + react-konva 19** で Phase 1 以降を進める
- [ ] スパイク `spikes/` を Phase 1 で破棄するか流用するか（推奨: 破棄して `apps/web` `apps/api` に再構成）

### Open issues for Phase 1+

- Phase 1: turborepo 化、Biome 設定、CI green、Playwright セットアップ
- Phase 2/3: Stage の resize 追従を `ResizeObserver` に切り替えるか検討
- Phase 4: Yjs `Awareness` を `yRoute` shorthand のまま載せられるか確認
- Phase 6: Konva の色を CSS変数 → Canvas 値に変換するヘルパーを作る必要

### Spike directory disposal

- **推奨**: Phase 1 開始時にこの `spikes/` ディレクトリは git からは保持するが、`apps/web` `apps/api` `packages/shared` に作り直す。spike コードは reference として残す。
- もし Spike B の `server/index.ts` を Phase 4 でほぼそのまま使うのであれば、`apps/api/src/yjs.ts` などに移植する。
