# Plan: Phase 7.7-3 ズーム/パン + fit-to-viewport

## Summary
任意サイズの画像を投入しても初期表示が viewport に収まり、ズーム/パンで詳細にアクセスできる Stage transform を導入する。`useStageTransform` フックで `{scale, x, y}` を一元管理し、Stage 全体に `scaleX/scaleY/x/y` を掛けることで既存の論理座標系・hit-test ロジック・注釈座標を一切変更しない方針(PRD 確定)。`Cmd+0`(fit) / `Cmd+1`(100%) / `Space+drag`(一時パン) / `Cmd+wheel` + トラックパッドピンチ(ズーム)を実装。

## User Story
As a **大きいスクショ(5000×5000 px)を上司に見せたいビジネスマン**, I want to **画像投入直後に viewport に fit して即注釈作業に入りたい、また詳細部位は Cmd+wheel でズームし Space+drag で見たい場所を出したい**, so that **「左上に貼り付いて巨大な画像が見えない」破綻を踏まずに、思考を切らさずに 1 サイクルで注釈を完成させられる**.

## Problem → Solution
**現状**: 画像読み込み時に Stage は `viewport size`、画像は等倍 + 左上寄せで描画される。5000×5000 の画像を投入すると右下が見切れ、注釈は一切できない。Stage scale 制御は未実装(`grep` 0 件)、ズーム/パンのキーボード割り当ても無し。

**改善後**: 画像 onLoad 時に `min(vw/iw, vh/ih, 1)` で初期 scale を計算し中央寄せ(等倍小画像はそのまま)。`Cmd+0` でいつでも fit、`Cmd+1` で 100%、`Space+drag` で一時パン、`Cmd+wheel`(マウス) / ピンチ(トラックパッド)でカーソル位置中心ズーム。Stage 全体に transform を掛けるため既存の Shape 座標 / Yjs mutation / reducer / awareness は一切変更不要。

## Metadata
- **Complexity**: Medium(3-10 ファイル / 200-500 行)
- **Source PRD**: `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md`
- **PRD Phase**: Phase 3 (B1: ズーム/パン + fit-to-viewport)
- **Estimated Files**: 8 ファイル更新 / 2 ファイル新規(フック + テスト)

---

## UX Design

### Before
```
┌───────────────────── viewport ─────────────────────┐
│ ┌─────────────────────────────                     │
│ │ 5000×5000 の画像                                 │
│ │ (左上から等倍配置)                                │
│ │                                                  │
│ │   見えない & スクロールも効かない                 │
│ │                                                  │
└───────────────────────────────────────────────────┘
   ↓ 注釈不可。ユーザーが画面サイズの画像しか使えない。
```

### After
```
┌──────── viewport ─────────────┐
│      ┌────────────┐           │
│      │  5000×5000 │ ← scale = │
│      │  (fit 表示)│   min(vw/iw,│
│      │            │   vh/ih, 1)│
│      └────────────┘           │
│  📐 左下: ズーム%(将来 Could)  │
└──────────────────────────────┘
   ↓ Cmd+wheel / Cmd+1 / Cmd+0 / Space+drag で自在
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 画像投入直後 | 等倍 + 左上 | viewport に fit + 中央寄せ(画像が viewport 以下なら等倍維持) | 自動 |
| Cmd+0 | 未割当 | fit-to-viewport へ復帰 | Photoshop 系規約 |
| Cmd+1 | 未割当 | 100% (scale=1, 画像中央 pivot) | Photoshop 系規約 |
| Cmd+wheel / pinch | 未割当 | カーソル位置 pivot で zoom in/out | Konva 公式パターン |
| Space + drag | 未割当 | 一時パン(離すと元のツールに戻る) | 全 Pro ツール共通 |
| カーソル形状 | crosshair | 通常 + Space 押下中は grab/grabbing | UX フィードバック |
| TextEditorOverlay 位置 | `stageContainerRect.left + annotation.x` | transform を反映 | scale / position 変化に追従 |
| PNG エクスポート | Stage 全体(viewport 範囲)を出力 | 画像範囲のみ出力(transform 一時リセット) | ズーム中でも常に元解像度を出す |

---

## Mandatory Reading

実装前に必ず読むべきファイル:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/components/canvas/CanvasStage.tsx` | 全体 | Stage props 拡張 + getPointerPosition 置換 + onWheel/Space+drag 追加 |
| P0 | `apps/web/src/components/canvas/ImageLayer.tsx` | 全体 | 画像 natural size を上に通知する onLoaded callback 追加 |
| P0 | `apps/web/src/pages/EditorShell.tsx` | 全体 | useStageTransform 導入 + ショートカット追加 + TextEditorOverlay 補正 |
| P0 | `apps/web/src/hooks/useStageSize.ts` | 全体 | viewport サイズ。新規 useStageTransform と並ぶ位置で参照 |
| P0 | `apps/web/src/hooks/useKeyboardShortcuts.ts` | 全体 | Cmd+0 / Cmd+1 を追加。isEditableTarget / mod 既存パターン踏襲 |
| P0 | `apps/web/src/components/canvas/TextEditorOverlay.tsx` | 全体 | 位置計算に transform を反映 |
| P0 | `apps/web/src/hooks/useExportPng.ts` | 全体 | export 直前に transform を一時リセットして toCanvas、画像範囲だけ切り出す |
| P0 | `apps/web/src/lib/exportPng.ts` | 全体 | stageToBlob のシグネチャに `bounds` 追加(or 別関数) |
| P1 | `apps/web/src/pages/LocalEditor.tsx` | 全体 | handleClear 時に transform リセットが必要かは EditorShell 側に閉じる方針 |
| P1 | `apps/web/src/pages/RoomEditor.tsx` | 全体 | 同上、reset 経路の確認 |
| P1 | `apps/web/src/components/canvas/AnnotationLayer.tsx` | 全体 | 変更なし(座標系は触らない、参照のみ) |
| P2 | `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` | 全体 | useImage モックの先行例。onLoaded 通知のテスト追加に流用 |
| P2 | `apps/web/e2e/keyboard-shortcuts.spec.ts` | 全体 | Cmd+0 / Cmd+1 / wheel-zoom / Space+drag の E2E パターン |
| P2 | `apps/web/e2e/annotation-tools.spec.ts` | 1-40 | dragOnStage パターン |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Konva Stage scaleXY + position | https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html | 公式パターン: `mousePointTo = (pointer - stagePos) / oldScale` → `newPos = pointer - mousePointTo * newScale` |
| getRelativePointerPosition | https://konvajs.org/api/Konva.Stage.html#getRelativePointerPosition | Stage transform を吸収して論理座標を返す。getPointerPosition は absolute |
| Wheel Pinch 検出 | https://konvajs.org/docs/sandbox/Free_Drawing.html (討論部分), Chromium / WebKit 実装 | macOS pinch zoom は wheel イベントで `evt.ctrlKey === true` で来る(キーボード Ctrl と区別不可な点に注意) |
| Stage toCanvas with bounds | https://konvajs.org/api/Konva.Stage.html#toCanvas | `{ x, y, width, height, pixelRatio }` で範囲指定可。transform を一時リセットしてから呼ぶのが安全 |
| Konva passive wheel listener 警告 | https://github.com/konvajs/konva/issues/1340 | wheel ハンドラで preventDefault 必須(ブラウザのデフォルトズーム抑止)、Konva 9+ は内部で non-passive 登録済 |

---

## Patterns to Mirror

### CUSTOM_HOOK_RETURN_SHAPE
```typescript
// SOURCE: apps/web/src/hooks/useStageSize.ts (全体)
type StageSize = Readonly<{
  width: number;
  height: number;
}>;

export const useStageSize = (): StageSize => {
  const [size, setSize] = useState<StageSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  // ...
  return size;
};
```
- `Readonly<{...}>` で公開型を作る
- フックは値オブジェクトを返す(callback 含めるなら `useCallback` 安定化)
- 初期化は `useState(() => ...)` 形式(SSR 安全側)

### KEYBOARD_SHORTCUT_REGISTRATION
```typescript
// SOURCE: apps/web/src/hooks/useKeyboardShortcuts.ts:30-78
const ref = useRef(shortcuts);
ref.current = shortcuts;

useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === 's' && !e.shiftKey) { /* preventDefault + onExport */ return; }
    // ...
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```
- `ref` で最新コールバックを参照(再 subscribe 不要)
- `mod = metaKey || ctrlKey`(macOS / Win 両対応)
- ブラウザのデフォルト挙動を奪う場合は `e.preventDefault()` を必ず呼ぶ
- editable target ガードを最初に通す

### REDUCER_FREE_STATE_HOOK_PATTERN
```typescript
// 注釈状態は useReducer + Yjs だが、Phase 7.7-3 の transform は
// 「ローカル UI のみ・Yjs 同期しない」ため useState + useCallback で十分。
// presence 連携も不要(他人のズームに付き合わされない方が良い、Excalidraw / Figma も同様)。
```

### IMAGE_NATURAL_SIZE_PROBE
```typescript
// 既存に類例なし。useImage の戻り値 image (HTMLImageElement | undefined) から
// useEffect で {naturalWidth, naturalHeight} を上に通知する callback を生やす。
// SOURCE: apps/web/src/components/canvas/ImageLayer.tsx (改修後想定)
useEffect(() => {
  if (!image) return;
  onImageLoaded?.({ width: image.naturalWidth, height: image.naturalHeight });
}, [image, onImageLoaded]);
```

### KONVA_WHEEL_ZOOM_AT_POINTER
```typescript
// SOURCE: 公式 docs https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html
const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
  e.evt.preventDefault();
  const stage = e.target.getStage();
  if (!stage) return;
  // macOS pinch は ctrlKey=true で来る(キー Ctrl と同じイベント形)。
  // Cmd+wheel もズーム扱い。それ以外の単純 wheel は無視(誤爆防止)。
  const isZoomGesture = e.evt.ctrlKey || e.evt.metaKey;
  if (!isZoomGesture) return;

  const oldScale = transform.scale;
  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  const mousePointTo = {
    x: (pointer.x - transform.x) / oldScale,
    y: (pointer.y - transform.y) / oldScale,
  };
  const factor = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
  const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);

  setTransform({
    scale: newScale,
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  });
};
```

### KONVA_GET_RELATIVE_POINTER
```typescript
// SOURCE: 公式 docs https://konvajs.org/api/Konva.Stage.html#getRelativePointerPosition
// 現状 (Phase 7.7-1 完了時点) は scale=1 前提で getPointerPosition を使用しているが、
// transform を入れたら全置換が必要。
const stage = e.target.getStage();
const pos = stage?.getRelativePointerPosition() ?? null;
// ↑ ここで返るのは「Stage transform を吸収した論理座標」=
//    Shape の x/y と直接比較・代入できる座標系。
```

### TEST_STRUCTURE_HOOK_UNIT
```typescript
// 類例なし(これまで pure reducer / domain 関数を test していた)。
// Phase 7.7-3 では `useStageTransform` を React testing で扱う:
import { act, renderHook } from '@testing-library/react'; // ※ 既存依存にあるか要確認
// なければ `react-dom/client` の createRoot + act パターンで代用
// (RectangleShape.test.tsx と同じスタイル)。
```
**判断**: 既存テストは全て `react-dom/client` の `createRoot + act` を使っており、`@testing-library/react` の renderHook は未導入。Phase 7.7-3 でも追加せず、`createRoot` パターンでフックを wrap した小さなテストハーネスを書く。あるいはフックを「pure な計算関数」に分割し pure 部分だけ unit test する。
**採用**: 計算ロジック(fitToViewport / zoomAtPointer / clampPan)を純関数に切り出して unit test。React フックは E2E + 簡単な smoke test。

### PURE_GEOMETRY_TESTING
```typescript
// SOURCE: apps/web/src/domain/annotation/operations.ts (既存パターン)
// 純関数に切り出せば pure unit test で十分カバー可能。
export const computeFitTransform = (
  imageSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
): { scale: number; x: number; y: number } => {
  const scale = Math.min(
    viewportSize.width / imageSize.width,
    viewportSize.height / imageSize.height,
    1,
  );
  return {
    scale,
    x: (viewportSize.width - imageSize.width * scale) / 2,
    y: (viewportSize.height - imageSize.height * scale) / 2,
  };
};
```

### TEST_STRUCTURE_E2E
```typescript
// SOURCE: apps/web/e2e/keyboard-shortcuts.spec.ts:23-32
const isPressed = async (page, label) =>
  (await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed')) === 'true';

const skipNonChromium = (testInfo) =>
  test.skip(testInfo.project.name !== 'chromium', '...');

// transform は window のグローバルにエクスポートしていないため、E2E では
// 「画像が viewport に fit している = canvas の boundingBox が画像比に近い」
// という間接観測か、新規に `__SNAP_SHARE_STAGE_TRANSFORM__` を window に
// expose する。ANNOTATIONS_KEY 既存パターンに揃えて後者を採用。
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/hooks/useStageTransform.ts` | CREATE | Stage transform を一元管理する新規フック |
| `apps/web/src/hooks/__tests__/useStageTransform.test.ts` | CREATE | 純関数(fit / zoom / clamp)の unit test |
| `apps/web/src/components/canvas/ImageLayer.tsx` | UPDATE | onImageLoaded callback で natural size を通知 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | Stage に transform 適用 / getPointerPosition → getRelativePointerPosition / onWheel / Space+drag pan |
| `apps/web/src/components/canvas/TextEditorOverlay.tsx` | UPDATE | 位置・fontSize に transform を反映 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | useStageTransform 配線 / ImageLayer onLoaded → setImageSize / Cmd+0/Cmd+1 ショートカット / clear 時 reset / TextEditorOverlay へ transform 渡し |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATE | onFitToViewport / onSetHundredPercent コールバック追加 |
| `apps/web/src/lib/exportPng.ts` | UPDATE | `stageToBlob` に `bounds` 引数追加(画像範囲だけ切り出すため) |
| `apps/web/src/hooks/useExportPng.ts` | UPDATE | export 前後で transform を一時リセット & 画像範囲指定で toCanvas |
| `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` | UPDATE | onImageLoaded コールバック発火を検証 |
| `apps/web/e2e/zoom-pan.spec.ts` | CREATE | E2E: 大画像 fit / Cmd+0 / Cmd+1 / wheel zoom / Space+drag pan |

## NOT Building

- **ズーム % インジケータ UI**(画面隅に「125%」表示) — PRD で Could。MVP 成立に不要、Phase 7.7-4(チートシート)後に検討
- **ズームスライダー / ボタン UI** — キーボード + wheel で十分(Excalidraw も Modal 内ボタンのみ)
- **キーボード単体ズーム(Cmd+`+` / Cmd+`-`)** — Cmd+wheel / Cmd+0 / Cmd+1 で MVP 成立。push request あれば Phase 7.7-4 で追加
- **慣性スクロール / ズームアニメーション** — instant transform でシンプルに。Konva 標準の `Tween` も導入しない
- **回転** — `rotateEnabled={false}` を Stage では設定しない(Stage に transform を直接掛けるだけ、Transformer ではない)。注釈側の rotate は既に Phase 7.7-1 で禁止
- **ズーム / パンの Yjs 同期** — ローカル UI のみ。他クライアントが勝手にズームされると混乱。Excalidraw / Figma も同様
- **ズーム / パンの Undo/Redo 対象化** — UI 表示状態であって編集履歴ではない。COMMITTING_ACTIONS には含めない
- **トラックパッド 2 本指スクロール = パン**(modless wheel = pan の挙動) — Cmd+wheel = ズーム を最優先。modless wheel は無視(誤動作防止)。push request あれば Phase 7.7-4 で再考
- **画像座標系の再計算 / Layer 個別 scale** — PRD 確定: Stage 全体に transform、注釈座標は不変
- **fit 計算の `iw < vw && ih < vh` 時の特殊ケース** — `min(..., 1)` で吸収済(等倍維持)。追加分岐不要
- **モバイル(タッチ)向け pinch zoom 専用ハンドリング** — Konva の wheel/touch 統一で動く範囲のみ。タッチ専用ジェスチャ最適化は PRD で明示的にスコープ外

---

## Step-by-Step Tasks

### Task 1: 純関数 `computeFitTransform` / `clampScale` / `zoomAtPointer` / `clampPan` を新規ファイルで実装
- **ACTION**: `apps/web/src/hooks/useStageTransform.ts` を新規作成、まず純関数だけを export
- **IMPLEMENT**:
  ```typescript
  export type StageTransform = Readonly<{ scale: number; x: number; y: number }>;
  export type Size = Readonly<{ width: number; height: number }>;

  export const MIN_SCALE = 0.1;
  export const MAX_SCALE = 8;
  export const ZOOM_STEP = 1.1;
  // 余白: 画像の各辺に画像サイズの 50% ずつ → 仮想領域 = 画像 2 倍(PRD「200%」の解釈)
  export const PAN_MARGIN_RATIO = 0.5;

  export const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  export const computeFitTransform = (image: Size, viewport: Size): StageTransform => {
    const scale = Math.min(viewport.width / image.width, viewport.height / image.height, 1);
    return {
      scale,
      x: (viewport.width - image.width * scale) / 2,
      y: (viewport.height - image.height * scale) / 2,
    };
  };

  export const computeHundredPercentTransform = (image: Size, viewport: Size): StageTransform => ({
    scale: 1,
    x: (viewport.width - image.width) / 2,
    y: (viewport.height - image.height) / 2,
  });

  export const zoomAtPointer = (
    transform: StageTransform,
    pointer: { x: number; y: number },
    factor: number,
  ): StageTransform => {
    const newScale = clampScale(transform.scale * factor);
    if (newScale === transform.scale) return transform;
    const mousePointTo = {
      x: (pointer.x - transform.x) / transform.scale,
      y: (pointer.y - transform.y) / transform.scale,
    };
    return {
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
  };

  // 仮想領域の左上 / 右下 (logical 座標)
  const virtualBounds = (image: Size) => ({
    minX: -image.width * PAN_MARGIN_RATIO,
    minY: -image.height * PAN_MARGIN_RATIO,
    maxX: image.width * (1 + PAN_MARGIN_RATIO),
    maxY: image.height * (1 + PAN_MARGIN_RATIO),
  });

  export const clampPan = (
    transform: StageTransform,
    image: Size,
    viewport: Size,
  ): StageTransform => {
    const b = virtualBounds(image);
    // logical 座標 b の右端が画面 viewport.width を、左端が 0 を超えないよう制約
    // screen 上の virtual 範囲: [b.minX*scale + x, b.maxX*scale + x]
    const minScreenX = b.minX * transform.scale + transform.x;
    const maxScreenX = b.maxX * transform.scale + transform.x;
    const minScreenY = b.minY * transform.scale + transform.y;
    const maxScreenY = b.maxY * transform.scale + transform.y;
    let x = transform.x;
    let y = transform.y;
    // 仮想領域の右端が viewport の左端より左に行ってはいけない
    if (maxScreenX < viewport.width) x += viewport.width - maxScreenX;
    if (minScreenX > 0) x -= minScreenX;
    if (maxScreenY < viewport.height) y += viewport.height - maxScreenY;
    if (minScreenY > 0) y -= minScreenY;
    return { scale: transform.scale, x, y };
  };
  ```
- **MIRROR**: KONVA_WHEEL_ZOOM_AT_POINTER, PURE_GEOMETRY_TESTING
- **IMPORTS**: なし(pure function のみ)
- **GOTCHA**:
  - `min(..., 1)` の最後の 1 を忘れると小画像が拡大されて表示される
  - clampPan の符号は「画面に対して仮想領域がどっち向きにはみ出ているか」で決まる。テストで矩形ケースを 4 方向きっちりカバー
  - `MAX_SCALE = 8` は 5000×5000 でも 40000×40000 表示 = 必要十分。MIN_SCALE = 0.1 は 5000×5000 が 500×500 で見える(縮小プレビュー用)
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑

### Task 2: `useStageTransform` フック本体を実装
- **ACTION**: 同ファイル `apps/web/src/hooks/useStageTransform.ts` に React フックを追加
- **IMPLEMENT**:
  ```typescript
  import { useCallback, useEffect, useRef, useState } from 'react';

  export type UseStageTransform = Readonly<{
    transform: StageTransform;
    /** 画像が読み込まれた / 切り替わった瞬間に呼ぶ。null 渡しでリセット。*/
    setImageSize: (size: Size | null) => void;
    /** Cmd+0: viewport に fit。imageSize が null のときは no-op。*/
    fitToViewport: () => void;
    /** Cmd+1: 等倍。imageSize が null のときは no-op。*/
    setHundredPercent: () => void;
    /** Cmd+wheel / pinch: pointer 中心ズーム。*/
    zoomBy: (pointer: { x: number; y: number }, factor: number) => void;
    /** Space+drag: 直接的な position 加算(clampPan を内部で適用)。*/
    panBy: (dx: number, dy: number) => void;
  }>;

  const IDENTITY: StageTransform = { scale: 1, x: 0, y: 0 };

  export const useStageTransform = (viewport: Size): UseStageTransform => {
    const [transform, setTransform] = useState<StageTransform>(IDENTITY);
    const imageSizeRef = useRef<Size | null>(null);
    const viewportRef = useRef<Size>(viewport);
    viewportRef.current = viewport;

    const setImageSize = useCallback((size: Size | null) => {
      imageSizeRef.current = size;
      if (!size) {
        setTransform(IDENTITY);
        return;
      }
      // 画像セット時は自動 fit。これが Phase 7.7-3 の最大の UX 価値。
      setTransform(computeFitTransform(size, viewportRef.current));
    }, []);

    const fitToViewport = useCallback(() => {
      const img = imageSizeRef.current;
      if (!img) return;
      setTransform(computeFitTransform(img, viewportRef.current));
    }, []);

    const setHundredPercent = useCallback(() => {
      const img = imageSizeRef.current;
      if (!img) return;
      setTransform(computeHundredPercentTransform(img, viewportRef.current));
    }, []);

    const zoomBy = useCallback((pointer: { x: number; y: number }, factor: number) => {
      setTransform((prev) => {
        const img = imageSizeRef.current;
        const next = zoomAtPointer(prev, pointer, factor);
        return img ? clampPan(next, img, viewportRef.current) : next;
      });
    }, []);

    const panBy = useCallback((dx: number, dy: number) => {
      setTransform((prev) => {
        const img = imageSizeRef.current;
        const moved: StageTransform = { scale: prev.scale, x: prev.x + dx, y: prev.y + dy };
        return img ? clampPan(moved, img, viewportRef.current) : moved;
      });
    }, []);

    // viewport が変わったら fit を再計算(画像表示時のみ)。
    // これでブラウザリサイズ時に画像が画面外へ消えることを防ぐ。
    useEffect(() => {
      const img = imageSizeRef.current;
      if (!img) return;
      // ユーザーがズーム中なら維持したいが、初期実装は再 fit を選ぶ
      // (Excalidraw も同挙動)。push 受けたら Phase 7.7-4 で再考。
      setTransform(computeFitTransform(img, viewport));
    }, [viewport]);

    return { transform, setImageSize, fitToViewport, setHundredPercent, zoomBy, panBy };
  };
  ```
- **MIRROR**: CUSTOM_HOOK_RETURN_SHAPE
- **IMPORTS**: `useCallback`, `useEffect`, `useRef`, `useState` from 'react'
- **GOTCHA**:
  - `imageSizeRef` を ref にする理由: callback の identity を viewport / image 変化で再生成しないため(下流の memoization を壊さない)
  - viewport 再 fit を `useEffect` 内で `setTransform(computeFitTransform(...))` する際、 `imageSizeRef.current` ではなく `imageSize` を依存配列に入れたいが ref で保持しているので入れられない。**設計判断**: viewport 変化時のみ fit、imageSize 変化時は `setImageSize` 呼出側で fit が走る。これで二重 fit を回避
  - `setTransform` は `(prev) => ...` 形式で functional update を使うこと(React 18 batching で前回値が必要)
- **VALIDATE**: typecheck 緑

### Task 3: useStageTransform の純関数 unit test
- **ACTION**: `apps/web/src/hooks/__tests__/useStageTransform.test.ts` を新規作成
- **IMPLEMENT**:
  - `computeFitTransform`:
    - 大画像(5000×5000) on viewport (1000×800) → scale = 800/5000 = 0.16, 中央寄せ
    - 小画像(320×240) on viewport (1000×800) → scale = 1, x = (1000-320)/2 = 340, y = 280
    - 縦長画像(500×3000) on viewport (1000×800) → scale = 800/3000
  - `computeHundredPercentTransform`:
    - 任意画像で scale=1, 中央寄せ
  - `zoomAtPointer`:
    - 等倍 transform で pointer (100, 100), factor 2 → scale=2, pointer 位置不変(`100 - (100-0)/1*2 + ... = 100 - 200 = -100` のような確認)
    - factor で MIN/MAX を超えないこと(clampScale 動作確認)
    - `factor = 1` で transform 不変
  - `clampScale`: 0.05 → 0.1, 100 → 8
  - `clampPan`:
    - 大きく逸脱した position が virtual bounds 内に戻ること(4 方向)
    - 範囲内なら不変
- **MIRROR**: 既存の `apps/web/src/domain/annotation/__tests__/operations.test.ts` の AAA パターン
- **IMPORTS**:
  ```typescript
  import { describe, expect, it } from 'vitest';
  import {
    computeFitTransform, computeHundredPercentTransform,
    zoomAtPointer, clampScale, clampPan,
    MIN_SCALE, MAX_SCALE, PAN_MARGIN_RATIO,
  } from '../useStageTransform';
  ```
- **GOTCHA**:
  - 浮動小数演算は `toBeCloseTo` を使うか、明示的に `Math.fround` 不要(JS は IEEE 754 倍精度)
  - 比率計算は意図した式(`viewport.width / image.width`)で書き、テストもそれに揃える
- **VALIDATE**: `pnpm -F @snap-share/web test -- useStageTransform` 全緑

### Task 4: ImageLayer に onImageLoaded callback を追加
- **ACTION**: `apps/web/src/components/canvas/ImageLayer.tsx` を更新
- **IMPLEMENT**:
  ```typescript
  import { useEffect } from 'react';
  import { Image as KonvaImage, Layer } from 'react-konva';
  import useImage from 'use-image';

  type ImageLayerProps = Readonly<{
    src: string;
    /** Fired exactly once per src when the underlying HTMLImageElement reaches
     *  natural dimensions. Null is sent on src change to allow callers to reset
     *  derived state (transform). */
    onImageLoaded?: (size: { width: number; height: number } | null) => void;
  }>;

  export const ImageLayer = ({ src, onImageLoaded }: ImageLayerProps) => {
    const [image] = useImage(src, 'anonymous');
    useEffect(() => {
      // src 変更直後 image は undefined → null を通知してダウンストリームに reset させる
      onImageLoaded?.(null);
    }, [src, onImageLoaded]);
    useEffect(() => {
      if (!image) return;
      onImageLoaded?.({ width: image.naturalWidth, height: image.naturalHeight });
    }, [image, onImageLoaded]);
    return <Layer listening={false}>{image && <KonvaImage image={image} listening={false} />}</Layer>;
  };
  ```
- **MIRROR**: IMAGE_NATURAL_SIZE_PROBE
- **IMPORTS**: `useEffect` 追加
- **GOTCHA**:
  - `useImage` は内部で `<img>` を作って onload で setState する → 初回 image=undefined → image=HTMLImageElement の 2 段階で再 render
  - `onImageLoaded` の identity が毎 render 変わると無限ループ。EditorShell 側で `useCallback` 安定化必須
  - src 変更 → `null` 通知の useEffect が image.useEffect より先に走る順序を保証する(2 つの useEffect は宣言順に動く)
- **VALIDATE**: typecheck 緑

### Task 5: ImageLayer のテストに onImageLoaded ケースを追加
- **ACTION**: `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` を更新
- **IMPLEMENT**:
  - 既存テスト維持
  - 新規ケース 1: "src 変更時に null を通知する"
  - 新規ケース 2: "image 取得時に {naturalWidth, naturalHeight} を通知する"
    - `useImageMock.mockReturnValue([{ naturalWidth: 1920, naturalHeight: 1080 } as HTMLImageElement, 'loaded'])`
    - `onImageLoaded` mock に `{ width: 1920, height: 1080 }` で呼ばれること
- **MIRROR**: 既存 `ImageLayer.test.tsx` の構造
- **IMPORTS**: `vi.fn` 追加
- **GOTCHA**:
  - `useImageMock.mockReturnValue` の戻り値型は `[HTMLImageElement | undefined, string]` だが `as HTMLImageElement` でキャスト OK
  - `act` 内で `mockReturnValue` を変更 → `root.render(<ImageLayer .../>)` 再実行で useEffect が動く
- **VALIDATE**: `pnpm -F @snap-share/web test -- ImageLayer` 緑

### Task 6: useKeyboardShortcuts に Cmd+0 / Cmd+1 を追加
- **ACTION**: `apps/web/src/hooks/useKeyboardShortcuts.ts` を更新
- **IMPLEMENT**:
  - props に追加:
    ```typescript
    onFitToViewport?: () => void;   // Cmd+0
    onSetHundredPercent?: () => void; // Cmd+1
    ```
  - onKey 内のショートカット判定に追加(mod チェック内、`s` 判定の後など順序は問わない):
    ```typescript
    if (mod && key === '0' && !e.shiftKey) {
      const cb = ref.current.onFitToViewport;
      if (cb) { e.preventDefault(); cb(); }
      return;
    }
    if (mod && key === '1' && !e.shiftKey) {
      const cb = ref.current.onSetHundredPercent;
      if (cb) { e.preventDefault(); cb(); }
      return;
    }
    ```
  - undefined のときは preventDefault も呼ばない(ブラウザの Cmd+0 = リセットズーム / Cmd+1 = タブ切替を奪わない)
- **MIRROR**: KEYBOARD_SHORTCUT_REGISTRATION
- **IMPORTS**: 変更なし
- **GOTCHA**:
  - Cmd+1 は Chrome / Firefox で「タブ 1 へ移動」のショートカット。preventDefault しないとタブが飛ぶ
  - Cmd+0 は Chrome で「ページのズームをリセット」。preventDefault でアプリ側を優先
  - 数字キー判定で `key === '0'` を使う(`e.code === 'Digit0'` ではなく、JIS / US 共通の `e.key`)
- **VALIDATE**: typecheck 緑、`pnpm -F @snap-share/web test -- useKeyboardShortcuts` (もし既存テストあれば) 緑

### Task 7: CanvasStage に Stage transform 適用と Space+drag pan / wheel zoom を追加
- **ACTION**: `apps/web/src/components/canvas/CanvasStage.tsx` を更新
- **IMPLEMENT**:
  - props に追加:
    ```typescript
    transform: { scale: number; x: number; y: number };
    onZoom: (pointer: { x: number; y: number }, factor: number) => void;
    onPan: (dx: number, dy: number) => void;
    ```
  - Stage に渡す:
    ```tsx
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={transform.scale}
      scaleY={transform.scale}
      x={transform.x}
      y={transform.y}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
    ```
  - **すべての `getPointerPosition()` を `getRelativePointerPosition()` に置換**(handleMouseDown / handleMouseMove / handleMouseUp の 3 箇所)。現コード上は `getPointerPosition()` だけを使っており、Phase 7.7-1 の resize 系は Konva 側 (Transformer) が transform を吸収するので変更不要
  - Space キー press 状態の管理:
    ```typescript
    const spaceDownRef = useRef(false);
    const panActiveRef = useRef(false);
    const panLastRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !isEditableTarget(e.target)) {
          spaceDownRef.current = true;
          // カーソル更新は CSS ホバーで対応 → containerRef に grab class を付ける
          // (実装は className state で管理)
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          spaceDownRef.current = false;
          panActiveRef.current = false;
          panLastRef.current = null;
        }
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }, []);
    ```
  - handleMouseDown の冒頭で:
    ```typescript
    if (spaceDownRef.current) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition() ?? null;
      if (!pos) return;
      panActiveRef.current = true;
      panLastRef.current = pos;
      return; // 既存の描画フローに進ませない
    }
    ```
  - handleMouseMove の冒頭で:
    ```typescript
    if (panActiveRef.current) {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition() ?? null;
      const last = panLastRef.current;
      if (!pos || !last) return;
      onPan(pos.x - last.x, pos.y - last.y);
      panLastRef.current = pos;
      return;
    }
    ```
  - handleMouseUp の冒頭で:
    ```typescript
    if (panActiveRef.current) {
      panActiveRef.current = false;
      panLastRef.current = null;
      return;
    }
    ```
  - 新規 handleWheel:
    ```typescript
    const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
      const isZoomGesture = e.evt.ctrlKey || e.evt.metaKey;
      if (!isZoomGesture) return; // 通常スクロール無視(modless wheel = pan は本フェーズ外)
      e.evt.preventDefault();
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const factor = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      onZoom(pointer, factor);
    }, [onZoom]);
    ```
  - **isEditableTarget は useKeyboardShortcuts.ts から export して再利用**(2 箇所同じガード)
- **MIRROR**: KONVA_WHEEL_ZOOM_AT_POINTER, KONVA_GET_RELATIVE_POINTER, KEYBOARD_SHORTCUT_REGISTRATION
- **IMPORTS**:
  ```typescript
  import { useCallback, useEffect, useRef, useState } from 'react';
  import { ZOOM_STEP } from '../../hooks/useStageTransform';
  import { isEditableTarget } from '../../hooks/useKeyboardShortcuts'; // export 追加
  ```
- **GOTCHA**:
  - cursor フィードバック (grab/grabbing) は CanvasStage の親コンテナ div に CSS で当てるのが綺麗。Stage 自体の className は react-konva では限定的。EditorShell 側の stageContainerRef div の className を `space-down` 状態で切り替えるか、Stage の `container().style.cursor` を直接書き換える(後者は Konva 公式パターン)
  - **採用**: `useEffect` 内で `stageRef.current?.container().style.cursor` を直接書き換え。これが Konva idiom
  - `Space` キー判定は `e.code === 'Space'`(`e.key === ' '` だと OS 差異が出るリスク)
  - panActive 中は `isStageClick` 判定や `selectedId` 解除をスキップする(冒頭 return)
  - getRelativePointerPosition は Stage transform 適用後の pos を返す → draft / dragStart に直接保存して OK
  - 既存テスト `CanvasStage` をモックする呼び出し元(EditorShell 等)は無いはずだが、もし RoomEditor 経路の E2E が壊れたら原因はここ
- **VALIDATE**:
  - typecheck 緑
  - `pnpm -F @snap-share/web test` 既存テスト regression 0
  - 既存 E2E `pnpm -F @snap-share/web test:e2e -- annotation-tools annotation-resize keyboard-shortcuts` 全緑

### Task 8: TextEditorOverlay の位置・fontSize に transform を反映
- **ACTION**: `apps/web/src/components/canvas/TextEditorOverlay.tsx` を更新
- **IMPLEMENT**:
  - props に追加:
    ```typescript
    transform: { scale: number; x: number; y: number };
    ```
  - style 計算を変更:
    ```typescript
    style={{
      position: 'absolute',
      left: stageContainerRect.left + annotation.x * transform.scale + transform.x - PADDING,
      top: stageContainerRect.top + annotation.y * transform.scale + transform.y - PADDING,
      minWidth: '6ch',
      padding: PADDING,
      margin: 0,
      border: `1px dashed ${OUTLINE_ACCENT}`,
      background: 'rgba(255, 255, 255, 0.95)',
      color: annotation.color,
      fontSize: annotation.fontSize * transform.scale,
      fontFamily: 'inherit',
      lineHeight: 1.2,
      resize: 'both',
      outline: 'none',
      zIndex: 100,
    }}
    ```
- **MIRROR**: 既存の TextEditorOverlay 構造
- **IMPORTS**: 変更なし
- **GOTCHA**:
  - PADDING は scale 適用しない(画面実 px の余白として残す)
  - resize: 'both' で textarea サイズを変えるとユーザー入力幅が崩れるが、Phase 7.7 スコープ外(将来 fontSize UI 検討と一緒に再考)
  - scale=0.16 等で fontSize が小さくなりすぎて読めない場合の救済(min fontSize)は本フェーズでは入れない。ズームアウト中にテキスト編集する想定が薄いため
- **VALIDATE**: typecheck 緑

### Task 9: EditorShell に useStageTransform を統合
- **ACTION**: `apps/web/src/pages/EditorShell.tsx` を更新
- **IMPLEMENT**:
  - import:
    ```typescript
    import { useStageTransform } from '../hooks/useStageTransform';
    ```
  - フック呼び出し:
    ```typescript
    const stageHeight = Math.max(stageSize.height - headerHeight, MIN_STAGE_HEIGHT);
    const transform = useStageTransform({ width: stageSize.width, height: stageHeight });
    ```
  - ImageLayer に渡す onImageLoaded callback(stable):
    ```typescript
    const handleImageLoaded = useCallback(
      (size: { width: number; height: number } | null) => {
        transform.setImageSize(size);
      },
      [transform.setImageSize],
    );
    ```
    ※ `transform.setImageSize` は useCallback で stable なので OK
  - CanvasStage は ImageLayer を内部で render するため、handleImageLoaded を **ImageLayer に直接** 渡す経路を通したい → CanvasStage の props に `onImageLoaded` を足し、CanvasStage 内で `<ImageLayer src={src} onImageLoaded={onImageLoaded} />` のように透過
  - CanvasStage に `transform`, `onZoom = transform.zoomBy`, `onPan = transform.panBy`, `onImageLoaded = handleImageLoaded` を渡す
  - useKeyboardShortcuts に追加:
    ```typescript
    onFitToViewport: source ? transform.fitToViewport : undefined,
    onSetHundredPercent: source ? transform.setHundredPercent : undefined,
    ```
    (画像未ロード時はブラウザのデフォルト Cmd+0 / Cmd+1 を奪わない)
  - handleClearImage で transform もリセット:
    ```typescript
    const handleClearImage = useCallback(() => {
      transform.setImageSize(null);
      onClearImage();
      setEditingTextId(null);
    }, [onClearImage, transform.setImageSize]);
    ```
  - TextEditorOverlay に transform を渡す:
    ```tsx
    <TextEditorOverlay
      annotation={editingAnnotation}
      stageContainerRect={stageRect}
      transform={transform.transform}
      onCommit={handleTextCommit}
      onCancel={handleTextCancel}
    />
    ```
  - **export 経路の修正は Task 10**(useExportPng と exportPng.ts に集約)
- **MIRROR**: 既存の EditorShell の hook 統合パターン
- **IMPORTS**: 上記
- **GOTCHA**:
  - useStageTransform を呼ぶ位置(stageHeight 算出後)に注意。順序が逆だと viewport が古い値になる
  - source 変化 → ImageLayer の src 変化 → onImageLoaded(null) → 再 setImageSize(new size) という流れ。null 経由で transform が IDENTITY に戻るため、画像差し替え時に古い transform が残らない
  - `transform.transform` は object で毎 render 新 reference → TextEditorOverlay の memo 化していなければ問題なし(現状 React.memo していない)
  - LocalEditor / RoomEditor の handleClear は onClearImage callback。EditorShell の handleClearImage で transform reset を入れれば両 mode で動く
- **VALIDATE**: typecheck 緑、`pnpm -F @snap-share/web test -- EditorShell` (もし既存テストあれば) 緑、なければ Task 11 の E2E に委ねる

### Task 10: PNG エクスポートに transform 補正を入れる
- **ACTION**: 2 ファイル更新
  - `apps/web/src/lib/exportPng.ts`
  - `apps/web/src/hooks/useExportPng.ts`
- **IMPLEMENT**:
  - `exportPng.ts` の `stageToBlob` を拡張:
    ```typescript
    export type StageBounds = Readonly<{ x: number; y: number; width: number; height: number }>;

    export const stageToBlob = async (
      stage: Konva.Stage,
      pixelRatio = 2,
      bounds?: StageBounds,
    ): Promise<Blob> => {
      const canvas = bounds
        ? stage.toCanvas({ ...bounds, pixelRatio })
        : stage.toCanvas({ pixelRatio });
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
          'image/png',
        );
      });
    };
    ```
  - `useExportPng.ts` を拡張:
    ```typescript
    export type UseExportPngParams = Readonly<{
      stageRef: RefObject<Konva.Stage | null>;
      awarenessLayerRef?: RefObject<Konva.Layer | null>;
      roomId: string | null;
      pixelRatio?: number;
      /** 画像サイズ(natural)。指定時はその範囲だけを toCanvas で切り出す。
       *  null のときは Stage 全体(従来挙動・後方互換)。*/
      imageSize?: { width: number; height: number } | null;
    }>;
    ```
    - 内部で transform 一時リセット → `stage.toCanvas({ x: 0, y: 0, width, height, pixelRatio })` → restore:
    ```typescript
    return useCallback(async () => {
      const stage = stageRef.current;
      if (!stage) return;
      const awareness = awarenessLayerRef?.current ?? null;

      // Save & reset transform so the export captures the image at native
      // resolution regardless of the user's current zoom / pan.
      const savedScaleX = stage.scaleX();
      const savedScaleY = stage.scaleY();
      const savedX = stage.x();
      const savedY = stage.y();

      let hidden = false;
      try {
        awareness?.hide();
        hidden = true;
        if (imageSize) {
          stage.scaleX(1); stage.scaleY(1); stage.x(0); stage.y(0);
        }
        const bounds = imageSize
          ? { x: 0, y: 0, width: imageSize.width, height: imageSize.height }
          : undefined;
        const blob = await stageToBlob(stage, pixelRatio, bounds);
        triggerDownload(blob, buildExportFilename(new Date(), roomId));
        toast.success('PNG を保存しました');
      } catch (e: unknown) { /* ... */ }
      finally {
        if (imageSize) {
          stage.scaleX(savedScaleX); stage.scaleY(savedScaleY);
          stage.x(savedX); stage.y(savedY);
          stage.batchDraw();
        }
        if (hidden) awareness?.show();
      }
    }, [stageRef, awarenessLayerRef, roomId, pixelRatio, imageSize]);
    ```
  - EditorShell の useExportPng 呼出に `imageSize` を渡す:
    ```typescript
    // EditorShell 内
    const [imageNaturalSize, setImageNaturalSize] = useState<{width:number; height:number} | null>(null);
    // handleImageLoaded 内で setImageNaturalSize も同期
    const exportPng = useExportPng({ stageRef, awarenessLayerRef, roomId, imageSize: imageNaturalSize });
    ```
    あるいは useStageTransform から imageSize を expose する選択肢もある(プライベート ref を露出するため、別 state で管理する方が分離が綺麗)
- **MIRROR**: 既存の useExportPng try/finally 構造
- **IMPORTS**: 上記
- **GOTCHA**:
  - `stage.toCanvas` は同期メソッド。transform 変更が即座に反映されるか不安だが、Konva は scaleX/scaleY/x/y の setter で内部 transform を更新し、`toCanvas` 呼出時にそれを使う(検証済の Konva v9 動作)
  - awareness.hide() のあとに `stage.batchDraw()` を入れないと hide が反映されない場合がある → finally で `batchDraw()` 必須(awareness 部分も)
  - `imageSize` が null でも壊れない(従来と完全同一 = Stage 全体 toCanvas)
  - 既存 E2E `room-export-receiver.spec.ts` / `keyboard-shortcuts.spec.ts` の Cmd+S テストは引き続き download が走ることを検証 → bounds 指定でも download 自体は成立、regression なし
- **VALIDATE**:
  - typecheck 緑
  - `pnpm -F @snap-share/web test:e2e -- keyboard-shortcuts room-export-receiver` 既存 export E2E が緑

### Task 11: E2E `zoom-pan.spec.ts` を新規作成
- **ACTION**: `apps/web/e2e/zoom-pan.spec.ts` を新規作成
- **IMPLEMENT**:
  - window に transform を expose する仕組みが無いため、EditorShell に debug-only で `window.__SNAP_SHARE_STAGE_TRANSFORM__ = transform.transform` を書く useEffect を入れる(既存 `__SNAP_SHARE_ANNOTATIONS__` パターンに揃える)
    ```typescript
    // EditorShell 内
    useEffect(() => {
      (window as unknown as Record<string, unknown>).__SNAP_SHARE_STAGE_TRANSFORM__ =
        transform.transform;
    }, [transform.transform]);
    ```
    本番でも害がない(別ロジックから読まれない)し、外部に公開もされない。Phase 7.6 と同方針
  - テストケース:
    - "画像投入直後に viewport に fit している(scale ≤ 1, 画像中央寄せ)" — `dropImage` → `await page.waitForFunction(...)` で transform オブジェクト到着を待つ → scale が `Math.min(vw/iw, vh/ih, 1)` ± 浮動小数誤差で一致
    - "Cmd+1 で scale = 1 になる" — キー押下 → poll で scale === 1
    - "Cmd+0 で初期 fit に戻る" — 一度 Cmd+1 → Cmd+0 → fit transform が再現
    - "Cmd+wheel zoom in で scale が増加" — `page.mouse.wheel(0, -100)` を `page.keyboard.down('Meta'/'Control')` 中に発火 → scale > 元の scale
    - "Space + drag で position が変わる" — Space keydown → mouse down → mouse move → mouse up → Space keyup → transform.x が変化、scale 不変
    - "input フォーカス中は Space pan が無効"(Phase 7.6 の isEditableTarget ガードと同じ精神 — テキスト編集中に Space で空白が打てる)
- **MIRROR**: TEST_STRUCTURE_E2E
- **IMPORTS**:
  ```typescript
  import { expect, test } from '@playwright/test';
  import { dropImage } from './fixtures/upload';
  ```
- **GOTCHA**:
  - `page.mouse.wheel` は `wheel` イベントを発火するが `evt.ctrlKey` のセットには `keyboard.down('Control')` を併用する必要あり
  - macOS の Cmd+wheel は Playwright 上で `keyboard.down('Meta')` でシミュレート可能
  - `process.platform === 'darwin'` で modifier を分岐(既存 keyboard-shortcuts.spec.ts と同じ)
  - Space pan で input フォーカス中の挙動は CanvasStage 内 keydown ハンドラの `isEditableTarget` ガードでカバー
  - `dropImage` は固定の小画像(typically 320×240 程度)を投入する → 大画像 fit のテストには別 fixture が必要かも → 現実装では「scale=1 で中央寄せ」が確認できれば fit 経路自体は同じコードパスなので OK。大画像テストは Phase 7.7-4 の全体回帰で
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- zoom-pan` 緑、既存 E2E 全部 regression 0

### Task 12: lint / format / 全体回帰
- **ACTION**: 品質ゲート
- **IMPLEMENT**:
  - `pnpm typecheck` 全緑
  - `pnpm lint`(biome ci)クリーン
  - `pnpm test` 全緑(reducer / shape / ImageLayer / useStageTransform 全部)
  - `pnpm test:e2e` 全緑(zoom-pan / annotation-resize / annotation-color / annotation-tools / keyboard-shortcuts / room-* 全部)
  - `pnpm build` 緑(vite + wrangler dry-run)
  - PRD の Phase 3 status を `pending` → `complete` に更新、plan / report リンク追加
- **VALIDATE**: 全コマンド exit 0

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| computeFitTransform: 大画像 | image 5000×5000, viewport 1000×800 | scale=0.16, x=100, y=0 | viewport 縦横比に合致 |
| computeFitTransform: 小画像 | image 320×240, viewport 1000×800 | scale=1, x=340, y=280 | min(...,1) で 1 に維持 |
| computeFitTransform: 縦長 | image 500×3000, viewport 1000×800 | scale=800/3000, 中央寄せ | 縦が制約 |
| computeFitTransform: ぴったり | image 1000×800, viewport 1000×800 | scale=1, x=0, y=0 | 余白 0 |
| computeHundredPercentTransform | image 1920×1080, viewport 1000×800 | scale=1, x=-460, y=-140 | 画像が viewport より大きいケース |
| zoomAtPointer: 中央 | transform=IDENTITY, pointer={500,400}, factor=2 | scale=2, pointer 位置不変 | pivot 計算 |
| zoomAtPointer: clampScale 上限 | scale=8, factor=2 | scale=8(変化なし)、transform 戻り値が ===prev | reference equality |
| zoomAtPointer: clampScale 下限 | scale=0.1, factor=0.5 | scale=0.1(変化なし) | 同上 |
| clampScale | 0.05 / 100 / 1 / 0 / Infinity | 0.1 / 8 / 1 / 0.1 / 8 | 異常値 |
| clampPan: 画像が左に逃げた | transform={scale:1, x:-2000, y:0}, image 1000×800, vw 800×600 | x が virtual 右端を vw 内に戻す値 | 4 方向 |
| useKeyboardShortcuts: Cmd+0 | 押下 | onFitToViewport 呼ばれる、preventDefault 呼ばれる | mod 必須 |
| useKeyboardShortcuts: Cmd+1 | 押下 | onSetHundredPercent 呼ばれる、preventDefault 呼ばれる | 同上 |
| ImageLayer: src 変化 | src を 'a' → 'b' | onImageLoaded(null) が呼ばれる | reset 経路 |
| ImageLayer: image arrival | useImage が naturalWidth=1920, height=1080 を返す | onImageLoaded({width:1920, height:1080}) | 通常経路 |

### Edge Cases Checklist
- [x] 画像 0×0(壊れた画像) → fit で scale=Infinity → clampScale で 8 に丸まる(誤検知だが破綻はしない)
- [x] viewport が 0 width(モバイル横画面切替直後) → useStageTransform 内では scale 計算が 0 になる → clampScale で MIN_SCALE
- [x] Space を input にフォーカス中に押す → CanvasStage の `isEditableTarget(e.target)` で無視
- [x] Space 押下中に他のキー(R / V 等) → useKeyboardShortcuts は通常通り動く(独立)
- [x] Cmd+wheel を画像未ロード時に → onZoom callback は呼ばれるが imageSize が null なら clampPan が走らないだけで scale は変わる(無害)。ただし「ロード前にズームしてもユーザーへの利益がない」ので CanvasStage 内で imageSize ガードをすべきかは判断:
  - **採用**: ガード入れない。空白 Stage に transform を掛けるのは無害かつ debug にも便利
- [x] export 中の transform リセット → finally で必ず復元、例外時も transform 維持
- [x] StrictMode 二重 useEffect → onImageLoaded は同一 src で複数回 fire しても idempotent(setTransform は同値で実質 no-op)
- [x] 画像差し替え(LocalEditor で別画像をドロップ) → ImageLayer の src 変化 → null 通知 → 新画像 size 通知 → 自動 fit
- [x] handleClearImage 後に再ドロップ → setImageSize(null) → IDENTITY → 新画像 fit、引きずりなし
- [ ] Yjs 同期(別ブラウザで同じルームを開く) → transform はローカルのみで Yjs に乗せない設計のため、相手のズームに影響されないことを E2E で確認(本フェーズでは入れない、Phase 7.7-4 の全体回帰で)

---

## Validation Commands

### Static Analysis
```sh
pnpm -F @snap-share/web typecheck
pnpm -F @snap-share/shared typecheck
```
EXPECT: Zero type errors

### Lint
```sh
pnpm lint
```
EXPECT: Biome クリーン

### Unit Tests (該当領域)
```sh
pnpm -F @snap-share/web test -- src/hooks/__tests__/useStageTransform.test.ts
pnpm -F @snap-share/web test -- src/components/canvas/__tests__/ImageLayer.test.tsx
pnpm -F @snap-share/web test -- src/hooks/__tests__/useKeyboardShortcuts.test.ts # 既存があれば
```
EXPECT: 全緑

### Full Test Suite
```sh
pnpm test
```
EXPECT: 既存テスト regression なし

### E2E
```sh
pnpm -F @snap-share/web test:e2e -- zoom-pan
pnpm -F @snap-share/web test:e2e -- annotation-tools annotation-resize annotation-color keyboard-shortcuts room-export-receiver
```
EXPECT: 全緑

### Build
```sh
pnpm build
```
EXPECT: vite build (web) + wrangler dry-run (api) 両方成功

### Manual Validation (dev server)
- [ ] `pnpm dev` → http://localhost:5173
- [ ] 320×240 / 1920×1080 / 5000×5000 各画像を順に投入 → 全て viewport にフィット表示される
- [ ] Cmd+0 / Cmd+1 でフィット ↔ 等倍が切り替わる
- [ ] Cmd+wheel(マウス)/ pinch(トラックパッド)でカーソル位置中心ズーム
- [ ] Space + drag で一時パン、Space release で元のツールに戻る
- [ ] ズーム中に矩形を描く → 描いた位置が論理座標で正しい(zoom out しても同じ位置に残る)
- [ ] Phase 7.7-1 のリサイズハンドルがズーム後も追従する(Konva Transformer は Stage transform を吸収)
- [ ] テキスト編集 textarea がズーム / パンに追従し、fontSize も比例してスケール
- [ ] PNG エクスポート → ズーム状態に関わらず元画像解像度の PNG が出る、画像範囲外の余白は含まれない
- [ ] 画像クリア → 別画像投入 → 新しい fit で表示
- [ ] 別ブラウザで同ルームを開いてもズーム状態は独立(同期されない)

---

## Acceptance Criteria
- [ ] Task 1-12 完了
- [ ] 全 validation コマンド緑
- [ ] 5000×5000 / 1920×1080 / 320×240 全画像で初期表示が viewport 内
- [ ] Cmd+0 / Cmd+1 / Cmd+wheel(+pinch)/ Space+drag が動作
- [ ] 既存の注釈描画 / 移動 / リサイズ / 色変更 が壊れていない
- [ ] PNG エクスポートがズーム状態によらず元解像度を出す
- [ ] PRD の Phase 3 status を `pending` → `complete` に更新

## Completion Checklist
- [ ] コードが Patterns to Mirror に準拠
- [ ] エラーハンドリング:画像未ロード時の Cmd+0/1 は no-op、export は try/finally で transform 必ず復元
- [ ] ロギング:transform 操作はログ吐かない(ノイズ過大)
- [ ] テストが PURE_GEOMETRY_TESTING / TEST_STRUCTURE_E2E パターン準拠
- [ ] ハードコード値: `MIN_SCALE`, `MAX_SCALE`, `ZOOM_STEP`, `PAN_MARGIN_RATIO` は全て定数化
- [ ] CLAUDE.md ルール順守:
  - [ ] ルール 1:スキーマ変更なし(transform は state に閉じる)
  - [ ] ルール 2:単一 useReducer のままで、transform は別 useState(混ぜない)
  - [ ] ルール 3:dragStart / draft の useRef 維持(Phase 7.7-1 で確立)
  - [ ] ルール 4:Konva 色定数(変更なし、transform は色と無関係)
  - [ ] ルール 5:ImageLayer の `listening={false}` 維持
  - [ ] ルール 8:Yjs mutation は本フェーズでは触らない
- [ ] 不要なスコープ追加なし(ズーム % 表示 / モバイル touch / inertia は明示的に除外)
- [ ] Self-contained — 実装中に追加調査不要

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Konva の getRelativePointerPosition が draft 描画でずれる | M | H | Task 11 の E2E でズーム中の矩形描画位置を実機検証。ずれたら getAbsoluteTransform().copy().invert().point(pointer) パターンに切替 |
| toCanvas の transform リセット → restore で 1 フレームだけ画像位置がジャンプする | L | L | useExportPng は同期 → 1 frame でも視覚的に検出できない。問題発生時のみ Konva の `caching` で対応 |
| trackpad pinch zoom が macOS 以外で動かない | M | L | macOS 主用途。Windows / Linux は Cmd+wheel 経路で代替できる(同じ判定 ctrlKey/metaKey) |
| Cmd+0 / Cmd+1 がブラウザショートカットを奪うことへの違和感 | L | L | preventDefault は画像ロード時のみ → ロード前は通常のブラウザ挙動 |
| Stage transform 適用後に Phase 7.7-1 の resize ハンドルが論理座標を返さない | M | M | Konva Transformer は Stage transform を吸収する設計。E2E で「ズーム後にハンドルドラッグして reducer に正しい論理 width が入る」ことを確認 |
| TextEditorOverlay の HTML textarea が DOM レイヤなため transform 反映後にカーソル位置がずれる | M | M | Task 8 で left/top/fontSize を式変換。E2E は dropImage 後にズーム → テキスト編集 → 文字が見える、で minimal 検証 |
| Phase 7.7-4(チートシート)で `?` キー追加時に Space と被る | L | L | `?` は Shift+/ で Space と独立。被らない |
| handleClearImage で transform reset を入れても LocalEditor / RoomEditor の clear 経路が両方通るか | L | M | EditorShell の handleClearImage に集約しているので両 mode で確実に通る。E2E `room-clear-image.spec.ts` を回して確認 |

## Notes
- **Stage 全体 transform 方針が最大の単純化**: 注釈座標 / Yjs / reducer / awareness / Phase 7.7-1 の Transformer / Phase 7.7-2 の color UI が一切無変更で済む。これは PRD のユーザー指示「canvas ごと倍率かけちゃえばいい」が技術的に最も的確だった
- **transform を Yjs に乗せない判断**: Excalidraw / Figma / Photoshop すべてローカルのみ。他人のズームに巻き込まれないのが業界収束。Phase 7.7-4 で「相手の view に追従する presence」を Could として再考できるが本フェーズ外
- **export 修正は必須セット**: Stage transform 導入と同時に export を直さないと、ズームすると export PNG が低解像度になる致命バグが発生する。Task 10 を必ず本 plan 内で完結させる
- **次フェーズ Phase 7.7-4(チートシート)との依存**: 本フェーズで増えるショートカット(Cmd+0 / Cmd+1 / Space+drag / Cmd+wheel)を `?` モーダルに記載する必要あり。Phase 7.7-4 の plan 起こし時にこの plan / 完了 report を Mandatory Reading に入れる
- **PAN_MARGIN_RATIO = 0.5 の解釈**: PRD の「画像サイズの 200%」を「画像サイズに対し各辺 50% ずつ余白(合計エリア 2 倍)」と解釈。「画像サイズの 200% = 画像の 4 倍領域」とも読めるが、PRD 補足「迷子防止のため過大領域は避ける」から控えめ側を採用。実装後の dogfood で push あれば 1.0(各辺 100% = 合計 3 倍)に拡張可能(定数 1 個変更)

---
*Generated: 2026-05-03*
*Status: ready-to-implement*
