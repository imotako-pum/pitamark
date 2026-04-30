# Plan: Phase 0 — 技術スパイク (Tech Spike)

## Summary

snap-share MVPのMust要件を満たす技術スタックの最小疎通を3本のスパイクで検証する。Konvaでの画像表示+矩形描画+ドラッグ、y-durableobjectsによるYjs+Cloudflare Durable Objects WebSocket Hibernationのlocalhost疎通、shadcn/ui+Vite統合の摩擦確認。最終アウトプットはPhase 1で本実装に進めるかの判断材料を含むスパイクレポート。

## User Story

As a snap-share の開発オーナー,
I want Phase 1 のモノレポ初期化に進む前に Must 要件を支える3技術が動くことと未確定スタック（shadcn/ui採用可否）を確認できる,
So that Phase 1 以降で「採用したライブラリが想定通り動かない」という致命的な手戻りを避けられる.

## Problem → Solution

**Current**: PRDで Konva / y-durableobjects / shadcn の採用方針は出ているが、それぞれが localhost で動く実物コードは存在しない。特に shadcn は「Phase 0 で採用判断」と保留扱い。
**Desired**: 3技術の最小疎通コードと判断材料が `spikes/` 配下に揃い、PRDのDecisions Logにshadcn採用可否が確定する。

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 0 — 技術スパイク
- **Estimated Files**: 約25ファイル（3スパイク × 7-8ファイル + ルート1ファイル）
- **Estimated LOC**: 600〜900行（依存パッケージのlock除く）

---

## UX Design

### Before / After

このフェーズはエンドユーザー向け機能を一切作らない。出力は開発者（オーナー）向けのローカル動作物のみ。

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 開発者がローカルで Konva を試す手段 | なし | `pnpm --filter @spike/konva dev` で画像表示+矩形ドラッグ | UI仕上げは Phase 3/6 |
| 開発者がローカルで Yjs+DO を試す手段 | なし | `pnpm --filter @spike/yjs-do dev` で2タブ間で同期 | 本実装は Phase 4 |
| shadcn/ui 採用判断 | 未決 | `pnpm --filter @spike/shadcn dev` で Button/Dialog/Input を確認、判断記録 | PRD Decisions Log を更新 |

> Internal change — 一般ユーザー向け UX 変更なし。Phase 0 は探索フェーズ。

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 136-174, 197-205 | Phase 0 ゴール・スコープ・Success signal |
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 254-285 | Decisions Log と Konva採用根拠（〜80KB gz、UI完全自前制御） |
| P0 | `.claude/rules/web/coding-style.md` | 全体 | spike配下も Web ルールに従う（CSS変数、コンポジター親和プロパティ等） |
| P1 | `.claude/rules/web/performance.md` | 全体 | Konva の `will-change`/Stage再描画注意点と CWV 目標 |
| P1 | `.claude/rules/common/coding-style.md` | 全体 | KISS / YAGNI / 800 lines max（spike でも遵守） |
| P2 | `README.md` | 全体 | 現状空（"# snap-share" のみ）。スパイク後に簡易説明を追記する候補 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| react-konva 基本 | https://konvajs.org/docs/react/index.html | `Stage > Layer > Image/Rect`。`useImage` フックでURL→HTMLImageElement変換。座標は `x`/`y`、ドラッグは `draggable` 属性 |
| react-konva 画像 | https://konvajs.org/docs/react/Images.html | `import useImage from 'use-image'` 別パッケージ要、`<KonvaImage image={image} />` で描画 |
| Konva レスポンシブ | https://konvajs.org/docs/sandbox/Responsive_Canvas.html | Stage の width/height を window resize で再設定する素直な方式 |
| y-durableobjects README | https://github.com/napolab/y-durableobjects | Hono ≥4.3 必須、`state.acceptWebSocket(ws)` で Hibernation 対応、`YDurableObjects` 基底クラスを extends |
| Cloudflare DO WebSocket Hibernation | https://developers.cloudflare.com/durable-objects/best-practices/websockets/ | `acceptWebSocket` を使うと idle 時に DO が完全休止。`webSocketMessage`/`webSocketClose` ハンドラ実装が必要 |
| shadcn/ui Vite Install | https://ui.shadcn.com/docs/installation/vite | `npx shadcn@latest init` 必要、Tailwind v4 + `@tailwindcss/vite` プラグイン、`tsconfig.json`/`tsconfig.app.json` 両方に path alias `@/*` |
| shadcn/ui コンポーネント追加 | https://ui.shadcn.com/docs/installation/manual | `npx shadcn@latest add button dialog input` でコンポーネントが `src/components/ui/` に直接コピーされる（コードを所有する設計） |

GOTCHA:
- **shadcn は「ライブラリ」ではなく「コードコピー」モデル**: パッケージ依存ではない。`components.json` でカスタマイズ。Phase 0 でこの所有モデルを許容するかも判断対象。
- **react-konva は SSR 不可**: Vite の `import.meta` 起動順だと問題ないが、後段で Next 移行する選択肢を絶てる点は記録する（PRDではVite確定なので問題なし）。
- **`y-durableobjects` は Hono 4.3+ をピア依存**: 最新 Hono を使うこと。
- **Wrangler v3+**: ローカル `wrangler dev` で DO は `--local` モード推奨（無料）。

---

## Patterns to Mirror

> このリポジトリは現状ほぼ空（`README.md` のみ、`src/` なし）。よって既存コード由来の "mirror" パターンはなく、外部ドキュメント由来のリファレンス実装と `.claude/rules/` のルールをパターンとして採用する。Phase 1 以降は本フェーズのスパイク自体が mirror 元になる。

### NAMING_CONVENTION
// SOURCE: `.claude/rules/common/coding-style.md` + `.claude/rules/web/coding-style.md`
```
- ファイル/ディレクトリ: kebab-case (`spikes/konva-canvas/`, `spike-runner.ts`)
- React コンポーネント: PascalCase (`SpikeStage.tsx`, `RectAnnotation.tsx`)
- フック: camelCase + use prefix (`useImage`, `useStageSize`)
- 定数: UPPER_SNAKE_CASE (`MAX_IMAGE_BYTES`, `DEFAULT_STAGE_WIDTH`)
- ブール: `is`/`has`/`should`/`can` prefix (`isDragging`, `hasImage`)
```

### ERROR_HANDLING
// SOURCE: `.claude/rules/common/coding-style.md` の "Error Handling"
```ts
// 境界(画像ロード/WS接続/wrangler命令)では try/catch + ユーザー向けメッセージ + 詳細ログ
try {
  const ws = new WebSocket(url);
} catch (err) {
  console.error('[spike:yjs-do] WS connection failed', err);
  setStatus({ kind: 'error', message: '同期サーバに接続できませんでした' });
}
// 黙って握りつぶさない、 catch は必ず log + 表示 or 再 throw
```

### LOGGING_PATTERN
// SOURCE: `.claude/rules/web/coding-style.md` + `.claude/rules/common/coding-style.md` から導出
```ts
// プレフィックスでスパイク識別 ([spike:konva], [spike:yjs-do], [spike:shadcn])
console.info('[spike:konva] stage size', { width, height });
console.warn('[spike:yjs-do] reconnecting', { attempt, delayMs });
console.error('[spike:yjs-do] doc broadcast failed', err);
// production ではないため info レベル可。本実装ではログライブラリ統一を Phase 1 で決める
```

### IMMUTABILITY_PATTERN
// SOURCE: `.claude/rules/common/coding-style.md` の "Immutability (CRITICAL)"
```ts
// 矩形リストは ReadonlyArray、追加は spread で新配列
type Rect = Readonly<{ id: string; x: number; y: number; w: number; h: number }>;
const addRect = (rects: ReadonlyArray<Rect>, r: Rect): ReadonlyArray<Rect> => [...rects, r];
const moveRect = (rects: ReadonlyArray<Rect>, id: string, dx: number, dy: number) =>
  rects.map(r => r.id === id ? { ...r, x: r.x + dx, y: r.y + dy } : r);
// useState のセッターも常に新オブジェクトを返す
```

### REACT_COMPONENT_PATTERN
// SOURCE: konvajs.org React getting started + repo coding-style
```tsx
// src/components/spike-stage/SpikeStage.tsx
import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import useImage from 'use-image';

type Props = Readonly<{ src: string; width: number; height: number }>;
export const SpikeStage = ({ src, width, height }: Props) => {
  const [image] = useImage(src);
  return (
    <Stage width={width} height={height}>
      <Layer>
        {image && <KonvaImage image={image} />}
      </Layer>
    </Stage>
  );
};
```

### CSS_TOKEN_PATTERN
// SOURCE: `.claude/rules/web/coding-style.md` の "CSS Custom Properties"
```css
/* spikes/<spike>/src/styles/tokens.css */
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
// SOURCE: `.claude/rules/common/testing.md` の AAA パターン
```ts
// spikes/<spike>/src/lib/__tests__/rect.test.ts
import { describe, it, expect } from 'vitest';
import { addRect } from '../rect';

describe('addRect', () => {
  it('returns a new array containing the appended rect', () => {
    // Arrange
    const rects = [] as const;
    const r = { id: 'a', x: 0, y: 0, w: 10, h: 10 } as const;
    // Act
    const next = addRect(rects, r);
    // Assert
    expect(next).toEqual([r]);
    expect(next).not.toBe(rects); // immutability
  });
});
```

> Phase 0 はスパイクなので 80% カバレッジ強制対象外。ただし `addRect` 等の純関数ユーティリティは TDD で作る（後段への mirror 元になる）。

### WORKSPACE_LAYOUT_PATTERN
// SOURCE: pnpm workspaces 公式ドキュメント + PRD の monorepo 方針
```
snap-share/
├── pnpm-workspace.yaml          # spikes/* を packages として登録
├── package.json                 # ルート（devDeps: typescript, vitest 等）
├── spikes/
│   ├── konva-canvas/            # Spike A
│   ├── yjs-durable-object/      # Spike B（Vite client + Workers サブディレクトリ）
│   └── shadcn-vite/             # Spike C
└── docs/
    └── spikes/
        └── REPORT.md            # 3スパイクの結論をまとめる
```
Phase 1 で turborepo 化する際にこの `spikes/` は破棄するか `apps/` 配下に移行する判断を行う（本計画の最終タスクで記録）。

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `package.json` | CREATE | ルートワークスペースマニフェスト |
| `pnpm-workspace.yaml` | CREATE | spikes/* を pnpm workspace に登録 |
| `.gitignore` | CREATE | `node_modules`, `dist`, `.wrangler`, `.DS_Store` |
| `.npmrc` | CREATE | `engine-strict=true`, `auto-install-peers=true` |
| `.nvmrc` | CREATE | Node バージョン固定 (LTS=22.x) |
| `tsconfig.base.json` | CREATE | spikes 共有の strict tsconfig |
| `spikes/konva-canvas/package.json` | CREATE | Vite + react-konva + use-image |
| `spikes/konva-canvas/index.html` | CREATE | Vite エントリ |
| `spikes/konva-canvas/vite.config.ts` | CREATE | React plugin + path alias |
| `spikes/konva-canvas/tsconfig.json` | CREATE | extends base |
| `spikes/konva-canvas/src/main.tsx` | CREATE | React レンダラー |
| `spikes/konva-canvas/src/App.tsx` | CREATE | 画像 D&D + Stage マウント |
| `spikes/konva-canvas/src/components/spike-stage/SpikeStage.tsx` | CREATE | 画像描画 + 矩形描画 + ドラッグ |
| `spikes/konva-canvas/src/lib/rect.ts` | CREATE | 矩形不変操作（addRect/moveRect/removeRect） |
| `spikes/konva-canvas/src/lib/__tests__/rect.test.ts` | CREATE | TDD 例として AAA パターンの単体テスト |
| `spikes/konva-canvas/src/styles/tokens.css` | CREATE | CSS変数（パターン保存目的） |
| `spikes/konva-canvas/README.md` | CREATE | 起動手順・確認観点 |
| `spikes/yjs-durable-object/package.json` | CREATE | Hono + y-durableobjects + wrangler + Vite client |
| `spikes/yjs-durable-object/wrangler.toml` | CREATE | DO バインディング + migrations |
| `spikes/yjs-durable-object/tsconfig.json` | CREATE | extends base + Workers types |
| `spikes/yjs-durable-object/server/index.ts` | CREATE | Hono ルート + DO クラス export |
| `spikes/yjs-durable-object/server/yjs-do.ts` | CREATE | YDurableObject extends 実装 |
| `spikes/yjs-durable-object/client/index.html` | CREATE | クライアント Vite エントリ |
| `spikes/yjs-durable-object/client/vite.config.ts` | CREATE | proxy 設定で `/ws` を wrangler dev に転送 |
| `spikes/yjs-durable-object/client/src/main.tsx` | CREATE | Yjs ドキュメント + 簡易テキスト同期 UI |
| `spikes/yjs-durable-object/README.md` | CREATE | 起動手順（wrangler dev + vite dev） |
| `spikes/shadcn-vite/package.json` | CREATE | Vite + Tailwind v4 + shadcn 想定の minimal |
| `spikes/shadcn-vite/vite.config.ts` | CREATE | `@tailwindcss/vite` + alias `@/*` |
| `spikes/shadcn-vite/tsconfig.json` + `tsconfig.app.json` | CREATE | shadcn 必須の path alias |
| `spikes/shadcn-vite/components.json` | CREATE (via CLI) | `npx shadcn@latest init` の成果物 |
| `spikes/shadcn-vite/src/main.tsx` + `src/App.tsx` | CREATE | Button/Dialog/Input を1画面で確認 |
| `spikes/shadcn-vite/src/index.css` | CREATE | Tailwind v4 ディレクティブ |
| `spikes/shadcn-vite/README.md` | CREATE | 起動手順・摩擦記録欄 |
| `docs/spikes/REPORT.md` | CREATE | 3スパイクの最終所見と shadcn 採用判断 |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 0 status: pending→in-progress / 完了時 complete、Decisions Log に shadcn 結論追記 |

## NOT Building

- **turborepo セットアップ**（Phase 1 の責務。spikes は pnpm workspace のみで十分）
- **CI / GitHub Actions**（Phase 1）
- **Biome 設定**（Phase 1。Phase 0 は素の prettier すら任意。strict tsconfig のみ徹底）
- **Playwright E2E**（Phase 1。Phase 0 は手動 dogfood で十分）
- **画像 R2 アップロード本実装**（Phase 2。spike B では Yjs ドキュメント同期のみ、画像は static URL で代用）
- **注釈ツール3種（矢印/テキスト/ハイライト）**（Phase 3。spike A は矩形のみ）
- **Undo/Redo**（Phase 3）
- **パスワード保護 / TTL**（Phase 5）
- **本物の認証 / Turnstile / レート制限**（Phase 5/7）
- **shadcn のテーマカスタマイズ**（採用確定後の Phase 6）
- **本番 Cloudflare デプロイ**（Phase 7。Phase 0 は localhost のみ）

---

## Step-by-Step Tasks

### Task 1: ワークスペース基盤
- **ACTION**: ルート `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.nvmrc`, `.npmrc`, `tsconfig.base.json` を作る
- **IMPLEMENT**:
  - `pnpm-workspace.yaml`: `packages: ["spikes/*"]`
  - ルート `package.json`: `"private": true`、`"packageManager": "pnpm@9.x"`、devDeps: `typescript@~5.6`, `@types/node`, `vitest`
  - `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, `jsx: react-jsx`, `verbatimModuleSyntax: true`
  - `.gitignore`: `node_modules/`, `dist/`, `.wrangler/`, `.DS_Store`, `*.log`, `coverage/`
  - `.nvmrc`: `22`
- **MIRROR**: WORKSPACE_LAYOUT_PATTERN
- **IMPORTS**: なし（設定ファイル）
- **GOTCHA**: pnpm workspace は `packages` キー名（npm workspaces とは別）。`packageManager` フィールドが無いと corepack が pnpm を起動しない可能性あり
- **VALIDATE**: `pnpm install` がエラーなく完走（依存ゼロ状態でも成功するはず）

### Task 2: Spike A（Konva）— Vite プロジェクト雛形
- **ACTION**: `spikes/konva-canvas/` を作成し Vite + React + TS の最小構成
- **IMPLEMENT**:
  - `package.json`: scripts `dev`, `build`, `test`、deps `react@~18`, `react-dom@~18`, `react-konva@~18`, `konva@~9`, `use-image@~1.1`、devDeps `vite@~5`, `@vitejs/plugin-react`, `vitest`
  - `vite.config.ts`: react plugin、`resolve.alias['@'] = /src`
  - `tsconfig.json`: extends `../../tsconfig.base.json`、`include: ["src"]`
  - `index.html`: `<div id="root">` のみ
  - `src/main.tsx`: `createRoot(...).render(<App/>)`
  - 空の `src/App.tsx` プレースホルダ
- **MIRROR**: WORKSPACE_LAYOUT_PATTERN, NAMING_CONVENTION
- **IMPORTS**: 上記 deps
- **GOTCHA**: react-konva のバージョンは React のバージョンに連動（react 18 → react-konva 18.x）。React 19 を使う場合は react-konva 19 を選ぶこと。本計画では安全側で React 18.3 を採用
- **VALIDATE**: `pnpm --filter konva-canvas dev` でブランクページが表示、TS エラーなし

### Task 3: Spike A — 矩形不変操作 + 単体テスト（TDD）
- **ACTION**: `src/lib/rect.ts` と `src/lib/__tests__/rect.test.ts` を TDD で実装
- **IMPLEMENT**:
  - 型: `Rect = Readonly<{ id: string; x: number; y: number; w: number; h: number }>`
  - 関数: `addRect`, `moveRect(id, dx, dy)`, `removeRect(id)` — すべて新配列返却
  - テストを RED → GREEN の順で 6 件以上（追加/移動/削除/no-op/imutability/empty）
- **MIRROR**: IMMUTABILITY_PATTERN, TEST_STRUCTURE
- **IMPORTS**: `vitest` のみ
- **GOTCHA**: `noUncheckedIndexedAccess` が効くので配列要素を扱う時は narrowing が必要。意図的に厳格な型を体験する
- **VALIDATE**: `pnpm --filter konva-canvas test` 全件 GREEN

### Task 4: Spike A — Stage マウントと画像表示
- **ACTION**: `SpikeStage.tsx` で画像を Konva に描画
- **IMPLEMENT**:
  - props: `imageSrc: string`
  - `useImage(imageSrc)` で画像取得
  - `<Stage width=window.innerWidth height=window.innerHeight>` 内に Layer + KonvaImage
  - resize 対応の `useStageSize` カスタムフック（`window.addEventListener('resize')` で再描画）
- **MIRROR**: REACT_COMPONENT_PATTERN
- **IMPORTS**: `react-konva`, `use-image`
- **GOTCHA**:
  - `useImage` が返す `image` は最初 `undefined`。null チェック必須
  - SSR時は window 参照不可だが Vite SPA なので問題なし
  - Stage の親要素にはサイズが必要（`#root { width: 100vw; height: 100vh }`）
- **VALIDATE**: `App.tsx` で固定 `https://placehold.co/1200x800.png` を渡してブラウザに画像が表示される

### Task 5: Spike A — 画像 D&D アップロード
- **ACTION**: トップページ全体に drop zone を作って画像を URL.createObjectURL で読み込む
- **IMPLEMENT**:
  - `App.tsx` に `useState<string | null>(imageSrc)`
  - drop ハンドラで `file.type.startsWith('image/')` を validation、`URL.createObjectURL(file)` で blob URL
  - paste（clipboard）対応は **Phase 2 の責務として外す**（ここはD&Dのみ）。NOT Building 節と整合
  - エラー時は `console.error` + 画面に簡易メッセージ
- **MIRROR**: ERROR_HANDLING, IMMUTABILITY_PATTERN
- **IMPORTS**: `react`
- **GOTCHA**: `dragover` で `event.preventDefault()` を呼ばないと drop が発火しない。createObjectURL のクリーンアップ（unmount時 revokeObjectURL）も忘れないこと
- **VALIDATE**: ブラウザで画像をD&D → Stage に表示される、TSエラー無し

### Task 6: Spike A — 矩形ドラッグ操作
- **ACTION**: クリックで矩形追加、ドラッグで移動、Delete キーで削除
- **IMPLEMENT**:
  - Stage onClick で空座標に矩形を addRect
  - 矩形を `<Rect draggable onDragEnd={moveRect}>` で描画
  - 選択中ID state、Delete/Backspace で removeRect
  - 矩形 fill: `oklch(68% 0.21 250 / 0.2)`、stroke は同色 unalpha
- **MIRROR**: IMMUTABILITY_PATTERN, CSS_TOKEN_PATTERN（色は CSS変数のミラー）
- **IMPORTS**: `react`, `react-konva`, `nanoid`(任意。`crypto.randomUUID()` で代替可)
- **GOTCHA**:
  - Konva のドラッグは `onDragEnd` で最終座標を取得（`e.target.x()` / `e.target.y()`）。途中で state を毎フレーム更新するとパフォーマンス劣化
  - Stage onClick は子要素の click も拾うので `e.target === e.target.getStage()` で空判定
- **VALIDATE**: ブラウザでクリック→矩形出現、ドラッグで移動、Delete で削除がそれぞれ動く

### Task 7: Spike B（y-durableobjects）— Workers 雛形
- **ACTION**: `spikes/yjs-durable-object/server/` を Hono + y-durableobjects で立ち上げる
- **IMPLEMENT**:
  - `package.json`: deps `hono@^4.3`, `yjs`, `y-protocols`, y-durableobjects (npm 上の正確な公開名を `npm view` で確認、無ければ git tag指定)、devDeps `wrangler@^3`, `@cloudflare/workers-types`, `typescript`, `vite`(client側)
  - `wrangler.toml`:
    ```toml
    name = "snap-share-spike-yjs"
    main = "server/index.ts"
    compatibility_date = "2026-04-07"
    [[durable_objects.bindings]]
    name = "Y_ROOM"
    class_name = "YRoomDO"
    [[migrations]]
    tag = "v1"
    new_sqlite_classes = ["YRoomDO"]
    ```
  - `server/yjs-do.ts`: `class YRoomDO extends YDurableObject {}`（必要な箇所のみ override、最小は extends のみ）
  - `server/index.ts`: Hono アプリで `app.get('/ws/:room', ...)` → Upgrade 確認 → DO 取得 → `state.fetch` 委譲
- **MIRROR**: ERROR_HANDLING, LOGGING_PATTERN
- **IMPORTS**: `hono`, y-durableobjects (公開名は実装時に確認), `@cloudflare/workers-types`
- **GOTCHA**:
  - **新規 DO クラスは migrations 必須**。`new_sqlite_classes` を忘れると `wrangler dev` がエラー
  - compatibility_date は **2026-04-07以降** にして `web_socket_auto_reply_to_close` を有効化（PRD Research Summary より）
  - `state.acceptWebSocket(ws)` を使うこと（`ws.accept()` だと Hibernation しない）
  - npm 上での y-durableobjects のパッケージ名はリポジトリ README で要確認。万一 npm 未公開ならば `pnpm add github:napolab/y-durableobjects#<tag>` で固定する
- **VALIDATE**: `wrangler dev --local` 起動、`curl -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:8787/ws/test` で 101 が返る（`websocat` 等の確認ツール推奨）

### Task 8: Spike B — Vite クライアント + Yjs 接続
- **ACTION**: `client/` で y-websocket プロバイダ経由 Yjs ドキュメントを2タブ間で同期
- **IMPLEMENT**:
  - deps: `yjs`, `y-websocket`, `react`, `react-dom`
  - Vite proxy: `/ws` → `http://localhost:8787` (ws upgrade 透過)
  - `src/main.tsx`: `Y.Doc` 作成 → `WebsocketProvider(wsUrl, 'spike-room', doc)` → `Y.Map` または `Y.Text` を1つ用意 → 簡易 `<input>` の onChange を Y.Text 同期
  - 接続状態（connecting/synced/disconnected）を画面に表示
- **MIRROR**: ERROR_HANDLING, LOGGING_PATTERN
- **IMPORTS**: `yjs`, `y-websocket`, `react`, `react-dom`
- **GOTCHA**:
  - WebsocketProvider の URL は **ws://** で渡す（http ではない）。Vite dev server のプロキシ設定で ws: true を必須
  - 同期状態 `provider.on('status', ...)` でログ取得
- **VALIDATE**:
  - 2タブ開いて片方で文字を入れたら他方に200ms以内で反映
  - 片方を5分以上アイドル放置（DO Hibernation 突入）後、再度入力で復帰してもドキュメントが保持されている
  - `wrangler tail` でログを確認、エラーが無いこと

### Task 9: Spike C（shadcn）— Vite + Tailwind v4 雛形
- **ACTION**: `spikes/shadcn-vite/` を Tailwind v4 + Vite + React で作る
- **IMPLEMENT**:
  - deps: `react@~18`, `react-dom@~18`, devDeps: `vite@~5`, `@vitejs/plugin-react`, `tailwindcss@~4`, `@tailwindcss/vite`, `typescript`
  - `vite.config.ts`:
    ```ts
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import tailwindcss from '@tailwindcss/vite';
    import path from 'node:path';
    export default defineConfig({
      plugins: [react(), tailwindcss()],
      resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    });
    ```
  - `tsconfig.json` & `tsconfig.app.json` 両方に `paths: { "@/*": ["./src/*"] }` と `baseUrl: "."`
  - `src/index.css`:
    ```css
    @import "tailwindcss";
    ```
  - `src/main.tsx` + `src/App.tsx`: 空のレイアウトを準備
- **MIRROR**: WORKSPACE_LAYOUT_PATTERN, NAMING_CONVENTION
- **IMPORTS**: 上記 deps
- **GOTCHA**:
  - shadcn CLI は **両方の tsconfig** を見る。片方だけだと "Could not find tsconfig" エラー
  - Tailwind v4 は postcss プラグインではなく Vite プラグイン経由。`tailwind.config.js` は不要（v4はCSSベース設定）
- **VALIDATE**: `pnpm --filter shadcn-vite dev` で空ページが起動、Tailwind ユーティリティが効くか `<div className="bg-blue-500 p-4">` で確認

### Task 10: Spike C — shadcn 初期化と3コンポーネント追加
- **ACTION**: `npx shadcn@latest init` 実行、その後 button/dialog/input を追加
- **IMPLEMENT**:
  - `cd spikes/shadcn-vite && pnpm dlx shadcn@latest init`（プロンプトに沿って New York / Slate / RSC=No / 既存 css=src/index.css 等を選択）
  - 生成された `components.json`, `src/components/ui/*`, `src/lib/utils.ts` をコミット
  - `pnpm dlx shadcn@latest add button dialog input`
  - `App.tsx` で 3 コンポーネントを並べた確認画面（Button click → Dialog 開く、Dialog 内に Input）を作る
- **MIRROR**: REACT_COMPONENT_PATTERN
- **IMPORTS**: `@/components/ui/button`, `@/components/ui/dialog`, `@/components/ui/input`
- **GOTCHA**:
  - `pnpm dlx` は CLI 引数を直接渡せる。`npx` でも可だが pnpm 環境統一として dlx を推奨
  - shadcn は必要な依存（`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` 等）を自動 install するので別途追加不要
  - 初期化時に "Are you using TypeScript?" → Yes、"path aliases" の質問で `@/*` を確認
- **VALIDATE**:
  - 画面で Button → Dialog → Input が正しく動く
  - 日本語 placeholder/label が文字化けせず表示される（フォント未指定でブラウザデフォルトでも視認できれば合格）
  - `tsc --noEmit` でエラーなし

### Task 11: 各スパイクの個別 README
- **ACTION**: 各 `spikes/*/README.md` に起動手順・観点・観察結果欄を書く
- **IMPLEMENT**: テンプレート
  ```md
  # Spike: <name>
  ## Goal
  <一文>
  ## Run
  pnpm install
  pnpm --filter <name> dev
  ## What to verify
  - [ ] 観点1
  - [ ] 観点2
  ## Observations
  (記入する)
  ```
- **MIRROR**: なし（ドキュメント）
- **IMPORTS**: なし
- **GOTCHA**: README の `## Observations` は空欄で残してスパイク実施時に手書きで埋める。AIが先回りして埋めない
- **VALIDATE**: 3 README が存在し、起動手順を読むだけで他人が動かせる

### Task 12: 統合スパイクレポート
- **ACTION**: `docs/spikes/REPORT.md` に3スパイクの結論 + shadcn 採用判断 + 残課題を記載
- **IMPLEMENT**: 構成
  ```md
  # Phase 0 Spike Report
  ## Konva (spike A)
  - 動作: ✅/⚠️/❌
  - 所見: <bundle size 実測, FPS, ドラッグ体感>
  - Phase 3 への引継: <そのまま使える/書き直す>
  ## Yjs + Durable Objects (spike B)
  - 動作: ✅/⚠️/❌
  - 所見: <Hibernation 復帰確認, 同期遅延 ms 計測, npm パッケージ名確定>
  - Phase 4 への引継: <…>
  ## shadcn/ui (spike C)
  - 動作: ✅/⚠️/❌
  - 摩擦: <インストール手順, 日本語表示, alias 設定>
  - **採用判断: 採用 / 不採用（理由）**
  ## Decisions to update in PRD
  - shadcn: <採用/不採用>
  - その他想定外で確定したこと
  ## Open issues for Phase 1+
  - <list>
  ```
- **MIRROR**: なし（ドキュメント）
- **IMPORTS**: なし
- **GOTCHA**: 数値（bundle, FPS, latency）は実測必須。「たぶん」で書かない。実測できない場合は「未計測」と明記
- **VALIDATE**: REPORT.md の3セクションが埋まっており、shadcn の採用可否が yes/no で書かれている

### Task 13: PRD 更新
- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` の Phase 0 行を更新
- **IMPLEMENT**:
  - Phase 0 行: `pending` → スパイク開始時 `in-progress`、Task 12 完了後 `complete`
  - PRP Plan セルに `.claude/PRPs/plans/phase-0-tech-spike.plan.md` を記入
  - Decisions Log の最終行付近に shadcn の決定を追記（採用 or 不採用 + 理由）
- **MIRROR**: なし
- **IMPORTS**: なし
- **GOTCHA**: ステータスは2回更新する点に注意（in-progress と complete は別タイミング）
- **VALIDATE**: `git diff .claude/PRPs/prds/snap-share.prd.md` でステータスと Decisions Log の追記を確認

---

## Testing Strategy

### Unit Tests（Spike A の純関数のみ TDD で必須）

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `addRect` returns new array | `[]`, `r1` | `[r1]`、元配列とは別参照 | no |
| `addRect` is immutable | `[r1]`, `r2` | 元配列に影響しない | yes |
| `moveRect` updates target only | `[r1, r2]`, `r1.id`, +5/+5 | r1 の x,y のみ加算、r2 は同一参照 | yes |
| `moveRect` no-op for unknown id | `[r1]`, `'zzz'`, +1/+1 | 内容同一だが新配列 | yes |
| `removeRect` filters out target | `[r1, r2]`, `r1.id` | `[r2]` | no |
| `removeRect` no-op for unknown id | `[r1]`, `'zzz'` | `[r1]`（新配列） | yes |

### Edge Cases Checklist
- [ ] D&D で画像以外（pdf 等）を落とした時に validation で弾く
- [ ] D&D で巨大画像（10MB超）を落とした時の挙動を観察（Phase 2 の制限実装の根拠取り）
- [ ] WS 接続失敗時にクライアントが console.error と画面ステータスで通知
- [ ] DO Hibernation 中に新規接続が来ても DO が wake してドキュメントを返せる
- [ ] shadcn Dialog が `Esc` で閉じる、フォーカストラップが動く（アクセシビリティ簡易確認）

> Spike B/C は手動 dogfood で十分。E2E 自動化は Phase 1+。

---

## Validation Commands

### Static Analysis
```bash
# 全 spike の TS チェック
pnpm -r exec tsc --noEmit
```
EXPECT: ゼロエラー

### Unit Tests（Spike A 純関数のみ）
```bash
pnpm --filter konva-canvas test
```
EXPECT: 全件 GREEN

### Spike A 起動
```bash
pnpm --filter konva-canvas dev
# ブラウザで http://localhost:5173 を開く
```
EXPECT: 画像 D&D → Konva 表示 → クリックで矩形 → ドラッグ移動 → Delete で削除 が動作

### Spike B 起動（2 端末/2 ターミナル）
```bash
# Terminal 1
cd spikes/yjs-durable-object && pnpm wrangler dev
# Terminal 2
cd spikes/yjs-durable-object && pnpm --filter ./client dev
# ブラウザで2タブ http://localhost:5173 を開く
```
EXPECT:
- 片方の入力が他方に200ms以内で反映
- 5分以上アイドル後の再入力でも同期維持
- `wrangler tail` でエラーログなし

### Spike C 起動 + shadcn 動作確認
```bash
pnpm --filter shadcn-vite dev
```
EXPECT: Button → Dialog → Input が動き、`tsc --noEmit` ゼロエラー

### Bundle Size 実測（Konva の "〜80KB gz" 検証）
```bash
pnpm --filter konva-canvas build
# dist/assets/*.js の gzip サイズを wc/du で確認
```
EXPECT: react + react-konva + konva の合算で 200KB gz 以下（PRD のランディング 150KB は超えるが、これは spike なので許容、Phase 6 で再評価）

### Manual Validation（最終チェックリスト）
- [ ] Konva で画像表示・矩形CRUD が手で動かせる
- [ ] Yjs+DO で2クライアント同期と Hibernation 復帰が確認できた
- [ ] shadcn を install 〜 3コンポーネント表示まで通せた、もしくは採用見送りの根拠が記録された
- [ ] `docs/spikes/REPORT.md` に各 spike の所見（数値含む）が記入されている
- [ ] PRD の Phase 0 行が `complete` になり PRP Plan 列に本ファイルパスが入っている
- [ ] PRD Decisions Log に shadcn 採用/不採用の決定が追記されている

---

## Acceptance Criteria
- [ ] Task 1〜13 すべて完了
- [ ] 上記 Validation Commands すべてクリア
- [ ] `tsc --noEmit` ゼロエラー
- [ ] Spike A の単体テスト 6 件以上 GREEN
- [ ] `docs/spikes/REPORT.md` の3スパイクセクションが埋まっている
- [ ] shadcn 採用 / 不採用 が yes/no で確定し PRD に反映

## Completion Checklist
- [ ] コードが本計画の Patterns to Mirror に準拠
- [ ] エラーハンドリングが console.error + ユーザー向け表示の両建て
- [ ] 不変パターンを徹底（mutation 無し）
- [ ] テストファイル名・配置が `__tests__` 配下に統一
- [ ] ハードコード禁止が守られている（色は CSS変数、サイズは定数）
- [ ] ドキュメント（REPORT.md, README）が更新済み
- [ ] スコープ外項目（NOT Building）に手を出していない
- [ ] PRD（Phase 0 status / PRP Plan / Decisions Log）が更新済み

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `y-durableobjects` の npm 公開名/最新タグが README と異なる | M | M | npm registry 直接確認、無ければ git tag pin、最悪 `y-websocket` を一時利用しつつ DO 側を自前実装 |
| `wrangler dev --local` で DO Hibernation が再現しない | M | L | --remote 確認は別タスク。Phase 0 では「ローカルで疎通」までで合格、Hibernation 確認は Phase 4 で本格化 |
| Tailwind v4 と shadcn の組合せ不安定（v4 移行直後） | M | M | shadcn 公式 Vite インストール手順に厳密追従。問題発生時は Tailwind v3 にダウングレードしてもう一度試す |
| react-konva と React バージョンミスマッチ | L | M | React 18.3 と react-konva 18.x で固定 |
| Spike が伸びて Phase 1 を圧迫 | M | H | 「2日想定」を厳守、3日目に入る場合は shadcn を即見送り判断、見送り時は素の Tailwind で進める前提を REPORT.md に記録 |
| `noUncheckedIndexedAccess` で型エラー連発 | L | L | spike 限定で `tsconfig.json` 側で false に上書き可能（base は維持）。ただし無効化したことを明記 |

## Notes

- **このフェーズは「コードの完成度」より「判断材料の蓄積」が目的**。Tasks 1〜10 は最小限、Tasks 11〜13 のドキュメンテーションが本フェーズの真の成果物。
- Phase 1 でこの `spikes/` を **破棄するか保持するか** は REPORT.md で結論を出す。デフォルト想定: 破棄して `apps/web` `apps/api` に再構成（コードスタイルの mirror 元としては REPORT.md と git history で十分）。
- shadcn 不採用なら、PRD の Solution Detail 表 `Should: shadcn適用` を Phase 6 で「Tailwind + 自前 UI コンポーネント」に書き換える追加作業が発生する。これは Phase 6 のタスクに繰延でよい（Phase 0 では PRD Decisions Log の更新のみ）。
- Konva の `~80KB gz` 検証で大幅超過した場合（例: 200KB gz超）は PRD の Decisions Log と Technical Risks に再評価メモを追加する。
- 実装着手前にこのプランを `/prp-implement` で実行する想定。spike は順次（A→B→C）でも並列でも構わないが、`pnpm install` がワークスペース全体に効く性質上、依存衝突を避けるため Task 1 は必ず最初に完了させる。
