# Plan: Phase 6 — PNG エクスポート + UI 仕上げ + shadcn 適用 + レスポンシブ

## Summary

Konva ステージから PNG をダウンロード可能にし、`apps/web/components.json` に既に置いてある shadcn/ui を実際にプロジェクト導入する。`Button` / `Input` / `Label` / `Checkbox` / `Tooltip` / `Sonner` / `AlertDialog` を入れ、既存の `ToolButton` / `CopyUrlButton` / `RoomGate` / `LocalEditor` のパスワード UI / `RoomEditor` の `window.confirm` を置き換える。タブレット閲覧（768px〜）と小型ノート（〜1024px）でツールバーが崩れないようレイアウトを再構成し、`<title>` / OGP / favicon / `lang="ja"` 周りを公開可能な水準に整える。

## User Story

As a snap-share の利用者,
I want 注釈を入れた画像を 1 クリックで PNG として保存し、タブレットでもレイアウト崩れなく閲覧でき、UI が「最小限を最小限に」と整っている状態,
So that 業務 Slack/Teams に貼って完結でき、共有相手のデバイスを問わず内容を確認してもらえる.

## Problem → Solution

- **現状**: PNG エクスポートが未実装、shadcn は `components.json` のみで実体は未導入、ツールバーが固定幅で 768px 以下では `header` の `flex` が破綻、`window.confirm` が UI 体験から浮いている、`<title>` などのメタは Vite 初期値のまま。
- **解決後**: Stage に ref を張って `toDataURL({ pixelRatio: 2 })` で PNG をダウンロード、shadcn primitive で揃った UI、768/1024 でツールバーが折り返し、上書き禁止系の確認は `AlertDialog` で行う、メタタグ/favicon/OGP が日本語ファーストで整う。

## Metadata

- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 6 — エクスポート + UI 仕上げ
- **Estimated Files**: 新規 ~10、更新 ~12

---

## UX Design

### Before

```
┌──────────────────────────────────────────────┐
│ snap-share                       [URLコピー] │  ← header (1024px 以下で重なる)
│           [V][R][A][T][H][↶][↷][🗑][🖼]      │
├──────────────────────────────────────────────┤
│                                              │
│              （画像 + 注釈）                 │
│                                              │
│                                  [● 同期中]  │
└──────────────────────────────────────────────┘

ヘッダ右端は「URLコピー」のみ。PNG 保存導線なし。
window.confirm() で素のブラウザダイアログ。
```

### After

```
┌──────────────────────────────────────────────┐
│ snap-share         [V R A T H │ ↶↷🗑│🖼│⤓]   │
│                                  [URLコピー] │  ← 1024px 以下では 2 段
├──────────────────────────────────────────────┤
│                                              │
│              （画像 + 注釈）                 │
│                                              │
│                                  [● 同期中]  │
└──────────────────────────────────────────────┘

⤓ = PNG として保存。Tooltip に「PNG 保存 (⌘S)」。
全注釈削除 → AlertDialog で確認。
コピー完了 → Sonner toast で右下フィードバック。
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| PNG エクスポート | 無し | ツールバー右端の `Download` ボタン + `⌘S` ショートカット | 非選択ツール扱い、`imageLoaded` のときのみ有効 |
| 全注釈削除（Room） | `window.confirm` | `AlertDialog`（破壊的アクション） | Room モードのみ。Local モードは画像クリアのみ |
| URL コピー完了 | ボタン文言が一時的に切替 | Sonner toast（"URL をコピーしました"）+ ボタンのアイコン切替維持 | 視認性向上 |
| ツールバー shortcut | `title` 属性 | shadcn `Tooltip`（ホバー / フォーカス時に kbd 付き） | 既存 a11y を維持 |
| パスワード入力（LocalEditor / RoomGate） | 素の `<input type="password">` | shadcn `Input` + `Label` + `Checkbox`（保護トグル） | ARIA は据え置き |
| 768px ヘッダ | `flex` 一列で折り返さず重なる | ヘッダ全体を `flex-wrap` 化 + ツールバー本体を内側で `flex-wrap` | `<h1>` は xs で非表示、メインツール列のみ常に visible |
| メタタグ | `<title>snap-share</title>` のみ | `<title>`、`description`、`og:*`、`theme-color`、`favicon.svg` 整備 | i18n は `lang="ja"` を維持しつつ `og:locale` を `ja_JP` に |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/pages/EditorShell.tsx` | all | ヘッダ（toolbar 行）/ Stage コンテナの再構成対象、`toolbarRight` slot を活用 |
| P0 | `apps/web/src/components/canvas/CanvasStage.tsx` | all | Stage に `ref` を追加し、export 時に Awareness を一時的に hide して `toDataURL` する起点 |
| P0 | `apps/web/src/components/canvas/AnnotationLayer.tsx` | all | export 中に draft 注釈が混ざらないよう、Stage refベース実装の前提を確認 |
| P0 | `apps/web/src/components/canvas/AwarenessLayer.tsx` | all | export 時に visible=false にする対象。`Layer` 単位で hide できる構成 |
| P0 | `apps/web/src/components/toolbar/Toolbar.tsx` | all | `Tooltip` 導入とエクスポートボタン追加、レスポンシブ崩れの主因 |
| P0 | `apps/web/src/components/toolbar/ToolButton.tsx` | all | shadcn `Button` 系に乗せ替え。ただし `aria-pressed` toggle 仕様は維持 |
| P0 | `apps/web/src/components/toolbar/CopyUrlButton.tsx` | all | Sonner toast 導入と shadcn `Button` 化 |
| P0 | `apps/web/src/components/room-gate/RoomGate.tsx` | all | shadcn `Input` / `Label` / `Button` 化 |
| P0 | `apps/web/src/pages/LocalEditor.tsx` | all | パスワード UI を shadcn `Input` + `Checkbox` + `Label` に置換 |
| P0 | `apps/web/src/pages/RoomEditor.tsx` | 99-114 | `window.confirm` → `AlertDialog` 化。`useState` で open 管理 |
| P0 | `apps/web/components.json` | all | Tailwind v4 / `style: "base-nova"` / alias 設定の確認 |
| P0 | `apps/web/src/styles/global.css` | all | shadcn が要求する CSS variables を `@theme` で追加する起点 |
| P0 | `apps/web/src/styles/tokens.css` | all | 既存トークンと shadcn neutral palette を併存させる |
| P1 | `apps/web/src/lib/utils.ts` | all | `cn` がすでに `clsx + tailwind-merge` で導入済（shadcn が前提とする） |
| P1 | `apps/web/src/hooks/useKeyboardShortcuts.ts` | all | `⌘S` を export ハンドラに紐付ける拡張点 |
| P1 | `apps/web/src/lib/logger.ts` | all | export 失敗時の warn 経路 |
| P1 | `apps/web/index.html` | all | `<title>` / `meta` / `lang` / favicon の置換対象 |
| P1 | `apps/web/playwright.config.ts` + `e2e/landing.spec.ts` | all | E2E 既存パターン（Chromium のみ、`pnpm dev` を web server に） |
| P2 | `apps/web/vite.config.ts` | all | dev proxy 設定維持。download 機能は新規ライブラリ不要 |
| P2 | `spikes/konva-canvas/src/App.tsx` | all | Stage size hook の比較。今回は `EditorShell` 既存の `useStageSize` に乗せる |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| shadcn/ui Tailwind v4 install | https://ui.shadcn.com/docs/installation/vite (v4 / `style: base-nova`) | `pnpm dlx shadcn@latest add <component>` でファイルが `apps/web/src/components/ui/` に生成される。Tailwind v4 では `@theme` ディレクティブで CSS variables を宣言。`tailwindcss-animate` は不要（v4 は `tw-animate-css` 公式パッケージ）|
| shadcn React 19 互換 | https://ui.shadcn.com/docs/react-19 | React 19 + radix-ui の peer dep 警告は pnpm の `peerDependencyRules.allowedVersions` で抑制可能。今回は警告許容で進める |
| Konva PNG export | https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html | `stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })`。export 中は不要 Layer を `layer.hide()` → 復元するパターンが公式推奨 |
| Konva data URL → file | https://konvajs.org/docs/sandbox/Stage_Preview.html / MDN `Blob`, `URL.createObjectURL` | `stage.toCanvas({ pixelRatio })` → `canvas.toBlob('image/png')` → `<a href download>` クリック。data URL は ~5MB を超えると Chromium が拒否することがあるため Blob を推奨 |
| Sonner（shadcn 推奨 toast） | https://ui.shadcn.com/docs/components/sonner | `<Toaster richColors closeButton position="bottom-right" />` を `App.tsx` に置く。`toast.success(...)` で発火 |
| Radix Dialog vs AlertDialog | https://www.radix-ui.com/primitives/docs/components/alert-dialog | 破壊的アクションには `AlertDialog`（Escape 以外で閉じない、`onOpenChange` のみ） |

KEY_INSIGHT: shadcn は Tailwind v4 + React 19 を `style: "base-nova"` でサポート済。`components.json` に `cssVariables: true` がすでに設定されており、`global.css` に `@theme inline { ... }` を足してから `pnpm dlx shadcn@latest add <name>` でファイル生成すれば良い。
APPLIES_TO: Task 1（shadcn 初期化）。
GOTCHA: shadcn の生成ファイルは `tailwindcss-animate` ではなく `tw-animate-css` を import する場合がある。生成された `globals.css` 追加分の指示に従う。

KEY_INSIGHT: `@konva/Stage` は ref で取得した Konva.Stage インスタンスから `toDataURL` / `toCanvas` を直接呼べる。export 直前に `awarenessLayerRef.current.hide()` → 直後に `show()` で十分（`layer.batchDraw()` は `hide/show` 内で自動）。
APPLIES_TO: Task 4（PNG エクスポートの実装）。
GOTCHA: テキスト編集中の DOM オーバーレイ（`TextEditorOverlay`）は Konva 外なので export には乗らない。export 前に `editingTextId` を `null` にすれば自動的にコミット/破棄される。

KEY_INSIGHT: タブレット閲覧用ブレイクポイントは Tailwind デフォルト（`sm` 640 / `md` 768 / `lg` 1024）に合わせる。`EditorShell` の絶対配置 `header` を `flex-wrap` + `gap-2` に変えれば、`Toolbar` 内側を `flex-wrap` に直すだけで 1024px 以下でも 2 段に割れる。
APPLIES_TO: Task 9（レスポンシブ対応）。
GOTCHA: `useStageSize` は `window.innerWidth/Height` 直読み。ヘッダが 2 段になると Stage の上端 `TOOLBAR_HEIGHT = 56` 固定が破綻するため、ResizeObserver で実測の header 高さを引く方式に切り替える。

---

## Patterns to Mirror

### NAMING_CONVENTION
```ts
// SOURCE: apps/web/src/components/toolbar/CopyUrlButton.tsx:7
export const CopyUrlButton = () => { ... }
// SOURCE: apps/web/src/components/empty-state/DropZone.tsx:9
export const DropZone = ({ onFile, error }: DropZoneProps) => { ... }
// SOURCE: apps/web/src/hooks/useImageSource.ts:28
export const useImageSource = (options: UseImageSourceOptions = {}): UseImageSource => { ... }
```
- Component: PascalCase named export, 1 file = 1 component
- Hook: `useCamelCase`、戻り値は `Readonly<{ ... }>`
- Props: `type Props = Readonly<{ ... }>` または同名 `XxxProps`、必ず `Readonly<...>`

### ERROR_HANDLING
```ts
// SOURCE: apps/web/src/components/toolbar/CopyUrlButton.tsx:33-37
} catch (e: unknown) {
  logger.warn('clipboard write failed', {
    error: e instanceof Error ? e.message : String(e),
  });
}
// SOURCE: apps/web/src/lib/imageValidation.ts:23-32
return { ok: false, error: '画像ファイルをドロップしてください (...)' };
```
- 例外は `unknown` で受けて `instanceof Error` で narrow → `logger.warn`
- ユーザー文言は日本語、Result discriminated union は `{ ok: true, ... } | { ok: false, error/reason }`

### LOGGING_PATTERN
```ts
// SOURCE: apps/web/src/lib/logger.ts:1-13
import { logger } from '../../lib/logger';
logger.info('image loaded', { type: result.contentType, bytes: result.bytes });
```
- すべて `logger.{info,warn,error}` 経由。`console.*` 直は `logger.ts` のみ
- 第二引数は `Record<string, unknown>`、機微情報は載せない

### TAILWIND_CSS_VAR_PATTERN
```tsx
// SOURCE: apps/web/src/components/connection/ConnectionBadge.tsx:21
className="... bg-(--color-surface) ring-1 ring-black/10 ..."
// SOURCE: apps/web/src/components/toolbar/Toolbar.tsx:58-61
className={[
  'pointer-events-auto flex items-center gap-3 rounded-xl border bg-(--color-toolbar-bg)',
  'border-(--color-toolbar-border) px-3 py-2 shadow-sm backdrop-blur',
].join(' ')}
```
- Tailwind v4 の `bg-(--var-name)` 構文を使う
- 既存色は `tokens.css` の `--color-*` を参照、shadcn 由来のグレースケールは `--background` / `--foreground` を別途定義（後述）

### REDUCER_DISPATCH_PATTERN
```ts
// SOURCE: apps/web/src/hooks/useAnnotationsStore.ts:21-42
const storeReducer = (state: HistoryState<AnnotationsState>, action: StoreAction) => { ... }
// SOURCE: apps/web/src/pages/EditorShell.tsx:74-81
const handleDelete = useCallback(() => {
  const id = store.state.selectedId;
  if (!id) return;
  store.dispatch({ type: 'annotation/remove', id });
}, [store, ...]);
```
- 単一 useReducer に discriminated union action を投げる
- ハンドラは useCallback、依存に store オブジェクト全体（store は安定参照）

### TEST_STRUCTURE_HOOK
```ts
// SOURCE: apps/web/src/lib/__tests__/utils.test.ts:1-15
import { describe, expect, it } from 'vitest';
describe('cn', () => {
  it('merges tailwind classes deduplicating identical utilities', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
// SOURCE: apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx
// (uses react-dom/client + happy-dom; no @testing-library)
```
- describe / it / expect、Arrange-Act-Assert
- DOM-touching テストは happy-dom + react-dom/client（既存パターンを踏襲）

### CSS_VARIABLE_BRIDGING
```ts
// SOURCE: apps/web/src/components/canvas/colors.ts:1-15
// Konva does not resolve CSS variables, so canvas color constants live here
// and are kept physically in sync with apps/web/src/styles/tokens.css.
export const STROKE_RECTANGLE = '#5b6dff';
```
- Konva に CSS 変数は通らないので hex 定数を `colors.ts` に集約し、`tokens.css` と物理的に同期する
- shadcn 側の追加色も同方針（必要なら `colors.ts` を分割せずコメントで明示）

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/ui/button.tsx` | CREATE | shadcn `Button` |
| `apps/web/src/components/ui/input.tsx` | CREATE | shadcn `Input` |
| `apps/web/src/components/ui/label.tsx` | CREATE | shadcn `Label` |
| `apps/web/src/components/ui/checkbox.tsx` | CREATE | shadcn `Checkbox` |
| `apps/web/src/components/ui/tooltip.tsx` | CREATE | shadcn `Tooltip` |
| `apps/web/src/components/ui/sonner.tsx` | CREATE | shadcn Sonner（Toaster ラッパ） |
| `apps/web/src/components/ui/alert-dialog.tsx` | CREATE | shadcn `AlertDialog` |
| `apps/web/src/components/toolbar/ExportButton.tsx` | CREATE | PNG エクスポート発火 UI（Toolbar 内に置く） |
| `apps/web/src/lib/exportPng.ts` | CREATE | Stage ref + filename builder + Blob → ダウンロード処理 |
| `apps/web/src/lib/__tests__/exportPng.test.ts` | CREATE | filename / blob 取得の純関数部分のテスト |
| `apps/web/src/hooks/useExportPng.ts` | CREATE | Stage ref + Awareness layer ref + ファイル名生成を組み合わせるフック |
| `apps/web/src/components/dialogs/ConfirmClearAllDialog.tsx` | CREATE | RoomEditor の「全注釈削除」確認 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATE | shadcn `Tooltip` 導入、`flex-wrap` + group 分割、Export 行を追加 |
| `apps/web/src/components/toolbar/ToolButton.tsx` | UPDATE | shadcn `Button` ベース化、`aria-pressed` を `data-[state=on]` も併用 |
| `apps/web/src/components/toolbar/CopyUrlButton.tsx` | UPDATE | shadcn `Button` + Sonner toast |
| `apps/web/src/components/room-gate/RoomGate.tsx` | UPDATE | shadcn `Input` / `Label` / `Button` |
| `apps/web/src/pages/LocalEditor.tsx` | UPDATE | shadcn `Input` / `Checkbox` / `Label` でパスワード UI 再構成、Export ボタンも localでは無効 |
| `apps/web/src/pages/RoomEditor.tsx` | UPDATE | `window.confirm` → `ConfirmClearAllDialog` |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | header を `flex-wrap` + ResizeObserver で実 height 計測、Export ハンドラを props に取り、`stageRef` / `awarenessLayerRef` を子へ |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | `Stage` に `ref` props を forward、`AwarenessLayer` 用 ref も受け渡し |
| `apps/web/src/components/canvas/AwarenessLayer.tsx` | UPDATE | `<Layer ref={...}>` を forward 受け取り |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATE | `onExport` を追加し、`⌘S` で発火 |
| `apps/web/src/styles/global.css` | UPDATE | shadcn 用の `@theme` ブロックと `@import "tw-animate-css"` を追加 |
| `apps/web/src/styles/tokens.css` | UPDATE | shadcn neutral palette と既存 `--color-*` の橋渡し |
| `apps/web/index.html` | UPDATE | `<title>` / description / og:* / theme-color / favicon |
| `apps/web/public/favicon.svg` | CREATE | 軽量 SVG favicon（snap-share の頭文字 or pin） |
| `apps/web/public/og-image.png` | CREATE | 1200x630 OG 画像（手書き or 単色 + アクセント） |
| `apps/web/src/App.tsx` | UPDATE | `<Toaster />` を最上位に追加 |
| `apps/web/package.json` | UPDATE | shadcn 由来の Radix / sonner / tw-animate-css 追加 |
| `pnpm-workspace.yaml` | UPDATE | radix / sonner / tw-animate-css を catalog に追加（複数 workspace で共有しないなら任意） |
| `apps/web/e2e/landing.spec.ts` | UPDATE | エクスポートボタンの可視・無効化テスト追加、見出しテストはそのまま |
| `apps/web/e2e/export.spec.ts` | CREATE | 画像 D&D → エクスポートで `download` イベントが発火する E2E |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 6 status を `pending` → `in-progress`、PRP 列に本ファイル |

## NOT Building

- 注釈の SVG / JPEG / PDF エクスポート（PNG のみ。PRD は PNG export を Must としている）
- ルームの永続化、ダウンロード履歴、画像のクラウド共有（Could 領域）
- ダークモード切り替え UI（PRD 内に未要請。`@theme` で将来拡張可能な骨格だけ整える）
- 多言語切替 UI（i18n フレームワーク導入）。Should の「英語フォールバック」は OS locale ベースの一括切替で、Phase 7 以降に切り出す
- スマートフォン縦持ちでの編集 UX（PRD は「タブレット閲覧」を Should とし、編集はデスクトップ前提）。`md` 以下の編集モードは「閲覧 + URL コピー + エクスポート」だけ可能とし、ツール群は `md` 以下では disabled
- shadcn の Avatar / DropdownMenu など今回不要な component 群
- E2E の WebKit / Firefox 拡張（Phase 7 で）

---

## Step-by-Step Tasks

### Task 1: shadcn 初期化（Tailwind v4 + 既存 components.json）
- **ACTION**: `pnpm dlx shadcn@latest add button input label checkbox tooltip sonner alert-dialog` を `apps/web` で実行。生成された `src/components/ui/*.tsx` を確認、`global.css` に追加された `@theme inline` ブロック・`@import "tw-animate-css"` を許容。`package.json` に追加された `@radix-ui/*` / `sonner` / `tw-animate-css` を catalog 経由か直接管理かを判断（今回は web 専用なので `apps/web/package.json` に直接保持で OK）。
- **IMPLEMENT**:
  - 生成された `tw-animate-css` 依存を `apps/web/package.json` に明示
  - `pnpm install` で lockfile 反映
  - `apps/web/src/styles/global.css` に shadcn が要求する `@theme` を追加し、既存 `@import "./tokens.css";` の前後関係を調整（`@import "tailwindcss"; @import "tw-animate-css"; @import "./tokens.css";` の順）
  - `tokens.css` に `--background: var(--color-surface)` / `--foreground: var(--color-text)` / `--ring: var(--color-accent)` など shadcn が参照する変数のブリッジを追加
- **MIRROR**: TAILWIND_CSS_VAR_PATTERN
- **IMPORTS**: なし（生成）
- **GOTCHA**: shadcn CLI は `components.json` の `style: "base-nova"` を尊重する。React 19 で peer warning が出ることがあるが許容。`Input` / `Label` のスタイルが既存 `bg-(--color-surface)` と衝突するので、生成後に既存トークンと突き合わせて `--input` / `--border` / `--muted-foreground` の値を `tokens.css` で上書きする。
- **VALIDATE**: `pnpm -F @snap-share/web typecheck`、`pnpm -F @snap-share/web build` がエラーゼロ。`pnpm -F @snap-share/web dev` 起動で既存 EditorShell が崩れていないことを目視確認。

### Task 2: Toaster 配線
- **ACTION**: `apps/web/src/App.tsx` に `<Toaster richColors closeButton position="bottom-right" />` を追加。`EditorShell` の `floatingExtras` の右下とは座標が被らないことを確認（toaster は viewport 直下の portal。`ConnectionBadge` の `right-4 bottom-4` を `bottom-12` にずらす）。
- **IMPLEMENT**:
  ```tsx
  import { Toaster } from '@/components/ui/sonner';
  // App.tsx
  return (
    <>
      <EditorPage roomId={roomId} onRoomIdChange={setRoomId} />
      <Toaster richColors closeButton position="bottom-right" />
    </>
  );
  ```
  - `ConnectionBadge.tsx` の `bottom-4` → `bottom-14` に変更
- **MIRROR**: NAMING_CONVENTION（named export）
- **IMPORTS**: `@/components/ui/sonner` の `Toaster`
- **GOTCHA**: Sonner はデフォルトで `aria-live="polite"` を出すので、`ConnectionBadge` と被ると Screen reader が二重通知する。`ConnectionBadge` 側を `aria-live="off"` でも良いが、ユーザーへの接続再試行通知は重要なので両者を残す。
- **VALIDATE**: 開発サーバで `toast.success('test')` をブラウザコンソールから呼び、右下に表示されること。

### Task 3: ToolButton と Toolbar の shadcn 化 + Tooltip
- **ACTION**: `ToolButton` を shadcn `Button` の `variant="ghost" size="icon"` ベースに置き換え、`aria-pressed` 時のスタイルを `data-[state=on]:` パターンで再現。`Toolbar` に `<TooltipProvider delayDuration={150}>` を貼り、各ボタンを `<Tooltip>` でラップしてキー bind を表示する。
- **IMPLEMENT**:
  - `ToolButton.tsx`:
    ```tsx
    import { Button } from '@/components/ui/button';
    import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
    // ... pressed prop は aria-pressed と class に反映
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-pressed={pressed} aria-label={label} ...>
            <Icon size={18} strokeWidth={1.75} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span>{label}</span>
          {shortcut && <kbd className="ml-2 rounded bg-(--color-toolbar-bg) px-1 text-xs">{shortcut}</kbd>}
        </TooltipContent>
      </Tooltip>
    );
    ```
  - `Toolbar.tsx`:
    - 全体を `<TooltipProvider>` でラップ
    - 内側 root を `flex flex-wrap items-center gap-x-2 gap-y-1` にする（`md` 以下で 2 段折り）
    - 区切り線 `<Separator>` 風の縦バーは既存の `<div aria-hidden="true" className="h-6 w-px ...">` を `hidden md:block` に
- **MIRROR**: TAILWIND_CSS_VAR_PATTERN, NAMING_CONVENTION
- **IMPORTS**: `@/components/ui/button`, `@/components/ui/tooltip`
- **GOTCHA**: shadcn の `Button` は `disabled:pointer-events-none` を持つ。Tooltip は `disabled` 時に開かないため、`asChild` の代わりに `<TooltipTrigger>` を別 wrapper にする必要があれば、`<span tabIndex={0}>` 付きで包む（Radix 公式パターン）。
- **VALIDATE**: 既存 E2E `landing page renders the editor toolbar with all five tools` が継続して pass。Tooltip がキー bind 付きで表示されること。

### Task 4: PNG エクスポート — `useExportPng` + `lib/exportPng.ts`
- **ACTION**: `useExportPng({ stageRef, awarenessLayerRef, getBaseFilename })` を実装。`exportPng.ts` には `buildExportFilename(now: Date, roomId: string | null)` と `stageToBlob(stage, options)` の純関数を置く。Awareness レイヤを一時的に `hide()` → `toCanvas({ pixelRatio })` → `canvas.toBlob('image/png')` → `triggerDownload(blob, name)` → `show()` の順。
- **IMPLEMENT**:
  ```ts
  // apps/web/src/lib/exportPng.ts
  export const buildExportFilename = (now: Date, roomId: string | null): string => {
    const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return roomId ? `snap-share-${roomId}-${ts}.png` : `snap-share-${ts}.png`;
  };

  export const stageToBlob = async (stage: Konva.Stage, pixelRatio = 2): Promise<Blob> => {
    const canvas = stage.toCanvas({ pixelRatio });
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
        'image/png',
      );
    });
  };

  export const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  ```
  ```ts
  // apps/web/src/hooks/useExportPng.ts
  export const useExportPng = (params: Params) => useCallback(async () => {
    const stage = params.stageRef.current; if (!stage) return;
    const awareness = params.awarenessLayerRef.current;
    awareness?.hide();
    try {
      const blob = await stageToBlob(stage, 2);
      triggerDownload(blob, buildExportFilename(new Date(), params.roomId));
      toast.success('PNG を保存しました');
    } catch (e) {
      logger.warn('export failed', { error: e instanceof Error ? e.message : String(e) });
      toast.error('PNG の保存に失敗しました');
    } finally {
      awareness?.show();
    }
  }, [params.stageRef, params.awarenessLayerRef, params.roomId]);
  ```
- **MIRROR**: ERROR_HANDLING, LOGGING_PATTERN, NAMING_CONVENTION
- **IMPORTS**: `Konva.Stage` 型は `konva/lib/Stage`、`Konva.Layer` は `konva/lib/Layer`
- **GOTCHA**:
  - `stage.toCanvas` は Konva 10 系で同期返却。Image source が `canvas.toBlob` に流れる前にロード済か `useImage` の `image` が ready か確認。Stage が描画されていれば暗黙に同期されている。
  - SVG 入力は Konva が `<Image>` でラスタライズ済なので問題ない。SVG を pixel ratio 2 で書き出すと粗が目立つ可能性あり、ユーザー画像ソースの解像度に応じて `pixelRatio = max(2, naturalWidth/stage.width())` とする。
  - 編集中のテキスト overlay（DOM）は export に乗らない。export ハンドラ冒頭で `setEditingTextId(null)` を呼ぶか、`EditorShell` 側で確認。
- **VALIDATE**: `pnpm -F @snap-share/web test -- src/lib/__tests__/exportPng.test.ts` で `buildExportFilename` の出力が `snap-share-abc123-20260501-153012.png` 形式になることを確認。

### Task 5: Stage / AwarenessLayer に ref を通す
- **ACTION**: `CanvasStage` の `Stage` に `ref` を `forwardRef` で受け、`AwarenessLayer` の `Layer` にも ref を通す。`EditorShell` が `stageRef`、`awarenessLayerRef` を持って `useExportPng` に注入する。
- **IMPLEMENT**:
  - `CanvasStage` の props に `stageRef?: React.Ref<Konva.Stage>` を追加。`<Stage ref={stageRef} ...>`。
  - `AwarenessLayer` を `forwardRef` 化、`<Layer ref={ref} listening={false}>`。
  - `EditorShell` で `useRef<Konva.Stage>(null)` / `useRef<Konva.Layer>(null)` を作り、`awarenessLayer={(ann) => <AwarenessLayer ref={awarenessLayerRef} ... />}` のように渡す。Local モードでは awareness 無しなので ref は null のまま。
- **MIRROR**: ToolButton と CanvasStage の Readonly props ルール
- **IMPORTS**: `import type Konva from 'konva';`（型のみ）。
- **GOTCHA**: `react-konva` 19 では `forwardRef` 相当が React 19 のシグネチャに合うかを確認。`Stage` 自身は `react-konva` の `forwardRef` 経由で ref を受け取れる（公式対応）。`Layer` も同様。
- **VALIDATE**: ref 経由で `stageRef.current?.width()` がブラウザコンソールから取れること。既存 `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` を含めた test 群が継続 pass。

### Task 6: Toolbar に ExportButton を追加
- **ACTION**: `ExportButton.tsx` を作り、`Download` (lucide) アイコン + Tooltip "PNG 保存 (⌘S)"。`Toolbar` props に `onExport: () => void; canExport: boolean` を追加。`onExport` は `EditorShell` が `useExportPng` から提供。
- **IMPLEMENT**: ToolButton と同 API（label / shortcut / disabled / onClick）。`tone` は default。
- **MIRROR**: ToolButton, NAMING_CONVENTION
- **IMPORTS**: `lucide-react` の `Download`
- **GOTCHA**: モバイル `<md` では `disabled`（編集ツール群と一括で）。`canExport = imageLoaded && !isEditingText`.
- **VALIDATE**: 既存 E2E が pass。新 E2E `export.spec.ts` で download イベントを検知（後述）。

### Task 7: useKeyboardShortcuts に onExport を追加
- **ACTION**: `KeyboardShortcuts` 型に `onExport?: () => void` を追加、`mod && key === 's' && !e.shiftKey` で `preventDefault` + `onExport`. `EditorShell` 側でフックに注入。
- **IMPLEMENT**:
  ```ts
  if (mod && key === 's' && !e.shiftKey) {
    e.preventDefault();
    ref.current.onExport?.();
    return;
  }
  ```
- **MIRROR**: useKeyboardShortcuts 既存パターン
- **GOTCHA**: ブラウザ標準 `⌘S`（ページ保存ダイアログ）を握り潰すので、画像未ロード時は `preventDefault` せず通す（`onExport` が undefined のとき）。
- **VALIDATE**: ユニットテストを `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.ts` に追加（既存ファイルが無ければ新規）し、`KeyboardEvent` を dispatch して `onExport` が呼ばれること、入力欄フォーカス中は呼ばれないことを検証。

### Task 8: RoomEditor の `window.confirm` → AlertDialog
- **ACTION**: `ConfirmClearAllDialog` コンポーネントを作り、`open` / `onOpenChange` / `onConfirm` を受ける。`RoomEditor.handleClearImage` を `setConfirmOpen(true)` に変える。
- **IMPLEMENT**:
  ```tsx
  // ConfirmClearAllDialog.tsx
  export const ConfirmClearAllDialog = ({ open, onOpenChange, onConfirm }) => (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ルーム内の注釈をすべて削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>この操作は他の参加者にも反映されます。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>削除する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  ```
  - `RoomEditor` で `const [confirmOpen, setConfirmOpen] = useState(false);` を追加し、`handleClearImage = () => setConfirmOpen(true)`。`onConfirm = () => { store.reset(); setConfirmOpen(false); }`。
- **MIRROR**: NAMING_CONVENTION
- **IMPORTS**: `@/components/ui/alert-dialog`
- **GOTCHA**: `<EditorShell>` の `floatingExtras` ではなく root に置く（Radix Portal で勝手に body 末尾に挿入される）。
- **VALIDATE**: Room モードで「画像をクリア」をクリック → ダイアログ表示 → 「削除する」で reset 実行、「キャンセル」で閉じる。

### Task 9: ヘッダのレスポンシブ + ResizeObserver による Stage 高さ計算
- **ACTION**: `EditorShell` の `<header>` を `flex-wrap` + `items-start` に変更し、`<h1>` と `Toolbar` と `toolbarRight` が 1024px 以下で折り返せるようにする。`TOOLBAR_HEIGHT` 定数撤廃、`useResizeObserver(headerRef)` で実 height を取り、Stage の `top` / `height` をそれに連動させる。`<h1>` は `hidden md:block` で xs では非表示にする（タイトルは `<title>` と OG で取れる）。
- **IMPLEMENT**:
  - `<header ref={headerRef} className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 px-3 py-2">`
  - `useEffect` 内で `ResizeObserver` を使い `setHeaderHeight(entry.contentRect.height)`
  - `<div style={{ top: headerHeight, height: stageHeight - headerHeight }}>`
  - 既存の `useStageSize`（window 全体）はそのまま。`stageHeight = max(stageSize.height - headerHeight, MIN_STAGE_HEIGHT)`
- **MIRROR**: TAILWIND_CSS_VAR_PATTERN
- **GOTCHA**: ResizeObserver で react render を呼ぶときは `requestAnimationFrame` で defer して `ResizeObserver loop completed with undelivered notifications.` を回避。
- **VALIDATE**: ブラウザを 768px / 1024px に縮めてもツールバーが overflow しない、Stage がツールバー直下から始まる。E2E で `await page.setViewportSize({ width: 768, height: 1024 })` を 1 件追加。

### Task 10: LocalEditor のパスワード UI を shadcn 化
- **ACTION**: 既存の素 `<input>` / `<label>` を `Checkbox`, `Label`, `Input` に置換。`blockedByEmptyPassword` のメッセージを `Input` の `aria-invalid` + `aria-describedby` で表現。
- **IMPLEMENT**:
  ```tsx
  import { Checkbox } from '@/components/ui/checkbox';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  // ...
  <div className="...">
    <div className="flex items-center gap-2">
      <Checkbox id={checkboxId} checked={protect} onCheckedChange={...} />
      <Label htmlFor={checkboxId}>パスワードで保護する（任意）</Label>
    </div>
    {protect && (
      <Input id={passwordId} type="password" value={password} onChange={...}
        aria-invalid={blockedByEmptyPassword || undefined} ... />
    )}
  </div>
  ```
- **MIRROR**: Existing LocalEditor markup, NAMING_CONVENTION
- **GOTCHA**: shadcn の `Checkbox` は Radix を使い、`onCheckedChange(checked: boolean | 'indeterminate')` を返す。boolean に絞って受ける。
- **VALIDATE**: `pnpm -F @snap-share/web test` で既存テストが pass。手動: パスワードオプトイン → 空 → 入力欄が rose 系の border で警告される。

### Task 11: RoomGate を shadcn 化
- **ACTION**: 既存 form を `Input` / `Label` / `Button` に置換。`Button` の `variant="default"`、`disabled` 時の opacity は shadcn のデフォルトを利用。
- **IMPLEMENT**: 既存の class を捨てて shadcn のものに乗せ替え、`autoFocus` / `aria-invalid` / `aria-describedby` は維持。
- **MIRROR**: 既存 RoomGate ロジック（state machine 部分は触らない）
- **GOTCHA**: 既存テスト `apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx` は label / role ベースで書かれているはず。`Input`/`Button` の DOM が変わると壊れる場合は最小修正。
- **VALIDATE**: RoomGate テスト 5 件が pass。

### Task 12: CopyUrlButton に Sonner toast
- **ACTION**: `setCopied` の代わりに `toast.success('URL をコピーしました')` を呼ぶ。一定時間で自動で消えるので `timerRef` ロジックは削除可能。ただしボタン内アイコンの `Check ↔ Copy` トグルは UX として残し、1.8 秒後に元に戻す。
- **IMPLEMENT**:
  ```tsx
  await navigator.clipboard.writeText(window.location.href);
  setCopied(true);
  toast.success('URL をコピーしました');
  setTimeout(() => setCopied(false), FEEDBACK_MS);
  ```
- **MIRROR**: CopyUrlButton 既存
- **GOTCHA**: `setTimeout` は ref 管理を残す（unmount 時 setState 防止）。toast 自体は umnount 後でも問題ない。
- **VALIDATE**: 手動で URL コピー → toast 表示 / アイコン切替。

### Task 13: index.html / favicon / OGP
- **ACTION**: `<title>` を「snap-share — 画像URL一発で共同注釈」に、description / og:* / theme-color を追加。`apps/web/public/favicon.svg` を作る（24x24 で十分）。`og-image.png` を 1200x630 で用意（手描き or Figma 不要のシンプル図）。
- **IMPLEMENT**:
  ```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta name="theme-color" content="#5b6dff" />
    <title>snap-share — 画像URL一発で共同注釈</title>
    <meta name="description" content="画像にハイライト・吹き出し・矢印・テキストをオーバーレイし、URL一発で共同編集できる、日本語ファーストの軽量Webアプリ。" />
    <meta property="og:title" content="snap-share — 画像URL一発で共同注釈" />
    <meta property="og:description" content="..." />
    <meta property="og:image" content="/og-image.png" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  ```
- **MIRROR**: 該当なし（HTML）
- **GOTCHA**: `og:url` は本番ドメインが Phase 7 で決まるため空欄か `__OG_URL__` プレースホルダで残し、Phase 7 で wrangler env から差し込む方針をコメントで残す。
- **VALIDATE**: `pnpm -F @snap-share/web build` で dist にコピーされる、Lighthouse SEO スコアが 90+。

### Task 14: tokens.css と shadcn variable のブリッジ
- **ACTION**: shadcn が要求する `--background` / `--foreground` / `--card` / `--card-foreground` / `--primary` / `--primary-foreground` / `--secondary` / `--muted` / `--muted-foreground` / `--accent` / `--accent-foreground` / `--destructive` / `--destructive-foreground` / `--border` / `--input` / `--ring` を `tokens.css` 内で既存トークンと結ぶ。
- **IMPLEMENT**:
  ```css
  :root {
    /* 既存トークン … */
    --background: var(--color-surface);
    --foreground: var(--color-text);
    --card: var(--color-surface);
    --card-foreground: var(--color-text);
    --primary: var(--color-accent);
    --primary-foreground: oklch(98% 0 0);
    --secondary: oklch(94% 0 0);
    --secondary-foreground: var(--color-text);
    --muted: oklch(94% 0 0);
    --muted-foreground: oklch(50% 0 0);
    --accent: var(--color-accent);
    --accent-foreground: oklch(98% 0 0);
    --destructive: oklch(54% 0.22 27);
    --destructive-foreground: oklch(98% 0 0);
    --border: var(--color-toolbar-border);
    --input: var(--color-toolbar-border);
    --ring: var(--color-accent);
    --radius: 0.625rem;
  }
  ```
- **MIRROR**: tokens.css 既存スタイル
- **GOTCHA**: `colors.ts` の Konva 用 hex とは別系統。shadcn の variable はあくまで Tailwind クラスから読まれるだけなので、Konva ハードコード hex は今のまま維持。
- **VALIDATE**: shadcn コンポーネントが既存背景 (`--color-surface`) と乖離しないことを目視確認。

### Task 15: テスト追加
- **ACTION**:
  1. `apps/web/src/lib/__tests__/exportPng.test.ts`（vitest, happy-dom）
     - `buildExportFilename(new Date(2026, 4, 1, 15, 30, 12), 'abc123')` → `'snap-share-abc123-20260501-153012.png'`
     - `buildExportFilename(..., null)` → `'snap-share-20260501-153012.png'`
     - `triggerDownload` は `<a>` を生成してクリックしたあと `URL.revokeObjectURL` を呼ぶことを mock で確認
  2. `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.ts`
     - `⌘S` で `onExport` が呼ばれる
     - input にフォーカス中は `onExport` が呼ばれない
     - 既存の `r` / `v` / `Delete` / `⌘Z` の挙動を回帰テスト
  3. `apps/web/e2e/landing.spec.ts` 更新: 「PNG 保存」ボタンが存在し、画像未ロード時は disabled
  4. `apps/web/e2e/export.spec.ts` 新規:
     - test の skip が解けるパターン: 画像 D&D は wrangler 起動が必要なので skip 維持。代わりに `page.route('/rooms', (r) => r.fulfill({ status: 201, body: ... }))` でモックし、PNG ボタン押下 → `page.waitForEvent('download')` → ファイル名が `snap-share-*.png` で終わることを assert
- **MIRROR**: TEST_STRUCTURE_HOOK
- **GOTCHA**: happy-dom は `URL.createObjectURL` / `<canvas>.toBlob` が full-fidelity でない。`toBlob` のテストは vitest 上では `stage.toCanvas` を mock して `Blob` を返すスタブで行う。
- **VALIDATE**: `pnpm -F @snap-share/web test` / `pnpm -F @snap-share/web test:e2e` 緑。

### Task 16: PRD ステータス + plans/completed への移動準備
- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` の Phase 6 行を `pending` → `in-progress` に、`PRP Plan` 列を本ファイルの相対リンクに更新。
- **IMPLEMENT**: 188行付近の Phase 6 行を編集。
- **MIRROR**: 既存の Phase 5 行の更新方法と同じ（`[phase-5-...](../plans/completed/...)` 形式は実装完了時。in-progress の間は `../plans/phase-6-export-ui-polish.plan.md`）。
- **VALIDATE**: PRD 表が正しくレンダリングされる。

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `buildExportFilename` with roomId | Date(2026-05-01 15:30:12), `'abc123'` | `'snap-share-abc123-20260501-153012.png'` | No |
| `buildExportFilename` without roomId | Date(2026-05-01 15:30:12), `null` | `'snap-share-20260501-153012.png'` | No |
| `buildExportFilename` 1月1日 0時0分 | Date(2026-01-01 00:00:00), `'a'` | `'snap-share-a-20260101-000000.png'` | Yes (zero pad) |
| `triggerDownload` | mock Blob | `<a>` クリック後 `URL.revokeObjectURL` 呼ばれる | Yes (cleanup) |
| `useKeyboardShortcuts` ⌘S | window keydown | `onExport` 呼ばれる、`preventDefault` される | No |
| `useKeyboardShortcuts` ⌘S in input | input focus + keydown | `onExport` 呼ばれない | Yes |
| `Toolbar` Tooltip | hover button | tooltip に label + shortcut が出る | No |
| `RoomGate` shadcn 移行 | 既存 5 ケース | 緑のまま | No |

### Edge Cases Checklist

- [x] 画像未ロード時に `⌘S` を押しても export が走らない
- [x] テキスト編集中（IME 入力含む）に `⌘S` で export しても、編集中文字が消失しない（事前に `setEditingTextId(null)` を呼ぶ）
- [x] Awareness レイヤを export 中に hide → 例外発生しても finally で show に戻す
- [x] 768px / 1024px / 1440px / 1920px でツールバーが折り返せる
- [x] AlertDialog 「キャンセル」で reset が走らない
- [x] AlertDialog Esc キーで閉じる
- [x] `URL.createObjectURL` の cleanup（download blob）

---

## Validation Commands

### Static Analysis
```sh
pnpm typecheck
```
EXPECT: 0 errors across all 4 workspaces

### Unit Tests
```sh
pnpm -F @snap-share/web test
pnpm -F @snap-share/shared test
pnpm -F @snap-share/api test
```
EXPECT: 既存 247 件 + 新規（lib/exportPng 4, hooks/useKeyboardShortcuts 6, RoomGate 回帰 5, Toolbar 1）= 全件 pass

### Lint
```sh
pnpm lint
```
EXPECT: biome ci 0 error。生成された shadcn ファイルが既存 biome ルール（single quotes / trailing commas / semicolons）と整合するか確認、必要なら `apps/web/src/components/ui/**` を `biome.json` の overrides に追加する選択肢もあるが、原則一致するはず。

### Build
```sh
pnpm -F @snap-share/web build
```
EXPECT:
- vite build 成功
- gzip サイズ < 280 KB（PRD 「App page < 300kb gzipped」予算内）。shadcn + radix で +30 KB 程度の増加見込み。閾値超えたら `dynamic import` で AlertDialog / Tooltip を分割

### Browser Validation
```sh
pnpm dev
# 別ターミナル
pnpm -F @snap-share/api dev
```
EXPECT:
- ローカル D&D → ルーム作成 → 注釈を 4 種追加 → ⌘S で `snap-share-{roomId}-YYYYMMDD-HHMMSS.png` ダウンロード、注釈が全て焼き込まれている、awareness カーソルは入っていない
- 同じウィンドウを 768px に縮めてヘッダが 2 段に折り返し、Stage が重ならない
- 画像クリア（Room モード）で AlertDialog が出る
- URL コピー → 右下 toast「URL をコピーしました」
- パスワード保護を有効化 → アップロード → 別タブで RoomGate に shadcn `Input` が見える

### E2E
```sh
pnpm -F @snap-share/web test:e2e
```
EXPECT: 既存 4 件 + 新規 2 件（タブレット viewport + export download）が pass

### Manual Validation
- [ ] Lighthouse Mobile スコア（Performance / Accessibility / Best Practices / SEO）90+
- [ ] OG カードを Slack `og:image` プレビューで表示確認（Phase 7 公開前の最終チェックは Phase 7 で）
- [ ] Safari iPad（タブレット閲覧）で URL を開いてレイアウト崩れがないこと（実機 or DevTools エミュレーション）
- [ ] スクリーンリーダー（VoiceOver）で「PNG 保存」ボタンに到達できる

---

## Acceptance Criteria

- [ ] PNG エクスポートで全注釈（4 種）が焼き込まれ、awareness カーソルが映らない
- [ ] `⌘S` で同じ動作（ブラウザ標準ダイアログを抑止）
- [ ] shadcn `Button` / `Input` / `Label` / `Checkbox` / `Tooltip` / `Sonner` / `AlertDialog` が `apps/web/src/components/ui/` に存在し、既存 UI から参照されている
- [ ] 768px viewport でヘッダが折り返し、Stage が重ならない
- [ ] `<title>` / description / OG / favicon が日本語ファーストで揃う
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm -F @snap-share/web test:e2e` / `pnpm -F @snap-share/web build` がすべて緑
- [ ] PRD Phase 6 の status が `in-progress`、本ファイルが `PRP Plan` 列に紐付く

## Completion Checklist

- [ ] Discovered patterns（`Readonly<{}>` props / cn() / logger.warn / `bg-(--color-*)`) を踏襲
- [ ] エラーは `unknown` で受けて `instanceof Error` で narrow
- [ ] `console.*` の直書きが増えていない
- [ ] テストが AAA 構造で日本語の `it` 説明を持つ
- [ ] ハードコード文字列はエクスポート文言・toast 文言・OG description のみ（i18n は Phase 7+ で外出し）
- [ ] バンドルサイズ予算内
- [ ] PRD 表更新済

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| shadcn CLI が `style: "base-nova"` + Tailwind v4 + React 19 の組合せで生成失敗 | M | H | 失敗したら `style: "default"` に一時的に切替、生成後に手で `cn` パスを直す。Phase 0 spike `shadcn-vite` がローカルに残っているので参考可能 |
| `react-konva` 19 で `Stage` の `forwardRef` シグネチャが変わって ref が取れない | L | H | `react-konva` 19 公式は forwardRef 対応済。万一壊れていれば `<Stage onMount={(s) => stageRef.current = s}>` で逃げる（react-konva 公式のフォールバックパターン） |
| バンドルサイズが 300KB gzipped を超える | M | M | shadcn の `AlertDialog` / `Tooltip` を `lazy(() => import(...))` で動的取得、Konva の chunk 分離は既に Phase 0 決定済 |
| `e2e/export.spec.ts` の `page.waitForEvent('download')` が happy-dom 互換性で flaky | L | M | Playwright は browser 駆動なので happy-dom 非依存。retry 2 を設定済 |
| Awareness レイヤ hide → show の間に他参加者の cursor 更新が発火し、export 後に古い cursor が一瞬見える | L | L | `Layer.hide()` は draw を止めるだけで内部 state はそのまま。`show()` で次フレームに反映される。視認上はほぼ問題なし |
| shadcn の global styles と既存 `tokens.css` が競合し色が壊れる | M | M | Task 14 で先に variable bridging を入れる。生成後に DropZone / ConnectionBadge / Toolbar の見た目を目視回帰 |

## Notes

- Phase 5 で `247` テスト緑、`vite build` 702 KB / gzip 214 KB。Phase 6 で gzip 240–270 KB を目標。
- shadcn `style: "base-nova"` は 2025-2026 系のニュートラルベース。色調が既存 `oklch(98% 0 0)` 系と相性が良い想定。生成結果が想定と異なる場合は本タスク Task 14 で吸収する。
- 「トップページ」は MVP では editor 直で兼ねる（PRD User Flow 通り）。Phase 7 で公開準備の段階で追加 LP を切り出すかは Phase 7 の plan で再評価する。
- 英語フォールバック（Should）は本 phase ではスコープ外。日本語のみで Phase 7 → Phase 8 の dogfood に入る。
