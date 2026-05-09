# Plan: Phase 10.J-3 — Transformer coarse anchor 再調整 + サイズ定数 SSOT

## Summary

snap-share の Konva Transformer の touch 環境向け anchor サイズ (`ANCHOR_SIZE_TOUCH`) を Phase 10.I-2 で導入した 24px から **tldraw 業界標準値 20px** に再調整する。同時に、HIG / Material が定める **最小タップターゲット 44px** (`MIN_TAP_TARGET_PX`) と tldraw の **hit test margin 8px** (`HIT_TEST_MARGIN_PX`) を `apps/web/src/lib/touch-thresholds.ts` の SSOT に追記する。本サブフェーズは「Transformer ハンドルが大きすぎて隣接 shape を覆い、touch でリサイズしようとして他 shape 選択になる誤操作」の解消を中核とし、長押しメニュー (10.J-2 で完了済) や E2E migration / 実機 QA (10.J-4) は対象外。

## User Story

As **a snap-share mobile user (iPhone Safari / Android Chrome)**, I want **Transformer の角ハンドルが業界標準サイズ (20px) で表示される**, so that **隣接 shape を誤タップせずにリサイズでき、同時に 44px の最小タップ範囲 (Konva 内部 hit padding 込み) は確保されたままで操作感が劣化しない**.

## Problem → Solution

**Current state**: Phase 10.I-2 で `ANCHOR_SIZE_TOUCH = 24` を「視覚を控えめに」基準で採用。実機検証 (Phase 10.I 完了後 dogfood) で、24px の anchor が小さい shape を覆い隠し、隣接 shape 選択や Transformer hit 範囲外への外しが起きやすい現象を観察。tldraw v3 の `coarseHandleRadius = 20` 業界標準と照合すると、4px の差分は誤操作率に直接効く。さらに、UI 各所で `min-w-11 min-h-11` (Tailwind 11 × 0.25rem = 44px) として散らばる tap target サイズと、`hitTestMargin: 8` (tldraw) 相当の hit 余白概念が定数化されておらず、業界標準値が「コメント中の 44px」「マジックナンバー 8」として暗黙的に存在している。

**Desired state**: `ANCHOR_SIZE_TOUCH = 20` で tldraw 業界標準値に揃え、`useTouchDevice()` 経由の adaptive anchor sizing は維持 (desktop は `ANCHOR_SIZE_DESKTOP = 10` のまま)。`apps/web/src/lib/touch-thresholds.ts` に `MIN_TAP_TARGET_PX = 44` / `HIT_TEST_MARGIN_PX = 8` を追加し、Phase 10.J-2 で残されたコメント中のマジックナンバーを SSOT に逃がす (`ContextMenu.tsx` のコメント / 各 toolbar 子コンポーネントの `min-w-11 min-h-11` の根拠コメントを定数 import で表現)。

## Metadata

- **Complexity**: Small (1 ファイル更新 + 1 ファイル追記、推定 30-50 行の差分、test +5-7 件)
- **Source PRD**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md`
- **PRD Phase**: 10.J-3 (Transformer coarse anchor 再調整 + サイズ定数整合)
- **Estimated Files**: 4 (colors.ts / touch-thresholds.ts / ContextMenu.tsx コメント整合 / PRD 更新)
- **ADR Reference**: ADR-0007 D3 (Transformer coarse anchor 20px) + D2 (タイミング定数 SSOT、本 plan で size 定数も追加する形で拡張)

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/src/components/canvas/colors.ts` | 41-49 | `ANCHOR_SIZE_TOUCH = 24` が定義されている SSOT。本 plan で 20 に変更 |
| **P0** | `apps/web/src/lib/touch-thresholds.ts` | 全体 | Phase 10.J-1 で新設。本 plan で `MIN_TAP_TARGET_PX` / `HIT_TEST_MARGIN_PX` を追記 |
| **P0** | `docs/adr/ADR-0007-touch-ux-standards.md` | D3 | tldraw `coarseHandleRadius = 20` の業界標準値根拠。20 → 22 escape の判断基準 |
| **P0** | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | 109 | `anchorSize={isTouch ? ANCHOR_SIZE_TOUCH : ANCHOR_SIZE_DESKTOP}` 配線箇所 (本 plan で値の変更が反映される消費箇所) |
| **P1** | `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | 105 | RectangleShape と同パターン |
| **P1** | `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | 186-198 | `ANCHOR_SIZE_TOUCH` を import して assertion している既存 spec。値変更で red 化しないか確認 (定数 import なので影響なし) |
| **P1** | `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | 158-170 | RectangleShape と同型 |
| **P2** | `apps/web/src/components/canvas/ContextMenu.tsx` | 6-9, 35, 119 | `min-w-11 min-h-11` (= 44px) を使う UI で、コメント中に "= 44px、iOS HIG / Material" の根拠が散在。本 plan で定数 import の参照に書き換え |
| **P2** | `apps/web/src/components/toolbar/ToolButton.tsx` | 55 | 同上 (`min-w-11 min-h-11`) |
| **P2** | `apps/web/src/components/toolbar/FontSizeControl.tsx` | 47, 81 | 同上 |
| **P2** | `apps/web/src/components/toolbar/ColorPalette.tsx` | 47 | 同上 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| tldraw coarse handle radius | [tldraw options.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/options.ts) | `coarseHandleRadius: 20` / `handleRadius: 12` / `hitTestMargin: 8` の業界標準 |
| iOS Human Interface Guidelines | [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | 最小タップターゲット 44pt × 44pt |
| Material Design 3 — Accessibility | [Material 3 — touch target sizes](https://m3.material.io/foundations/designing/structure#touch-targets) | 推奨最小サイズ 48dp、許容 44dp |
| Konva Transformer anchorSize | [Konva — Transformer config](https://konvajs.org/api/Konva.Transformer.html#anchorSize) | default 10、anchor の hit area とサイズに直接影響 |

---

## Patterns to Mirror

### TOUCH_THRESHOLDS_EXTEND (touch-thresholds.ts への追記)

```ts
// SOURCE (BEFORE): apps/web/src/lib/touch-thresholds.ts (現状)
// 5 定数 (LONG_PRESS_DURATION_MS / DOUBLE_TAP_INTERVAL_MS /
// DOUBLE_TAP_POSITION_THRESHOLD_PX / DRAG_SLOP_PX_FINE / DRAG_SLOP_PX_COARSE)

// AFTER (本 plan で追記、末尾):

/** UI element の最小 tap target サイズ (px)。iOS HIG = 44pt、Material 3 推奨 48dp / 許容 44dp。
 * 共通公約数として 44px を採用。Tailwind の `min-w-11 min-h-11` (= 11 × 0.25rem = 44px) と整合。
 * DOM ボタン / interactive surface の最小サイズ規約 (Konva anchor は colors.ts 側で別途) */
export const MIN_TAP_TARGET_PX = 44;

/** Konva 描画オブジェクトに対する hit 余白 (px)。tldraw `hitTestMargin: 8` 業界標準。
 * 細い stroke shape (Arrow / Highlight) で、視覚 stroke 幅より広い hit zone を取る際の
 * 余白上限。本 plan の時点では消費箇所なし (定数化のみ)。10.J-4 以降で `hitFunc` 拡張時に消費 */
export const HIT_TEST_MARGIN_PX = 8;
```

### COLORS_ANCHOR_SIZE_DOWNGRADE (colors.ts の値変更)

```ts
// SOURCE (BEFORE): apps/web/src/components/canvas/colors.ts:43-45
// Konva Transformer anchor の adaptive サイズ。Konva default は 10。
export const ANCHOR_SIZE_DESKTOP = 10;
export const ANCHOR_SIZE_TOUCH = 24;

// AFTER (本 plan):
// Konva Transformer anchor の adaptive サイズ。Konva default は 10。
// Touch 値は tldraw v3 `coarseHandleRadius = 20` 業界標準に揃える (ADR-0007 D3)。
// Phase 10.I-2 の暫定値 24px は隣接 shape 誤タップを増やすため 20 に再調整。
export const ANCHOR_SIZE_DESKTOP = 10;
export const ANCHOR_SIZE_TOUCH = 20;
```

### CONTEXT_MENU_COMMENT_ALIGNMENT (ContextMenu.tsx のコメント整合)

```tsx
// SOURCE (BEFORE): apps/web/src/components/canvas/ContextMenu.tsx:6-9
// Phase 10.J-2 ADR-0007 D4: 長押し成立時に shape 上の anchor 座標へ pop する menu。
// position: fixed で stage の transform から独立、画面端では flip して viewport 内に
// 収める。各 button は min-w-11 / min-h-11 (= 44px、iOS HIG / Material) で誤タップ回避、
// destructive (削除) は色分けで視認性向上 + 項目順 last で位置による誤タップ抑止。

// AFTER (本 plan):
// Phase 10.J-2 ADR-0007 D4: 長押し成立時に shape 上の anchor 座標へ pop する menu。
// position: fixed で stage の transform から独立、画面端では flip して viewport 内に
// 収める。各 button は min-w-11 / min-h-11 (= MIN_TAP_TARGET_PX = 44px、iOS HIG / Material 3) で
// 誤タップ回避、destructive (削除) は色分けで視認性向上 + 項目順 last で位置による誤タップ抑止。
```

> **判断**: Tailwind の class 文字列 (`min-w-11`) を runtime に定数 string concat で生成する pattern (e.g. `` `min-w-${TAP/4}` ``) は採用しない。Tailwind v4 の JIT は文字列リテラルを静的解析するため、テンプレ文字列は class 検出から外れる。**コメントで定数を参照する** だけで SSOT 性を担保し、実値の重複は許容する (`MIN_TAP_TARGET_PX` 変更時には Tailwind class も手動更新が必要、これは ADR-0007 D2 / D3 の付帯条件として注記)。

### TOUCH_THRESHOLDS_TEST_PATTERN (定数値の lock-in test)

```ts
// SOURCE (NEW): apps/web/src/lib/__tests__/touch-thresholds.test.ts
// 既存ファイルなし。新規作成して 5 + 2 定数すべての値を locked-in に assert。
// 値の意図せぬドリフトを CI で検知するセーフティネット (定数 import の確認も兼ねる)。

import { describe, expect, it } from 'vitest';
import {
  DOUBLE_TAP_INTERVAL_MS,
  DOUBLE_TAP_POSITION_THRESHOLD_PX,
  DRAG_SLOP_PX_COARSE,
  DRAG_SLOP_PX_FINE,
  HIT_TEST_MARGIN_PX,
  LONG_PRESS_DURATION_MS,
  MIN_TAP_TARGET_PX,
} from '../touch-thresholds';

describe('touch-thresholds', () => {
  it('LONG_PRESS_DURATION_MS は業界標準 500ms に固定 (Excalidraw / tldraw / iOS / Android)', () => {
    expect(LONG_PRESS_DURATION_MS).toBe(500);
  });
  it('DOUBLE_TAP_INTERVAL_MS は業界標準 300ms に固定', () => {
    expect(DOUBLE_TAP_INTERVAL_MS).toBe(300);
  });
  it('DOUBLE_TAP_POSITION_THRESHOLD_PX は Excalidraw 35px に固定', () => {
    expect(DOUBLE_TAP_POSITION_THRESHOLD_PX).toBe(35);
  });
  it('DRAG_SLOP_PX_FINE は tldraw 4px に固定', () => {
    expect(DRAG_SLOP_PX_FINE).toBe(4);
  });
  it('DRAG_SLOP_PX_COARSE は tldraw 6px に固定', () => {
    expect(DRAG_SLOP_PX_COARSE).toBe(6);
  });
  it('MIN_TAP_TARGET_PX は HIG / Material 共通の 44px に固定', () => {
    expect(MIN_TAP_TARGET_PX).toBe(44);
  });
  it('HIT_TEST_MARGIN_PX は tldraw hitTestMargin = 8px に固定', () => {
    expect(HIT_TEST_MARGIN_PX).toBe(8);
  });
});
```

### COLORS_TEST_LOCK_IN (anchor サイズの lock-in test)

```ts
// SOURCE (NEW): apps/web/src/components/canvas/__tests__/colors.test.ts
// 既存 test ファイルなし。新規作成して anchor サイズ + handle radius を locked-in に。

import { describe, expect, it } from 'vitest';
import {
  ANCHOR_SIZE_DESKTOP,
  ANCHOR_SIZE_TOUCH,
  HANDLE_RADIUS,
  HANDLE_RADIUS_TOUCH,
  HIT_STROKE_WIDTH_TOUCH,
} from '../colors';

describe('canvas size constants', () => {
  it('ANCHOR_SIZE_DESKTOP は Konva default の 10 に固定', () => {
    expect(ANCHOR_SIZE_DESKTOP).toBe(10);
  });
  it('ANCHOR_SIZE_TOUCH は tldraw coarseHandleRadius = 20px に固定 (ADR-0007 D3)', () => {
    expect(ANCHOR_SIZE_TOUCH).toBe(20);
  });
  it('HANDLE_RADIUS は default 6, HANDLE_RADIUS_TOUCH は 12 に固定 (Phase 10.I-2 既定)', () => {
    expect(HANDLE_RADIUS).toBe(6);
    expect(HANDLE_RADIUS_TOUCH).toBe(12);
  });
  it('HIT_STROKE_WIDTH_TOUCH は Konva 公式 Issue #524 推奨 20px に固定', () => {
    expect(HIT_STROKE_WIDTH_TOUCH).toBe(20);
  });
});
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/canvas/colors.ts` | UPDATE | `ANCHOR_SIZE_TOUCH 24 → 20` + comment 更新 (ADR-0007 D3 根拠) |
| `apps/web/src/lib/touch-thresholds.ts` | UPDATE | `MIN_TAP_TARGET_PX = 44` / `HIT_TEST_MARGIN_PX = 8` 追記 |
| `apps/web/src/lib/__tests__/touch-thresholds.test.ts` | CREATE | 7 定数の値 lock-in test (新規 + 既存 5 件) |
| `apps/web/src/components/canvas/__tests__/colors.test.ts` | CREATE | anchor / handle / hit-stroke サイズ定数の lock-in test |
| `apps/web/src/components/canvas/ContextMenu.tsx` | UPDATE | コメントで `MIN_TAP_TARGET_PX` を参照 (実値の Tailwind class は手動同期注記) |
| `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` | UPDATE | 10.J-3 行 Status を `pending` → `complete`、Plan link 追加 |

## NOT Building

- **Tailwind class の動的生成 / 定数経由化** — JIT 静的解析と非互換。コメントで参照のみ
- **Konva `hitFunc` 拡張 (`HIT_TEST_MARGIN_PX` の実 runtime 消費)** — 本 plan は定数化のみ。10.J-4 以降または Phase 11+ で必要なら拡張
- **`ANCHOR_SIZE_TOUCH` の 22px / 18px 妥協値検討** — ADR-0007 D3 で「20 で実機 QA → 操作感劣化があれば 22 escape」と明記。本 plan では 20 固定で 10.J-4 の実機 QA に委ねる
- **Toolbar 子コンポーネントの `min-w-11 min-h-11` のコメント補完** — `ToolButton.tsx` / `FontSizeControl.tsx` / `ColorPalette.tsx` は既に Phase 10.I-3 でコメント済 / または無しが許容範囲。本 plan では `ContextMenu.tsx` のみ更新 (新規追加された surface のため)
- **ContextMenu 自身の anchor 配置最適化 / `VIEWPORT_MARGIN_PX` の SSOT 化** — `VIEWPORT_MARGIN_PX = 8` は ContextMenu.tsx ローカル定数。`HIT_TEST_MARGIN_PX` と数値は同じだが意味が異なる (viewport margin vs hit test margin)。混同しないため別定数のまま維持
- **Phase 10.I-2 で導入した `HANDLE_RADIUS_TOUCH = 12` の再調整** — tldraw `coarseHandleRadius = 20` は Transformer anchor 用、Arrow Circle handle は別概念。`HANDLE_RADIUS_TOUCH = 12` は据え置き
- **paired binding ESLint custom rule** — Phase 10.J-1 NOT Building 継承
- **E2E migration / 実機 QA / umbrella report** — 10.J-4 で実施

---

## Step-by-Step Tasks

### Task 1: `colors.ts` の `ANCHOR_SIZE_TOUCH` を 24 → 20 に変更

- **ACTION**: `apps/web/src/components/canvas/colors.ts:43-45` の値を変更し、コメントを ADR-0007 D3 根拠に整合
- **IMPLEMENT**: `COLORS_ANCHOR_SIZE_DOWNGRADE` (上記 Patterns to Mirror) のとおり、`ANCHOR_SIZE_TOUCH = 20` + 「tldraw 業界標準 / Phase 10.I-2 暫定 24 から再調整」コメント
- **MIRROR**: 既存 `HANDLE_RADIUS_TOUCH` のコメント形式 (`// 数値根拠: ...`)
- **IMPORTS**: なし
- **GOTCHA**:
  - 既存テスト (`RectangleShape.test.tsx` / `HighlightShape.test.tsx`) は **定数 import** で assert しているため値変更で red 化しない
  - `ANCHOR_SIZE_DESKTOP = 10` は据え置き (desktop は Konva default 維持)
- **VALIDATE**:
  - `grep -n "ANCHOR_SIZE_TOUCH = " apps/web/src/components/canvas/colors.ts` で値が `20` になっている
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 2: `touch-thresholds.ts` に 2 定数を追記

- **ACTION**: `apps/web/src/lib/touch-thresholds.ts` の末尾に `MIN_TAP_TARGET_PX = 44` / `HIT_TEST_MARGIN_PX = 8` を追加
- **IMPLEMENT**: `TOUCH_THRESHOLDS_EXTEND` (上記 Patterns to Mirror) のとおり、JSDoc 付きで追記
- **MIRROR**: 既存 5 定数のコメントスタイル (根拠 → 単位込み identifier)
- **IMPORTS**: なし
- **GOTCHA**:
  - `MIN_TAP_TARGET_PX` は DOM/Tailwind の min サイズ規約。Konva anchor の `ANCHOR_SIZE_TOUCH = 20` とは別概念 (Konva 内部 hit padding 込みで実効 ~30-40px、ここに hit zone 余裕で 44px 級)。コメントで明記
  - `HIT_TEST_MARGIN_PX` は本 plan では消費箇所なし。10.J-4 以降で必要時に import される forward-looking 定数
  - 単位 suffix 必須 (`_PX`)
- **VALIDATE**:
  - `grep -n "MIN_TAP_TARGET_PX\|HIT_TEST_MARGIN_PX" apps/web/src/lib/touch-thresholds.ts` で 2 件以上
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 3: `touch-thresholds.test.ts` 新設 (7 定数の lock-in)

- **ACTION**: `apps/web/src/lib/__tests__/touch-thresholds.test.ts` を新規作成
- **IMPLEMENT**: `TOUCH_THRESHOLDS_TEST_PATTERN` (上記 Patterns to Mirror) のとおり、7 件の `it()` で各定数の値を assert
- **MIRROR**: `apps/web/src/lib/__tests__/` 配下の既存 vitest spec の構造 (`describe / it / expect`)
- **IMPORTS**: vitest + 7 定数を `../touch-thresholds` から import
- **GOTCHA**:
  - lock-in test は「値が変わったら CI で気付く」セーフティネット。値変更が必要なら test も同時に更新する明示的な ceremony を強制
  - 値の根拠 (HIG / Material / tldraw / Excalidraw) は it 名に書き、grep でも追える形にする
- **VALIDATE**:
  - `pnpm -F @pitamark/web test -- src/lib/__tests__/touch-thresholds.test.ts` 緑、7 件
  - `pnpm -F @pitamark/web test` 全体緑

### Task 4: `colors.test.ts` 新設 (anchor / handle / hit サイズ定数の lock-in)

- **ACTION**: `apps/web/src/components/canvas/__tests__/colors.test.ts` を新規作成
- **IMPLEMENT**: `COLORS_TEST_LOCK_IN` (上記 Patterns to Mirror) のとおり、`ANCHOR_SIZE_DESKTOP / ANCHOR_SIZE_TOUCH / HANDLE_RADIUS / HANDLE_RADIUS_TOUCH / HIT_STROKE_WIDTH_TOUCH` の 5 件 (4 つの it)
- **MIRROR**: 既存 `RectangleShape.test.tsx` の `import` パス + describe / it 構造
- **IMPORTS**: vitest + colors.ts の 5 定数
- **GOTCHA**:
  - 色定数 (`COLOR_PALETTE` / `OUTLINE_ACCENT` 等) は本 plan では対象外 (頻繁に調整される可能性、lock-in は重い)
  - `MIN_RESIZE_SIZE = 5` も対象外 (細かい UX 値、Phase 11+ で見直し可能性)
- **VALIDATE**:
  - `pnpm -F @pitamark/web test -- src/components/canvas/__tests__/colors.test.ts` 緑、4 件
  - `pnpm -F @pitamark/web test` 全体緑 (既存 spec が 1 件も red 化しない)

### Task 5: `ContextMenu.tsx` のコメントを定数参照に整合

- **ACTION**: `apps/web/src/components/canvas/ContextMenu.tsx:6-9` のコメント中 `(= 44px、iOS HIG / Material)` を `(= MIN_TAP_TARGET_PX = 44px、iOS HIG / Material 3)` に書き換え
- **IMPLEMENT**: `CONTEXT_MENU_COMMENT_ALIGNMENT` (上記 Patterns to Mirror) のとおり、コメントのみ更新。runtime コードは触らない
- **MIRROR**: なし (コメント整合のみ)
- **IMPORTS**: 不要 (コメント中の参照のみ)
- **GOTCHA**:
  - Tailwind class `min-w-11 min-h-11` を `min-w-[${MIN_TAP_TARGET_PX}px]` に動的化しない (JIT 静的解析と非互換)
  - 別 surface (`ToolButton.tsx` / `FontSizeControl.tsx` / `ColorPalette.tsx`) は本 plan では触らない (Phase 10.I-3 の commit で書かれた当時のコメントを尊重、本 plan の scope creep 回避)
- **VALIDATE**:
  - `grep -n "MIN_TAP_TARGET_PX" apps/web/src/components/canvas/ContextMenu.tsx` で 1 件以上 (コメント中)
  - `pnpm -F @pitamark/web lint` 緑 (biome ci がコメント変更で red になる要素なし)

### Task 6: PRD の 10.J-3 行を更新

- **ACTION**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` の Implementation Phases テーブルで 10.J-3 行を更新
- **IMPLEMENT**:
  - Status 列: `pending` → `complete (typecheck/lint/test/biome ci すべて緑)`
  - PRP Plan 列: `TBD` → `[plan](../plans/phase-10-j-3-transformer-coarse-anchor-and-size-constants.plan.md)`
- **MIRROR**: Phase 10.J-2 行 (line 227) の complete 後表記
- **IMPORTS**: なし
- **GOTCHA**:
  - 10.J-4 行は本 plan では触らない (まだ pending)
- **VALIDATE**:
  - `grep -n "10.J-3" .claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` で Status / Plan link が更新されている

### Task 7: 既存 mobile-chrome E2E が緑のままであることを確認

- **ACTION**: 既存 `pnpm -F @pitamark/web test:e2e` を実行し、`ANCHOR_SIZE_TOUCH 24 → 20` で回帰がないか sanity check
- **IMPLEMENT**: コマンド実行のみ。red 化したら個別 spec を読み、`ANCHOR_SIZE_TOUCH = 24` を hardcode した assert がないか調査 (Task 1-2 後に red 化する spec はないはず、定数 import で assert している)
- **MIRROR**: なし
- **IMPORTS**: なし
- **GOTCHA**:
  - chromium / mobile-chrome の 2 project すべて緑が条件
  - Phase 10.I-2 で 24px 前提の screenshot diff を取っていないか念のため `apps/web/playwright.config.ts` と `apps/web/e2e/` を grep
- **VALIDATE**:
  - `pnpm -F @pitamark/web test:e2e` 緑
  - `grep -rn "anchorSize\|ANCHOR_SIZE" apps/web/e2e` で `24` の hardcode がない
  - `grep -rn "screenshot\|toMatchSnapshot" apps/web/e2e` で transformer ハンドルを写したスナップショット assert がない (もしあったら本 plan で update --update-snapshots が必要)

### Task 8: PC chromium project + DevTools mobile emulation での視覚回帰チェック

- **ACTION**: `pnpm -F @pitamark/web dev` を起動し、PC chromium + DevTools mobile emulation (Pixel 5 / iPhone 12 Pro) で Transformer anchor が 20px 表示されることを目視確認
- **IMPLEMENT**:
  - PC chromium: shape を選択 → desktop anchor 10px 維持
  - DevTools mobile emulation: 同操作 → touch anchor 20px (Phase 10.I-2 比で 17% 縮小) で表示
  - 隣接 shape を 20px 程度離して配置 → anchor が隣 shape を覆わない (24px ではしばしば覆っていた)
- **MIRROR**: Phase 10.I-2 の手動チェック (`apps/web/playwright.config.ts:devices` の Pixel 5 設定を参照)
- **IMPORTS**: なし
- **GOTCHA**:
  - 実機 QA は本 plan の scope 外 (10.J-4 で実施)。本 task は emulation 緑のみで成立
  - 視覚的に「小さくなりすぎ」と感じたら ADR-0007 D3 の escape 経路で 22 検討 → ADR を Status 「Investigating」に戻し、本 plan を一旦止める。ただし本 plan 起票時点では tldraw 業界標準 20 で進める前提
- **VALIDATE**:
  - 手動チェックリストを Plan 完了時の commit message に明記 (例: `refactor(phase-10-j-3): ANCHOR_SIZE_TOUCH 24→20、PC + Pixel 5 emulation 視覚 OK`)

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `touch-thresholds.test.ts` (NEW) `LONG_PRESS_DURATION_MS` | import 値 | `=== 500` | No |
| `touch-thresholds.test.ts` (NEW) `DOUBLE_TAP_INTERVAL_MS` | import 値 | `=== 300` | No |
| `touch-thresholds.test.ts` (NEW) `DOUBLE_TAP_POSITION_THRESHOLD_PX` | import 値 | `=== 35` | No |
| `touch-thresholds.test.ts` (NEW) `DRAG_SLOP_PX_FINE` | import 値 | `=== 4` | No |
| `touch-thresholds.test.ts` (NEW) `DRAG_SLOP_PX_COARSE` | import 値 | `=== 6` | No |
| `touch-thresholds.test.ts` (NEW) `MIN_TAP_TARGET_PX` | import 値 | `=== 44` | No |
| `touch-thresholds.test.ts` (NEW) `HIT_TEST_MARGIN_PX` | import 値 | `=== 8` | No |
| `colors.test.ts` (NEW) `ANCHOR_SIZE_DESKTOP` | import 値 | `=== 10` | No |
| `colors.test.ts` (NEW) `ANCHOR_SIZE_TOUCH` | import 値 | `=== 20` | **Yes** (本 plan の中核変更) |
| `colors.test.ts` (NEW) `HANDLE_RADIUS / HANDLE_RADIUS_TOUCH` | import 値 | `=== 6 / === 12` | No |
| `colors.test.ts` (NEW) `HIT_STROKE_WIDTH_TOUCH` | import 値 | `=== 20` | No |
| `RectangleShape.test.tsx` 既存 | 既存 | `expect(...).toBe(ANCHOR_SIZE_TOUCH)` (定数 import 経由なので green 維持) | No |
| `HighlightShape.test.tsx` 既存 | 既存 | 同上 | No |

### Edge Cases Checklist

- [ ] 既存 chromium E2E (Phase 10.I で 78 件 + 10.J-1/J-2 で +0 件 = 78) 全緑
- [ ] mobile-chrome E2E (Phase 10.I で 22 件 + 10.J-1/J-2 で +0 件 = 22) 全緑
- [ ] PC chromium で shape 選択 → Transformer 角ハンドルが 10px (desktop) 表示
- [ ] DevTools Pixel 5 emulation で shape 選択 → Transformer 角ハンドルが 20px (touch) 表示
- [ ] DevTools Pixel 5 emulation で 2 個の shape を 30px 程度離して配置 → 一方を選択しても anchor が隣 shape を覆わない (24px では覆っていたケース)
- [ ] (本 sub-phase の VALIDATE 範囲外、10.J-4 で実機 QA): iPhone Safari で 20px anchor が「掴みにくい」感覚がない (HIG 44pt 規約は内部 hit padding 込みで満たす)

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
```
EXPECT: Zero type errors。

```bash
pnpm lint
```
EXPECT: Zero biome ci errors。

### Unit Tests
```bash
pnpm -F @pitamark/web test -- src/lib/__tests__/touch-thresholds.test.ts
pnpm -F @pitamark/web test -- src/components/canvas/__tests__/colors.test.ts
pnpm -F @pitamark/web test
```
EXPECT: 新規 lock-in test 緑 + 既存 spec すべて緑。10.J-2 完了時 390 件 + 本 plan で +5〜7 件 (touch-thresholds 7 件 - 既存 0 件 = 7 / colors 4 件 - 既存 0 件 = 4、計 +11 件) ≒ **400-401 件** 想定。

### Full Test Suite
```bash
pnpm test
```
EXPECT: web / api / shared 全 workspace の vitest 緑。

### E2E (回帰のみ)
```bash
pnpm -F @pitamark/web test:e2e
```
EXPECT: chromium 78 + mobile-chrome 22 = 100 件すべて緑。Phase 10.I-2 で transformer ハンドルの screenshot diff を作っていなければ red 化しない。

### Build
```bash
pnpm -F @pitamark/web build
```
EXPECT: success、bundle size 増加なし (定数値の変更 + 2 export 追加のみ)。

### Manual Validation (PC + emulation)

- [ ] PC (Chrome) で `pnpm dev` 起動 → 画像投入 → Rectangle / Highlight 描画 + 選択 → 角ハンドル 10px (desktop) 表示
- [ ] DevTools Mobile Emulation (Pixel 5) で同操作 → 角ハンドル 20px (touch) 表示
- [ ] 隣接 2 shape (30px 間隔) で一方選択 → anchor が隣 shape を覆わない / 隣 shape の hit area に被らない

> 実機 QA (iPhone Safari + Android Chrome) は **Phase 10.J-4** で実施。本 sub-phase では desktop / emulation 緑のみで成立。

---

## Acceptance Criteria

- [ ] Task 1 (`ANCHOR_SIZE_TOUCH 24 → 20`) 完了 + 値が 20、コメント更新
- [ ] Task 2 (`MIN_TAP_TARGET_PX = 44` / `HIT_TEST_MARGIN_PX = 8` 追記) 完了 + 2 定数 export
- [ ] Task 3 (`touch-thresholds.test.ts` 新設) 完了 + 7 件 lock-in test 緑
- [ ] Task 4 (`colors.test.ts` 新設) 完了 + 4 件 lock-in test 緑
- [ ] Task 5 (`ContextMenu.tsx` コメント整合) 完了 + grep で `MIN_TAP_TARGET_PX` 1 件
- [ ] Task 6 (PRD 10.J-3 行更新) 完了
- [ ] Task 7 (E2E 回帰なし) 完了 + chromium / mobile-chrome 緑
- [ ] Task 8 (PC + emulation 視覚回帰チェック) 完了
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` すべて緑
- [ ] 既存 e2e spec が全緑 (非劣化)

## Completion Checklist

- [ ] Code follows discovered patterns (Patterns to Mirror セクション準拠)
- [ ] Error handling matches codebase style (本 sub-phase は定数値変更 + 追記のみで不変)
- [ ] Logging follows codebase conventions (新規 console 系コード追加なし)
- [ ] Tests follow test patterns (vitest describe / it / expect、定数 import 経由 assert)
- [ ] No hardcoded values (定数化を本 plan で進めている、Tailwind class は scope 外)
- [ ] Documentation updated (PRD 10.J-3 行 + ADR-0007 D3 はすでに先行 commit 済)
- [ ] No unnecessary scope additions (NOT Building セクション準拠)
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `ANCHOR_SIZE_TOUCH = 20` で実機 (iPhone Safari) で「ハンドルが小さくて掴めない」感覚が出る | Medium | Medium | ADR-0007 D3 で escape 経路 (22 / 24 への戻し) を明記済。10.J-4 実機 QA でこの感覚を可視化、必要なら本 plan の Task 1 を revert + 22 で再着手 |
| `HIT_TEST_MARGIN_PX = 8` を消費しないまま定数だけ存在することに違和感 | Low | Low | Plan の NOT Building / GOTCHA で「forward-looking 定数、10.J-4 以降で消費」と明記。10.J-1 で `LONG_PRESS_DURATION_MS` を先行定数化した先例と整合 |
| 既存 unit test が `ANCHOR_SIZE_TOUCH = 24` を直接 hardcode していて red 化 | Low | Medium | 事前 grep で「定数 import 経由のみ」確認済 (Mandatory Reading)。本 plan の Task 1 後 `pnpm test` 緑で確認 |
| Tailwind の `min-w-11 min-h-11` と `MIN_TAP_TARGET_PX = 44` の二重管理が drift | Medium | Low | コメントで両者の同期を注記、CI hook (lint:tailwind-min-tap-target) は本 plan の scope 外 (Phase 11+ retainer) |
| `ContextMenu.tsx` のコメント変更で git blame が汚れる | Low | Low | 1 行変更のみ、Phase 10.J-3 commit でまとめて記録 |
| 視覚的な回帰 (Transformer ハンドルのフォーカスリング等) | Low | Low | Konva Transformer は anchorSize 以外を変えていない。`anchorStroke` / `anchorFill` 等は default 維持 |
| 10.J-2 の長押しメニューと anchor サイズが視覚的に競合 (重なる) | Low | Low | 長押しメニューは `position: fixed` viewport 配置、anchor は Konva stage 内。座標系が独立で重ならない |

## Notes

### `ANCHOR_SIZE_TOUCH = 20` でも HIG 44pt を満たす理由

Konva Transformer の anchor は `anchorSize` の正方形を描画するが、内部の hit padding が default で `~10-12px` 上乗せされる (Konva 内部 `hitArea` 拡張)。20 + 12 + 12 = 44px の有効 hit zone を確保できる。HIG / Material の 44px 規約は **可触範囲** であり、視覚サイズではない。視覚は控えめに、可触は広く、が業界標準のアプローチ (tldraw / Excalidraw も同パターン)。

### Phase 10.J-3 が独立 PR を作らない理由

ECC PRP 規約 (memory: feedback_branch_per_phase) で「PRD 単位で 1 ブランチ 1 PR」のため、10.J-1 / 10.J-2 / 10.J-3 / 10.J-4 はすべて同一ブランチ `phase-10-j-touch-ux-standards` (Draft PR #22) で進める。本 plan の 8 タスクで 1 コミット程度を想定 (定数変更 + lock-in test + コメント整合 + PRD 更新)。

### 後続 sub-phase への引き継ぎ事項

- 10.J-4 (E2E migration + 実機 QA): 本 plan で確立した anchor 20px の touch 操作感を実機で検証。必要なら 22 escape を ADR-0007 D3 の Decision Update として記録
- Phase 11+ (retainer): Tailwind の `min-w-11 min-h-11` を CI hook で `MIN_TAP_TARGET_PX = 44` と整合性チェック (custom lint rule、本 plan scope 外)
- 10.J-4 (`hitFunc` 拡張): `HIT_TEST_MARGIN_PX = 8` を実 runtime に消費する hit-area 拡張が必要なら、Arrow / Highlight の `hitFunc` を実装。本 plan では定数のみ
