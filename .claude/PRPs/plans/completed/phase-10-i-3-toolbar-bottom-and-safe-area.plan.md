# Plan: Phase 10.I-3 — Toolbar bottom 固定 + safe-area + 44px tap target

## Summary

`useTouchDevice` で touch (`pointer: coarse`) 判定し、touch 環境では Toolbar を `<header>` から取り出して画面下部 (既存 `AdSlot bottom` 100px の直上) に固定する。`paddingBottom: env(safe-area-inset-bottom)` で iPhone notch / home indicator を回避し、ToolButton / ColorPalette / FontSizeControl の各 Button に `min-w-11 min-h-11` (44px tap target) を touch 時のみ適用して iOS HIG / Material 48dp 推奨を満たす。Visual サイズ (アイコン 18px / swatch 16px / ボタン外形 28-32px) は完全維持し、hit zone のみ拡張することで desktop UX を非劣化に保つ。Stage の bottom inset も touch + bottom toolbar の高さを ResizeObserver で測定して動的反映する。

## User Story

As **a snap-share mobile user (iPhone Safari / Android Chrome)**, I want **画面下部に固定された toolbar で全ツールに親指が届き、ボタンが指サイズで確実にタップできる**, so that **両手持ちを強いられずスマホを片手で snap-share の全機能を完遂できる**.

## Problem → Solution

**Current state (10.I-2 完了時点)**:
- Toolbar は `<header>` 内 (画面上部固定) にあり、スマホでは親指が届かない
- ToolButton (`size="icon"` = 32px) / ColorPalette / FontSizeControl (`size="icon-sm"` = 28px) のボタン外形が iOS HIG 44pt 未満で指タップ精度が低い
- iPhone home indicator / notch (`safe-area-inset-bottom`) を考慮していない (画面端ぎりぎりに UI 要素を配置するレイアウトはあるが、Toolbar が bottom にないため現状は問題ない)

**Desired state**:
- touch device (`pointer: coarse`) のみ Toolbar を画面下部に固定 (既存 `AdSlot bottom = 100px` の直上)
- desktop は従来通り `<header>` 内 (上部固定) で UI 学習コスト維持
- 全 Button が touch 時に `min-w-11 min-h-11` (44px) tap zone を確保。Visual は変更なし
- iPhone safe-area 対応 (`paddingBottom: env(safe-area-inset-bottom)`)
- Stage 高さ計算に Toolbar bottom 高さも反映 (画像が Toolbar に被らない)

## Metadata

- **Complexity**: Small-Medium (6 ファイル更新 + 1 E2E spec 新規、推定 150〜250 行差分)
- **Source PRD**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`
- **PRD Phase**: 10.I-3 (Toolbar bottom 固定 + safe-area)
- **Estimated Files**: 6

---

## UX Design

### Before (10.I-2 完了時点 / Mobile)

```
┌─────────────────────────────────┐
│ [iPhone Safari, viewport 390px] │
│ ┌─────────────────────────────┐ │
│ │ Toolbar (top, 32px buttons) │ │ ← 親指届かない
│ │ pitamark   [LangToggle]     │ │
│ ├─────────────────────────────┤ │
│ │                             │ │
│ │      画像 + 注釈             │ │
│ │                             │ │
│ │                             │ │
│ ├─────────────────────────────┤ │
│ │ AdSlot bottom (100px)       │ │ ← 既存
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### After (10.I-3 完了時点 / Mobile)

```
┌─────────────────────────────────┐
│ [iPhone Safari, viewport 390px] │
│ ┌─────────────────────────────┐ │
│ │ pitamark         [LangToggle│ │ ← header 縮小
│ ├─────────────────────────────┤ │
│ │                             │ │
│ │                             │ │
│ │      画像 + 注釈             │ │
│ │                             │ │
│ │                             │ │
│ ├─────────────────────────────┤ │
│ │ Toolbar (44px tap, wrap可)  │ │ ← bottom 固定
│ │ [□][→][T][▥]  ⎯  ↶ ↷ 🗑 ...│ │   親指リーチ
│ ├─────────────────────────────┤ │
│ │ AdSlot bottom (100px)       │ │ ← 既存維持
│ │ +safe-area-inset-bottom     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### After (Desktop / 非劣化)

```
┌─────────────────────────────────────────────┐
│ [Desktop Chrome, viewport 1440px]           │
│ ┌─────────────────────────────────────────┐ │
│ │ AdSlot rail (左160px)                    │ │
│ │ ┌──────────────────────────────────────┐│ │
│ │ │ pitamark [Toolbar 32px] [LangToggle] ││ │ ← 従来 header 内 (非劣化)
│ │ ├──────────────────────────────────────┤│ │
│ │ │            画像 + 注釈                ││ │
│ │ │                                      ││ │
│ │ └──────────────────────────────────────┘│ │
│ │ AdSlot rail (右160px)                    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After (touch) | After (desktop) | Notes |
|---|---|---|---|---|
| Toolbar 配置 | `<header>` 内 (top) | `<div fixed bottom-[100px]>` (AdSlot 上) | `<header>` 内 (非劣化) | `useTouchDevice` で 2-way 分岐 |
| ToolButton tap zone | 32px (icon サイズ) | **44px** (`min-w-11 min-h-11`) | 32px (非劣化) | visual 18px icon は不変、hit のみ拡張 |
| ColorPalette swatch tap zone | 28px (icon-sm) | **44px** | 28px (非劣化) | visual 16px swatch は不変 |
| FontSizeControl +/- tap zone | 28px (icon-sm) | **44px** | 28px (非劣化) | |
| safe-area-inset-bottom | 未考慮 | Toolbar 自身に padding-bottom 適用 | 影響なし | AdSlot bottom 既に対応済 |
| Stage 高さ | `viewport - header - 100px` | `viewport - header - 100px - toolbar高` | 従来 (lg 時 0、narrow 時 100px) | ResizeObserver で動的追従 |
| Toolbar 折り返し | `flex-wrap` (narrow で 2 行になる前提) | 同上 | 同上 | viewport 幅により 1〜3 行 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/src/pages/EditorShell.tsx` | 117-244 | レイアウト state (`headerHeight` / `stageBottomInset`) と ResizeObserver パターン。Toolbar bottom 用の高さ ref / ResizeObserver を同形式で追加 |
| **P0** | `apps/web/src/pages/EditorShell.tsx` | 530-600 | `<header>` レンダリング箇所 + `<Toolbar>` 配置。`source !== null` の条件分岐位置を確認 |
| **P0** | `apps/web/src/components/toolbar/ToolButton.tsx` | 全体 (71 行) | shadcn `<Button size="icon">` に adaptive class 追加する箇所 |
| **P0** | `apps/web/src/components/toolbar/ColorPalette.tsx` | 全体 (68 行) | `<Button size="icon-sm">` を 7 swatch 分 adaptive 化 |
| **P0** | `apps/web/src/components/toolbar/FontSizeControl.tsx` | 全体 (89 行) | +/- 2 ボタンを adaptive 化 |
| **P0** | `apps/web/src/components/toolbar/Toolbar.tsx` | 全体 (174 行) | 内側 div の className を変更しない (中身は維持)。Plan の core decision: Toolbar 自身は touch 配置を知らず、親 (EditorShell) が wrap container で位置決め |
| **P1** | `apps/web/src/components/ad/AdSlot.tsx` | 49-75 | `safe-area-inset-bottom` 適用パターン (既存事例)。`fixed inset-x-0 bottom-0 z-20 lg:hidden` の構造を Toolbar 用に類比 (`bottom-[100px]` で AdSlot の上に乗せる) |
| **P1** | `apps/web/src/hooks/useTouchDevice.ts` | 全体 (29 行) | 10.I-2 で作成済 hook。本 plan で再利用 |
| **P1** | `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | 1-58 | 既存 test 構造 (`renderToolbar` ヘルパ + TooltipProvider)。useTouchDevice mock を追加して adaptive class assert |
| **P2** | `apps/web/src/components/ui/button.tsx` | 24-32 | shadcn Button size variants: `icon` = `size-8` (32px) / `icon-sm` = `size-7` (28px)。本 plan は size 変更ではなく `min-w-11 min-h-11` で hit zone のみ拡張 |
| **P2** | `apps/web/src/styles/global.css` | 全体 | `.konvajs-content { touch-action: none }` (10.I-1) のセレクタ階層理解。本 plan は global.css に追加なし (Tailwind class 内で完結) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| iOS HIG tap target | [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | 44×44 pt 最小推奨。Tailwind の `w-11 h-11` (= 44px) と一致 |
| Material touch target | [Material — touch-target](https://m2.material.io/develop/web/supporting/touch-target) | 48×48 dp 推奨だが Web では 44px 級でも実用上十分 (iOS HIG と整合) |
| `env(safe-area-inset-*)` | [MDN env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env) | Tailwind v4 でも `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}` で素直に使える。class arbitrary value (`pb-[env(safe-area-inset-bottom)]`) でも可 |
| viewport meta `viewport-fit=cover` | [MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag) | safe-area-inset を有効化するには `viewport-fit=cover` が必要。本 plan で `apps/web/index.html` を 1 行更新 |

---

## Patterns to Mirror

### USE_TOUCH_DEVICE_REUSE
```ts
// SOURCE: apps/web/src/hooks/useTouchDevice.ts (Phase 10.I-2 で作成済)
import { useTouchDevice } from '../../hooks/useTouchDevice';
// 戻り値 boolean を className conditional で使う。
const isTouch = useTouchDevice();
```

### ADAPTIVE_BUTTON_HIT_ZONE
```tsx
// SOURCE (NEW): apps/web/src/components/toolbar/ToolButton.tsx
// shadcn Button の size prop は visual サイズを決める (size-8 = 32px)。touch 時は visual
// を変えず、Tailwind の min-w-11 min-h-11 (44px) を className に追加して hit zone のみ
// 拡張する。これで desktop は完全非劣化、touch は iOS HIG 44pt を満たす。
import { useTouchDevice } from '../../hooks/useTouchDevice';

const isTouch = useTouchDevice();
<Button
  // ...
  className={cn(
    'rounded-md border border-transparent',
    TONE_CLASS[tone],
    isTouch && 'min-w-11 min-h-11',
  )}
>
```

### TOOLBAR_FIXED_BOTTOM (touch only)
```tsx
// SOURCE (NEW): apps/web/src/pages/EditorShell.tsx の <header> 直後に追加。
// 既存 AdSlot bottom variant (z-20, fixed inset-x-0 bottom-0, height 100px) の直上に
// Toolbar を浮かべる。z-30 で AdSlot より前面。pointer-events-none ラッパで Toolbar
// 外の領域 (Stage と重なる箇所) はクリック透過。
//
// Toolbar 内側の div 自身が pointer-events-auto を持っているので、wrapper は none で OK。

const isTouch = useTouchDevice();

// header 内では touch 時に Toolbar をレンダーしない
{!isTouch && source !== null && <Toolbar {...toolbarProps} />}

// touch 時は別 container で bottom 固定
{isTouch && source !== null && (
  <div
    ref={bottomToolbarRef}
    className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3"
    style={{
      bottom: BOTTOM_HEIGHT_PX,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}
  >
    <Toolbar {...toolbarProps} />
  </div>
)}
```

### RESIZE_OBSERVER_FOR_BOTTOM_TOOLBAR
```ts
// SOURCE (NEW): apps/web/src/pages/EditorShell.tsx
// 既存の headerHeight 測定パターン (line 132-149) を踏襲。Toolbar が flex-wrap で
// 2-3 行になる可能性に備えて高さを ResizeObserver で動的に追従する。

const bottomToolbarRef = useRef<HTMLDivElement>(null);
const [bottomToolbarHeight, setBottomToolbarHeight] = useState<number>(0);

useEffect(() => {
  const el = bottomToolbarRef.current;
  if (!el) {
    setBottomToolbarHeight(0);
    return;
  }
  const update = () => setBottomToolbarHeight(el.getBoundingClientRect().height);
  update();
  let raf = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  });
  observer.observe(el);
  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
  };
}, [isTouch, source]); // bottomToolbar は isTouch && source で条件付き mount
```

### STAGE_INSET_RECOMPUTE
```ts
// SOURCE (UPDATE): apps/web/src/pages/EditorShell.tsx line 244
// 既存:
//   const stageBottomInset = isLgViewport ? 0 : BOTTOM_HEIGHT_PX;
// touch + 非 lg 時は AdSlot bottom (100px) + bottomToolbarHeight を加算する。
const stageBottomInset =
  isLgViewport ? 0 : BOTTOM_HEIGHT_PX + (isTouch ? bottomToolbarHeight : 0);
```

### VIEWPORT_META_SAFE_AREA
```html
<!-- SOURCE (UPDATE): apps/web/index.html line 5 -->
<!-- BEFORE: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<!-- AFTER: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<!-- viewport-fit=cover が無いと iOS で `env(safe-area-inset-bottom)` が常に 0 を返す。
     既存 AdSlot bottom variant (Phase 10.H) の safe-area が iOS で実効していない可能性
     があり、本 plan で同時修正する。 -->
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/index.html` | UPDATE | viewport meta に `viewport-fit=cover` 追加 (1 行) |
| `apps/web/src/components/toolbar/ToolButton.tsx` | UPDATE | useTouchDevice + `min-w-11 min-h-11` adaptive (~5 行差分) |
| `apps/web/src/components/toolbar/ColorPalette.tsx` | UPDATE | 同上、7 swatch 全体 (~5 行差分) |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | UPDATE | +/- 2 ボタン (~6 行差分、ボタン 2 箇所に同 className 適用) |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | useTouchDevice 取り込み + Toolbar 配置切替 + bottomToolbarRef + ResizeObserver + stageBottomInset 計算 (~50 行差分) |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | UPDATE | useTouchDevice mock + touch 時に min-w-11 が ToolButton 内側 button に付く assert (~15 行追加) |
| `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` | UPDATE | 同種、swatch button の adaptive assert (~10 行追加) |
| `apps/web/src/components/toolbar/__tests__/FontSizeControl.test.tsx` | UPDATE | 同種 (~10 行追加) |
| `apps/web/e2e/touch-toolbar-bottom.spec.ts` | CREATE | mobile-chrome smoke (Toolbar が viewport 下半分に存在 + 矩形ツール tap で挿入できる) |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | UPDATE | sub-phase 10.I-3 行を complete に |

## NOT Building

- **VisualViewport API での IME 出現吸収** — Should、Phase 10.I MVP 後にドッグフードで判断
- **awareness layer (他ユーザーカーソル) の touch device 判定** — Should、Phase 10.I-4 以降
- **Toolbar 自身のレイアウト変更** (折り畳み / FAB 化 / drawer) — `flex-wrap` で narrow に対応する既存設計を維持。FAB / drawer は将来 Phase
- **Toolbar 内部要素 (アイコン / swatch) の visual サイズ変更** — desktop UX 非劣化のため、visual は完全維持。hit zone のみ拡張
- **AdSlot bottom の touch 時非表示** — Phase 10.H で予約済 slot を本 plan で消すと「広告枠予約」の意味が消える。Toolbar を AdSlot の **上** (= `bottom: 100px`) に重ねる設計で共存
- **AdSense 実接続 / AdSense ポリシー対応** — Phase 11+ で別 PRD。本 plan の「Toolbar が AdSlot に隣接する」配置はクリック誤誘導の懸念があるが、AdSlot 自身が現状 placeholder のため Phase 11+ 接続時に再評価
- **長押しコンテキストメニュー / 3 本指ジェスチャ** — PRD Won't 継承
- **Toolbar に表示する内容の変更** (ボタン追加 / 削除 / 並び替え) — 配置切替のみ、中身は完全維持

---

## Step-by-Step Tasks

### Task 1: viewport meta 修正

- **ACTION**: `apps/web/index.html` line 5 の viewport meta に `viewport-fit=cover` を追加
- **IMPLEMENT**: `content="width=device-width, initial-scale=1.0, viewport-fit=cover"` に書き換え
- **MIRROR**: `VIEWPORT_META_SAFE_AREA` (上記)
- **IMPORTS**: なし
- **GOTCHA**:
  - `viewport-fit=cover` は iOS Safari 11+ で safe-area-inset-* を有効化する必須条件。これがないと `env(safe-area-inset-bottom)` が常に 0
  - `viewport-fit=cover` を有効化すると iOS で「画面 4 隅の角丸 + notch 領域」まで viewport が広がる。既存 layout で `inset-x-0` を使っている要素は 4 隅に達する可能性があり、視覚 regression を確認する必要がある
- **VALIDATE**:
  - `grep -n "viewport-fit" apps/web/index.html` で 1 件 hit
  - PC chromium で既存 e2e 全件緑 (デスクトップでは viewport-fit は無視されるはず)
  - 実機 iPhone Safari で `getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')` が 0 以外になることを DevTools で確認 (推奨、blocker ではない)

### Task 2: ToolButton adaptive hit zone

- **ACTION**: `apps/web/src/components/toolbar/ToolButton.tsx` で `useTouchDevice()` を呼び、`<Button>` の className に `min-w-11 min-h-11` を touch 時のみ追加
- **IMPLEMENT**:
  ```tsx
  import { useTouchDevice } from '../../hooks/useTouchDevice';

  // ... 関数本体内
  const isTouch = useTouchDevice();
  // ...
  <Button
    // ...
    className={cn(
      'rounded-md border border-transparent',
      TONE_CLASS[tone],
      isTouch && 'min-w-11 min-h-11',
    )}
  >
  ```
- **MIRROR**: `ADAPTIVE_BUTTON_HIT_ZONE` (上記) + `USE_TOUCH_DEVICE_REUSE`
- **IMPORTS**: `import { useTouchDevice } from '../../hooks/useTouchDevice';`
- **GOTCHA**:
  - `min-w-11` / `min-h-11` は Tailwind v4 の core spacing で `2.75rem` = 44px。`w-11` (固定 44px) ではなく `min-` を使うことで、`size-8` (32px) の visual を維持しつつ tap zone のみ拡張する
  - shadcn `<Button>` は内部で `inline-flex items-center justify-center` を持つため、min-w/h で広がっても icon は中央配置される
- **VALIDATE**:
  - `grep -n "min-w-11" apps/web/src/components/toolbar/ToolButton.tsx` で 1 件 hit
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 3: ColorPalette adaptive

- **ACTION**: `apps/web/src/components/toolbar/ColorPalette.tsx` の 7 swatch 全部に同 adaptive class を追加
- **IMPLEMENT**: Task 2 と同形式。`useTouchDevice` を 1 回呼び、map 内の `<Button>` の `className={cn(..., isTouch && 'min-w-11 min-h-11')}` に追加
- **MIRROR**: `ADAPTIVE_BUTTON_HIT_ZONE`
- **IMPORTS**: 既存 `cn` + `useTouchDevice` 追加
- **GOTCHA**:
  - 7 個のボタンが横に並ぶため、touch 時は合計幅が 7 × 44px = 308px となり、narrow 390px viewport ではほぼぴったり。`flex-wrap` で 2 行に折り返す可能性あり (Toolbar 全体は元から `flex-wrap`)
  - swatch の visual (16px square) は変えない、hit zone のみ拡張
- **VALIDATE**:
  - `grep -n "min-w-11" apps/web/src/components/toolbar/ColorPalette.tsx` で 1 件 hit (map 内 1 箇所)
  - 既存 `ColorPalette.test.tsx` が緑のまま

### Task 4: FontSizeControl adaptive

- **ACTION**: `apps/web/src/components/toolbar/FontSizeControl.tsx` の +/- 2 ボタンに同 adaptive class を追加
- **IMPLEMENT**: Task 2 / 3 と同形式
- **MIRROR**: `ADAPTIVE_BUTTON_HIT_ZONE`
- **IMPORTS**: `useTouchDevice` 追加
- **GOTCHA**: 中央の `<span>{activeFontSize}px</span>` は単なる表示で hit zone 不要、min-w 適用しない
- **VALIDATE**: `grep -n "min-w-11" apps/web/src/components/toolbar/FontSizeControl.tsx` で 2 件 hit

### Task 5: EditorShell の Toolbar 配置切替 + ResizeObserver + stageBottomInset

- **ACTION**: `apps/web/src/pages/EditorShell.tsx` で Toolbar を touch 時 bottom 固定にし、Toolbar 高さを ResizeObserver で測定、stageBottomInset を再計算
- **IMPLEMENT**:
  - **Step 5a**: `useTouchDevice()` を呼び、`isTouch` を取得
  - **Step 5b**: `bottomToolbarRef` (`useRef<HTMLDivElement>(null)`) と `bottomToolbarHeight` state を追加
  - **Step 5c**: `useEffect` で `bottomToolbarRef.current` を ResizeObserver 監視、`isTouch && source` のときだけアタッチ
  - **Step 5d**: `stageBottomInset` を `BOTTOM_HEIGHT_PX + (isTouch ? bottomToolbarHeight : 0)` に変更 (lg 時は 0 のまま)
  - **Step 5e**: `<header>` 内の `<Toolbar />` を `{!isTouch && source !== null && <Toolbar ... />}` に変更
  - **Step 5f**: `<header>` の直後に touch 用 bottom container を追加: `{isTouch && source !== null && <div ref={bottomToolbarRef} className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3" style={{ bottom: BOTTOM_HEIGHT_PX, paddingBottom: 'env(safe-area-inset-bottom)' }}><Toolbar ... /></div>}`
  - **Step 5g**: Toolbar の props を 2 箇所に重複させないよう、`toolbarProps` 変数に集約してから両方で参照
- **MIRROR**: `TOOLBAR_FIXED_BOTTOM` + `RESIZE_OBSERVER_FOR_BOTTOM_TOOLBAR` + `STAGE_INSET_RECOMPUTE`
- **IMPORTS**: `useTouchDevice` 追加
- **GOTCHA**:
  - Toolbar の outer div は元から `pointer-events-auto` を持つので、wrapper は `pointer-events-none` で OK
  - `z-30` は AdSlot bottom (`z-20`) より前面、Tooltip provider などとの z-index 順序に注意。既存の `header` (`z-10`) より上、AdSlot より上
  - `bottom: BOTTOM_HEIGHT_PX` は inline style で 100 (number) を渡すと px が補完される (React の慣習)
  - `safe-area-inset-bottom` は AdSlot が既に bottom 0 で適用しているが、Toolbar は AdSlot の **上** (bottom: 100px) なので、`safe-area-inset-bottom` は実効しないが念のため付ける (将来 AdSlot を消したときの保険)
  - `useEffect` の deps には `isTouch` と `source` を入れる。両者 true の遷移で ref が attach される
- **VALIDATE**:
  - `grep -n "bottomToolbarRef\|bottomToolbarHeight" apps/web/src/pages/EditorShell.tsx` で 5 件以上
  - `pnpm -F @pitamark/web typecheck` 緑
  - 既存 unit test (342 件) が緑のまま (Toolbar caller 変更による regression なし)

### Task 6: Toolbar.test.tsx に adaptive 経路の test 追加

- **ACTION**: `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` で useTouchDevice mock を追加し、touch 時に ToolButton が min-w-11 class を持つことを assert
- **IMPLEMENT**:
  - `vi.hoisted` で `useTouchDeviceMock` を定義
  - `vi.mock('../../../hooks/useTouchDevice', () => ({ useTouchDevice: () => useTouchDeviceMock() }))`
  - 既存テストで `useTouchDeviceMock.mockReturnValue(false)` を beforeEach に追加 (default desktop)
  - 新規 it: touch 時 ToolButton (button[aria-label="矩形"] 等) の className に `min-w-11` が含まれる
- **MIRROR**: 10.I-2 で既に書いた `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` の useTouchDeviceMock パターン
- **IMPORTS**: 既存 + `useTouchDevice` mock
- **GOTCHA**:
  - shadcn Button は wrap 構造を持つので、querySelector で実 button 要素を取得する必要あり (`container.querySelector('button[aria-label="..."]')`)
  - className の含有 check は `expect(btn?.className).toContain('min-w-11')` の単純 string check で OK
- **VALIDATE**: 新規 2 件以上の test (desktop / touch) が緑

### Task 7: ColorPalette.test.tsx / FontSizeControl.test.tsx の adaptive test

- **ACTION**: 同種の useTouchDevice mock を追加し、各 test ファイルで desktop / touch 両経路を 1 件ずつ assert
- **IMPLEMENT**: Task 6 と同形式
- **MIRROR**: Task 6 + 既存 ArrowShape.test.tsx
- **IMPORTS**: 同上
- **GOTCHA**: ColorPalette は 7 swatch 中 1 つのみ assert で OK (代表)。FontSizeControl は + のみ assert (代表) で OK
- **VALIDATE**: 新規 4 件以上 (各 file 2 件) が緑

### Task 8: Playwright smoke (mobile-chrome で Toolbar bottom)

- **ACTION**: `apps/web/e2e/touch-toolbar-bottom.spec.ts` を新規作成。1 件のみ
- **IMPLEMENT**:
  - mobile-chrome project 限定
  - 画像投入後、Toolbar が viewport 下半分に存在することを `boundingBox().y > viewport.height / 2` で確認
  - 「矩形」ボタンを tap して、続けて canvas 上で drag → annotation が 1 件追加される
- **MIRROR**: 10.I-1 / 10.I-2 の e2e spec パターン (`touch-rectangle-draw.spec.ts` / `touch-pinch-zoom.spec.ts`)
- **IMPORTS**: `@playwright/test` + `dropImage`
- **GOTCHA**:
  - `page.setViewportSize` ではなく Pixel 5 device descriptor の viewport をそのまま使う (既存 mobile-chrome project)
  - mobile-chrome の hasTouch: true 配下では `page.tap()` が利用可、ボタンタップは tap 経由が確実
- **VALIDATE**:
  - `pnpm exec playwright test e2e/touch-toolbar-bottom.spec.ts --project=mobile-chrome` で緑
  - chromium project では skip 動作

### Task 9: PRD 更新

- **ACTION**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` の sub-phase 10.I-3 行を `pending` → `in-progress` → `complete` に更新
- **IMPLEMENT**: 10.I-1 / 10.I-2 と同形式の遷移
- **MIRROR**: PRD 内既存パターン
- **IMPORTS**: なし
- **VALIDATE**: `grep -n "10.I-3" .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` で Status / Plan link / report link が更新されている

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| ToolButton desktop | `useTouchDevice() === false` | className に `min-w-11` を含まない | No |
| ToolButton touch | `useTouchDevice() === true` | className に `min-w-11` と `min-h-11` を含む | No |
| ColorPalette desktop | 同上 | swatch button に adaptive class なし | No |
| ColorPalette touch | 同上 | swatch button に adaptive class あり | No |
| FontSizeControl desktop | 同上 | +/- ボタンに adaptive class なし | No |
| FontSizeControl touch | 同上 | +/- ボタンに adaptive class あり | No |

### Edge Cases Checklist

- [ ] PC chromium で Toolbar が `<header>` 内にある (従来位置維持)
- [ ] PC chromium でボタンサイズが 32px / 28px (size-8 / size-7) を維持 (visual 非劣化)
- [ ] mobile-chrome で Toolbar が viewport 下半分に存在
- [ ] mobile-chrome で Toolbar が AdSlot bottom (100px) の上に位置
- [ ] mobile-chrome で `paddingBottom: env(safe-area-inset-bottom)` が effective (`viewport-fit=cover` 効果)
- [ ] mobile-chrome で全 ToolButton / ColorPalette / FontSizeControl が `min-w-11 min-h-11` 効果で 44px tap zone
- [ ] Toolbar の高さが flex-wrap で 2-3 行になっても ResizeObserver で stage 高さが追従
- [ ] Stage が Toolbar に被らない (画像が toolbar bottom 100px + safe-area の上で完結)
- [ ] 既存 chromium e2e 78 件が緑のまま (回帰なし)
- [ ] LangToggle が touch / desktop どちらでも header 右に残る (Toolbar から独立)
- [ ] landing 状態 (source === null) では touch / desktop どちらでも Toolbar 非表示

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
pnpm exec biome ci .
```
EXPECT: ゼロエラー、ゼロ違反

### Unit Tests
```bash
pnpm -F @pitamark/web test -- src/components/toolbar/__tests__
pnpm -F @pitamark/web test
```
EXPECT: 全件緑、新規 8 件 (Toolbar 2 + ColorPalette 2 + FontSizeControl 2 + 余裕で 2) が adaptive 経路をカバー

### Build
```bash
pnpm build
```
EXPECT: success、bundle size 微増 (Tailwind class 追加分)

### E2E
```bash
cd apps/web && pnpm exec playwright test e2e/touch-toolbar-bottom.spec.ts --project=mobile-chrome
cd apps/web && pnpm exec playwright test --project=chromium
```
EXPECT: 新規 smoke 緑、chromium 78 件すべて緑

### Manual Validation

- [ ] PC Chrome / Firefox で Toolbar が画面上部 (header 内) に位置 (従来通り)
- [ ] PC でボタンが従来サイズ (32px / 28px) で visual 非劣化 (DevTools で目視)
- [ ] **実機 iPhone Safari で Toolbar が画面下部に固定**、AdSlot の真上に配置
- [ ] **実機 iPhone Safari で home indicator (notch / pill) が Toolbar / AdSlot を侵食しない** (`viewport-fit=cover` + safe-area-inset-bottom 効果)
- [ ] **実機 iPhone Safari で全ボタンに親指が届く** (片手持ちで操作可能)
- [ ] 実機で flex-wrap により Toolbar が 2-3 行になっても Stage の bottom 余白が連動して画像が toolbar に被らない
- [ ] Android Chrome で同上の主要項目
- [ ] Tablet (iPad) 縦持ち / 横持ち でレイアウト崩壊なし (lg 境界の挙動確認、推奨)

---

## Acceptance Criteria

- [ ] Task 1〜9 すべて完了
- [ ] `pnpm typecheck` / `biome ci` / `pnpm test` / `pnpm build` 全緑
- [ ] 新規 unit test (Toolbar / ColorPalette / FontSizeControl の adaptive 各 2 件) 緑
- [ ] 新規 E2E smoke (`touch-toolbar-bottom.spec.ts`) 緑
- [ ] chromium 全 e2e 回帰ゼロ
- [ ] PC で Toolbar / ボタンサイズが従来通りであることを目視確認
- [ ] PRD 10.I-3 行が complete + plan / report link 追加

## Completion Checklist

- [ ] `useTouchDevice` (10.I-2 で作成済) を再利用
- [ ] visual サイズは完全維持、hit zone のみ拡張
- [ ] desktop UX 非劣化を chromium e2e で担保
- [ ] AdSlot bottom (Phase 10.H 予約済) との共存設計 (Toolbar が AdSlot の上に乗る)
- [ ] `viewport-fit=cover` で iOS の `safe-area-inset` を有効化 (副作用として AdSlot 既存実装にも効果)
- [ ] No hardcoded values (Tailwind の `min-w-11` `min-h-11` で意図明示、`BOTTOM_HEIGHT_PX` は既存定数を参照)
- [ ] No unnecessary scope additions (NOT Building 準拠、Toolbar の中身は完全維持)
- [ ] Self-contained — codebase 再検索なしで実装可能

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `viewport-fit=cover` の追加で iOS の既存 layout が画面 4 隅まで拡張し、`inset-x-0` 要素が notch / 角丸に被る | Low | Medium | desktop e2e で regression なし。実機確認推奨。問題が出れば本 plan 内で `padding-x: env(safe-area-inset-left/right)` を追加対応 |
| Toolbar の `flex-wrap` で 3 行以上になり画面占有率が高くなりすぎる | Medium | Low | Toolbar の中身は変更しない方針 (NOT Building 準拠)。問題が出れば 10.I-4 ドッグフードで Toolbar 縮約 (一部ボタンを overflow menu に) を検討 |
| `min-w-11 min-h-11` で ColorPalette swatch のクリック領域が広がりすぎ、密接した swatch 間で誤タップが増える | Medium | Low | swatch hit zone は `min-w-11` で広がるが visual は 16px で残る。ユーザは swatch の中心を狙う前提のため、誤タップは「隣の色」になる程度で致命的ではない。実機ドッグフードで 10.I-4 で評価 |
| AdSlot bottom が touch 時に Toolbar の真下にあり、AdSense 接続時に誤クリック誘発 | Low | Medium (AdSense ポリシー) | Phase 11+ の AdSense 実接続時に再評価。本 plan で扱わない (NOT Building) |
| `bottomToolbarHeight` の ResizeObserver が `isTouch && source` の遷移で正しく attach/detach されない | Low | Medium | useEffect の deps を `[isTouch, source]` にして mount/unmount を確実化。test で再現は困難なため実機確認推奨 |
| `viewport-fit=cover` で既存 AdSlot bottom の `safe-area-inset-bottom` が**新たに 0 以外を返す**ようになり、AdSlot の物理高さが既存より大きくなる (AdSlot は固定 `height: BOTTOM_HEIGHT_PX = 100`、`paddingBottom` は内側に消費されるため外形は同じ) | Low | Low | AdSlot は `box-sizing: border-box` (Tailwind preflight) + 固定 height のため外形 100px 不変。stage inset 計算は影響なし |
| Toolbar が flex-wrap で 2-3 行になったときに `bottom: 100px` 固定で画面中央側に伸びる → 画像エリアを圧迫 | Medium | Medium | ResizeObserver で `bottomToolbarHeight` を測って stageBottomInset に加算するロジックで自動追従。設計上カバー済 |
| iOS Safari で `position: fixed` の要素が virtual keyboard 出現時に予期せぬ位置に動く | Medium | Low | 本 plan のスコープ (描画ツール / 既存 annotation 操作) では IME を使わない。テキスト編集時は別レイヤ (TextEditorOverlay) があり、Toolbar の bottom 配置と独立。VisualViewport API での吸収は Should (10.I MVP 後検討) |

## Notes

### `useTouchDevice` のキャッシュ効果

10.I-2 で作成した hook を 4 ファイル (ToolButton / ColorPalette / FontSizeControl / EditorShell) で再利用するが、各 useEffect が独立に matchMedia listener をアタッチする。結果としてアタッチ数は 4 だが、これは小さなオーバーヘッド。複数 component で同 hook を使う patterns は React の標準的アプローチ。

### Toolbar 中身を変えない理由

Toolbar.tsx の中身 (構造 / class / divider 配置) は **完全維持** する。理由:
1. 既存 Toolbar.test.tsx の test ID / aria-label に依存する e2e が 78 件あり、構造変更で大規模 regression のリスク
2. desktop UX 非劣化が PRD の最優先要求
3. 配置変更 (header 内 → bottom 固定) は Toolbar 自身ではなく **EditorShell の wrapping div** で完結する

### `viewport-fit=cover` の副作用

`viewport-fit=cover` を追加すると iOS Safari で:
- `env(safe-area-inset-top/right/bottom/left)` が実値を返す
- 画面 4 隅の角丸 / notch まで viewport が広がる

副作用として、**既存 AdSlot bottom の `padding-bottom: env(safe-area-inset-bottom)` が初めて実効する**。これは Phase 10.H で意図された動作で、本 plan の修正でようやく効くようになる (= 既存実装の latent bug を併せて解消)。

### ECC PRP との整合

本 plan は 10.I-1 / 10.I-2 と同一ブランチ `phase-10-i-touch-optimization` で進める。コミット粒度は sub-phase ごと、本 plan で 1〜2 コミット想定 (viewport meta + adaptive button + Toolbar 配置 + test + e2e + PRD)。

### 後続 sub-phase に渡す前提

- 10.I-4 (受入): 本 plan の `touch-toolbar-bottom.spec.ts` を base に、4 形状 × 3 操作 = 12 ケース + Toolbar の全ボタンが mobile で機能することを網羅検証する。手動チェックリストで「実機で親指リーチ達成」を最終確認
- Phase 11+ (AdSense 接続時): Toolbar が AdSlot の上に乗る配置を再評価 (誤クリック誘発リスク)。Toolbar 自身を AdSlot の上に固定するか、AdSlot を上部に移すか判断
