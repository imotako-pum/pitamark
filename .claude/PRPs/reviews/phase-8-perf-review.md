# Local Code Review: Phase 8 — bundle・perf (#10)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: bundle 予算 / dynamic import / Konva・Yjs lazy load / Core Web Vitals 見込み / 画像ロード戦略 / CSS animation / scroll handler churn
**Decision**: NEEDS_FIX — HIGH 1 件（bundle 超過）と MEDIUM 3 件を確認。CRITICAL なし。

## Summary

`pnpm -F @snap-share/web build` を実行して実測した結果:

| チャンク | raw | gzip | バジェット |
|---|---|---|---|
| `index-*.js` | 918.65 kB | **283.82 kB** | App page < 300 kB |
| `index-*.css` | 40.95 kB | 7.91 kB | App page CSS < 50 kB |

gzip 後の JS が **283.82 kB** — App page 予算 300 kB に対して残余わずか 16 kB。Vite 自体が「500 kB 超過」警告を出力している。

チャンクは **1 本のみ (single-bundle)**。Konva / react-konva / Yjs / y-websocket がすべて main bundle に同期 import されており、コード分割がゼロの状態。PRD Decisions Log（line 392）が「Phase 6 で `dynamic import` によるコード分割を必須タスク化」と明記しているにもかかわらず未実施のまま Phase 8 まで積み残されている。

lucide-react は全ファイルで named import（`import { ArrowUpRight, ... } from 'lucide-react'`）を使用しており tree-shake は正常に機能している。font は system-ui スタック（外部フォント不使用）のため font loading は問題なし。CSS animation は opacity / transform 系のみで layout-bound property のアニメーションなし。scroll handler のうち mousemove / wheel は Konva の合成イベントで処理されており生の scroll listener はなし。

`useStageSize` と `EditorShell` の両方が `window.addEventListener('resize', ...)` を別々に登録しており、resize イベントが同時に 2 つの handler を叩く二重登録が存在する（MEDIUM M2）。

## Findings

### CRITICAL
None.

### HIGH

**H1: single-bundle 283.82 kB gz — App page 予算超過目前 + 動的分割ゼロ**

- **Location**: `apps/web/vite.config.ts`（chunking 設定なし）/ `apps/web/src/App.tsx`（lazy なし）/ `apps/web/src/pages/EditorPage.tsx`（lazy なし）
- **Issue**:
  gzip 283.82 kB は App page 予算 300 kB の 94.6% を占有し、残余は 16 kB のみ。今後の機能追加（新 annotation 型 / Phase 9 以降の UI）で容易に超過する。加えて Konva（+react-konva 合算で Phase 0 実測 152.7 kB gz 相当）/ Yjs + y-websocket（room mode 専用）が一括ロードされており、local mode アクセス時でも room 向けコードが全量ダウンロードされる。

  PRD Decisions Log（`snap-share.prd.md:392`）は「Phase 6 で `dynamic import` によるコード分割を必須タスク化」と明記しているが、vite.config.ts に chunking 設定が存在せず、App.tsx / EditorPage.tsx に `React.lazy()` / `Suspense` の使用箇所がゼロであることを確認。

  Vite 自体がビルド時に以下の警告を出している:
  ```
  (!) Some chunks are larger than 500 kB after minification.
  Consider: Using dynamic import() to code-split the application
  ```

- **Suggested Fix**:
  1. `vite.config.ts` に `build.rolldownOptions.output.manualChunks` で `konva` / `react-konva` / `use-image` を `vendor-canvas` チャンクに、`yjs` / `y-websocket` / `y-protocols` を `vendor-yjs` チャンクに分離
  2. `EditorPage.tsx` で `LocalEditor` / `RoomEditor` を `React.lazy()` でラップし、`Suspense` + fallback を追加
  3. 効果の見込み: main bundle を ~100 kB gz 以下に削減（canvas + yjs vendor = ~180 kB gz が別チャンク化され on-demand ロードに）

  ```typescript
  // vite.config.ts に追加
  build: {
    rolldownOptions: {
      output: {
        manualChunks: {
          'vendor-canvas': ['konva', 'react-konva', 'use-image'],
          'vendor-yjs': ['yjs', 'y-websocket', 'y-protocols'],
        },
      },
    },
  },
  ```

  ```tsx
  // App.tsx または EditorPage.tsx
  const LocalEditor = lazy(() => import('./LocalEditor'));
  const RoomEditor = lazy(() => import('./RoomEditor'));

  export const EditorPage = ({ roomId, onRoomIdChange }: Props) => (
    <Suspense fallback={<div aria-busy="true" />}>
      {roomId ? (
        <RoomEditor key={roomId} roomId={roomId} />
      ) : (
        <LocalEditor onRoomIdChange={onRoomIdChange} />
      )}
    </Suspense>
  );
  ```

- **Severity**: HIGH — 予算超過目前 + 将来の機能追加で確実に超過する時限爆弾。PRD で Phase 6 必須タスクと宣言されたまま未着手で積み残し。

---

### MEDIUM

**M1: Konva が local mode でも全量ロードされる — room 分割なし**

- **Location**: `apps/web/src/pages/EditorPage.tsx:1-19` / `apps/web/src/pages/LocalEditor.tsx:7` / `apps/web/src/pages/RoomEditor.tsx:2-3`
- **Issue**:
  `EditorPage` は `LocalEditor` と `RoomEditor` を静的 import で取り込んでいる。両コンポーネントは `EditorShell` → `CanvasStage` → `react-konva` の import chain を共有するため、local mode でも Konva が全量ロードされる。さらに `RoomEditor` は `useYjsAnnotationsStore` → `yjs` / `y-websocket` を静的 import しており、room URL でない通常アクセス時でも Yjs のネットワーク接続コードがロードされる。

  Yjs（`y-websocket`）は room mode 専用であり、landing（local mode）では不要。H1 の dynamic import 化で同時に解決するが、分割単位として明示しておく。

- **Suggested Fix**: H1 と同一修正で解決。`RoomEditor` を lazy にすれば Yjs チャンクは room URL アクセス時にのみロードされる。

- **Severity**: MEDIUM — H1 の副次 finding。独立した fixing PR は不要で H1 と同一 PR に含める。

**M2: `window.addEventListener('resize', ...)` の二重登録**

- **Location**: `apps/web/src/hooks/useStageSize.ts:18` / `apps/web/src/pages/EditorShell.tsx:138`
- **Issue**:
  `useStageSize` は `window.addEventListener('resize', ...)` でウィンドウサイズを追跡し、`EditorShell` は別途 `useLayoutEffect` 内で `window.addEventListener('resize', update)` を登録して `stageRect` を更新する。両ハンドラは resize ごとに同時発火し、それぞれが `setState` を呼ぶため 1 回の resize イベントで React の render が 2 回発生する。

  `useStageSize` は Konva Stage の width/height 決定のみに使用されており、`stageContainerRef.current.getBoundingClientRect()` を使う `EditorShell` 側の観測と役割が重複している。

  ```typescript
  // useStageSize.ts:14-20
  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // EditorShell.tsx:133-140
  useLayoutEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const update = () => setStageRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [source]);
  ```

- **Suggested Fix**:
  `useStageSize` を廃止し、`stageContainerRef` の `ResizeObserver`（EditorShell が header に既に使用するパターン）に統一する。または `useStageSize` を `ResizeObserver` ベースに置き換えて EditorShell の resize listener を削除する。どちらでも resize 時の re-render が 1 回に削減される。

- **Severity**: MEDIUM — render 頻度過剰。resize は低頻度だが、INP に影響する re-render を不必要に 2 回発生させているパターンとして記録。

**M3: `useStageSize` が viewport 全体サイズを返すが Konva Stage の実際の描画域と乖離する**

- **Location**: `apps/web/src/hooks/useStageSize.ts` 全体 / `apps/web/src/pages/EditorShell.tsx:100-110`（Stage height 計算）
- **Issue**:
  `useStageSize` は `window.innerWidth` / `window.innerHeight` 全体を返す。しかし実際の Stage 描画域は toolbar height（`headerHeight`）と最小高（`MIN_STAGE_HEIGHT`）を差し引いた値 `Math.max(stageSize.height - headerHeight, MIN_STAGE_HEIGHT)` で決まる。`stageSize.width` は変換されずそのまま Konva Stage に渡されるため viewport width = Stage width となるが、将来サイドバー等を追加した際に乖離が生じやすい設計。

  また `stageRect`（`EditorShell` 側）と `stageSize`（`useStageSize`）の 2 つの size 概念が並存しており、どちらが "真の" canvas 描画域かが初見では不明瞭。

- **Suggested Fix**: `useStageSize` の使用範囲を限定するか、`stageContainerRef` の `getBoundingClientRect()` で Stage の実サイズを1ソースで管理する設計に整理する（M2 の修正と同時実施が自然）。

- **Severity**: MEDIUM — 現時点では動作問題ないが、M2 と合わせてリファクタしないと将来 layout 追加で CLS / 表示ズレを引き起こす可能性。

---

### LOW

**L1: CWV LCP 見込み — Konva Stage は `<canvas>` 要素で LCP 測定外となる可能性**

- **Location**: `apps/web/index.html`（preload なし）/ `apps/web/src/components/canvas/ImageLayer.tsx:16-31`
- **Issue**:
  ブラウザの LCP は `<canvas>` 要素を計測対象外とする（Chromium 仕様）。snap-share の「コンテンツ」はすべて Konva の `<canvas>` 内にレンダリングされるため、LCP は DOM の上位要素（DropZone / RoomGate など）が拾われる。DropZone は `flex` コンテナで最初に表示されるため LCP 候補となり得る。

  `index.html` に画像の preload / preconnect ヒントがなく、Turnstile の `<script async defer>` が `<head>` 末尾に配置されているが、これは `async defer` のため render-blocking にならない点は正しい。

  `ImageLayer` の `useImage(src, 'anonymous')` は画像が ObjectURL（ローカル D&D）または API 経由 URL（room mode）で渡されるため、network preload ヒントを `<link rel="preload">` で事前宣言することが難しい構造。

- **Suggested Fix**: 観測のみ。実測は dogfood (Phase 9) で Web Analytics + Chrome DevTools を使用して計測し、LCP が 2.5s を超える場合は API レスポンス最適化（Cloudflare Workers cold start）を優先的に調査する。

- **Human Friction**: false
  - 改修時必読: no — ImageLayer / index.html は通常の機能追加で触らない
  - 再発生コスト: low — preload ヒントを追加するだけ、対応が明確
  - 認知負荷増: no — LCP が canvas 外になる理由はブラウザ仕様で自明

**L2: TurnstileWidget の `setTimeout` ポーリング（50 回 × 100ms = 最大 5s）**

- **Location**: `apps/web/src/components/turnstile/TurnstileWidget.tsx:44-58`
- **Issue**:
  Turnstile script が `async defer` でロードされるため、`window.turnstile` の出現を 100ms ごとに最大 50 回ポーリングしている。現状 `async defer` + 小さいスクリプトなので実用上は 1-3 回で解決するはずだが、低速回線や CF エッジ遅延時に最大 5s のポーリングが走り、その間の UI 更新が `setTimeout` チェーンを汚染する。MutationObserver や `script.onload` コールバックで確実に検出する設計の方がスマート。

- **Suggested Fix**:
  ```typescript
  // script.onload を使って確実に window.turnstile が存在するタイミングを検出する
  const script = document.querySelector<HTMLScriptElement>(
    'script[src*="challenges.cloudflare.com/turnstile"]'
  );
  if (script && !script.loaded) {
    script.addEventListener('load', tryRender, { once: true });
  } else {
    tryRender(); // already loaded
  }
  ```
  ただし `index.html` の script タグに `id` がなく querySelector が必要になる。観測のみで Phase 8.x の対象とする。

- **Human Friction**: false
  - 改修時必読: no — TurnstileWidget は独立コンポーネントで他と結合少ない
  - 再発生コスト: low — このファイル内だけの変更
  - 認知負荷増: no — ポーリングの意図（async defer 待機）はコメントで説明されている

**L3: `usePresence` の rAF throttle — cursor update のみ対象で setSelectedId は throttle なし**

- **Location**: `apps/web/src/hooks/usePresence.ts:10-24`（`useRafThrottle`）/ `:66-68`（`setSelectedId`）
- **Issue**:
  mousemove 由来の cursor 更新は `useRafThrottle` で正しく throttle されており、60fps を超えた Yjs 更新が防止されている。一方 `setSelectedId` は `useCallback` のみで throttle なし。選択変更は click 単位なのでほぼ問題ないが、将来 keyboard navigation で高速に selection が変わる場合は Yjs awareness を毎回更新することになる。現状は許容範囲。

- **Suggested Fix**: 観測のみ。keyboard navigation で selection が高速に変化するユースケースが発生した場合に `useRafThrottle` を適用する。

- **Human Friction**: false
  - 改修時必読: yes — presence 周りを触る際は usePresence は必ず読む
  - 再発生コスト: low — useRafThrottle の適用範囲を広げるだけ
  - 認知負荷増: no — throttle の意図は `useRafThrottle` のコメントで明確

---

## 副次観点（#3 React / #9 a11y）への共有

- **#3 React への引継ぎ**: `useStageSize`（M2 / M3）は React hooks の責務分離の問題でもある。`useStageSize` が `window.innerWidth/Height` を直接読むのは `stageContainerRef.getBoundingClientRect()` と乖離する抽象設計問題であり、#3 React BP でも取り上げることを推奨。
- **#9 a11y への引継ぎ**: L1 の LCP 候補 DOM 要素（DropZone / empty state）がスクリーンリーダーの landing 体験に直結するため、a11y review でも確認が必要。

---

## Validation Results

| Check | Result |
|---|---|
| `pnpm -F @snap-share/web build` | Pass（gzip 283.82 kB、Vite 警告 1 件） |
| 実コード変更 | なし（観察のみ） |

## Files Reviewed

| File | Type | Note |
|---|---|---|
| `apps/web/vite.config.ts` | 観察 | chunking 設定なし = H1 主因 |
| `apps/web/src/main.tsx` | 観察 | entry chain — lazy なし |
| `apps/web/src/App.tsx` | 観察 | `EditorPage` 静的 import |
| `apps/web/src/pages/EditorPage.tsx` | 観察 | `LocalEditor` / `RoomEditor` 静的 import |
| `apps/web/src/pages/LocalEditor.tsx` | 観察 | Konva 依存（EditorShell 経由） |
| `apps/web/src/pages/RoomEditor.tsx` | 観察 | Yjs 依存（useYjsAnnotationsStore 経由） |
| `apps/web/src/pages/EditorShell.tsx` | 観察 | resize listener 二重登録（M2） |
| `apps/web/src/hooks/useStageSize.ts` | 観察 | resize listener + viewport size（M2 / M3） |
| `apps/web/src/components/canvas/CanvasStage.tsx` | 観察 | useState vs useRef 使用パターン確認済 |
| `apps/web/src/components/canvas/ImageLayer.tsx` | 観察 | crossOrigin='anonymous' 確認済 |
| `apps/web/src/hooks/usePresence.ts` | 観察 | rAF throttle 確認済（L3） |
| `apps/web/src/hooks/useStageTransform.ts` | 観察 | ResizeObserver 不使用（raw resize listener）確認 |
| `apps/web/src/components/turnstile/TurnstileWidget.tsx` | 観察 | setTimeout ポーリング（L2） |
| `apps/web/index.html` | 観察 | font / preload / preconnect ヒント確認 |
| `apps/web/src/styles/global.css` | 観察 | system-ui スタック、外部フォントなし |
| `apps/web/src/styles/tokens.css` | 観察 | CSS animation 設定確認 |
| `apps/web/package.json` | 観察 | 全依存が同期 import 前提 |

## Decision Rationale

- **CRITICAL なし** → BLOCK 不要
- **H1 (bundle 超過目前 + 分割ゼロ)** が Phase 9 dogfood 前に対処すべき問題として残留 → NEEDS_FIX
- H1 の修正（lazy + manualChunks）は vite.config.ts と EditorPage.tsx の局所変更で完結し、Phase 8.x の 1 PR に収まる規模

## Resolution Update

（Phase 8 は観察のみ、修正は Phase 8.x で別 PR）

---
*Generated: 2026-05-04*
*Reviewer: Claude Sonnet 4.6*
