# Plan: Phase 10.I-2 — 2-finger pinch / pan + ヒットエリア拡大

## Summary

Konva 公式 multi-touch sample に準拠して `<Stage onTouchMove>` で 2-finger pinch zoom + 2-finger pan を実装する (`Konva.hitOnDragEnabled = true` を bootstrap で有効化)。Phase 10.I-1 の Pointer Events 経路は single-pointer 用に維持し、2 本指検知時は Pointer 側の drag / pan 状態を中断して TouchEvent 経路へ譲る並列共存設計を採る。並行して、selection handle / Transformer anchor / 細線 stroke のヒットエリアを `window.matchMedia('(pointer: coarse)')` 判定で adaptive 化し、touch device では iOS HIG 44pt / Material 48dp 相当に拡大、PC では従来サイズ維持でデスクトップ非劣化を担保する。

## User Story

As **a snap-share mobile user (iPhone Safari / Android Chrome)**, I want **2 本指でピンチズーム / パンができ、selection handle や細い矢印を指で確実に掴める**, so that **キャンバス操作と図形編集をスマホでもストレスなく完遂できる**.

## Problem → Solution

**Current state (10.I-1 完了時点)**:
- single-finger drag で矩形/矢印/ハイライト/テキスト描画は復旧済 (Pointer Events 一本化)
- だが **2 本指 = ブラウザ側の native gesture が `touch-action: none` で抑止されているだけ** で、アプリ側で何も拾わない無反応状態
- selection handle (Konva Circle radius 6) や Arrow / Highlight stroke (2px) が指で掴めない
- Transformer の anchor (default 10px) も指サイズに不足

**Desired state**:
- 2 本指で pinch zoom (画面中点を軸に scale) + 同時 pan (中点移動分だけ Stage 移動) が動作
- single-finger 描画/移動/Space+drag は劣化なし
- touch 環境では: ArrowShape handle Circle radius 12 / Transformer anchorSize 24 / Arrow + Highlight に hitStrokeWidth: 20 を付与 → 指で確実に掴める
- desktop 環境では: 従来 (radius 6 / anchorSize 10 / hitStrokeWidth なし) を維持

## Metadata

- **Complexity**: Medium (10 ファイル、推定 350〜500 行差分 + 新規 hook + 新規 test)
- **Source PRD**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`
- **PRD Phase**: 10.I-2 (2-finger pinch / pan + ヒットエリア拡大)
- **Estimated Files**: 10 (CanvasStage / useStageTransform 関連 + main.tsx / 3 shapes / colors.ts / 新規 useTouchDevice hook + test / Playwright smoke / PRD 更新)

---

## UX Design

### Before (10.I-1 完了時点)

```
┌───────────────────────────────┐
│ [iPhone Safari]               │
│  ┌─────────────────────────┐  │
│  │ Toolbar (top — 10.I-3)  │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ 画像                      │  │
│  │  1 本指 drag → ✓描画/移動│  │
│  │  2 本指 pinch  → ✗無反応 │  │
│  │  細い矢印 tap  → ✗外す   │  │
│  │  ハンドル tap  → △難しい │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

### After (10.I-2 完了時点)

```
┌───────────────────────────────┐
│ [iPhone Safari]               │
│  ┌─────────────────────────┐  │
│  │ Toolbar (top — 10.I-3 で│  │
│  │   bottom 化予定)          │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ 画像                      │  │
│  │  1 本指 drag → ✓描画/移動│  │
│  │  2 本指 pinch  → ✓zoom   │  │
│  │  2 本指 swipe  → ✓pan    │  │
│  │  細い矢印 tap  → ✓確実   │  │
│  │  ハンドル tap  → ✓確実   │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 2-finger pinch | 無反応 | scale が中点固定で zoom in/out | scale 範囲は既存 `MIN_SCALE=0.1` / `MAX_SCALE=8` を流用 |
| 2-finger swipe | 無反応 | 中点移動分だけ pan (`clampPan` 適用) | Wheel pan と同じ clamp logic |
| 1-finger 描画 / drag / Space+pan | 動作 | 動作 (非劣化) | 2 本指検知瞬間に in-flight state は中断 |
| ArrowShape endpoint handle (touch) | radius 6 で掴みにくい | **radius 12** (visual) + Konva 内部 hit area で約 24px hit | `pointer: coarse` 判定 |
| ArrowShape endpoint handle (mouse) | radius 6 維持 | **radius 6 維持** (非劣化) | `pointer: fine` |
| Rectangle/Highlight 編集 anchor (touch) | default 10px | **24px** | Konva Transformer `anchorSize` |
| Rectangle/Highlight 編集 anchor (mouse) | 10px | **10px 維持** (非劣化) | |
| Arrow body 細線 tap (touch) | strokeWidth=2 で hit 困難 | **`hitStrokeWidth: 20`** で約 20px の hit zone | desktop でも害はないので両環境に適用 |
| Highlight 矩形面 tap | 元から面で広い | 変更なし | 必要なら `hitStrokeWidth` を Transformer の枠線にだけ追加 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/src/components/canvas/CanvasStage.tsx` | 117-538 全体 | Pointer 経路と並列で TouchEvent 経路を追加する。dragStartRef / panActiveRef / draftRef の状態を 2-finger 検知時に中断する箇所を理解 |
| **P0** | `apps/web/src/hooks/useStageTransform.ts` | 全体 (155 行) | `zoomBy` / `panBy` の既存 callback を multi-touch から呼ぶ。**新規 callback `setTransformDirect(transform)` を追加** して pinch の "scale + position 一括設定" 経路を作る (中点 zoom + 中点移動 pan を 1 setState で適用するため) |
| **P0** | `apps/web/src/components/canvas/colors.ts` | 28-35 | `HANDLE_RADIUS = 6` / `HANDLE_FILL` / `HANDLE_STROKE_WIDTH` の定数。touch 用変種定数を新規追加 |
| **P0** | `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | 70-105 | endpoint Circle 2 箇所の `radius={HANDLE_RADIUS}`。adaptive 化 + `hitStrokeWidth` 追加 (Konva Issue #524 推奨パターン) |
| **P0** | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | 78-90 | `<Transformer ...>` に `anchorSize` を adaptive で渡す |
| **P0** | `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | 75-87 | RectangleShape と同型 (Transformer config) |
| **P1** | `apps/web/src/main.tsx` | 全体 | `Konva.hitOnDragEnabled = true` 追加箇所 (10.I-1 で `capturePointerEventsEnabled = true` を入れた直下) |
| **P1** | `apps/web/src/hooks/useStageTransform.test.ts` | 1-60 (パターン) | 既存 unit test 形式 (zoomAtPointer / clampPan の純粋関数 test)。新規 helper (`getTouchDistance` / `getTouchCenter`) も同形式で追加可能 |
| **P1** | `apps/web/src/hooks/__tests__/presence-context.test.tsx` または `useStageSize.test.tsx` | 全体 | `matchMedia` mock パターンの参考 (もし既存実装があれば。なければ vitest setup で global mock) |
| **P1** | `apps/web/e2e/touch-rectangle-draw.spec.ts` (10.I-1 既存) | 全体 (60 行) | mobile-chrome project の smoke 構造を踏襲し、pinch 検証の new spec を追加するための雛形 |
| **P1** | `docs/adr/ADR-0006-pointer-events-unification.md` | 全体 | ADR-0006 に「multi-touch pinch のみ TouchEvent 併用」の Status Update セクションを追記する原本 |
| **P2** | `apps/web/playwright.config.ts` | 34-37 | mobile-chrome (Pixel 5) project は既存。`hasTouch: true` 配下で `page.touchscreen` API が使えるが drag 操作はできない (CDPSession or `dispatchEvent('touchmove')` 経由) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Konva 公式 multi-touch pinch (vanilla JS) | [Multi-touch_Scale_Stage.mdx](https://github.com/konvajs/site/blob/new/content/docs/sandbox/Multi-touch_Scale_Stage.mdx) | `Konva.hitOnDragEnabled = true` 必須 / `stage.on('touchmove', fn)` で `e.evt.touches[0/1]` を取得 / `lastCenter` + `lastDist` + `dragStopped` の 3 state で trace |
| Konva 公式 multi-touch pinch (React) | 同上 | `useEffect` で stage.on('touchmove') アタッチ。本 plan では `<Stage onTouchMove={fn}>` の React Konva prop で代替 (react-konva の prop → instance.on() マッピングで等価) |
| Konva `hitOnDragEnabled` API | [Multi-touch_Scale_Shape.mdx](https://github.com/konvajs/site/blob/new/content/docs/sandbox/Multi-touch_Scale_Shape.mdx) | デフォルト `false`: drag 中 touchmove が発火しない最適化が効いている。pinch-while-drag を成立させるため `true` 必須 |
| MDN `matchMedia('(pointer: coarse)')` | [MDN MediaQueryList](https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList) | `addEventListener('change', fn)` で reactive 取得可。SSR 互換のため初回 render は `false` 開始 → useEffect で実値同期 |
| iOS HIG / Material touch target | [Material touch-target](https://m2.material.io/develop/web/supporting/touch-target) | iOS 44pt / Material 48dp。本 plan は radius 12 (= 24px diameter visual) + Konva 内部 hit padding で 44px 級を実現 |
| Konva `hitStrokeWidth` | [Konva Issue #524](https://github.com/konvajs/konva/issues/524) | stroke-based shape (Arrow / Line) で見た目より広い hit zone を提供する公式 API |

---

## Patterns to Mirror

### MULTI_TOUCH_HANDLER_KONVA_OFFICIAL
```ts
// SOURCE: https://github.com/konvajs/site/blob/new/content/docs/sandbox/Multi-touch_Scale_Stage.mdx (vanilla JS の React 化適応)
// 本 plan では React Konva の `<Stage onTouchMove={handleTouchMove}>` 経路で受ける。
// 中身ロジックは公式サンプルにほぼ忠実。state は React の useState ではなく
// useRef に置く (Pointer 経路と同じく 1 render cycle 内で連続発火するため)。

const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
const lastDistRef = useRef<number>(0);
// dragStopped は不要 — snap-share の Stage は draggable={false} で、独自の dragStartRef
// 経路を持つため。Stage drag を持たない設計のメリット。

const handleTouchMove = useCallback(
  (e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    const touches = e.evt.touches;
    const touch1 = touches[0];
    const touch2 = touches[1];
    if (!touch1 || !touch2) {
      // 1 本指 → Pointer 経路に任せる。multi-touch state はリセットだけしておく。
      lastCenterRef.current = null;
      lastDistRef.current = 0;
      return;
    }

    // 2 本指検知瞬間に Pointer 経路の in-flight state を全部中断。
    if (dragStartRef.current || draftRef.current) {
      dragStartRef.current = null;
      draftRef.current = null;
      setDraft(null);
    }
    if (panActiveRef.current) {
      panActiveRef.current = false;
      panLastRef.current = null;
      setCursor('');
    }

    const stage = e.target.getStage();
    if (!stage) return;
    const rect = stage.container().getBoundingClientRect();
    const p1 = { x: touch1.clientX - rect.left, y: touch1.clientY - rect.top };
    const p2 = { x: touch2.clientX - rect.left, y: touch2.clientY - rect.top };
    const newCenter = getCenter(p1, p2);
    const newDist = getDistance(p1, p2);

    // 初回検知: state 初期化のみで return (jitter 防止)
    if (!lastCenterRef.current || lastDistRef.current === 0) {
      lastCenterRef.current = newCenter;
      lastDistRef.current = newDist;
      return;
    }

    onPinchPan({
      center: newCenter,
      distRatio: newDist / lastDistRef.current,
      panDx: newCenter.x - lastCenterRef.current.x,
      panDy: newCenter.y - lastCenterRef.current.y,
    });

    lastDistRef.current = newDist;
    lastCenterRef.current = newCenter;
  },
  [onPinchPan, setCursor],
);

const handleTouchEnd = useCallback(() => {
  lastCenterRef.current = null;
  lastDistRef.current = 0;
}, []);
```

### PURE_HELPERS_FOR_PINCH
```ts
// SOURCE (NEW): apps/web/src/hooks/useStageTransform.ts に追加 (clampScale 等と並ぶ純粋関数)
// 公式サンプルと同一実装。unit test 可能な純粋関数として置く。

export const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number =>
  Math.hypot(p2.x - p1.x, p2.y - p1.y);

export const getCenter = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): { x: number; y: number } => ({
  x: (p1.x + p2.x) / 2,
  y: (p1.y + p2.y) / 2,
});

/** pinch 入力 (中点 + scale 比 + pan delta) を 1 つの transform に集約する。
 *  既存 zoomAtPointer + panBy を別々に呼ぶと state flush タイミングで 2 回 setState
 *  されるため、pinch 時は 1 setState に集約して描画 jitter を回避する。 */
export const applyPinch = (
  transform: StageTransform,
  center: { x: number; y: number },
  distRatio: number,
  panDx: number,
  panDy: number,
): StageTransform => {
  const newScale = clampScale(transform.scale * distRatio);
  const pointTo = {
    x: (center.x - transform.x) / transform.scale,
    y: (center.y - transform.y) / transform.scale,
  };
  return {
    scale: newScale,
    x: center.x - pointTo.x * newScale + panDx,
    y: center.y - pointTo.y * newScale + panDy,
  };
};
```

### USE_TOUCH_DEVICE_HOOK_PATTERN
```ts
// SOURCE (NEW): apps/web/src/hooks/useTouchDevice.ts
// SSR / hydration 安全 (初回 false → useEffect で実値同期 — server-rendering なくても
// React 19 / strict mode の 2-render に対応)。
import { useEffect, useState } from 'react';

const QUERY = '(pointer: coarse)';

export const useTouchDevice = (): boolean => {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    setIsTouch(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isTouch;
};
```

### ADAPTIVE_HANDLE_PATTERN_ARROWSHAPE
```tsx
// SOURCE (NEW): apps/web/src/components/canvas/shapes/ArrowShape.tsx 内
// useTouchDevice の値で radius / hitStrokeWidth を切替。
const isTouch = useTouchDevice();
const handleRadius = isTouch ? HANDLE_RADIUS_TOUCH : HANDLE_RADIUS;
const arrowHitStrokeWidth = isTouch ? HIT_STROKE_WIDTH_TOUCH : annotation.strokeWidth;

<KonvaArrow
  // ...
  hitStrokeWidth={arrowHitStrokeWidth}
/>
<Circle
  radius={handleRadius}
  // ...
/>
```

### ADAPTIVE_TRANSFORMER_ANCHOR
```tsx
// SOURCE (NEW): apps/web/src/components/canvas/shapes/RectangleShape.tsx と HighlightShape.tsx
const isTouch = useTouchDevice();
<Transformer
  ref={trRef}
  anchorSize={isTouch ? ANCHOR_SIZE_TOUCH : ANCHOR_SIZE_DESKTOP}
  rotateEnabled={false}
  flipEnabled={false}
  ignoreStroke
  boundBoxFunc={(oldBox, newBox) =>
    Math.abs(newBox.width) < MIN_RESIZE_SIZE || Math.abs(newBox.height) < MIN_RESIZE_SIZE
      ? oldBox
      : newBox
  }
/>
```

### COLORS_TS_NEW_CONSTANTS
```ts
// SOURCE (NEW): apps/web/src/components/canvas/colors.ts に追加
// 既存 HANDLE_RADIUS = 6 を残しつつ、touch 用変種を別定数で追加。
// 数値根拠: iOS HIG 44pt = radius 22。本実装は visual 12px (= 24px diameter) +
// Konva 内部の hit padding で 44px 級ターゲットを実現する。デザイン的に visual 22 だと
// アノテーションを覆い隠すため visual は控えめ、hit zone のみ広くする方針。
export const HANDLE_RADIUS_TOUCH = 12;

// Transformer anchor: Konva default 10。touch では 24 (Material 48dp の半分以上)。
export const ANCHOR_SIZE_DESKTOP = 10;
export const ANCHOR_SIZE_TOUCH = 24;

// Arrow / Highlight stroke の hit zone 拡張。strokeWidth が 2px と細いので touch 時は
// 約 20px の hit zone を提供する。Konva 公式 Issue #524 推奨パターン。
export const HIT_STROKE_WIDTH_TOUCH = 20;
```

### KONVA_HITONDRAG_ENABLED
```ts
// SOURCE (NEW): apps/web/src/main.tsx の capturePointerEventsEnabled の直下に追加。
// Konva 公式 multi-touch sandbox 必須項目。default は false で、drag 中の touchmove が
// 発火しない最適化が効いている。pinch-while-drag (図形を片手で押さえつつ別の指で zoom)
// を成立させるため true に設定。
Konva.hitOnDragEnabled = true;
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/main.tsx` | UPDATE | `Konva.hitOnDragEnabled = true` を 1 行追加 (Konva 公式必須) |
| `apps/web/src/hooks/useTouchDevice.ts` | CREATE | `(pointer: coarse)` reactive 判定 hook (~25 行) |
| `apps/web/src/hooks/__tests__/useTouchDevice.test.tsx` | CREATE | matchMedia mock + change event 動作の unit test |
| `apps/web/src/hooks/useStageTransform.ts` | UPDATE | 純粋 helper `getDistance` / `getCenter` / `applyPinch` 追加 + `setTransformDirect` callback exposure (pinch state を atomic 適用) |
| `apps/web/src/hooks/__tests__/useStageTransform.test.ts` | UPDATE | `applyPinch` の純粋関数 test を追加 (中点固定 zoom + pan delta 検証) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | `onTouchMove` / `onTouchEnd` ハンドラ追加 + multi-touch state ref 3 個 + Pointer 経路の中断ロジック + Stage prop 配線 |
| `apps/web/src/components/canvas/colors.ts` | UPDATE | `HANDLE_RADIUS_TOUCH` / `ANCHOR_SIZE_DESKTOP` / `ANCHOR_SIZE_TOUCH` / `HIT_STROKE_WIDTH_TOUCH` 追加 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATE | `useTouchDevice` 取り込み、handle Circle 2 箇所の `radius` adaptive 化、`<KonvaArrow>` に `hitStrokeWidth` 追加 |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATE | `useTouchDevice` 取り込み、Transformer に `anchorSize` 追加 |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATE | RectangleShape と同型変更 (Transformer `anchorSize`) |
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | UPDATE | mock の matchMedia / Transformer prop 検証で anchorSize の有無を assert |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | UPDATE | hitStrokeWidth が arrow に付くこと、handle radius が touch 環境で増えることを assert |
| `apps/web/e2e/touch-pinch-zoom.spec.ts` | CREATE | mobile-chrome smoke spec: 2-finger pinch で transform.scale が変化することを確認 |
| `docs/adr/ADR-0006-pointer-events-unification.md` | UPDATE | 「Status Update (Phase 10.I-2): multi-touch pinch のみ TouchEvent 併用」セクション追記 |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | UPDATE | sub-phase 10.I-2 行を `pending` → `in-progress` → `complete`、Plan link 追加 |

## NOT Building

- **Toolbar の bottom 固定 + safe-area-inset-bottom** — Phase 10.I-3 の対象
- **awareness layer の touch device 判定** — Should、Phase 10.I-3 以降
- **VisualViewport API での IME 吸収** — Should、Phase 10.I MVP 完了後にドッグフードで判断
- **palm rejection / ペンモード / 長押しメニュー / 3 本指ジェスチャ / ダブルタップ zoom** — PRD Won't 継承
- **3 本指 pinch zoom** — Excalidraw が pen mode で無効化している通り、UX 価値が低い
- **Pinch zoom limits を変更** — 既存 `MIN_SCALE = 0.1` / `MAX_SCALE = 8` を流用、Phase 10.I-2 では拡張しない
- **2-finger 回転** — figma 等の純デザインツール領域、snap-share の用途 (注釈共有) では不要
- **drag-while-pinch (Konva 公式の `dragStopped` ロジック)** — snap-share の `<Stage>` は `draggable={false}` で独自の dragStartRef 経路を使うため、Stage drag を中断する `dragStopped` state は不要
- **`stage.getPointersPositions()` 経由の Pointer Events 統合 multi-touch** — 公式サンプルが TouchEvent 経路で安定実装を提示しているため、こちらに準拠 (Pointer Events への将来統合は Phase 11+ で再評価)
- **Playwright での pinch 完全検証** — `page.touchscreen` の制限上 drag 不能。CDPSession 経由は Phase 10.I-4 で本格対応、本 plan は smoke 1 件のみ

---

## Step-by-Step Tasks

### Task 1: ADR-0006 への Status Update セクション追記

- **ACTION**: `docs/adr/ADR-0006-pointer-events-unification.md` の末尾に新規セクション「Status Update (Phase 10.I-2)」を追加
- **IMPLEMENT**:
  - 追記内容: 「multi-touch pinch zoom + 2-finger pan は Konva 公式 multi-touch sandbox の TouchEvent 経路 (`stage.on('touchmove', ...)`) を併用する。Pointer Events 一本化方針 (本 ADR の Decision) は single-pointer (描画 / drag / Space+pan) に限定して維持する」「並列共存設計の根拠: 公式 sample が TouchEvent ベースで `Konva.hitOnDragEnabled = true` 前提のため、独自に Pointer Events Map 自前管理に置き換えるとサポート外実装になり長期負債」「将来 Phase 11+ で `stage.getPointersPositions()` ベースの完全 Pointer 統合へ移行する余地は残す」
- **MIRROR**: 既存 ADR の "Status Update" / "Update" 追記パターン (ADR-0001 の Rejection Note セクション構造)
- **IMPORTS**: なし (Markdown)
- **GOTCHA**: ADR-0006 の最上部 `Status: Accepted` は変更しない (本 update は Decision を覆さず scope clarification のため)
- **VALIDATE**: `grep -l "Status Update (Phase 10.I-2)" docs/adr/ADR-0006-pointer-events-unification.md` で 1 件 hit

### Task 2: `Konva.hitOnDragEnabled = true` を main.tsx に追加

- **ACTION**: `apps/web/src/main.tsx` の `capturePointerEventsEnabled = true` 直下に 1 行追加
- **IMPLEMENT**:
  ```ts
  // multi-touch pinch (2 本指 zoom + pan) を成立させるため、drag 中の touchmove 抑止を
  // 解除する。Konva default は false。詳細は ADR-0006 / Phase 10.I-2。
  Konva.hitOnDragEnabled = true;
  ```
- **MIRROR**: `KONVA_HITONDRAG_ENABLED` pattern (上記)
- **IMPORTS**: 既存 `import Konva from 'konva';` を流用 (10.I-1 で追加済)
- **GOTCHA**: `capturePointerEventsEnabled` と `hitOnDragEnabled` は別 property — typo すると typecheck で `TS2551 Did you mean ...?` が出る (10.I-1 で同種の typo を経験済)
- **VALIDATE**:
  - `grep -n "hitOnDragEnabled" apps/web/src/main.tsx` で 1 件 hit
  - `pnpm -F @pitamark/web typecheck` でエラーなし

### Task 3: `useTouchDevice` hook 新規作成

- **ACTION**: `apps/web/src/hooks/useTouchDevice.ts` を新規作成 + `apps/web/src/hooks/__tests__/useTouchDevice.test.tsx` を新規作成
- **IMPLEMENT**:
  - hook 本体: `USE_TOUCH_DEVICE_HOOK_PATTERN` (上記) を完全コピー
  - test: matchMedia mock で `(pointer: coarse)` の `matches: true / false` 切替 + `change` event の reactive 動作 + `removeEventListener` cleanup を assert
- **MIRROR**: `apps/web/src/hooks/__tests__/useStageSize.test.tsx` の React Testing Library + `renderHook` パターン (もし参照可能)
- **IMPORTS**:
  - hook 側: `import { useEffect, useState } from 'react';`
  - test 側: `import { renderHook, act } from '@testing-library/react'; import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'; import { useTouchDevice } from '../useTouchDevice';`
- **GOTCHA**:
  - happy-dom が `window.matchMedia` を実装するか確認。実装していなければ test 内で `vi.stubGlobal('matchMedia', ...)` か `Object.defineProperty(window, 'matchMedia', ...)` で mock を定義
  - 初回 render は `false` 開始、useEffect 後に `true` になる場合の test 期待値を `act` で同期
  - `useEffect` cleanup の `removeEventListener` を `vi.fn()` で trap して呼ばれること確認
- **VALIDATE**:
  - `pnpm -F @pitamark/web test -- src/hooks/__tests__/useTouchDevice.test.tsx` で全 spec 緑
  - hook 単体で `pnpm typecheck` 通る

### Task 4: `useStageTransform.ts` に純粋 helper 追加

- **ACTION**: `apps/web/src/hooks/useStageTransform.ts` の `clampScale` / `zoomAtPointer` の近くに `getDistance` / `getCenter` / `applyPinch` を追加。`UseStageTransform` interface には何も追加せず、純粋関数として `export` のみ
- **IMPLEMENT**: `PURE_HELPERS_FOR_PINCH` (上記) を完全コピー
- **MIRROR**: 既存の `clampScale` / `zoomAtPointer` / `clampPan` の export 純粋関数パターン
- **IMPORTS**: なし (型は `StageTransform` を既存定義から流用)
- **GOTCHA**:
  - `applyPinch` の `pointTo` 計算は `zoomAtPointer` と同じ仕組み (logical 座標を求めて scale 適用後の screen 位置に戻す)
  - `clampPan` は `applyPinch` の中で呼ばない — Stage transform の clamp は CanvasStage 側で `setTransform(prev => clampPan(applyPinch(prev, ...), img, viewport))` の形で適用させる (zoomBy / panBy も同じ流儀)
  - 既存 `panBy` / `zoomBy` は **変更しない** (10.I-2 では multi-touch 経路から呼ぶ専用 setter を別途 expose)
- **VALIDATE**:
  - `grep -n "applyPinch\|getDistance\|getCenter" apps/web/src/hooks/useStageTransform.ts` で 3 関数定義と export を確認
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 5: `useStageTransform.test.ts` に `applyPinch` の test 追加

- **ACTION**: 既存 test 末尾に `describe('applyPinch', ...)` ブロックを追加
- **IMPLEMENT**:
  - 中点 (0.5, 0.5)、distRatio = 2 で scale が 2 倍、center が固定で transform.x/y がスケール変化分だけ調整される
  - panDx = 10 / panDy = 0 で transform.x が +10 移動、scale 不変
  - distRatio = 0.0001 (極小値) で scale が `MIN_SCALE = 0.1` に clamp される (zoomAtPointer 同様)
  - distRatio = 100 (極大値) で scale が `MAX_SCALE = 8` に clamp される
- **MIRROR**: 既存 `describe('zoomAtPointer', ...)` の test 構造 (line 不明、要確認)
- **IMPORTS**: 既存 import に `applyPinch` を追加
- **GOTCHA**: `panDx = 0, panDy = 0` のケースで `zoomAtPointer` 等価動作になる (sanity check)
- **VALIDATE**:
  - `pnpm -F @pitamark/web test -- src/hooks/__tests__/useStageTransform.test.ts` 全 spec 緑
  - 新規 test 4 件以上が追加されている

### Task 6: `CanvasStage.tsx` に multi-touch handler 追加

- **ACTION**: `useStageTransform` の戻り値に `setTransformDirect: (next: StageTransform) => void` を expose してから、CanvasStage 側で `onTouchMove` / `onTouchEnd` を実装
- **IMPLEMENT**:
  - **Step 6a**: `useStageTransform.ts` の return 物に `setTransformDirect` を追加 (`setTransform(prev => clampPan(input, ...))` を内包する callback)
  - **Step 6b**: `useStageTransform` を呼ぶ側 (おそらく `EditorShell.tsx` か直近の親) で `setTransformDirect` を receive し、`<CanvasStage onPinchPan={...}>` に渡す
  - **Step 6c**: `CanvasStage.tsx` に props `onPinchPan: (input: { center: {x:number;y:number}; distRatio: number; panDx: number; panDy: number }) => void` を追加
  - **Step 6d**: `CanvasStage.tsx` 内で `lastCenterRef` / `lastDistRef` を新規定義
  - **Step 6e**: `handleTouchMove` callback 実装 (`MULTI_TOUCH_HANDLER_KONVA_OFFICIAL` pattern 完全踏襲)
  - **Step 6f**: `handleTouchEnd` callback 実装 (state リセット)
  - **Step 6g**: `<Stage onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>` を追記 (既存の Pointer 系 prop は維持)
- **MIRROR**: `MULTI_TOUCH_HANDLER_KONVA_OFFICIAL` pattern + 既存 useCallback 配線スタイル
- **IMPORTS**:
  - `import type { KonvaEventObject } from 'konva/lib/Node';` (既存)
  - `getDistance, getCenter` を `useStageTransform.ts` から import (なお `applyPinch` は CanvasStage では呼ばない — 親側で `setTransformDirect` 内に内包する設計)
- **GOTCHA**:
  - `e.evt.preventDefault()` は必須 (公式サンプル準拠)。これがないと iOS Safari のページズームに奪われる
  - `getBoundingClientRect()` は毎回呼ぶ — Stage 位置が CSS で動く可能性に対する防御 (10.I-3 の bottom toolbar 化で Stage が動く)
  - 2 本指検知瞬間に Pointer 経路の `dragStartRef` / `draftRef` / `panActiveRef` をリセットするのを **忘れない** — 忘れると pinch 完了後に「描画途中の draft が残る」「pan モードが効きっぱなし」のリーク
  - `lastCenterRef` / `lastDistRef` の jitter 防止初期化 (1 frame 目は state 更新だけして return) を必ず入れる
  - `handleTouchMove` の deps array に `setCursor` を入れる (内部で in-flight pan を中断するため呼ぶ)
- **VALIDATE**:
  - `grep -n "onTouchMove\|onTouchEnd" apps/web/src/components/canvas/CanvasStage.tsx` で 4 件以上 (handler 定義 + Stage prop)
  - `pnpm -F @pitamark/web typecheck` 緑
  - 既存 unit test (321 件) が緑のまま (pointer 経路の regression なし)

### Task 7: `colors.ts` に touch 用定数追加

- **ACTION**: `apps/web/src/components/canvas/colors.ts` に 4 定数を追加 (既存 `HANDLE_RADIUS = 6` は残す)
- **IMPLEMENT**: `COLORS_TS_NEW_CONSTANTS` (上記) を完全コピー
- **MIRROR**: 既存の `export const NAME = value;` 形式と JSDoc コメントスタイル
- **IMPORTS**: なし
- **GOTCHA**: `HANDLE_RADIUS` (= 6) は残す。既存 ArrowShape は touch 環境では `HANDLE_RADIUS_TOUCH` を、mouse 環境では `HANDLE_RADIUS` を選ぶ adaptive 切替に変える (Task 8)
- **VALIDATE**:
  - `grep -n "HANDLE_RADIUS_TOUCH\|ANCHOR_SIZE_DESKTOP\|ANCHOR_SIZE_TOUCH\|HIT_STROKE_WIDTH_TOUCH" apps/web/src/components/canvas/colors.ts` で 4 行確認
  - `pnpm typecheck` 緑

### Task 8: `ArrowShape.tsx` を adaptive 化 + hitStrokeWidth

- **ACTION**: `apps/web/src/components/canvas/shapes/ArrowShape.tsx` で `useTouchDevice()` を呼び、handle radius と arrow `hitStrokeWidth` を adaptive に
- **IMPLEMENT**:
  - 関数本体に `const isTouch = useTouchDevice();` を追加
  - `<KonvaArrow ...>` に `hitStrokeWidth={isTouch ? HIT_STROKE_WIDTH_TOUCH : annotation.strokeWidth}` を追加
  - 2 箇所の Circle handle で `radius={isTouch ? HANDLE_RADIUS_TOUCH : HANDLE_RADIUS}` に書き換え
- **MIRROR**: `ADAPTIVE_HANDLE_PATTERN_ARROWSHAPE` (上記)
- **IMPORTS**:
  - 既存 import に `useTouchDevice` を追加: `import { useTouchDevice } from '../../../hooks/useTouchDevice';`
  - `colors.ts` の import を `HANDLE_RADIUS_TOUCH, HIT_STROKE_WIDTH_TOUCH` 追加
- **GOTCHA**:
  - `hitStrokeWidth` は Konva の Line / Arrow / Path 等の stroke shape にのみ効く API。Circle 内側は filled 領域がそのまま hit zone のため別途 `hitFunc` 等の対応は不要
  - desktop で `hitStrokeWidth` を strokeWidth と同値にする (= 拡張なし) のは UX 一貫性のため。touch 限定で 20px に拡張する
- **VALIDATE**:
  - `grep -n "useTouchDevice\|hitStrokeWidth\|HANDLE_RADIUS_TOUCH" apps/web/src/components/canvas/shapes/ArrowShape.tsx` で 4 行以上
  - `pnpm -F @pitamark/web test -- src/components/canvas/__tests__/ArrowShape.test.tsx` 全 spec 緑

### Task 9: `RectangleShape.tsx` / `HighlightShape.tsx` の Transformer adaptive

- **ACTION**: 両ファイルで `useTouchDevice()` を呼び `<Transformer anchorSize={...} />` を adaptive に
- **IMPLEMENT**:
  - 関数本体に `const isTouch = useTouchDevice();` 追加
  - `<Transformer ... anchorSize={isTouch ? ANCHOR_SIZE_TOUCH : ANCHOR_SIZE_DESKTOP} />` に書き換え
- **MIRROR**: `ADAPTIVE_TRANSFORMER_ANCHOR` (上記)
- **IMPORTS**:
  - `useTouchDevice` 追加
  - `colors.ts` から `ANCHOR_SIZE_DESKTOP, ANCHOR_SIZE_TOUCH` 追加
- **GOTCHA**: Konva Transformer の `anchorSize` は default 10。`anchorStrokeWidth` / `anchorCornerRadius` 等は変更不要 (visual 一貫性は維持)
- **VALIDATE**:
  - `grep -n "anchorSize\|useTouchDevice" apps/web/src/components/canvas/shapes/RectangleShape.tsx apps/web/src/components/canvas/shapes/HighlightShape.tsx` で 4 行
  - 既存 test (RectangleShape.test.tsx / HighlightShape.test.tsx) が緑のまま

### Task 10: 関連 unit test の更新

- **ACTION**: `RectangleShape.test.tsx` と `ArrowShape.test.tsx` の mock で `useTouchDevice` の戻り値を制御し、touch / desktop 両方で適切な値が渡ることを assert
- **IMPLEMENT**:
  - `vi.mock('../../../hooks/useTouchDevice', () => ({ useTouchDevice: () => false }));` (default desktop) として既存挙動を保つ test を確認
  - 新規 test ケース: `vi.doMock` でランタイム切替 — 「touch 環境では `anchorSize` が 24 になる」「`hitStrokeWidth` が 20 になる」を check
- **MIRROR**: 既存 `vi.hoisted()` + react-konva mock パターン (RectangleShape.test.tsx:23-50)
- **IMPORTS**: 変更なし
- **GOTCHA**: `vi.doMock` は `vi.mock` と異なり再マウントが必要。既存の `vi.mock` は file-level hoisting なので、touch 切替 test を別 describe で書くか、`useTouchDevice` をモジュールレベルでなくローカル関数として注入できる形にしておく方が単純。本 plan では mock の戻り値固定 test (touch=true) と (touch=false) を別 it ブロックで作る最小手で OK
- **VALIDATE**: 既存 + 新規 test すべて緑、coverage 目視で adaptive 経路が両方通っている

### Task 11: Playwright smoke (mobile-chrome pinch)

- **ACTION**: `apps/web/e2e/touch-pinch-zoom.spec.ts` を新規作成。1 件のみ
- **IMPLEMENT**:
  - mobile-chrome project 限定 (`test.skip(testInfo.project.name !== 'mobile-chrome', ...)`)
  - 画像投入 → window.__SNAP_SHARE_TRANSFORM__ (もし expose されていなければ Konva Stage の scale を取得する evaluate を使う) で初期 scale 取得
  - `page.evaluate` で `dispatchEvent('touchstart' / 'touchmove' / 'touchend')` を canvas に直接送る (CDPSession の `Input.dispatchTouchEvent` を使うとさらに確実)
  - touchmove で 2 点間の距離を 2 倍にする → scale が約 2 倍になることを assert (許容誤差 ±10%)
- **MIRROR**: `apps/web/e2e/touch-rectangle-draw.spec.ts` (10.I-1 で作成済) の skeleton + dropImage helper
- **IMPORTS**: `import { expect, test } from '@playwright/test'; import { dropImage } from './fixtures/upload';`
- **GOTCHA**:
  - `page.touchscreen.tap` は単発のみで drag できない → `page.context().newCDPSession(page)` 経由で `Input.dispatchTouchEvent` を使うか、`page.locator(canvas).dispatchEvent('touchmove', { touches: [{...}, {...}] })` を使う
  - 後者は synthetic event なので Konva 側で本物の TouchList と判定されない可能性あり → 実機検証で調整必要なら 10.I-4 へ持ち越す
  - 本 plan の smoke は「pinch を一度発火して scale が変化する」ことの最小確認。完全 12 ケース受入は 10.I-4
- **VALIDATE**:
  - `pnpm exec playwright test e2e/touch-pinch-zoom.spec.ts --project=mobile-chrome` で 1 件緑
  - chromium project では skip 動作

### Task 12: PRD 更新

- **ACTION**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` の sub-phase 10.I-2 行を `pending` → `in-progress` (実装着手時) → `complete` (Task 1-11 + manual verify 完了時) に更新
- **IMPLEMENT**:
  - Status 列: `pending` → `complete (typecheck/lint/test/build/E2E mobile-chrome smoke + chromium 全件回帰すべて緑、ADR-0006 Status Update 追記済)`
  - PRP Plan 列: `-` → `[plan](../plans/completed/phase-10-i-2-multitouch-and-hit-areas.plan.md) / [report](../reports/phase-10-i-2-multitouch-and-hit-areas-report.md)`
- **MIRROR**: 10.I-1 行の遷移パターン (PRD 内既存)
- **IMPORTS**: なし
- **VALIDATE**: `grep -n "10.I-2" .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` で Status / Plan link 更新

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `getDistance({0,0}, {3,4})` | 2 点 | `5` | No |
| `getCenter({0,0}, {10,10})` | 2 点 | `{5,5}` | No |
| `applyPinch` 基本 | identity, center {100,100}, distRatio 2 | scale=2、x/y は中点固定維持に必要な調整 | No |
| `applyPinch` clamp 上限 | scale 4, distRatio 100 | scale=8 (MAX_SCALE) | Yes |
| `applyPinch` clamp 下限 | scale 0.5, distRatio 0.001 | scale=0.1 (MIN_SCALE) | Yes |
| `applyPinch` pan のみ | distRatio=1, panDx=10 | x=transform.x+10, scale 不変 | No |
| `useTouchDevice` 初期 false | matchMedia mock matches:false | `false` | No |
| `useTouchDevice` 初期 true | matchMedia mock matches:true | `true` | No |
| `useTouchDevice` reactive | matches を false → true に change event 発火 | `false` → `true` に reactive 変化 | Yes |
| `useTouchDevice` cleanup | unmount | `removeEventListener` が呼ばれる | Yes |

### Edge Cases Checklist

- [ ] 1 本指 → 2 本指に増えた瞬間に Pointer 経路の draft / dragStart / panActive が中断される
- [ ] 2 本指 → 1 本指に減ったとき、multi-touch state がリセットされ、Pointer 経路に復帰
- [ ] 2 本指から両方離した (touchend) で `lastCenter`/`lastDist` リセット
- [ ] pinch 中の 1 frame 目で `lastCenter`/`lastDist` がまだ null/0 のとき、scale jitter が起きない
- [ ] PC chromium では `useTouchDevice = false` で従来 handle / anchor / hitStrokeWidth が維持
- [ ] 細い arrow (strokeWidth=2) を touch でタップして掴める (`hitStrokeWidth: 20`)
- [ ] Transformer の anchor が touch で 24px、desktop で 10px
- [ ] Stage 外への 2-finger swipe で `clampPan` が効き、画像が画面外に飛ばない
- [ ] zoom in 限界 (scale=8) と zoom out 限界 (scale=0.1) で stop
- [ ] iOS Safari の system gesture 介入 → multi-touch state も `pointercancel` 等価でリセット (要 touchend 経由で対応 — 10.I-1 の `pointercancel` ハンドラと同じ責務分担)
- [ ] desktop の wheel zoom / Cmd+wheel zoom が劣化していない
- [ ] desktop の Space+drag pan が劣化していない
- [ ] 既存 unit test (321 件) すべて緑のまま

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
pnpm lint
```
EXPECT: ゼロエラー、ゼロ違反

### Unit Tests
```bash
pnpm -F @pitamark/web test -- src/hooks/__tests__/useStageTransform.test.ts
pnpm -F @pitamark/web test -- src/hooks/__tests__/useTouchDevice.test.tsx
pnpm -F @pitamark/web test -- src/components/canvas/__tests__
pnpm -F @pitamark/web test
```
EXPECT: 全件緑、新規 test が `applyPinch` / `useTouchDevice` をカバー

### Build
```bash
pnpm build
```
EXPECT: success、bundle size に劇的変化なし

### E2E
```bash
cd apps/web && pnpm exec playwright test e2e/touch-pinch-zoom.spec.ts --project=mobile-chrome
cd apps/web && pnpm exec playwright test --project=chromium
```
EXPECT: 新規 pinch smoke 緑、既存 chromium 78 件すべて緑 (回帰なし)

### Manual Validation

- [ ] PC Chrome / Firefox で wheel zoom + Cmd+wheel zoom + Space+drag pan が劣化していない
- [ ] PC Chrome で selection handle が radius 6 維持、Transformer anchor が 10 維持
- [ ] **実機 iPhone Safari で 2-finger pinch zoom が動作 (中点固定)**
- [ ] **実機 iPhone Safari で 2-finger pan が動作**
- [ ] **実機 iPhone Safari で 1-finger 描画が pinch とぶつからずに動作**
- [ ] 実機で細い arrow を指でタップして掴める (`hitStrokeWidth: 20` 効果)
- [ ] 実機で Rectangle / Highlight の Transformer anchor が指で掴める (24px)
- [ ] Android Chrome で同上の主要項目
- [ ] 図形を片手で押さえつつ別の指で pinch (`hitOnDragEnabled = true` の効果) — pinch-while-drag が動作

---

## Acceptance Criteria

- [ ] Task 1〜12 すべて完了
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` 全緑
- [ ] 新規 unit test (`applyPinch` 4 件 + `useTouchDevice` 4 件) 緑
- [ ] 新規 E2E smoke (`touch-pinch-zoom.spec.ts`) 緑
- [ ] chromium 全 e2e 回帰ゼロ
- [ ] PC で selection handle / anchor の見た目が変化していないことを目視確認
- [ ] ADR-0006 に Status Update セクションが追記されている

## Completion Checklist

- [ ] Konva 公式 multi-touch sample に準拠 (`getDistance` / `getCenter` 純粋関数 + `lastCenterRef` / `lastDistRef` state pattern)
- [ ] Pointer 経路 (10.I-1) と TouchEvent 経路 (10.I-2) の責務分担が明確
- [ ] `useTouchDevice` が SSR 互換 (typeof window guard)
- [ ] adaptive 切替が CSS ではなく React state ベース (Konva canvas は CSS variable を resolve しないため)
- [ ] Pointer 経路の in-flight state が 2 本指検知時に確実に中断される
- [ ] No hardcoded values (新規定数は colors.ts に集約)
- [ ] No unnecessary scope additions (NOT Building 準拠)
- [ ] Self-contained — codebase 再検索なしで実装可能

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Konva 公式 multi-touch sample が `dragStopped` ロジックを含む (`<Stage draggable>` 前提) — snap-share では `<Stage draggable={false}>` のため不要だが、想定外の干渉が起きる | Low | Medium | snap-share の Stage は最初から `draggable` prop を渡していない。Konva default は false なので想定通り動く。実装時に `stage.isDragging()` チェックは入れない (= 公式サンプルの `dragStopped` 系を意図的に省略) |
| Pointer 経路と TouchEvent 経路の二重発火 | Medium | Medium | iOS Safari は 1 つのジェスチャで両方発火する仕様。本 plan では「Pointer 経路は 1 本指のみ処理、2 本指検知時は in-flight state 中断 + 何もしない」「TouchEvent 経路は 2 本指のみ処理」で責務分離。実装時に `if (touch1 && !touch2) return;` の早期 return を Touch 側に必ず入れる |
| `useTouchDevice` の matchMedia mock が happy-dom で未実装 | Medium | Low | test 側で `vi.stubGlobal('matchMedia', ...)` で polyfill。本 plan の Task 3 GOTCHA に明記済 |
| `Konva.hitOnDragEnabled = true` が drag-heavy な既存挙動 (Transformer resize / shape drag) のパフォーマンスに影響 | Low | Low | Konva 公式が同 flag を multi-touch 必須としている時点で、推奨設定。本 plan で performance regression が出れば 10.I-4 で計測 |
| Playwright synthetic touch event が Konva に届かない | Medium | Low | smoke 1 件のため失敗時は 10.I-4 で CDPSession 経由に切替。10.I-2 の Acceptance はあくまで実装の typecheck / unit test / 実機手動確認で担保 |
| `applyPinch` の中点固定計算が `zoomAtPointer` と微妙に異なって意図しない drift | Low | Medium | unit test 4 件で純粋関数検証。中点固定の不変条件を assert |
| Transformer の `anchorSize=24` が figma 等のデザイナー慣習と違って違和感を生む | Low | Low | iOS HIG 44pt / Material 48dp に準拠した妥当値。違和感が出れば 10.I-4 ドッグフードで反映 |
| 2-finger pinch 中に `clampPan` が中点固定特性を破壊する (画像が画面端に強制移動して中点が固定されない) | Medium | Medium | unit test で `clampPan` 適用後の transform が pinch input の意図を壊さないか確認 (純粋関数 test 範囲で検証可能)。実機で違和感が出れば 10.I-4 で `clampPan` の挙動を調整 |
| 細い arrow に `hitStrokeWidth: 20` を全環境付けると、複数 arrow が密接した状態で誤タップが増える | Medium | Low | desktop では `hitStrokeWidth = annotation.strokeWidth` (= 拡張なし) に分岐。touch のみ拡張で密集タッチに対する妥協を受け入れる |

## Notes

### Pointer Events 一本化方針 (10.I-1) との整合

ADR-0006 の Decision 「Pointer Events 一本化」は **single-pointer 入力に限定** して維持される。multi-touch pinch のみ TouchEvent 経路を併用することは、Konva 公式 sample が TouchEvent ベース実装で長年安定運用されている事実 + 独自に Pointer Events Map 自前管理に置き換えるとサポート外実装になる長期負債を避けるための **scope clarification** である。Task 1 で ADR-0006 に明記する。

将来 Phase 11+ で `stage.getPointersPositions()` ベースの完全 Pointer 統合へ移行する余地は残す。Konva 自身がその統合を進めれば、TouchEvent 経路を撤去できる。

### `setTransformDirect` callback の追加

`useStageTransform` の既存 API は `zoomBy(pointer, factor)` / `panBy(dx, dy)` の 2 つに分かれているため、pinch のように「scale + position を 1 frame で atomic 適用」する用途には向かない (2 回 setState して 2 回 render が走り jitter)。Task 6a で `setTransformDirect(transform: StageTransform): void` を expose し、内部で `setTransform(prev => clampPan(input, img, viewport))` を 1 回だけ呼ぶ設計にする。これにより multi-touch handler 側は `applyPinch` で計算した transform を atomic に適用できる。

### ECC PRP との整合

本 plan は 10.I-1 と同一ブランチ `phase-10-i-touch-optimization` で進める (memory: PRP は PRD 単位で 1 ブランチ 1 PR)。コミット粒度は sub-phase ごと、本 plan で 1〜3 コミットを想定 (ADR + main.tsx + hook 新規 / CanvasStage + helpers / shapes adaptive + colors / test + e2e + PRD)。

### 後続 sub-phase に渡す前提

- 10.I-3 (Toolbar bottom): `useTouchDevice` を流用してボタンサイズの adaptive 化に転用可能
- 10.I-4 (受入): 本 plan の smoke を base に、4 形状 × 3 操作 = 12 ケース + pinch 中の描画衝突回避 + Stage 外 drag 継続検証を加える
