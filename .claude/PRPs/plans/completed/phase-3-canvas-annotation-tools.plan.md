# Plan: Phase 3 — キャンバス & 注釈ツール (Canvas & Annotation Tools)

## Summary

`apps/web` に Konva ベースの編集キャンバスを実装し、4 種の注釈（矩形 / 矢印 / テキスト / ハイライト）をローカルで作成・選択・移動・削除できる単一画面を作る。状態は Zod スキーマ駆動の Discriminated Union（`packages/shared` SSOT）でモデル化し、Phase 4 の Yjs/CRDT 同期に乗せ替えやすい純粋関数（pure functions）+ `useReducer` 構造に閉じ込める。Undo/Redo はローカル history stack で実装。画像は **D&D / paste の ObjectURL のみ**（API 経由のアップロードは Phase 4 へ送る）。`apps/web/src/App.tsx` のプレースホルダを `EditorPage` に差し替えて完了とする。

## User Story

As a snap-share の Phase 4 以降を実装する開発オーナー（兼最初のユーザー）,
I want 1 ユーザーで画像を読み込んで 4 種の注釈をストレスなく書ける編集体験を,
So that Phase 4 で Yjs を被せた瞬間に「2 タブで同期する編集体験」が即成立し、注釈モデル / 操作 API / Undo/Redo の輪郭がフロント側で固まった状態で同期実装に集中できる.

## Problem → Solution

**Current**: `apps/web/src/App.tsx` は `<AppShell><p>準備中 — Phase 1 monorepo init scaffold</p></AppShell>` のみ。`konva` / `react-konva` / `use-image` 依存はワークスペースに未登録（catalog にもなし）。`packages/shared` の SSOT は `RoomSchema` のみで注釈型は存在しない。Phase 0 のスパイク `spikes/konva-canvas/` には矩形 1 種の最小 PoC があるが、`apps/web` には移植されていない。

**Desired**: `apps/web` のトップ画面 = 編集エディタ。ツールバーから `select / rectangle / arrow / text / highlight` を切替、Stage に対する `mousedown → mousemove → mouseup` で図形を描画 / 配置できる。選択中図形はドラッグで移動、`Delete` / `Backspace` / `Cmd+Z` / `Cmd+Shift+Z` がキーボード操作で動作。テキストは Konva 上の見た目と HTML `<textarea>` の overlay 編集で確定。`packages/shared/src/annotation.ts` が `AnnotationSchema = z.discriminatedUnion('type', [...])` で 4 種を一段で表現し、Phase 4 で Yjs Y.Array<Y.Map> に乗せ替える土台になる。`pnpm turbo run lint typecheck test build` および E2E smoke がすべて green。

## Metadata

- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 3 — キャンバス & 注釈ツール（pending → in-progress 化）
- **Depends on**: Phase 1（complete）。Phase 2 / 2.5 とは独立だが、依存関係は Phase 1 のみ
- **Parallel with**: Phase 2.5（既に complete のため実質シーケンシャル）
- **Estimated Files**: 約 22 ファイル新規 + 5 ファイル更新
- **Estimated LOC**: 1400〜1800 行（テスト含む）
- **Confidence**: 7/10 — Konva スパイクで矩形操作と D&D は実装実証済み（gz 152.7 KB の bundle 実測済み）。残るリスクはテキスト overlay 編集と 4 ツール間の `mousedown/move/up` 状態遷移。Cmd/Ctrl 同時押し判定とキーリピート抑止に細かい罠が想定される

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────┐
│  apps/web → http://localhost:5173/                    │
│   ┌──────────────────────────┐                        │
│   │  snap-share (h1)         │                        │
│   │  準備中 — Phase 1 ...    │                        │
│   └──────────────────────────┘                        │
│  画像 D&D 受口なし、Konva 未配線、ツールバーなし      │
└──────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────┐
│  apps/web → http://localhost:5173/                        │
│  ┌──────────────────────────────────────────────────────┐│
│  │  snap-share                            [↶][↷]  [⌫]   ││
│  │ ──────────────────────────────────────────────────── ││
│  │  [▢ 選択] [▭ 矩形] [↗ 矢印] [Aa テキスト] [▒ ハイライト] ││
│  │                                                      ││
│  │  ┌──────────────────────────────────────────────┐    ││
│  │  │                                              │    ││
│  │  │   < 画像 + 注釈レイヤ (Konva Stage) >         │    ││
│  │  │                                              │    ││
│  │  │   矩形をドラッグで描画 / クリックで選択 /     │    ││
│  │  │   テキストはダブルクリックで再編集            │    ││
│  │  │                                              │    ││
│  │  └──────────────────────────────────────────────┘    ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  画像未ロード時: 中央に D&D / paste 受口の Empty State    │
└──────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 画像読込 | 経路なし | D&D / `Cmd+V` paste | ObjectURL のみ（Phase 4 で R2 経由統合） |
| ツール選択 | 経路なし | ツールバーのボタンクリック / `V/R/A/T/H` ショートカット | 1 クリックで切替 |
| 矩形/ハイライト作成 | — | `mousedown → drag → mouseup` で範囲指定 | リサイズ可能 |
| 矢印作成 | — | `mousedown → drag → mouseup` で始点・終点 | 直線 + 矢じり |
| テキスト作成 | — | クリック → `<textarea>` overlay 自動 focus → Enter/blur で確定 | 既存テキストは double-click で再編集 |
| 選択 | — | shape クリック / ステージクリックで解除 | 選択中はストローク強調 |
| 移動 | — | shape ドラッグ | `onDragEnd` で 1 history commit |
| 削除 | — | `Delete` / `Backspace` / ツールバーの 🗑 | 選択中のみ |
| Undo/Redo | — | `Cmd+Z` / `Cmd+Shift+Z`（mac）+ `Ctrl+Z` / `Ctrl+Shift+Z`（Win/Linux）+ ツールバー ↶/↷ | 上限 50 ステップ |
| ステージサイズ | — | `window` リサイズ追従 | スパイクと同パターン |

### Edge Case Behaviors（UX レベル）

- 画像未ロード時にツールバーは全て disabled（ヒントテキスト表示）
- `text` ツールで空文字確定したら自動削除（無意味な「空テキスト」を残さない）
- ドラッグ中の矩形/矢印は `commit` 前のプレビュー（破線 or 半透明）で表示。`mouseup` 時に履歴に commit
- ドラッグ距離が 4px 未満の場合は「クリックのみ」とみなし矩形/矢印は作らない（誤爆防止）
- `<textarea>` 編集中の `Cmd+Z` は **OS 標準のテキスト Undo に委譲**（`stopPropagation` でグローバル Undo を抑止）

---

## Mandatory Reading

実装前に必ず読むファイル。

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 191, 230-238 | Phase 3 行 / Goal / Scope / Success signal |
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 270-291 | Decisions Log: React 19 / Konva 152.7KB / shared = src 直参照 / web は単一 tsconfig / Zod v4 SSOT |
| P0 | `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx` | all | **Stage / Layer / KonvaImage / KonvaRect の最小ミラー対象**。`Readonly<T>` props / `e.cancelBubble` / `draggable` / `KonvaEventObject` |
| P0 | `spikes/konva-canvas/src/lib/rect.ts` | all | **Pure function + Immutability の手本**。`addRect/moveRect/removeRect` を 4 ツールに展開する |
| P0 | `spikes/konva-canvas/src/lib/__tests__/rect.test.ts` | all | **AAA + 不変性検証 (`expect(next).not.toBe(rects)`) のテスト形** |
| P0 | `spikes/konva-canvas/src/App.tsx` | all | D&D / `useStageSize` / objectURL クリーンアップ / Delete キー / `crypto.randomUUID` フォールバックの全部 |
| P0 | `spikes/konva-canvas/package.json` | all | `konva ^10.2` / `react-konva ^19.2` / `use-image ^1.1` の確定バージョン |
| P0 | `apps/web/src/App.tsx` | all | プレースホルダ（差し替え対象） |
| P0 | `apps/web/src/main.tsx` | all | `StrictMode` + `createRoot` の現行配線 |
| P0 | `apps/web/src/components/app-shell/AppShell.tsx` | all | レイアウト基盤（拡張余地） |
| P0 | `apps/web/package.json` | all | catalog 経由の deps 配線パターン |
| P0 | `apps/web/vite.config.ts` | all | `@` alias + `happy-dom` test 環境 + e2e 除外 |
| P0 | `apps/web/tsconfig.json` | all | 単一 tsconfig + `@/*` paths + `@cloudflare/workers-types` を含む types |
| P0 | `apps/web/src/styles/tokens.css` | all | OKLCH トークン（拡張対象） |
| P0 | `apps/web/src/styles/global.css` | all | `@import "tailwindcss"` + tokens の現状 |
| P0 | `packages/shared/src/room.ts` | all | **Zod v4 / `.readonly()` / `z.infer` / 定数 export パターンのミラー対象** |
| P0 | `packages/shared/src/__tests__/room.test.ts` | all | スキーマテストの AAA + 全プロパティ negative ケース |
| P0 | `packages/shared/src/index.ts` | all | barrel re-export パターン |
| P0 | `packages/shared/package.json` | all | catalog 経由 zod、test スクリプト |
| P0 | `pnpm-workspace.yaml` | all | catalog 拡張対象 |
| P0 | `tsconfig.base.json` | all | `verbatimModuleSyntax` / `noUncheckedIndexedAccess` / `strict` の前提 |
| P0 | `biome.json` | all | `useConst` / `noConsole: warn` / `noExplicitAny: warn` / シングルクォート |
| P0 | `.claude/rules/typescript/coding-style.md` | all | unknown narrowing / Zod 境界検証 / immutability / `interface` vs `type` |
| P0 | `.claude/rules/web/coding-style.md` | all | feature ベースの src 構成 + Animation-Only Properties + Semantic HTML |
| P0 | `.claude/rules/web/design-quality.md` | all | Banned Patterns（generic templates / unmodified shadcn defaults / safe gray-on-white）|
| P0 | `.claude/rules/common/coding-style.md` | all | KISS / DRY / YAGNI / 800 行上限 / 50 行関数上限 / 4 段ネスト上限 |
| P0 | `.claude/rules/common/testing.md` | all | 80% カバレッジ / TDD / AAA / 命名 |
| P1 | `apps/web/src/lib/utils.ts` | all | `cn()` ヘルパ |
| P1 | `apps/web/src/lib/api-client.ts` | all | `import.meta.env` の使い方（Phase 3 では呼ばないが、テスト環境変数の前例） |
| P1 | `apps/web/components.json` | all | shadcn aliases（必要時の参照のみ） |
| P1 | `apps/web/playwright.config.ts` | all | E2E 既存設定（chromium のみ）|
| P1 | `apps/web/e2e/landing.spec.ts` | all | E2E のミラー対象（最小拡張） |
| P1 | `apps/web/src/lib/__tests__/utils.test.ts` | all | `describe/it/expect` の既存形 |
| P1 | `.claude/PRPs/plans/completed/phase-2.5-api-modernization.plan.md` | 1-100 | 直近の plan 文書スタイルの参考 |
| P1 | `.claude/PRPs/reports/phase-0-tech-spike-report.md` | 100-156 | Konva 関連の Deviations（`onTap` 削除 / React 19 確定） |
| P1 | `.claude/rules/common/development-workflow.md` | all | TDD ループ + GitHub code search 優先方針 |
| P2 | `apps/api/src/routes/rooms.ts` | all | `createRoute` 形式の参考のみ（Phase 3 で API は呼ばない） |
| P2 | `docs/spikes/REPORT.md` | all | bundle size 152.7KB gz の根拠 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| react-konva 19 + React 19 | https://github.com/konvajs/react-konva | `<Stage>` / `<Layer>` / `<Image>` / `<Rect>` / `<Line>` / `<Arrow>` / `<Text>` / `<Group>` / `<Transformer>` / `<Circle>`。React 19 では `react-konva@^19` |
| Konva Arrow shape | https://konvajs.org/api/Konva.Arrow.html | `points: [x1, y1, x2, y2]` / `pointerLength` / `pointerWidth` / `fill` で矢じり、`stroke` / `strokeWidth` で線 |
| Konva Text editing パターン | https://konvajs.org/docs/sandbox/Editable_Text.html | Konva に native edit はない。HTML `<textarea>` を絶対配置でオーバーレイし `position` を Konva 座標 → DOM 座標に変換するのが定石 |
| Konva Transformer | https://konvajs.org/docs/select_and_transform/Basic_demo.html | リサイズ・回転 UI。Phase 3 では矩形/ハイライトのみリサイズ対応（矢印の Transformer は Should、外す） |
| use-image | https://github.com/konvajs/use-image | `const [image, status] = useImage(src, 'anonymous')`。`status` は `'loading' \| 'loaded' \| 'failed'` |
| Konva pixel ratio | https://konvajs.org/docs/performance/All_Performance_Tips.html | Retina で `Konva.pixelRatio = window.devicePixelRatio` を Stage 生成前に設定すると線がシャープになる |
| Zod v4 discriminatedUnion | https://zod.dev/?id=discriminated-unions | `z.discriminatedUnion('type', [A, B])`。v4 では parse パフォーマンスが v3 比 7-14× |
| HTMLDialogElement / textarea overlay | https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea | `position: absolute` + Stage の `getAbsolutePosition()` で座標合わせ |
| `crypto.randomUUID()` | https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID | `secure context` 必須。spike A の fallback パターンを再利用 |
| ResizeObserver | https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver | window resize ではなく container 境界 resize を取りたい場合の選択肢（Phase 3 では `useStageSize` の window resize で十分） |
| TanStack Router の保留判断 | ADR-0002 §Decision | Phase 3 では `import.meta.env.VITE_API_URL` 不要なので **TanStack Router/Query は導入しない**。Phase 4 のルーム URL 出現で初導入 |
| Tailwind v4 `@theme` | https://tailwindcss.com/docs/v4-beta | v4 は `@theme` ブロックで CSS 変数経由のトークン公開。Phase 3 では既存 `tokens.css` を最小限拡張 |

> **GOTCHA — `react-konva` の `KonvaEventObject<MouseEvent>` と `<TouchEvent>`**: Phase 0 Deviation #4 で発覚した型非互換。**タッチ系 (`onTap` / `onTouchStart` 等) は Phase 3 でも実装しない**。デスクトップ優先（Should スコープ）。

> **GOTCHA — Konva の SVG 入力**: `<KonvaImage image={image}>` に SVG を渡しても表示はできるが、SVG 内の `<style>` や CSS は適用されない（Konva は `<canvas>` ベース）。PRD の Should 「SVG 入力対応」は **PNG 化 fallback ではなく "そのまま image として描画" まで** とする。インタラクティブ SVG の編集は永遠にスコープ外。

> **GOTCHA — Tailwind v4 + Konva canvas**: Konva は内部で `<canvas>` を生成しスタイルを直接設定する。Tailwind ユーティリティで `<canvas>` を装飾するとレンダリングが崩れる。**ステージは無装飾の `<div>` ラッパに入れて、装飾は ラッパ側にだけ書く**。

> **GOTCHA — `<textarea>` overlay と Stage scroll**: Stage が viewport より大きい場合、`<textarea>` の絶対座標は `Stage` の `container().getBoundingClientRect()` 起点で計算する。Phase 3 ではステージ = `100vw × 100vh - toolbar` 固定で scroll しない設計にして回避する（ズーム/パンは Phase 6）。

> **GOTCHA — `crypto.randomUUID()` のテスト環境**: `happy-dom` v20 は `crypto.randomUUID` を提供する（Node.js 22 経由）。Test 環境でも `crypto.randomUUID()` 直呼び OK。ただし `Date.now()` を使う history commit のテストでは `vi.useFakeTimers()` で時刻を固定する。

> **GOTCHA — Cmd+Z と `<textarea>` の標準 Undo**: `<textarea>` フォーカス中に window の `keydown` で `Cmd+Z` を捕らえると、ブラウザの標準テキスト Undo を奪ってしまう。**`useKeyboardShortcuts` hook はターゲットが `INPUT` / `TEXTAREA` / `[contenteditable]` のときは何もしない**ガードを必ず入れる。

> **GOTCHA — `noUncheckedIndexedAccess` と Konva points**: `tsconfig.base.json` で `noUncheckedIndexedAccess: true` のため、`points[0]` は `number | undefined`。Konva の `Arrow` の `points` 配列を扱う関数は型ガード必須。`points: [number, number, number, number]` のタプル型で受ける設計にして回避。

---

## Patterns to Mirror

実装中はこのセクションを**他のファイルを開かなくても**書ける状態にしてある。

### IMPORT_HEADER
ソース: 既存の `apps/web/src/components/app-shell/AppShell.tsx:1` および `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx:1-4`

```typescript
import type { ReactNode } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect as KonvaRect } from 'react-konva';
import useImage from 'use-image';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Annotation } from '@snap-share/shared';
```

`type` のみの import は `verbatimModuleSyntax` のため必ず `import type`。

### NAMING_CONVENTION
ソース: `apps/web/src/components/app-shell/AppShell.tsx:5`、`spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx:22`

```typescript
type AnnotationLayerProps = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  selectedId: string | null;
  onShapeClick: (id: string) => void;
  onShapeDragEnd: (id: string, x: number, y: number) => void;
}>;

export const AnnotationLayer = ({ annotations, selectedId, onShapeClick, onShapeDragEnd }: AnnotationLayerProps) => {
  // ...
};
```

- コンポーネント: PascalCase, `export const Foo = (props: FooProps) => ...` の named arrow function
- props: `Readonly<{ ... }>` で囲む
- 配列 props: `ReadonlyArray<T>`
- イベントハンドラ: `on{Subject}{Event}` 形式（`onShapeDragEnd`）
- ファイル: PascalCase コンポーネント / camelCase ヘルパ
- フォルダ: kebab-case (`canvas/`, `app-shell/`, `empty-state/`)

### ZOD_SSOT_PATTERN
ソース: `packages/shared/src/room.ts:1-37`

```typescript
import { z } from 'zod';

export const FOO_REGEX = /^[A-Za-z0-9_-]{21}$/;
export const ALLOWED_KINDS = ['rectangle', 'arrow'] as const;

export const FooSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(ALLOWED_KINDS),
  })
  .readonly();

export type Foo = z.infer<typeof FooSchema>;
```

- 末尾に `.readonly()` を付ける（コンパイラ強制の immutability）
- `.regex(...)` / `.min/max` / `.int().positive()` の組み合わせで boundary 検証
- 定数 (`ALLOWED_*` / `MAX_*`) は同ファイルに `as const` で export

### PURE_OPERATIONS_PATTERN
ソース: `spikes/konva-canvas/src/lib/rect.ts:1-26`

```typescript
export const addRect = (
  rects: ReadonlyArray<Rect>,
  rect: Rect,
): ReadonlyArray<Rect> => [...rects, rect];

export const moveRect = (
  rects: ReadonlyArray<Rect>,
  id: string,
  dx: number,
  dy: number,
): ReadonlyArray<Rect> =>
  rects.map((r) => (r.id === id ? { ...r, x: r.x + dx, y: r.y + dy } : r));

export const removeRect = (
  rects: ReadonlyArray<Rect>,
  id: string,
): ReadonlyArray<Rect> => rects.filter((r) => r.id !== id);
```

- 引数は `ReadonlyArray<T>` で受ける
- 戻り値も `ReadonlyArray<T>`
- ID 不在時は no-op + 新しい配列返却
- Mutation は禁止（`expect(next).not.toBe(rects)` でテストで縛る）

### TEST_STRUCTURE_PATTERN
ソース: `spikes/konva-canvas/src/lib/__tests__/rect.test.ts:1-54`、`packages/shared/src/__tests__/room.test.ts:1-19`

```typescript
import { describe, expect, it } from 'vitest';
import type { Rect } from '../rect';
import { addRect, moveRect, removeRect } from '../rect';

const r1: Rect = { id: 'a', x: 0, y: 0, w: 10, h: 10 };
const r2: Rect = { id: 'b', x: 5, y: 5, w: 10, h: 10 };

describe('addRect', () => {
  it('returns a new array containing the appended rect', () => {
    const rects: ReadonlyArray<Rect> = [];
    const next = addRect(rects, r1);
    expect(next).toEqual([r1]);
    expect(next).not.toBe(rects);
  });

  it('does not mutate the input array', () => {
    const rects: ReadonlyArray<Rect> = [r1];
    const before = [...rects];
    addRect(rects, r2);
    expect(rects).toEqual(before);
  });
});
```

- `vitest` から `describe / expect / it` の3点 import
- ファイル先頭に test fixture 定数を置く
- 1 describe = 1 関数、1 it = 1 シナリオ
- AAA を明示的にコメントまたは空行で分ける

### REACT_HOOK_PATTERN
ソース: `spikes/konva-canvas/src/App.tsx:19-32`

```typescript
const useStageSize = () => {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
};
```

- カスタムフックは `use*` 命名 / camelCase
- 副作用は必ず cleanup を return
- 状態の初期値は lazy 初期化 (`useState(() => ...)`) でレンダ毎の DOM 参照を避ける

### LOG_PATTERN
ソース: `spikes/konva-canvas/src/App.tsx:62, 67, 79`

```typescript
console.error('[web] non-image file dropped', { type: file.type });
console.warn('[web] oversized image', { bytes: file.size });
console.info('[web] image loaded', { type: file.type, bytes: file.size });
```

- 接頭辞 `[web]`（API 側は `[api]`、`logger.ts` 経由）
- biome `noConsole: warn` のため、`web` 側で console を意図的に使うファイルは先頭に
  `// biome-ignore-all lint/suspicious/noConsole: this module is the user-facing diagnostic logger.` を付ける
- もしくは `apps/web/src/lib/logger.ts` を新設し、`apps/api/src/lib/logger.ts:1-13` をミラーする（**こちらを採用**）

### IMMUTABILITY_PATTERN
ソース: `.claude/rules/typescript/coding-style.md:130-153`

```typescript
const updateRectangle = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  patch: Readonly<Partial<Pick<RectangleAnnotation, 'x' | 'y' | 'width' | 'height' | 'stroke'>>>,
): ReadonlyArray<Annotation> =>
  annotations.map((a) =>
    a.id === id && a.type === 'rectangle' ? { ...a, ...patch } : a,
  );
```

- spread operator で新オブジェクト生成（mutation 禁止）
- `Readonly<Partial<Pick<...>>>` で更新可能フィールドを型で限定

---

## Files to Change

### Created（22 ファイル）

| File | Action | Justification |
|---|---|---|
| `packages/shared/src/annotation.ts` | CREATE | Zod スキーマ駆動 SSOT で 4 種注釈の Discriminated Union を定義（Phase 4 の Yjs 境界検証に再利用） |
| `packages/shared/src/__tests__/annotation.test.ts` | CREATE | 各 schema の parse 成功/失敗 + discriminator narrowing テスト |
| `apps/web/src/lib/logger.ts` | CREATE | `[web]` prefix 付き console wrapper（`apps/api/src/lib/logger.ts` をミラー） |
| `apps/web/src/lib/id.ts` | CREATE | `crypto.randomUUID()` + フォールバック ID 生成器 |
| `apps/web/src/lib/__tests__/id.test.ts` | CREATE | id 生成の一意性 + 形式テスト |
| `apps/web/src/domain/annotation/operations.ts` | CREATE | 4 種注釈に対する pure functions（add/move/remove/setStyle/setText/setEndpoints/resize） |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | CREATE | 全 operation の AAA + 不変性検証 |
| `apps/web/src/hooks/useStageSize.ts` | CREATE | window resize 追従（スパイクからの抽出） |
| `apps/web/src/hooks/useImageSource.ts` | CREATE | File → ObjectURL + cleanup（スパイクからの抽出と一般化） |
| `apps/web/src/hooks/useHistory.ts` | CREATE | Undo/Redo の history stack（過去/現在/未来）+ 上限管理 |
| `apps/web/src/hooks/__tests__/useHistory.test.ts` | CREATE | commit / undo / redo / 上限 / 連続 commit のテスト |
| `apps/web/src/hooks/useAnnotationsStore.ts` | CREATE | useReducer ベースの注釈 + 選択 + ツール状態管理 |
| `apps/web/src/hooks/__tests__/useAnnotationsStore.test.ts` | CREATE | reducer の各 action テスト + history 連携 |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | CREATE | Delete / Cmd+Z / Cmd+Shift+Z / V/R/A/T/H ツール切替 + INPUT/TEXTAREA ガード |
| `apps/web/src/components/canvas/CanvasStage.tsx` | CREATE | Konva Stage コンテナ（mousedown/move/up の draft annotation state machine） |
| `apps/web/src/components/canvas/ImageLayer.tsx` | CREATE | 画像表示レイヤ（`use-image`） |
| `apps/web/src/components/canvas/AnnotationLayer.tsx` | CREATE | 全注釈ディスパッチ（type で shape コンポーネントを切替） |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | CREATE | 矩形描画 + 選択枠 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | CREATE | 矢印描画（Konva `Arrow`） |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | CREATE | Konva `Text` 表示 + 選択枠 + ダブルクリックで edit モード起動 |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | CREATE | 半透明矩形（`opacity: 0.35`） |
| `apps/web/src/components/canvas/TextEditorOverlay.tsx` | CREATE | HTML `<textarea>` 絶対配置 overlay（座標合わせ + Enter/blur/Escape 確定） |
| `apps/web/src/components/toolbar/Toolbar.tsx` | CREATE | ツール切替 + Undo/Redo + Delete ボタン |
| `apps/web/src/components/toolbar/ToolButton.tsx` | CREATE | 個別ツールボタン（aria-pressed + ショートカット表示） |
| `apps/web/src/components/empty-state/DropZone.tsx` | CREATE | 画像未ロード時の D&D / paste 受口 |
| `apps/web/src/pages/EditorPage.tsx` | CREATE | App 直下の単一ページ。AppShell + Toolbar + CanvasStage または DropZone |

### Updated（5 ファイル）

| File | Action | Diff (概算) |
|---|---|---|
| `pnpm-workspace.yaml` | UPDATE | catalog に `konva: ^10.2` / `react-konva: ^19.2` / `use-image: ^1.1` 追加 (+3) |
| `apps/web/package.json` | UPDATE | dependencies に `konva: catalog:` / `react-konva: catalog:` / `use-image: catalog:` 追加 (+3) |
| `packages/shared/src/index.ts` | UPDATE | `export * from './annotation';` 1 行追加 (+1) |
| `apps/web/src/styles/tokens.css` | UPDATE | annotation 関連トークン追加（`--color-tool-rect` / `--color-tool-arrow` / `--color-highlight-yellow` / `--space-toolbar`）(+8) |
| `apps/web/src/App.tsx` | UPDATE | `<EditorPage />` を返すよう書き換え (-3 +3) |
| `apps/web/e2e/landing.spec.ts` | UPDATE | E2E に「ツールバーがレンダリングされる」smoke を追加 (+10) |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 3 行 `pending` → `in-progress` + plan link (+1 -1) |

合計: 22 新規 + 7 更新 = 29 ファイル touched。

## NOT Building（明示的にスコープ外）

- **API 統合（POST /rooms / GET /rooms/:id/image）**: Phase 4 で Yjs と一緒に統合
- **Yjs / CRDT / WebSocket 同期**: Phase 4
- **TanStack Router / Query / Form**: Phase 4 でルーム URL 出現時に初導入。Phase 3 は単一ページ
- **Authentication / パスワード保護**: Phase 5
- **TTL / DO Alarms**: Phase 5
- **PNG エクスポート**: Phase 6
- **shadcn UI コンポーネントの本格適用**: Phase 6（Phase 3 では Tailwind 直書きで十分。Button のみ shadcn add するかは任意。`components.json` 設定だけは Phase 1 で完了済）
- **モバイル / タッチ操作**: Should スコープ。Phase 6 でレスポンシブ対応時に検討。Phase 0 で発覚した `react-konva` の Touch 型不互換が再発するため Phase 3 では絶対に触らない
- **ズーム / パン / 視点操作**: Phase 6
- **レイヤー UI（z-order 並べ替え）**: Phase 6 / Could スコープ
- **コメントスレッド / ピン**: Could スコープ（PRD）
- **タッチデバイス向けピンチ操作**: Won't（PRD）
- **Konva `Transformer` の本格適用（リサイズハンドル UI）**: Phase 6 / Should スコープ。Phase 3 は移動 + 削除のみで完結
- **画像のリサイズ・回転 UI**: Won't（PRD）
- **形状の塗りつぶし色選択 UI**: Phase 6 / Should スコープ。Phase 3 は デフォルト色のみ（矩形 = アクセント色 / 矢印 = アクセント色 / テキスト = テキスト色 / ハイライト = 黄色）
- **太字/斜体/フォント選択**: Won't（MVP）
- **Konva のレイヤー数最適化（多層化）**: Phase 6 / 性能改善時に検討
- **i18n（複数言語切替）**: Phase 6 で英語 UI fallback の Should スコープ。Phase 3 は日本語 + 必要箇所のみ

---

## Step-by-Step Tasks

### Task 1: catalog 拡張（konva / react-konva / use-image）

- **ACTION**: `pnpm-workspace.yaml` の `catalog:` セクションに 3 依存を追加
- **IMPLEMENT**:
  ```yaml
  catalog:
    # ... 既存
    konva: ^10.2
    react-konva: ^19.2
    use-image: ^1.1
  ```
- **MIRROR**: 既存の `pnpm-workspace.yaml` の Phase 1/2 で確立した順序（typescript → vitest → zod → ...）に追記
- **GOTCHA**: バージョンは `spikes/konva-canvas/package.json` で動作実証済の `^10.2` / `^19.2` / `^1.1` を使う。`konva@11.x` は 2026 年 3 月リリースだが破壊的変更を未追跡のため避ける
- **VALIDATE**: `pnpm install` がエラーなく完走、`pnpm-lock.yaml` 更新

### Task 2: `apps/web/package.json` deps 追加

- **ACTION**: `apps/web/package.json` の `dependencies` に 3 依存を catalog 経由で追加
- **IMPLEMENT**:
  ```json
  "dependencies": {
    "@snap-share/api": "workspace:*",
    "@snap-share/shared": "workspace:*",
    "clsx": "^2.1",
    "hono": "^4.12",
    "konva": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "react-konva": "catalog:",
    "tailwind-merge": "^3.0",
    "use-image": "catalog:"
  },
  ```
- **MIRROR**: `apps/api/package.json:7-12` の catalog 参照
- **GOTCHA**: `react-konva` は peer に `react` / `react-dom` を要求。catalog の `react: ^19.2` で peer 整合
- **VALIDATE**: `pnpm install` 緑、`pnpm -F @snap-share/web typecheck` 緑（既存ファイルだけで）

### Task 3: `packages/shared/src/annotation.ts` を TDD で作成（テスト先行）

- **ACTION**: `packages/shared/src/__tests__/annotation.test.ts` を先に書き、次に `annotation.ts` を実装
- **IMPLEMENT**: テストが要求するスキーマを順次実装
  - 定数: `ANNOTATION_TYPES = ['rectangle', 'arrow', 'text', 'highlight'] as const`
  - 定数: `MAX_ANNOTATIONS_PER_ROOM = 200`（Phase 4 の DO Storage 上限を見越して暫定）
  - 定数: `MAX_TEXT_LENGTH = 500`
  - 定数: `COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/`
  - schema: `PointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).readonly()`
  - schema: `BaseAnnotationFields = { id: z.string().min(1), createdAt: z.number().int().nonnegative() }`
  - schema: `RectangleAnnotationSchema` (type='rectangle' / x / y / width.positive / height.positive / stroke.regex / strokeWidth.positive.max(20))
  - schema: `ArrowAnnotationSchema` (type='arrow' / from / to / stroke / strokeWidth)
  - schema: `TextAnnotationSchema` (type='text' / x / y / text.max(500) / fontSize.positive.max(200) / fill)
  - schema: `HighlightAnnotationSchema` (type='highlight' / x / y / width / height / fill)
  - `AnnotationSchema = z.discriminatedUnion('type', [...])`
  - export types: `Annotation`, `AnnotationKind`, `RectangleAnnotation`, `ArrowAnnotation`, `TextAnnotation`, `HighlightAnnotation`, `Point`
- **MIRROR**:
  - `packages/shared/src/room.ts:1-37` の Zod v4 + `.readonly()` + `z.infer` パターン
  - `packages/shared/src/__tests__/room.test.ts:1-160` のテスト構造
- **IMPORTS**: `import { z } from 'zod';`
- **GOTCHA**:
  - `discriminatedUnion` の各 schema は `.readonly()` ではなく `.strict()` のみにする（v4 の制約: discriminatedUnion 内の `.readonly()` は型推論を壊す可能性）。**実装時に検証**して、もし型エラーが出たら `.strict()` 単独で行く
  - `ColorSchema = z.string().regex(COLOR_REGEX)` で hex 6 桁のみ受ける（短縮形 #fff は弾く、これで透明度のフォーマット問題回避）
  - `text` フィールドはサニタイズ前のため、Phase 4 の Yjs 経由で受信する際は再度 schema parse する想定（XSS 対策）
- **VALIDATE**:
  - `pnpm -F @snap-share/shared test` で全 16 件以上の新規テスト緑
  - `pnpm -F @snap-share/shared typecheck` 緑

### Task 4: `packages/shared/src/index.ts` 更新

- **ACTION**: barrel に `export * from './annotation';` を追加
- **IMPLEMENT**:
  ```typescript
  export * from './room';
  export * from './annotation';
  ```
- **MIRROR**: 既存 `packages/shared/src/index.ts:1` の形
- **VALIDATE**: `import { AnnotationSchema, type Annotation } from '@snap-share/shared'` が apps/web から解決可能（次タスクの空 Test で確認）

### Task 5: `apps/web/src/lib/logger.ts` 作成

- **ACTION**: `apps/api/src/lib/logger.ts` を `[web]` prefix で完全ミラー
- **IMPLEMENT**:
  ```typescript
  // biome-ignore-all lint/suspicious/noConsole: this module is the single console wrapper for the web app.
  const PREFIX = '[web]';

  type Meta = Record<string, unknown>;

  export const logger = {
    info: (msg: string, meta?: Meta) =>
      meta ? console.info(PREFIX, msg, meta) : console.info(PREFIX, msg),
    warn: (msg: string, meta?: Meta) =>
      meta ? console.warn(PREFIX, msg, meta) : console.warn(PREFIX, msg),
    error: (msg: string, meta?: Meta) =>
      meta ? console.error(PREFIX, msg, meta) : console.error(PREFIX, msg),
  };
  ```
- **MIRROR**: `apps/api/src/lib/logger.ts:1-13` を 1 行 prefix 違いで複製
- **GOTCHA**: ファイル先頭の biome-ignore-all は **`// biome-ignore-all`**（all 必須）。`// biome-ignore` だと次の 1 行のみで効かない
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑、`pnpm lint` 緑

### Task 6: `apps/web/src/lib/id.ts` を TDD で作成

- **ACTION**: `apps/web/src/lib/__tests__/id.test.ts` を先に書き、次に実装
- **IMPLEMENT**:
  ```typescript
  export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  };
  ```
- **MIRROR**: `spikes/konva-canvas/src/App.tsx:12-17`
- **GOTCHA**: テストでは `vi.stubGlobal('crypto', undefined)` で fallback 経路を踏む 1 ケースを用意
- **VALIDATE**: `apps/web/src/lib/__tests__/id.test.ts` で 3+ ケース（一意性、UUID 形式、fallback）緑

### Task 7: `apps/web/src/domain/annotation/operations.ts` を TDD で作成

- **ACTION**: `apps/web/src/domain/annotation/__tests__/operations.test.ts` を先に書き、次に実装
- **IMPLEMENT**: 関数群（すべて pure / immutable）
  - `addAnnotation(annotations, annotation): ReadonlyArray<Annotation>` — 末尾に append
  - `removeAnnotation(annotations, id): ReadonlyArray<Annotation>` — id 一致を filter
  - `moveAnnotation(annotations, id, dx, dy): ReadonlyArray<Annotation>` — type ごとに座標オフセット適用（rectangle/highlight/text は x/y、arrow は from と to の両方）
  - `resizeRectangle(annotations, id, width, height): ReadonlyArray<Annotation>` — type='rectangle' のみ更新
  - `resizeHighlight(annotations, id, width, height): ReadonlyArray<Annotation>` — type='highlight' のみ更新
  - `setArrowEndpoints(annotations, id, from, to): ReadonlyArray<Annotation>` — type='arrow' のみ更新
  - `setText(annotations, id, text): ReadonlyArray<Annotation>` — type='text' のみ更新
  - `setStroke(annotations, id, stroke): ReadonlyArray<Annotation>` — rectangle/arrow のみ
  - `setFill(annotations, id, fill): ReadonlyArray<Annotation>` — text/highlight のみ
- **MIRROR**: `spikes/konva-canvas/src/lib/rect.ts:9-25` の immutable 操作パターン × 4 ツール展開
- **IMPORTS**:
  ```typescript
  import type {
    Annotation,
    Point,
    RectangleAnnotation,
    ArrowAnnotation,
    TextAnnotation,
    HighlightAnnotation,
  } from '@snap-share/shared';
  ```
- **GOTCHA**:
  - 「型違いに対する操作」は **no-op で元配列を新インスタンスとして返す**（例: `resizeRectangle` を arrow id に対して呼ぶ → 元と同じ内容の新配列）
  - `moveAnnotation` の arrow case は from/to **両方** に dx/dy を加える（始点だけ動かさない）
  - `setText` で空文字を許す（呼び出し側で空文字 → `removeAnnotation` を判断する）
- **VALIDATE**:
  - 各関数 3+ ケース × 9 関数 = 27+ ケース緑
  - 全テストで `expect(next).not.toBe(input)` を含めて mutation 禁止を強制

### Task 8: `apps/web/src/hooks/useStageSize.ts` を抽出

- **ACTION**: スパイクの `useStageSize` を hook として独立ファイル化
- **IMPLEMENT**: スパイク `App.tsx:19-32` をそのまま移植
- **MIRROR**: `spikes/konva-canvas/src/App.tsx:19-32`
- **GOTCHA**: SSR 環境では `window` 未定義。`apps/web` は SPA なので問題ないが、`useState` の lazy initializer で `typeof window !== 'undefined'` のガードを **入れない**（無駄な防衛）。SSR したくなったときに直す
- **VALIDATE**: typecheck 緑（テストは Phase 3 では skip — `happy-dom` の `resize` event 配線は brittle、E2E でカバー）

### Task 9: `apps/web/src/hooks/useImageSource.ts` を作成

- **ACTION**: File / Blob → ObjectURL の lifecycle を管理するフック
- **IMPLEMENT**:
  ```typescript
  type ImageSource = Readonly<{
    url: string;
    contentType: string;
    bytes: number;
  }>;

  type UseImageSource = Readonly<{
    source: ImageSource | null;
    error: string | null;
    loadFromFile: (file: File) => void;
    clear: () => void;
  }>;

  export const useImageSource = (): UseImageSource => {
    // useRef で objectURL を保持
    // loadFromFile: バリデーション → revokeObjectURL → URL.createObjectURL → setState
    // clear: revoke + state リセット
    // unmount cleanup で revoke
  };
  ```
- **MIRROR**: `spikes/konva-canvas/src/App.tsx:36-80` の D&D 内ロジックをフック化
- **IMPORTS**: `import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '@snap-share/shared';`
- **GOTCHA**:
  - **クリーンアップ漏れは memory leak の温床**。useRef + useEffect の return での revoke を必ずペアにする
  - バリデーション順は: type → size。size を先にすると 100MB の HTML をパースしようとして遅延
  - svg は `image/svg+xml` を含む（共有定数で既に正しい）
- **VALIDATE**:
  - 型チェック緑
  - happy-dom + `vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })` で 5+ ケース

### Task 10: `apps/web/src/hooks/useHistory.ts` を TDD で作成

- **ACTION**: テスト先行で undo/redo stack を実装
- **IMPLEMENT**:
  ```typescript
  const HISTORY_LIMIT = 50;

  type HistoryState<T> = Readonly<{
    past: ReadonlyArray<T>;
    present: T;
    future: ReadonlyArray<T>;
  }>;

  type HistoryControls<T> = Readonly<{
    state: T;
    canUndo: boolean;
    canRedo: boolean;
    commit: (next: T) => void;
    replace: (next: T) => void;  // ドラッグ中の中間更新（commit せず）
    undo: () => void;
    redo: () => void;
    reset: (initial: T) => void;
  }>;

  export const useHistory = <T,>(initial: T): HistoryControls<T> => { ... };
  ```
- **MIRROR**: `spikes/konva-canvas/src/lib/rect.ts` の immutable パターン
- **GOTCHA**:
  - `commit` で `present !== next`（参照比較）を必ずチェック。同じ参照なら past にプッシュしない（Konva の同期 callback で重複 commit する罠を避ける）
  - `past` が `HISTORY_LIMIT` を超えたら先頭を破棄（slice）
  - `replace` は present のみ更新、past/future はそのまま（ドラッグ中のプレビュー用）
  - `redo` 後に新 commit すると future はクリア
- **VALIDATE**:
  - 7+ ケース: commit, replace, undo, redo, redo→commit→future cleared, past の上限到達時, 同一参照時の no-op

### Task 11: `apps/web/src/hooks/useAnnotationsStore.ts` を TDD で作成

- **ACTION**: Annotation + 選択 + ツール状態を `useReducer` でまとめる
- **IMPLEMENT**:
  ```typescript
  type Tool = 'select' | 'rectangle' | 'arrow' | 'text' | 'highlight';

  type State = Readonly<{
    annotations: ReadonlyArray<Annotation>;
    selectedId: string | null;
    tool: Tool;
  }>;

  type Action =
    | { type: 'tool/set'; tool: Tool }
    | { type: 'select/set'; id: string | null }
    | { type: 'annotation/add'; annotation: Annotation }
    | { type: 'annotation/remove'; id: string }
    | { type: 'annotation/move'; id: string; dx: number; dy: number }
    | { type: 'annotation/resize-rect'; id: string; width: number; height: number }
    | { type: 'annotation/resize-highlight'; id: string; width: number; height: number }
    | { type: 'annotation/set-arrow-endpoints'; id: string; from: Point; to: Point }
    | { type: 'annotation/set-text'; id: string; text: string }
    | { type: 'state/replace'; state: State };  // history 連動の hard set

  const reducer = (state: State, action: Action): State => { ... };

  export const useAnnotationsStore = (): {
    state: State;
    canUndo: boolean;
    canRedo: boolean;
    dispatch: React.Dispatch<Action>;
    commit: () => void;
    undo: () => void;
    redo: () => void;
  } => { ... };
  ```
- **MIRROR**:
  - reducer 形式は React 公式の Discriminated Union pattern
  - immutable update は Task 7 の `operations.ts` を呼ぶ
- **GOTCHA**:
  - `useReducer` の state を直接 `useHistory` の present に渡し、`commit` 時にスナップショット保存
  - `state/replace` action で `useHistory.undo/redo` の結果を反映
  - `tool` 切替時は **history に commit しない**（ツール切替は undo 対象外）
- **VALIDATE**: 10+ ケース（各 action × happy/edge）

### Task 12: `apps/web/src/hooks/useKeyboardShortcuts.ts` を作成

- **ACTION**: キーボードショートカットを window 単位で配線
- **IMPLEMENT**:
  ```typescript
  type Shortcuts = Readonly<{
    onUndo: () => void;
    onRedo: () => void;
    onDelete: () => void;
    onSetTool: (tool: Tool) => void;
    onEscape: () => void;
  }>;

  export const useKeyboardShortcuts = (s: Shortcuts): void => {
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          s.onUndo();
          return;
        }
        if (mod && (e.key.toLowerCase() === 'z' && e.shiftKey || e.key.toLowerCase() === 'y')) {
          e.preventDefault();
          s.onRedo();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          s.onDelete();
          return;
        }
        if (e.key === 'Escape') {
          s.onEscape();
          return;
        }
        // tool shortcuts
        const map: Record<string, Tool> = { v: 'select', r: 'rectangle', a: 'arrow', t: 'text', h: 'highlight' };
        const tool = map[e.key.toLowerCase()];
        if (tool && !mod) {
          s.onSetTool(tool);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [s]);
  };
  ```
- **MIRROR**: `spikes/konva-canvas/src/App.tsx:122-131` の keydown listener パターン
- **GOTCHA**:
  - `<textarea>` フォーカス中は **何もしない**（ブラウザ標準テキスト Undo 優先）
  - `Backspace` も削除に割り当てる（macOS では Delete キーが forward delete のため `Backspace` の方が一般的）
  - tool ショートカットは `mod=false` のみ反応（`Cmd+R` が browser reload を奪わない）
  - `useEffect` の deps に `s` を入れる場合、呼び出し側は `s` を `useMemo` でラップ。**そうしないと無限再登録**になる。`s` を `Ref` に格納して deps 空配列でも可。**実装時はどちらを採用するか実装者判断**。テストで verify
- **VALIDATE**: typecheck 緑、E2E で「Cmd+Z で undo が起きる」を 1 件カバー（Phase 6 で本格 E2E 拡張）

### Task 13: `apps/web/src/components/canvas/shapes/RectangleShape.tsx` を作成

- **ACTION**: 単一矩形のレンダラ
- **IMPLEMENT**:
  ```typescript
  type RectangleShapeProps = Readonly<{
    annotation: RectangleAnnotation;
    isSelected: boolean;
    onClick: (id: string) => void;
    onDragEnd: (id: string, x: number, y: number) => void;
  }>;

  export const RectangleShape = ({ annotation, isSelected, onClick, onDragEnd }: RectangleShapeProps) => (
    <KonvaRect
      x={annotation.x}
      y={annotation.y}
      width={annotation.width}
      height={annotation.height}
      stroke={annotation.stroke}
      strokeWidth={isSelected ? annotation.strokeWidth + 1 : annotation.strokeWidth}
      // ... draggable / cancelBubble
    />
  );
  ```
- **MIRROR**: `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx:38-55` の KonvaRect 設定
- **GOTCHA**:
  - `onClick` で `e.cancelBubble = true` してステージレベルのクリック (deselect) を抑止
  - `draggable` は `isSelected` のときだけ `true` にする方が混乱が少ない（仕様判断: Phase 3 では **常に draggable**、ツール=select でなくても掴めるようにする方が UX が軽い）
- **VALIDATE**: typecheck 緑

### Task 14: `apps/web/src/components/canvas/shapes/ArrowShape.tsx` を作成

- **ACTION**: 矢印レンダラ（Konva `Arrow`）
- **IMPLEMENT**:
  ```typescript
  import { Arrow as KonvaArrow } from 'react-konva';

  type ArrowShapeProps = Readonly<{
    annotation: ArrowAnnotation;
    isSelected: boolean;
    onClick: (id: string) => void;
    onDragEnd: (id: string, dx: number, dy: number) => void;
  }>;

  const POINTER_LENGTH = 12;
  const POINTER_WIDTH = 12;

  export const ArrowShape = ({ annotation, isSelected, onClick, onDragEnd }: ArrowShapeProps) => (
    <KonvaArrow
      points={[annotation.from.x, annotation.from.y, annotation.to.x, annotation.to.y]}
      pointerLength={POINTER_LENGTH}
      pointerWidth={POINTER_WIDTH}
      stroke={annotation.stroke}
      fill={annotation.stroke}
      strokeWidth={isSelected ? annotation.strokeWidth + 1 : annotation.strokeWidth}
      // draggable + click handler
    />
  );
  ```
- **MIRROR**: 矢印は `points` 配列ベースなので RectangleShape とは構造が異なる。Konva 公式 [Arrow](https://konvajs.org/api/Konva.Arrow.html) を直接参照
- **GOTCHA**:
  - `Arrow` の draggable はオブジェクト全体を移動。`onDragEnd` で `e.target.x() / e.target.y()` は **オフセット** が返る（始点絶対座標ではない）。dx/dy として親に通知し、reducer 側で from/to 両方に適用
  - `tsconfig.base.json` の `noUncheckedIndexedAccess` で `points: [number, number, number, number]` のタプル型として受け取らないと `points[0]` が `number | undefined`
- **VALIDATE**: typecheck 緑、ブラウザで矢印描画 + ドラッグ移動が 1 タスク内で確認

### Task 15: `apps/web/src/components/canvas/shapes/TextShape.tsx` を作成

- **ACTION**: テキストレンダラ + ダブルクリックで edit モード起動
- **IMPLEMENT**:
  ```typescript
  import { Text as KonvaText, Group } from 'react-konva';

  type TextShapeProps = Readonly<{
    annotation: TextAnnotation;
    isSelected: boolean;
    isEditing: boolean;  // 編集中は Konva Text を hide（textarea が代わり）
    onClick: (id: string) => void;
    onDragEnd: (id: string, x: number, y: number) => void;
    onDoubleClick: (id: string) => void;
  }>;
  ```
- **GOTCHA**:
  - `isEditing` のとき `<KonvaText visible={false} />` にして overlay の `<textarea>` がそのまま見える状態にする
  - 選択枠は別途 transparent `<Rect>` をテキスト矩形と同サイズで重ね、`stroke` を accent 色に
  - `onDblClick`（onDoubleClick だが Konva の prop は `onDblClick`）でダブルクリックを捕捉
- **VALIDATE**: typecheck 緑

### Task 16: `apps/web/src/components/canvas/shapes/HighlightShape.tsx` を作成

- **ACTION**: 半透明矩形（マーカー風）
- **IMPLEMENT**:
  ```typescript
  const HIGHLIGHT_OPACITY = 0.35;

  export const HighlightShape = ({ annotation, isSelected, onClick, onDragEnd }: HighlightShapeProps) => (
    <KonvaRect
      x={annotation.x}
      y={annotation.y}
      width={annotation.width}
      height={annotation.height}
      fill={annotation.fill}
      opacity={HIGHLIGHT_OPACITY}
      stroke={isSelected ? 'var(--color-accent)' : undefined}
      strokeWidth={isSelected ? 2 : 0}
      // ...
    />
  );
  ```
- **GOTCHA**:
  - Konva は `var(--*)` の CSS 変数を解釈しない。**JSX 内では計算済みの色 (`#xxxxxx` or `rgba(...)`) を渡す**。トークンを Konva に渡すには CSS 経由で `getComputedStyle(document.documentElement).getPropertyValue('--color-accent')` か、ハードコードした定数を `apps/web/src/components/canvas/colors.ts` 等に集約する
  - **採用**: `colors.ts` を canvas/ 配下に作って `OUTLINE_ACCENT = '#5b6dff'` 等のハードコードを 1 か所に集める。`tokens.css` と物理的に値を合わせる
- **VALIDATE**: typecheck 緑

### Task 17: `apps/web/src/components/canvas/AnnotationLayer.tsx` を作成

- **ACTION**: type で shape コンポーネントをディスパッチ
- **IMPLEMENT**:
  ```typescript
  type AnnotationLayerProps = Readonly<{
    annotations: ReadonlyArray<Annotation>;
    selectedId: string | null;
    editingTextId: string | null;
    onShapeClick: (id: string) => void;
    onShapeDragEnd: (id: string, dx: number, dy: number) => void;
    onTextDoubleClick: (id: string) => void;
  }>;

  export const AnnotationLayer = (props: AnnotationLayerProps) => (
    <Layer>
      {props.annotations.map((a) => {
        const isSelected = a.id === props.selectedId;
        switch (a.type) {
          case 'rectangle':
            return <RectangleShape key={a.id} annotation={a} isSelected={isSelected} ... />;
          case 'arrow':
            return <ArrowShape key={a.id} annotation={a} isSelected={isSelected} ... />;
          case 'text':
            return <TextShape key={a.id} annotation={a} isSelected={isSelected} isEditing={props.editingTextId === a.id} ... />;
          case 'highlight':
            return <HighlightShape key={a.id} annotation={a} isSelected={isSelected} ... />;
        }
      })}
    </Layer>
  );
  ```
- **GOTCHA**:
  - `noFallthroughCasesInSwitch` のため、すべての case で `return` する
  - `discriminatedUnion` の網羅性は TS の exhaustive check で担保。default case で `const _: never = a;` を入れて型レベル網羅性を強制
- **VALIDATE**: typecheck 緑

### Task 18: `apps/web/src/components/canvas/ImageLayer.tsx` を作成

- **ACTION**: `use-image` で画像レイヤを単独管理
- **IMPLEMENT**:
  ```typescript
  type ImageLayerProps = Readonly<{
    src: string;
  }>;

  export const ImageLayer = ({ src }: ImageLayerProps) => {
    const [image] = useImage(src);
    return <Layer>{image && <KonvaImage image={image} />}</Layer>;
  };
  ```
- **MIRROR**: `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx:32-37`
- **GOTCHA**: `useImage` の第 2 引数 `crossOrigin` は ObjectURL 経由なら不要、R2 経由（Phase 4）で必要になる
- **VALIDATE**: typecheck 緑

### Task 19: `apps/web/src/components/canvas/CanvasStage.tsx` を作成（中核）

- **ACTION**: ステージ + draft annotation の state machine
- **IMPLEMENT**:
  - Stage の `onMouseDown` / `onMouseMove` / `onMouseUp` でツール別 draft annotation を作成 / 更新 / commit
  - tool=select の場合: ステージ上をクリックすると selection clear、図形クリックは図形側で `e.cancelBubble`
  - tool=rectangle/highlight: mousedown で起点記録 → mousemove で `replace`（draft annotation を present に挿入）→ mouseup で `commit`（4px 未満なら破棄）
  - tool=arrow: 同上だが draft は arrow 形式
  - tool=text: クリック単発で空 TextAnnotation 追加 + editing 開始
- **MIRROR**:
  - `spikes/konva-canvas/src/App.tsx:82-103` の handleStageClick パターン
  - 4 ツール展開は新規設計
- **GOTCHA**:
  - `e.target === e.target.getStage()` でステージ自身のクリック判定（図形クリックを除外）
  - mousedown 時に `setIsDragging(true)` し、mousemove 内で `replace`、mouseup で `commit`
  - draft annotation は `useState` で持つ（reducer に入れずローカル）→ ドラッグ中は描画用の present に注入する関数を用意
- **VALIDATE**: ブラウザで全 4 ツールが動作

### Task 20: `apps/web/src/components/canvas/TextEditorOverlay.tsx` を作成

- **ACTION**: HTML `<textarea>` を Stage 上に絶対配置
- **IMPLEMENT**:
  ```typescript
  type TextEditorOverlayProps = Readonly<{
    annotation: TextAnnotation;
    stageContainerRect: DOMRect;
    onCommit: (text: string) => void;
    onCancel: () => void;
  }>;

  export const TextEditorOverlay = (props: TextEditorOverlayProps) => {
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
    return (
      <textarea
        ref={ref}
        defaultValue={props.annotation.text}
        style={{
          position: 'absolute',
          left: props.stageContainerRect.left + props.annotation.x,
          top: props.stageContainerRect.top + props.annotation.y,
          fontSize: props.annotation.fontSize,
          color: props.annotation.fill,
          // resize/border は accent 色で
        }}
        onBlur={(e) => props.onCommit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); props.onCommit(e.currentTarget.value); }
          if (e.key === 'Escape') { e.preventDefault(); props.onCancel(); }
          e.stopPropagation();  // global undo を奪わせない
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  };
  ```
- **GOTCHA**:
  - `onKeyDown` で `e.stopPropagation()` を **必ず**呼ぶ（window レベルのキーボードショートカットがテキスト編集を妨害しないように）
  - `defaultValue` で初期値、`onBlur` 時に `currentTarget.value` 取得（controlled より uncontrolled の方が IME 入力に強い）
  - 確定後はテキストが空なら呼び出し側で `removeAnnotation` する（このコンポーネントは onCommit に空文字を渡すだけ、判断は EditorPage 側）
- **VALIDATE**: ブラウザで日本語 IME 入力 + Enter 確定 + Escape キャンセルが動く

### Task 21: `apps/web/src/components/toolbar/ToolButton.tsx` + `Toolbar.tsx` を作成

- **ACTION**: ツールバー UI
- **IMPLEMENT**:
  - `ToolButton`: Tailwind v4 + tokens でスタイル。`aria-pressed` + `title` でショートカット表示
  - `Toolbar`: 5 ツール + Undo/Redo/Delete + 画像クリア
- **GOTCHA — 設計品質**:
  - `.claude/rules/web/design-quality.md` の Banned Patterns に注意:
    - 「default tailwind / shadcn template に見える」は禁止
    - 「unmodified library defaults」は禁止
  - **Required Qualities** から最低 4 つ:
    1. **hierarchy through scale contrast**: ツールアイコンは 20px、Undo/Redo は 16px、Delete はやや大きく + 色違いで明示
    2. **intentional rhythm in spacing**: ツールグループ（select/4 ツール）と操作グループ（Undo/Redo/Delete）の間に倍の gap
    3. **hover/focus/active states that feel designed**: hover=背景 fade、active=accent border 1px、focus=ring (`outline: 2px var(--color-accent)`)
    4. **color used semantically**: select=neutral、arrow=accent blue、highlight=yellow、Delete=danger red
  - lucide-react のアイコンを使う（PRD components.json `iconLibrary: lucide` 確定）。catalog に追加: `lucide-react: ^0.460`（Phase 6 で shadcn 本格導入時に再共有）
- **VALIDATE**:
  - 各ツールボタンクリックで `tool` state が切替わる（hook 経由）
  - Undo/Redo ボタンが `canUndo/canRedo` で disabled になる
  - 画像未ロード時は Toolbar 全体が disabled

### Task 22: `apps/web/src/components/empty-state/DropZone.tsx` を作成

- **ACTION**: 画像未ロード時の画面中央 D&D / paste 受口
- **IMPLEMENT**:
  - 中央寄せ、淡い border-dashed、`Cmd+V でも貼り付け可` のヒント
  - `onDrop` / `onDragOver` / `onPaste` を window レベルで listen するか、コンテナレベルで listen するかは要検討。`window.addEventListener('paste', ...)` の方がペースト UX は安定するため、`useEffect` 内で window paste listener を登録
- **GOTCHA**:
  - `e.preventDefault()` を `dragover` で必ず呼ぶ（呼ばないと `drop` が発火しない）
  - `drop` 時に `e.dataTransfer.files[0]` のみ取得（複数ドロップは無視 / ヒント表示）
  - `paste` の `e.clipboardData.files[0]` でクリップボード画像を取得（macOS スクリーンショット → CMD+V を最初の動線として確実にカバー）
- **VALIDATE**: ブラウザで D&D + paste が両方動く

### Task 23: `apps/web/src/pages/EditorPage.tsx` を作成

- **ACTION**: AppShell + Toolbar + (CanvasStage または DropZone) の画面組み立て
- **IMPLEMENT**:
  ```typescript
  export const EditorPage = () => {
    const { source, error, loadFromFile, clear } = useImageSource();
    const store = useAnnotationsStore();
    const { width, height } = useStageSize();
    const [editingTextId, setEditingTextId] = useState<string | null>(null);

    useKeyboardShortcuts({
      onUndo: store.undo,
      onRedo: store.redo,
      onDelete: () => { /* selected を remove */ },
      onSetTool: (tool) => store.dispatch({ type: 'tool/set', tool }),
      onEscape: () => { /* deselect / cancel edit */ },
    });

    return (
      <AppShell>
        <Toolbar
          tool={store.state.tool}
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          hasSelection={store.state.selectedId !== null}
          imageLoaded={source !== null}
          onSetTool={...}
          onUndo={store.undo}
          onRedo={store.redo}
          onDelete={...}
          onClearImage={clear}
        />
        {source ? (
          <CanvasStage ... />
        ) : (
          <DropZone onFile={loadFromFile} error={error} />
        )}
        {editingText && stageRect && (
          <TextEditorOverlay ... />
        )}
      </AppShell>
    );
  };
  ```
- **VALIDATE**: 全機能の手動 smoke

### Task 24: `apps/web/src/App.tsx` を更新

- **ACTION**: プレースホルダを EditorPage に差し替え
- **IMPLEMENT**:
  ```typescript
  import { EditorPage } from './pages/EditorPage';

  export const App = () => <EditorPage />;
  ```
- **MIRROR**: 既存 `apps/web/src/App.tsx:1-7` の薄さを維持
- **VALIDATE**: `pnpm -F @snap-share/web dev` 起動 → ブラウザで EditorPage が表示

### Task 25: `apps/web/src/styles/tokens.css` 拡張

- **ACTION**: annotation 用カラートークンを追加
- **IMPLEMENT**:
  ```css
  :root {
    /* 既存 */
    --color-surface: oklch(98% 0 0);
    --color-text: oklch(18% 0 0);
    --color-accent: oklch(68% 0.21 250);

    /* Phase 3 — annotation tools */
    --color-tool-rect: oklch(60% 0.18 250);     /* 矩形のデフォルトストローク */
    --color-tool-arrow: oklch(60% 0.20 30);     /* 矢印 (赤系) */
    --color-tool-text: oklch(20% 0 0);          /* テキスト */
    --color-highlight-yellow: oklch(85% 0.18 95); /* ハイライト */
    --color-toolbar-bg: oklch(98% 0 0 / 0.86);
    --color-toolbar-border: oklch(85% 0 0);

    --space-toolbar: 0.5rem;
    --radius-toolbar: 0.75rem;
    --duration-fast: 120ms;
    --duration-normal: 200ms;
    --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  }
  ```
- **MIRROR**: 既存 `apps/web/src/styles/tokens.css:1-10` の OKLCH パターン
- **GOTCHA**: Konva に渡す色値は CSS 変数解決ができないため、`apps/web/src/components/canvas/colors.ts` に等価な hex/rgba を持つ（Task 16 で言及）
- **VALIDATE**: ブラウザで Toolbar 等が tokens 通りの色になっている

### Task 26: `apps/web/e2e/landing.spec.ts` 拡張

- **ACTION**: smoke レベルで以下を追加
  ```typescript
  test('landing page renders toolbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('snap-share');
    // ツールバーの 5 ツールがレンダリングされる
    await expect(page.getByRole('button', { name: /選択/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /矩形/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /矢印/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /テキスト/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /ハイライト/ })).toBeVisible();
    // 画像未ロード時はツールが disabled
    await expect(page.getByRole('button', { name: /矩形/ })).toBeDisabled();
    // DropZone が表示
    await expect(page.getByText(/画像をドロップ|paste/i)).toBeVisible();
  });
  ```
- **MIRROR**: 既存 `apps/web/e2e/landing.spec.ts:1-6`
- **GOTCHA**: D&D の本格 E2E は Phase 6 でやる。今は表示確認のみ
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e` 緑

### Task 27: PRD ステータス更新

- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` の Phase 3 行を `pending` → `in-progress` に変更し、PRP Plan 列に plan path を追記
- **IMPLEMENT**:
  - 191 行目を:
    ```
    | 3 | キャンバス & 注釈ツール | Konva実装 + 4種注釈 + Undo/Redo | in-progress | with 2.5 | 1 | [phase-3-canvas-annotation-tools.plan.md](../plans/phase-3-canvas-annotation-tools.plan.md) |
    ```
- **VALIDATE**: マークダウン表が崩れていない

### Task 28: 最終検証

- **ACTION**: `pnpm install` → `pnpm turbo run lint typecheck test build` → `pnpm -F @snap-share/web test:e2e` をすべて緑にする
- **VALIDATE**: 後述の Validation Commands セクション参照

---

## Testing Strategy

### Unit Tests

| Test File | Tests (推定数) | Coverage |
|---|---|---|
| `packages/shared/src/__tests__/annotation.test.ts` | 16+ | 4 schema × parse 成功/失敗 + discriminator narrowing |
| `apps/web/src/lib/__tests__/id.test.ts` | 3+ | 一意性、UUID 形式、fallback 経路 |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | 27+ | 9 関数 × 各 3 ケース（happy + edge + immutability） |
| `apps/web/src/hooks/__tests__/useHistory.test.ts` | 7+ | commit / replace / undo / redo / 上限 / 同一参照 / future クリア |
| `apps/web/src/hooks/__tests__/useAnnotationsStore.test.ts` | 10+ | 各 action × happy/edge + history 連携 |

合計目標: **70+ ケース**（既存 63 件 + 新規 70 件 = 130+ 件）

### Edge Cases Checklist

- [ ] `addAnnotation` で `MAX_ANNOTATIONS_PER_ROOM` 到達時の挙動（Phase 4 で本格化、Phase 3 では schema parse まで）
- [ ] `setText` に空文字を渡した際の挙動（empty annotation を作らない）
- [ ] `removeAnnotation` で存在しない id を渡した時 → no-op + 新配列
- [ ] `moveAnnotation` の arrow case で from/to 両方が動く
- [ ] discriminatedUnion で type='unknown' を parse → throws
- [ ] color regex で短縮形 `#fff` を弾く（hex 6 桁のみ）
- [ ] `useHistory` の上限 50 ステップ + その先の overflow
- [ ] `useHistory` の `redo` 後に新 commit すると future がクリア
- [ ] `useImageSource.loadFromFile` で 10MB+1 を渡した時のエラー
- [ ] `useKeyboardShortcuts` が INPUT/TEXTAREA フォーカス時に発火しない
- [ ] `<textarea>` 編集中の Cmd+Z は標準 Undo に委譲（global Undo を奪わない）

### Manual Validation Checklist（ブラウザ）

- [ ] 起動時に DropZone が中央表示、ツールバー全体が disabled
- [ ] 画像 D&D で画像表示、ツールバーが活性化
- [ ] Cmd+V で macOS スクリーンショットが貼り付け可能
- [ ] 矩形ツール: ドラッグで矩形描画 / 4px 未満は破棄
- [ ] 矢印ツール: ドラッグで矢印描画 / 矢じりが正しく表示
- [ ] テキストツール: クリック → textarea overlay focus → 日本語 IME 入力 → Enter で確定
- [ ] テキストの再編集: ダブルクリックで再 overlay 起動
- [ ] ハイライトツール: ドラッグで半透明矩形描画
- [ ] 図形クリックで selection（ストローク強調）
- [ ] 図形ドラッグで移動
- [ ] Delete / Backspace で選択中図形を削除
- [ ] Cmd+Z で undo、Cmd+Shift+Z で redo
- [ ] V/R/A/T/H キーでツール切替（INPUT/TEXTAREA 中は反応しない）
- [ ] ステージは window resize に追従
- [ ] 画像クリアボタンで初期状態に戻る

---

## Validation Commands

### Static Analysis

```bash
pnpm turbo run typecheck
```
EXPECT: shared / api / web 全ゼロエラー

### Lint

```bash
pnpm lint
```
EXPECT: Biome 0 errors, organize-imports 自動修正なし

### Unit Tests

```bash
pnpm turbo run test
```
EXPECT: shared 36+ / api 37 / web 80+ = **150+ tests GREEN**

### Build

```bash
pnpm turbo run build
```
EXPECT:
- web: vite build 成功（bundle size は Konva + react-konva 込みで gz **150-200 KB** を許容範囲とする。152.7 KB を超えても Phase 6 のコード分割で解決）
- api: wrangler dry-run 成功

### E2E

```bash
pnpm -F @snap-share/web test:e2e
```
EXPECT: chromium で `landing page renders toolbar` PASS

### Browser Validation

```bash
pnpm -F @snap-share/web dev
# → http://localhost:5173 を開いて Manual Validation Checklist を全消化
```

---

## Acceptance Criteria

- [ ] `apps/web` を `pnpm dev` で起動し、ブラウザで EditorPage が表示
- [ ] PRD §Phase 3 Success signal: 1 ユーザーで 4 種注釈ツールがバグなく動作
- [ ] 各注釈の作成 / 選択 / 移動 / 削除 / Undo / Redo が動作
- [ ] テキストツールが日本語 IME 入力で動作
- [ ] D&D / paste 両方で画像読み込み
- [ ] `pnpm turbo run lint typecheck test build` all green
- [ ] `pnpm -F @snap-share/web test:e2e` 緑
- [ ] Manual Validation Checklist 全項目 ✓
- [ ] PRD の Phase 3 行が `in-progress`、plan link 追記済
- [ ] `apps/web/src/App.tsx` が EditorPage を返す（プレースホルダ撤去済）

## Completion Checklist

- [ ] 4 種注釈の Zod schema が `packages/shared/src/annotation.ts` に存在し、`@snap-share/shared` から import 可能
- [ ] 各 schema が `.discriminatedUnion('type', ...)` で union 化されている
- [ ] `apps/web/src/domain/annotation/operations.ts` の関数群がすべて pure / immutable
- [ ] `useHistory` の上限が 50 ステップで実装されている
- [ ] `useKeyboardShortcuts` が INPUT/TEXTAREA を除外している
- [ ] Konva に渡す色値が `colors.ts` に集約されている（CSS 変数を Konva に直接渡していない）
- [ ] エラーハンドリングが `apps/web/src/lib/logger.ts` 経由
- [ ] biome `noConsole` warning が新規ファイルに出ていない
- [ ] テストカバレッジ 80% 以上（特に operations.ts, useHistory.ts, useAnnotationsStore.ts）
- [ ] No hardcoded secrets, no `console.log`（logger 経由は OK）
- [ ] `noUncheckedIndexedAccess` の制約に違反していない（特に矢印 points）
- [ ] PRD ステータス更新済

---

## Phase 4 / 5 / 6 への布石

実装で意識する点:

- **AnnotationSchema を `packages/shared` に置く** → Phase 4 で Yjs Y.Array<Y.Map> に乗せる際、メッセージ境界で `AnnotationSchema.parse(payload)` をかけるだけで XSS / 型誤りを排除可能
- **`useAnnotationsStore` の interface を pure** → Phase 4 で reducer の中身を Yjs `observe` ベースに置換し、interface（`dispatch / state / commit / undo / redo`）を保ったまま同期化できる
- **operations.ts の関数群** → Phase 4 でも Yjs transaction 内で同じ関数が使える設計（pure)
- **logger.ts** → Phase 5 のレート制限・パスワード認証エラー surface でも統一形式
- **`apps/web/src/lib/id.ts`** → Phase 4 で Yjs クライアント ID と統合する際の参照点
- **DropZone の `paste` listener** → Phase 4 で R2 経由アップロード追加時にこの hook 内に `api.rooms.$post` を仕込む
- **TextEditorOverlay の座標変換** → Phase 6 のズーム/パン対応時に `Stage.getAbsoluteTransform()` を組み込む拡張点

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `react-konva@^19` + React 19 で型のなんらかの非互換が発覚 | M | M | Phase 0 スパイクで実証済（rect 6 件 GREEN）。発覚時はピンポイント `as` cast + コメントで応急処置、Phase 6 までに upstream PR 検討 |
| HTML `<textarea>` の座標と Konva Text の座標がずれる（特に padding / lineHeight 微差） | M | M | Konva Text の `padding=0` / `lineHeight=1.0` で固定、textarea も同 padding=0 にして 1px 単位で目視合わせ |
| Cmd+Z が `<textarea>` 編集を奪う | M | H | `useKeyboardShortcuts` で INPUT/TEXTAREA ガード + `TextEditorOverlay` の `onKeyDown` で `stopPropagation` の二重防御 |
| draft annotation の `replace` が React 19 の自動バッチング下で取りこぼし | L | M | `flushSync` を最終手段にする前に、`requestAnimationFrame` でステート更新を 1 フレーム単位で確定する選択肢あり |
| Bundle size が gz 200KB を超える | L | M | `react-konva` を `React.lazy` で遅延（Phase 6 で必須化）。Phase 3 段階では 200KB 上限内に留める |
| `useReducer` + `useHistory` の二重ステート管理が原因で undo が壊れる | M | H | useReducer の state 自体は immutable で、`useHistory` の present として直接管理する設計に統一。テストで遷移を網羅 |
| 4px 未満ドラッグの判定が iPad の事故タッチと衝突 | L | L | Phase 3 はデスクトップのみ、iPad は Should スコープなので無視 |
| Konva の `Arrow` の `onDragEnd` の dx/dy が始点絶対座標と思い込んで誤実装 | M | M | Task 14 GOTCHA で警告済。テストで verify（happy-dom が Konva 内部 mouse simulator を持たない場合は手動検証で代用） |

## Notes

- **shadcn UI コンポーネントは Phase 3 では追加しない**: Phase 1 で `components.json` のみ用意済。Phase 3 のツールバーは Tailwind 直書きで十分（Required Quality を満たすには手動設計の方が「default template に見えない」を満たしやすい）。`Button` を shadcn 経由で追加するか、Tailwind 直書きにするかは実装者判断（KISS 優先で **Tailwind 直書き** を推奨）
- **`lucide-react` を catalog に追加するか**: Phase 6 で shadcn 経由で確実に必要になるが、Phase 3 ではツールバーに 5-7 個のアイコンが要る。catalog 化しておく価値あり（`lucide-react: ^0.460`）
- **Phase 0 spike の `spikes/konva-canvas` は破棄しない**: Phase 3 完了後も参照価値があるため git history からも参照可能な状態で残す（PRD Decisions Log に記載済の方針）
- **`AppShell` の責務**: 現状 `<header><h1>snap-share</h1></header>` のみ。Phase 3 では Toolbar をどこに置くか議論。**推奨**: AppShell の `header` 配下にツールバーを差し込む（`children` slot とは別）か、EditorPage 内で Toolbar 配置を完全制御する。**KISS の観点で後者を推奨**（AppShell に slot を追加しない）。Phase 6 の UI 仕上げで再構築する余地を残す
- **テストの優先度**: 80% カバレッジ目標は `packages/shared` と `apps/web/src/domain/`、`apps/web/src/hooks/` が中心。`apps/web/src/components/canvas/*` は visual テストの方が signal が高い（`.claude/rules/web/testing.md`）→ Phase 3 では unit を厚く、visual regression は Phase 6 へ送る
- **「最小限を最小限に」を体現する Toolbar 設計**: PRD Decisions Log L281 の文脈と整合させ、ツールアイコン 5 個 + 操作 3 個（Undo/Redo/Delete）の合計 8 ボタンに留める。色変更 / 線幅変更 / フォントサイズ変更は Phase 6 へ送る（Should スコープ）
- **catalog 拡張の方針**: 今回追加する 4 つ（konva / react-konva / use-image / lucide-react）はすべて catalog 経由とする。Phase 4 で `yjs / y-protocols / y-konva` 等の Yjs 系を catalog 追加する際、同じ列に並ぶ
