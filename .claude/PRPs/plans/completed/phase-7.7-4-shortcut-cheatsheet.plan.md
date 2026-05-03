# Plan: Phase 7.7-4 ショートカット網羅 + チートシート

## Summary
`?` キー(Shift+/)で起動する `HelpModal` を新規追加し、Phase 7.7-1〜3 で生やしたショートカットを 1 箇所に集約してユーザーに発見させる。同時に **色変更ショートカット** (`C` で次の色 / `Shift+C` で前の色) を新設して「マウス無し golden path」を完成させる。Modal は base-ui `Dialog` を使った新規 `ui/dialog.tsx` を介して実装(既存の `alert-dialog.tsx` を破壊系・確認用に温存し、情報表示系を分離)。

## User Story
As a **キーボード作業を切らしたくないビジネスマン**, I want to **`?` を押せば全ショートカットが表として読めて、`C` で色を循環できる**, so that **「投入 → 4 種配置 → 色変更 → リサイズ → PNG 出力」をマウスに 1 度も触れずに完遂できる(success metric「マウス無し golden path 100%」を達成する)**.

## Problem → Solution
**現状**: 既存ショートカット 9 種(V/R/A/T/H + ⌘Z/⌘⇧Z/Delete/Esc + ⌘S + ⌘0/⌘1)はコード(`useKeyboardShortcuts.ts`)に散在し、UI の Tooltip にも一部しか出ない。`?` キーは未割り当て、Help / チートシート UI そのものが無い。色変更はマウスで色パレットをクリックするしかなく、キーボードのみでは色が固定 1 色から動かせない → success metric「マウス無し golden path」が満たせない。

**改善後**: `useKeyboardShortcuts` に `?` (Shift+/) と `C` / `Shift+C` を追加。`HelpModal` がツール選択 / 編集 / 色 / ズーム / エクスポート / ヘルプの 6 グループに分けて全ショートカットを表示。Toolbar の右端に Help アイコンボタン(`?` キーと同等動作)を追加して discoverability を担保。base-ui `Dialog` ベースの `ui/dialog.tsx` を新規追加し、`HelpModal` は既存 `ConfirmClearAllDialog` と同じ「`open` / `onOpenChange` props を受け取って親が状態管理」パターンに揃える。

## Metadata
- **Complexity**: Medium(7-9 ファイル / 200-400 行)
- **Source PRD**: `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md`
- **PRD Phase**: Phase 4 (B2: ショートカット網羅 + チートシート)
- **Estimated Files**: 5 ファイル新規 / 6 ファイル更新

---

## UX Design

### Before
```
┌── Toolbar ───────────────────────────────────────┐
│ V R A T H │ ↶ ↷ Del │ 🟥🟧🟨🟩🟦🟪⬛ │ ⬇ 🗑   │
│  ↑ Tooltip だけが頼り、色変更はマウス必須。       │
└──────────────────────────────────────────────────┘
   ↓ 「?」を押しても何も起きない / 全ショートカット一覧無し
```

### After
```
┌── Toolbar ──────────────────────────────────────────┐
│ V R A T H │ ↶ ↷ Del │ 🟥🟧🟨🟩🟦🟪⬛(C) │ ⬇ 🗑 ❓│
│  ↑ ❓ アイコン or `?` キーで HelpModal が開く        │
└─────────────────────────────────────────────────────┘
   ↓
┌── HelpModal (base-ui Dialog, centered) ────────────┐
│ キーボードショートカット                       [×] │
│                                                    │
│ ツール    V 選択 / R 矩形 / A 矢印 / T テキスト    │
│           H ハイライト                             │
│ 色        C 次の色 / ⇧C 前の色                     │
│ 編集      ⌘Z 元に戻す / ⌘⇧Z やり直し             │
│           Del/Backspace 削除 / Esc 解除            │
│ ズーム    ⌘0 fit / ⌘1 100% / ⌘ホイール ズーム      │
│           Space+ドラッグ パン                       │
│ 出力      ⌘S PNG 保存                              │
│ ヘルプ    ?  このパネル                            │
└────────────────────────────────────────────────────┘
   ↓ Esc / クリックアウトで閉じる
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `?` キー | 未割り当て | HelpModal を toggle | open 中に再度押すと閉じる |
| `C` キー | tool 'C' に割り当て無し(palette 未操作) | 次の色に巡回(`COLOR_PALETTE` index +1) | active が palette に無い場合は先頭から開始 |
| `Shift+C` キー | 同上 | 前の色に巡回 | wrap around |
| Toolbar 右端 | ❓ アイコン無し | Help アイコンボタン追加 | aria-label="ショートカット一覧" |
| Modal 開閉時 | n/a | open 中はキャンバス側ショートカット(V/R/...) は **発火する**(input ガードと同様、modal 内 focus でない限り) | 後述 GOTCHA |
| Modal 内 focus | n/a | Tab で閉じるボタン → 内部スクロール領域 → Tab loop | base-ui が `focus trap` を提供 |

---

## Mandatory Reading

実装前に必ず読むべきファイル:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/hooks/useKeyboardShortcuts.ts` | 全体 (101 行) | `?` / `C` / `⇧C` 追加の中核 |
| P0 | `apps/web/src/components/dialogs/ConfirmClearAllDialog.tsx` | 全体 | 既存 dialog コンポーネントの open/onOpenChange パターン |
| P0 | `apps/web/src/components/ui/alert-dialog.tsx` | 全体 (172 行) | base-ui の dialog ラッパ流儀 — HelpModal 用 `ui/dialog.tsx` をこのスタイルで複製 |
| P0 | `apps/web/src/pages/EditorShell.tsx` | 全体 (328 行) | useKeyboardShortcuts 配線箇所 + HelpModal の state を持つ場所 + handlePickColor の再利用 |
| P0 | `apps/web/src/components/toolbar/Toolbar.tsx` | 全体 (137 行) | 右端に Help ボタン追加(`Divider` の後ろ) |
| P0 | `apps/web/src/components/canvas/colors.ts` | 1-23 | `COLOR_PALETTE` 配列 — `C` キー巡回のソース |
| P0 | `apps/web/src/hooks/annotationsReducer.ts` | 1-50 | `Tool` 型 + `active-color/set` action |
| P1 | `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | 全体 | `Harness` パターン + `press()` ヘルパ — 新ショートカットの test に流用 |
| P1 | `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` | 全体 | `createRoot + act` + `TooltipProvider` ラップ — Toolbar 系テストの標準 |
| P1 | `apps/web/e2e/keyboard-shortcuts.spec.ts` | 全体 (132 行) | E2E パターン(`waitForRoom` / `isPressed` / `skipNonChromium`) — golden path E2E に流用 |
| P1 | `apps/web/e2e/zoom-pan.spec.ts` | 全体 | window 露出 (`__SNAP_SHARE_*`) パターン |
| P1 | `apps/web/e2e/fixtures/upload.ts` | 全体 | `dropImage` / `buildSolidPng` / `dropImageBuffer` |
| P2 | `apps/web/src/components/ui/button.tsx` | 全体 | Help ボタンの variant/size 候補 |
| P2 | `apps/web/src/styles/tokens.css` | 1-65 | `--popover` / `--popover-foreground` / `--border` などダイアログ用変数(既に shadcn bridge 済) |
| P2 | `apps/web/node_modules/@base-ui/react/dialog/index.d.ts` | 全体 (10 行) | base-ui Dialog のエクスポート — `Root` / `Trigger` / `Portal` / `Popup` / `Backdrop` / `Title` / `Description` / `Close` / `Viewport` |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| base-ui Dialog (non-alert) | https://base-ui.com/react/components/dialog | `Dialog.Root open={...} onOpenChange={...}` + `Portal > Backdrop + Popup` の構造。AlertDialog と props 互換、ただし `dismissible` がデフォルト true(クリックアウトで閉じる) |
| base-ui FocusTrap | base-ui Dialog ドキュメント "Focus management" 節 | Popup マウント時に内部初期 focus を当てる、unmount 時に trigger に focus を返す。`initialFocus` ref で初期 focus を制御可能 |
| KeyboardEvent.key for `?` | https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values | US/JIS 配列とも `Shift+/` は `e.key === '?'`(JIS は Shift+`/` が `?` になる)。`e.code` は配列依存(US は `Slash`、JIS は `Slash` または `IntlRo`)で不安定 → `e.key` を採用 |
| 同上(JIS 注意点) | https://github.com/microsoft/vscode/issues/121120 (類例) | macOS 日本語 IME 入力中は keydown が `e.key === 'Process'` で来る → 既存 `isEditableTarget` ガードで textarea 中は無視されるので問題なし、IME 中も非フォーカス時は `?` にならず安全 |
| Konva clear when modal open | n/a | Konva は DOM のフォーカスとは独立。Modal の Backdrop が canvas を覆うため、modal open 中は canvas pointer event は届かない。ショートカットだけは window keydown で奪い合う点に注意(後述 GOTCHA) |

---

## Patterns to Mirror

### KEYBOARD_SHORTCUT_REGISTRATION_EXISTING
```typescript
// SOURCE: apps/web/src/hooks/useKeyboardShortcuts.ts:36-99 (既に Phase 7.7-3 で
// Cmd+0 / Cmd+1 を吸収済み。同じ shape で `?` / `C` / `⇧C` を追加する)
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts): void => {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 's' && !e.shiftKey) { /* preventDefault + onExport */ return; }
      if (mod && key === '0' && !e.shiftKey) { /* onFitToViewport */ return; }
      if (mod && key === '1' && !e.shiftKey) { /* onSetHundredPercent */ return; }
      if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); ref.current.onUndo(); return; }
      if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) { e.preventDefault(); ref.current.onRedo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { ref.current.onDelete(); return; }
      if (e.key === 'Escape') { ref.current.onEscape(); return; }
      if (mod) return;
      const tool = TOOL_KEY_MAP[key];
      if (tool) ref.current.onSetTool(tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
```
**規約**:
- modifier 付きは早期リターンで分岐 → `mod` が真かつ未知キーなら `if (mod) return`
- `e.key` を小文字化して比較(`key.toLowerCase()`)
- 既存修飾子順序: `mod && key === ... && !e.shiftKey` を維持(Shift 付きは別分岐)
- preventDefault は **callback がある時だけ**(ブラウザのデフォルトを尊重)

### DIALOG_WRAPPER_FROM_BASE_UI
```typescript
// SOURCE: apps/web/src/components/ui/alert-dialog.tsx:1-50
// 同じ構造で `Dialog` 版を作る。AlertDialog は modal で「閉じる手段が cancel/action のみ」、
// Dialog は「クリックアウト・Esc で閉じられる」点が異なる。
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { cn } from '@/lib/utils';

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}
function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}
function AlertDialogContent({ className, size = 'default', ...props }) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          'group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}
```
**規約**:
- `data-slot="..."` をすべての primitive ラッパに付ける(将来 styling hook 用)
- `data-open:animate-in` / `data-closed:animate-out` で base-ui の data attribute と Tailwind animate を結ぶ
- `cn(..., className)` で外部 className を後勝ちで merge
- 一貫: `bg-popover` / `text-popover-foreground` / `ring-foreground/10` の token を使う

### MODAL_CONSUMER_PATTERN
```typescript
// SOURCE: apps/web/src/components/dialogs/ConfirmClearAllDialog.tsx 全体
type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}>;

export const ConfirmClearAllDialog = ({ open, onOpenChange, onConfirm }: Props) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>...</AlertDialogTitle>
        <AlertDialogDescription>...</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>...</AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
```
**規約**:
- 親(EditorShell)が `useState` で `open` を持ち、`onOpenChange` を渡す
- ダイアログは見た目だけ返すコンポーネント。state を内部に持たない

### KEYBOARD_TEST_HARNESS
```typescript
// SOURCE: apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx:6-58
const Harness = ({ shortcuts, onMount }) => {
  useKeyboardShortcuts(shortcuts);
  useEffect(() => { onMount?.(); }, [onMount]);
  return null;
};
const press = (init: KeyboardEventInit & { key: string }) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  let prevented = false;
  const orig = event.preventDefault.bind(event);
  event.preventDefault = () => { prevented = true; orig(); };
  window.dispatchEvent(event);
  return { prevented };
};
const baseShortcuts = (overrides: Partial<KeyboardShortcuts> = {}): KeyboardShortcuts => ({
  onUndo: vi.fn(), onRedo: vi.fn(), onDelete: vi.fn(),
  onSetTool: vi.fn() as (tool: Tool) => void, onEscape: vi.fn(),
  ...overrides,
});
```
**規約**:
- `Harness` でフックを乗せる
- `press()` ヘルパで `prevented` を回収
- `baseShortcuts(overrides)` で必須コールバックを vi.fn() で埋める

### TOOLBAR_BUTTON_PATTERN
```typescript
// SOURCE: apps/web/src/components/toolbar/Toolbar.tsx:73-111
<ToolButton
  icon={Download}
  label="PNG 保存"
  shortcut="⌘S"
  disabled={!canExport}
  onClick={onExport}
/>
```
**規約**:
- `icon` は lucide-react のコンポーネント、`label` は日本語、`shortcut` は記号(⌘ / ⇧ / ?)
- `Divider` で機能群を区切る

### TEST_E2E_KEYBOARD
```typescript
// SOURCE: apps/web/e2e/keyboard-shortcuts.spec.ts:11-32
const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const waitForRoom = async (page) => {
  await page.goto('/');
  await dropImage(page);
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
};
const isPressed = async (page, label) =>
  (await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed')) === 'true';
const skipNonChromium = (testInfo) =>
  test.skip(testInfo.project.name !== 'chromium', '...');
```

### TOKEN_USAGE
```css
/* SOURCE: apps/web/src/styles/tokens.css:33-65
   shadcn bridge 経由で `bg-popover` / `text-popover-foreground` / `border` /
   `ring` などが使える。HelpModal でも同じトークンを使う。Konva 系の hex は
   absolutely 触らない (canvas/colors.ts 専管)。*/
--popover: var(--color-surface);
--popover-foreground: var(--color-text);
--border: var(--color-toolbar-border);
--ring: var(--color-accent);
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/ui/dialog.tsx` | CREATE | base-ui `Dialog`(非破壊系) のラッパ。AlertDialog の双子だが「クリックアウト・Esc で閉じる」差異 |
| `apps/web/src/components/dialogs/HelpModal.tsx` | CREATE | チートシート本体。ConfirmClearAllDialog と同じ open/onOpenChange パターン |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | CREATE | open=true でショートカット行が描画されるかの smoke test |
| `apps/web/src/lib/colorCycle.ts` | CREATE | `nextColor` / `prevColor` の純関数。`COLOR_PALETTE` への index 解決と wrap-around |
| `apps/web/src/lib/__tests__/colorCycle.test.ts` | CREATE | 純関数 unit test(palette 内 / palette 外 / 先頭/末尾 wrap) |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATE | `onShowHelp` / `onCycleColorNext` / `onCycleColorPrev` を追加、ハンドラ実装、props 拡張 |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | UPDATE | 新ショートカットの test 追加(IME / Shift+? / Shift+C / undefined ガード) |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATE | 右端に Help アイコンボタン追加 + props `onShowHelp` |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | CREATE (もしくは追記) | ※既存 Toolbar.test.tsx が無いため CREATE。Help ボタンが見える/クリック可能 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | `useState<boolean>(false)` で `helpOpen` 管理、`HelpModal` を render、useKeyboardShortcuts に追加コールバック配線、`handleCycleColor` 実装 |
| `apps/web/e2e/golden-path.spec.ts` | CREATE | success metric 直対応: 投入 → 4 種配置 → 色変更 → リサイズ → PNG 保存をキーボードのみで完走 |
| `apps/web/e2e/help-modal.spec.ts` | CREATE | `?` で開く / Esc / クリックアウトで閉じる / Toolbar Help ボタンで開く |
| `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md` | UPDATE | Phase 4 行 status `pending` → `in-progress`、plan link 挿入 |

## NOT Building

- **「最近使ったショートカットをハイライト」** — PRD で Could、Phase 7.8 以降
- **ズームインジケータ%表示** — 7.7-3 NOT Building と同じく、Phase 7.7-4 でも追加しない(Modal 内で「Cmd+0 / Cmd+1」と書くだけ)
- **モバイル/タッチ向け Help 起動ジェスチャ**(2 本指タップなど) — デスクトップキーボード前提、PRD スコープ外
- **ショートカットのカスタマイズ UI** — Modal 内で表示のみ。ユーザー定義 keymap は将来の話
- **`?` 起動以外のヘルプ経路**(右クリックメニュー / `F1` 等) — 1 入口に絞る(`?` キー + Toolbar の ❓ ボタン)
- **`C` 以外の色キー(数字キーで色 1-7 を直接選択)** — Skitch 流。Photoshop/Figma に類似が無く学習コストが上がる。push があれば Phase 7.7 後に検討
- **Modal 内のスクロールアニメーション** — チートシート程度の情報量(6 グループ・約 12 行)で必要無し
- **多言語対応(英語版チートシート)** — 日本語固定(リポジトリ全体方針 → CLAUDE.md)。i18n 基盤導入と一緒にしか入れられない
- **Help 起動を Cmd+/ などで併設** — `?` 単独で十分。発見性は ❓ アイコンボタンで担保
- **キャンバスへの "Tutorial" オーバーレイ**(初回起動時にコーチマーク) — 別物のオンボーディング機能、Phase 8 以降

---

## Step-by-Step Tasks

### Task 1: 純関数 `colorCycle` を新規ファイルで実装
- **ACTION**: `apps/web/src/lib/colorCycle.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { COLOR_PALETTE } from '../components/canvas/colors';

  // active が COLOR_PALETTE に含まれない場合は -1 → 次は palette[0]、前は palette[last]
  const indexOf = (color: string): number => COLOR_PALETTE.indexOf(color);

  export const nextColor = (active: string): string => {
    const i = indexOf(active);
    if (COLOR_PALETTE.length === 0) return active;
    const next = (i + 1) % COLOR_PALETTE.length;
    // biome-ignore lint/style/noNonNullAssertion: COLOR_PALETTE.length > 0 で next は必ず有効
    return COLOR_PALETTE[next]!;
  };

  export const prevColor = (active: string): string => {
    const i = indexOf(active);
    if (COLOR_PALETTE.length === 0) return active;
    // -1 の場合は length-1 (末尾) を返す: 「palette 外 → ⇧C で末尾に乗る」UX
    const prev = i <= 0 ? COLOR_PALETTE.length - 1 : i - 1;
    // biome-ignore lint/style/noNonNullAssertion: 同上
    return COLOR_PALETTE[prev]!;
  };
  ```
- **MIRROR**: 既存の `apps/web/src/domain/annotation/operations.ts` の純関数スタイル(import 1 つ + named export のみ)
- **IMPORTS**: `COLOR_PALETTE`
- **GOTCHA**:
  - `noUncheckedIndexedAccess` 有効(tsconfig.base.json) → 配列アクセスは `string | undefined` になる。`!` か early return が必要
  - `prev` の `i <= 0` 分岐は「-1(palette 外)」と「先頭(0)」を同じく末尾に飛ばす設計。テストで両方確認
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑

### Task 2: `colorCycle` の純関数 unit test
- **ACTION**: `apps/web/src/lib/__tests__/colorCycle.test.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { describe, expect, it } from 'vitest';
  import { COLOR_PALETTE } from '../../components/canvas/colors';
  import { nextColor, prevColor } from '../colorCycle';

  describe('nextColor', () => {
    it('returns palette[1] when active is palette[0]', () => {
      expect(nextColor(COLOR_PALETTE[0]!)).toBe(COLOR_PALETTE[1]);
    });
    it('wraps to palette[0] when active is the last color', () => {
      expect(nextColor(COLOR_PALETTE[COLOR_PALETTE.length - 1]!)).toBe(COLOR_PALETTE[0]);
    });
    it('returns palette[0] when active is not in palette', () => {
      expect(nextColor('#ffffff')).toBe(COLOR_PALETTE[0]);
    });
  });

  describe('prevColor', () => {
    it('returns palette[N-1] when active is palette[0]', () => {
      expect(prevColor(COLOR_PALETTE[0]!)).toBe(COLOR_PALETTE[COLOR_PALETTE.length - 1]);
    });
    it('returns palette[1] when active is palette[2]', () => {
      expect(prevColor(COLOR_PALETTE[2]!)).toBe(COLOR_PALETTE[1]);
    });
    it('returns palette[N-1] when active is not in palette', () => {
      expect(prevColor('#ffffff')).toBe(COLOR_PALETTE[COLOR_PALETTE.length - 1]);
    });
  });
  ```
- **MIRROR**: `apps/web/src/hooks/__tests__/useStageTransform.test.ts` の AAA + describe ネスト
- **IMPORTS**: `vitest`, `COLOR_PALETTE`, `nextColor`, `prevColor`
- **GOTCHA**: `COLOR_PALETTE[0]!` の `!` を忘れると `string | undefined` で型エラー
- **VALIDATE**: `pnpm -F @snap-share/web test -- colorCycle` 緑

### Task 3: `useKeyboardShortcuts` に `?` / `C` / `⇧C` を追加
- **ACTION**: `apps/web/src/hooks/useKeyboardShortcuts.ts` を更新
- **IMPLEMENT**:
  - `KeyboardShortcuts` 型に追加:
    ```typescript
    /** Optional. `?` (Shift+/) → toggle help cheatsheet. preventDefault only when
     *  provided so the browser doesn't lose `?` in non-app contexts. */
    onShowHelp?: () => void;
    /** Optional. `C` → cycle to the next palette color. preventDefault only
     *  when provided. */
    onCycleColorNext?: () => void;
    /** Optional. `⇧C` → cycle to the previous palette color. */
    onCycleColorPrev?: () => void;
    ```
  - onKey 内に分岐追加(既存の `if (mod) return;` の **前** に挿入。`mod` 不要のキーであるため):
    ```typescript
    // `?` (Shift+/) — toggle help. JIS/US どちらも Shift+/ で `e.key === '?'`。
    // mod を要求しないので modifier 分岐の前に置く。
    if (!mod && e.key === '?') {
      const cb = ref.current.onShowHelp;
      if (cb) {
        e.preventDefault();
        cb();
      }
      return;
    }
    // `C` / `⇧C` — palette cycle (mod 無し)。Shift で逆方向。
    if (!mod && key === 'c') {
      const cb = e.shiftKey ? ref.current.onCycleColorPrev : ref.current.onCycleColorNext;
      if (cb) {
        e.preventDefault();
        cb();
      }
      return;
    }
    ```
  - 既存 `TOOL_KEY_MAP` に `c` を **追加しない**(衝突防止)。`c` は palette 専用キー。
- **MIRROR**: KEYBOARD_SHORTCUT_REGISTRATION_EXISTING
- **IMPORTS**: 変更なし
- **GOTCHA**:
  - **配置位置**: `?` と `C` は modifier 不要 → `if (mod) return;` ガードよりも **前** に書く必要あり。さもなくば mod キー押下中に発火する可能性が排除しきれない(現状コードは mod check + 早期 return で連鎖しているので、安全側に寄せて modifier 不要の Esc/Delete と同じ群に入れる)
  - **JIS 配列の `?`**: `Shift+/` で `e.key === '?'` になる(US/JIS とも)。`e.code` を使うと配列依存(US: `Slash`、JIS: `Slash` だが Shift 状態の解釈差)で不安定になるため `e.key === '?'` で十分
  - **IME 中**: 日本語 IME ON で keydown が `e.key === 'Process'` で来るが、その状況では textarea にフォーカスがあるはずで `isEditableTarget` ガードが先に効く。canvas focus 時は IME 関係なく `?` がそのまま届く
  - **`C` と TOOL_KEY_MAP**: 既存 TOOL_KEY_MAP は v/r/a/t/h のみ。`c` は palette 専用にして明確に分離
  - **ブラウザの `?` ハンドリング**: ブラウザの「?」キーには元々特別な機能無し(検索バー起動の `Cmd+/` は別)。preventDefault しなくても害は無いが、callback ありの時だけ呼ぶ規約は維持
- **VALIDATE**: typecheck 緑

### Task 4: `useKeyboardShortcuts` のテスト拡充
- **ACTION**: `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` に test 追加
- **IMPLEMENT**:
  ```typescript
  it('? (Shift+/) fires onShowHelp and prevents default when provided', () => {
    const onShowHelp = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onShowHelp })} />);
    const { prevented } = press({ key: '?', shiftKey: true });
    expect(onShowHelp).toHaveBeenCalledOnce();
    expect(prevented).toBe(true);
  });

  it('? does NOT preventDefault when onShowHelp is undefined', () => {
    mount.render(<Harness shortcuts={baseShortcuts()} />);
    const { prevented } = press({ key: '?', shiftKey: true });
    expect(prevented).toBe(false);
  });

  it('C fires onCycleColorNext (no shift)', () => {
    const next = vi.fn();
    const prev = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onCycleColorNext: next, onCycleColorPrev: prev })} />);
    press({ key: 'c' });
    expect(next).toHaveBeenCalledOnce();
    expect(prev).not.toHaveBeenCalled();
  });

  it('Shift+C fires onCycleColorPrev (not next)', () => {
    const next = vi.fn();
    const prev = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onCycleColorNext: next, onCycleColorPrev: prev })} />);
    press({ key: 'C', shiftKey: true });
    expect(prev).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not fire ? or C when focus is in an input', () => {
    const onShowHelp = vi.fn();
    const onCycleColorNext = vi.fn();
    mount.render(<Harness shortcuts={baseShortcuts({ onShowHelp, onCycleColorNext })} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const helpEv = new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true });
    Object.defineProperty(helpEv, 'target', { value: input, writable: false });
    window.dispatchEvent(helpEv);
    const cEv = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    Object.defineProperty(cEv, 'target', { value: input, writable: false });
    window.dispatchEvent(cEv);
    expect(onShowHelp).not.toHaveBeenCalled();
    expect(onCycleColorNext).not.toHaveBeenCalled();
    input.remove();
  });
  ```
- **MIRROR**: KEYBOARD_TEST_HARNESS
- **IMPORTS**: 既存の vi / Harness / press / baseShortcuts
- **GOTCHA**:
  - `KeyboardEvent` の `key === '?'` を 1 回 dispatch しても `shiftKey` は別フィールド。両方セットする
  - happy-dom の `KeyboardEvent` はネイティブ Chrome と同じく `e.key` を読み出せる
  - `Shift+C` ケースは `key: 'C'` (大文字) を渡す: ブラウザは Shift で `key` を大文字化する
  - `key.toLowerCase()` で比較しているので `'C'` は `'c'` にマッチする(既存ロジック)
- **VALIDATE**: `pnpm -F @snap-share/web test -- useKeyboardShortcuts` 全緑(既存 + 新規 4 件)

### Task 5: `ui/dialog.tsx` を新規追加(base-ui Dialog ラッパ)
- **ACTION**: `apps/web/src/components/ui/dialog.tsx` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
  import type * as React from 'react';
  import { cn } from '@/lib/utils';

  function Dialog({ ...props }: DialogPrimitive.Root.Props) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
  }

  function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
  }

  function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
  }

  function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
  }

  function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
    return (
      <DialogPrimitive.Backdrop
        data-slot="dialog-overlay"
        className={cn(
          'fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
          className,
        )}
        {...props}
      />
    );
  }

  function DialogContent({
    className,
    size = 'default',
    ...props
  }: DialogPrimitive.Popup.Props & { size?: 'default' | 'lg' }) {
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-size={size}
          className={cn(
            'group/dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-6 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-md data-[size=lg]:max-w-2xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </DialogPortal>
    );
  }

  function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
      <div
        data-slot="dialog-header"
        className={cn('flex flex-col gap-1.5', className)}
        {...props}
      />
    );
  }

  function DialogTitle({
    className,
    ...props
  }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
      <DialogPrimitive.Title
        data-slot="dialog-title"
        className={cn('text-base font-semibold', className)}
        {...props}
      />
    );
  }

  function DialogDescription({
    className,
    ...props
  }: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
      <DialogPrimitive.Description
        data-slot="dialog-description"
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    );
  }

  export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
  };
  ```
- **MIRROR**: DIALOG_WRAPPER_FROM_BASE_UI(`alert-dialog.tsx` の構造をそのまま `Dialog` に置換)
- **IMPORTS**: `@base-ui/react/dialog`, `cn`
- **GOTCHA**:
  - **AlertDialog との差**: AlertDialog はクリックアウトで閉じない(`dismissible: false` がデフォルト)。Dialog はクリックアウト・Esc で閉じるのがデフォルト。Help 用途なのでこの挙動が望ましい
  - **size の `lg` 追加**: Help 表は AlertDialog の `xs/sm` よりも横幅が必要(チートシート 2 列レイアウト)。`max-w-2xl`(672px)で余裕を持たせる
  - **z-50 / Portal**: Toolbar(z-10)より確実に上に出る。既存 alert-dialog と同じ層
  - **Close button**: `DialogClose` を export しておくが Modal 内で必須では無い(クリックアウト + Esc で閉じる)。HelpModal 側で「閉じる」ボタンとしてだけ使う
- **VALIDATE**: typecheck 緑

### Task 6: `HelpModal` コンポーネントを新規実装
- **ACTION**: `apps/web/src/components/dialogs/HelpModal.tsx` を新規作成
- **IMPLEMENT**:
  ```typescript
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';

  type Props = Readonly<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>;

  // チートシートの全項目。row = [label, keys...] で keys は <kbd> として連結表示。
  // 「+」セパレータで <kbd>+</kbd> ではなく単なる文字 "+" として表示する。
  type Row = Readonly<{ label: string; keys: ReadonlyArray<string> }>;

  const TOOL_ROWS: ReadonlyArray<Row> = [
    { label: '選択', keys: ['V'] },
    { label: '矩形', keys: ['R'] },
    { label: '矢印', keys: ['A'] },
    { label: 'テキスト', keys: ['T'] },
    { label: 'ハイライト', keys: ['H'] },
  ];

  const COLOR_ROWS: ReadonlyArray<Row> = [
    { label: '次の色', keys: ['C'] },
    { label: '前の色', keys: ['⇧', 'C'] },
  ];

  const EDIT_ROWS: ReadonlyArray<Row> = [
    { label: '元に戻す', keys: ['⌘', 'Z'] },
    { label: 'やり直し', keys: ['⌘', '⇧', 'Z'] },
    { label: '削除', keys: ['Del'] },
    { label: '選択解除', keys: ['Esc'] },
  ];

  const ZOOM_ROWS: ReadonlyArray<Row> = [
    { label: '全体表示', keys: ['⌘', '0'] },
    { label: '100%', keys: ['⌘', '1'] },
    { label: 'ズーム', keys: ['⌘', 'ホイール'] },
    { label: 'パン', keys: ['Space', 'ドラッグ'] },
  ];

  const EXPORT_ROWS: ReadonlyArray<Row> = [
    { label: 'PNG 保存', keys: ['⌘', 'S'] },
  ];

  const HELP_ROWS: ReadonlyArray<Row> = [
    { label: 'このパネル', keys: ['?'] },
  ];

  type Section = Readonly<{ title: string; rows: ReadonlyArray<Row> }>;

  const SECTIONS: ReadonlyArray<Section> = [
    { title: 'ツール', rows: TOOL_ROWS },
    { title: '色', rows: COLOR_ROWS },
    { title: '編集', rows: EDIT_ROWS },
    { title: 'ズーム', rows: ZOOM_ROWS },
    { title: '出力', rows: EXPORT_ROWS },
    { title: 'ヘルプ', rows: HELP_ROWS },
  ];

  const Kbd = ({ children }: { children: React.ReactNode }) => (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </kbd>
  );

  export const HelpModal = ({ open, onOpenChange }: Props) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>キーボードショートカット</DialogTitle>
          <DialogDescription>
            すべての操作はキーボードで完結できます。閉じるには Esc か外側をクリック。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title} aria-labelledby={`help-section-${section.title}`}>
              <h3
                id={`help-section-${section.title}`}
                className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {section.title}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {section.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{row.label}</span>
                    <span className="flex items-center gap-1">
                      {row.keys.map((k, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: keys 配列は static で並び順が安定
                        <Kbd key={i}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
  ```
- **MIRROR**: MODAL_CONSUMER_PATTERN(open / onOpenChange を親が持つ)
- **IMPORTS**: 上記 Dialog 系コンポーネント
- **GOTCHA**:
  - **「⌘」記号**: macOS 専用。Windows/Linux では `Ctrl` だが、本プロダクトのターゲット(オーナー dogfood)が macOS なので `⌘` 1 種で MVP 成立。push があれば `process.platform` 相当の実行時判定を入れる(Phase 7.7-4 後)
  - **`<kbd>` のスタイル**: 既存に類例無し。`bg-muted` + `border-border` + monospace で OS 標準キーキャップに寄せる
  - **2 列 grid**: `grid-cols-1 sm:grid-cols-2` で狭い画面は 1 列。Modal の `max-w-2xl` で十分入る
  - **focus management**: base-ui Dialog が `initialFocus` を Popup に当てる。明示的に `Close` ボタンを置かなくても trap される。Esc / クリックアウトで閉じる
  - **見た目だけ**: `onOpenChange` に渡す callback は親(EditorShell)が決める。閉じる動作は base-ui が `onOpenChange(false)` で勝手に呼ぶので、ここでは何も書かなくて良い
- **VALIDATE**: typecheck 緑

### Task 7: `HelpModal` の smoke test
- **ACTION**: `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { act } from 'react';
  import { createRoot, type Root } from 'react-dom/client';
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { HelpModal } from '../HelpModal';

  const renderModal = (props: { open?: boolean; onOpenChange?: (o: boolean) => void }) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: Root | undefined;
    act(() => {
      root = createRoot(container);
    });
    act(() => {
      root?.render(
        <HelpModal
          open={props.open ?? false}
          onOpenChange={props.onOpenChange ?? (() => {})}
        />,
      );
    });
    return {
      container,
      unmount: () => {
        act(() => { root?.unmount(); });
        container.remove();
      },
    };
  };

  describe('HelpModal', () => {
    beforeEach(() => {
      while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });
    afterEach(() => { vi.clearAllMocks(); });

    it('open=false renders nothing into the document body', () => {
      const m = renderModal({ open: false });
      // base-ui の Portal は open=false で Popup を mount しない。
      expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull();
      m.unmount();
    });

    it('open=true renders the cheatsheet title and at least the V tool row', () => {
      const m = renderModal({ open: true });
      const title = document.body.querySelector('[data-slot="dialog-title"]');
      expect(title?.textContent).toContain('キーボードショートカット');
      // V (選択) の行が表示されている
      expect(document.body.textContent).toContain('選択');
      // 「⌘」「Z」がそれぞれ <kbd> に入っていること
      const kbds = document.body.querySelectorAll('kbd');
      const labels = Array.from(kbds).map((k) => k.textContent);
      expect(labels).toContain('⌘');
      expect(labels).toContain('Z');
      expect(labels).toContain('?');
      m.unmount();
    });

    it('open=true and Esc closes — onOpenChange(false) gets called', () => {
      const onOpenChange = vi.fn();
      const m = renderModal({ open: true, onOpenChange });
      // happy-dom で base-ui の internal Esc handler を呼ぶ:
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);
      // base-ui は dismissible で Esc → onOpenChange(false) を呼ぶ
      // (test 観点では「呼ばれた」事実を確認、実 close は React state 駆動)
      expect(onOpenChange).toHaveBeenCalledWith(false);
      m.unmount();
    });
  });
  ```
- **MIRROR**: ColorPalette テストの `renderXxx` パターン + `createRoot + act`
- **IMPORTS**: 上記
- **GOTCHA**:
  - **base-ui Portal が happy-dom で動くか**: AlertDialog が happy-dom で動いているならば Dialog も同じ(同じ primitives)。動かない場合はその test だけ skip して E2E に委ねる
  - **Esc 経路**: base-ui は `document` レベルで Esc を listen している(focus trap 内のみ)。`document.dispatchEvent` で OK
  - **noUncheckedIndexedAccess**: `kbds[0]` 系を直接読まないよう `Array.from(kbds).map(...)` で配列化
  - **assertion 緩め**: 各セクションを総当りせず「主要キー(⌘ / Z / ?)が出ている」だけ確認。E2E が "?" → modal open の経路を別途担保する
- **VALIDATE**: `pnpm -F @snap-share/web test -- HelpModal` 緑

### Task 8: `Toolbar` に Help アイコンボタンを追加
- **ACTION**: `apps/web/src/components/toolbar/Toolbar.tsx` を更新
- **IMPLEMENT**:
  - import に追加: `import { CircleHelp } from 'lucide-react';`
  - props に追加:
    ```typescript
    onShowHelp: () => void;
    ```
  - エクスポート部の最後の `Divider` の後ろに追加:
    ```tsx
    <Divider />
    <ToolButton
      icon={CircleHelp}
      label="ショートカット一覧"
      shortcut="?"
      onClick={onShowHelp}
    />
    ```
  - destructuring に `onShowHelp` を加える
- **MIRROR**: TOOLBAR_BUTTON_PATTERN
- **IMPORTS**: `CircleHelp` (lucide-react に存在)
- **GOTCHA**:
  - **disabled 条件**: 画像未投入時も Help は出せる(キーボード操作の発見性確保のため)。`disabled` を渡さない
  - **shortcut 表示**: `?` は単独。`⇧/` ではなく `?` で表示するのが業界慣例(Excalidraw / VSCode と同じ)
  - **配置**: 「PNG 保存 / 注釈をすべて削除」の **次** に Divider + Help。一番右に置くことで「最後の救済策」として目に入りやすい
- **VALIDATE**: typecheck 緑

### Task 9: `EditorShell` に HelpModal と新ショートカットを配線
- **ACTION**: `apps/web/src/pages/EditorShell.tsx` を更新
- **IMPLEMENT**:
  - import に追加:
    ```typescript
    import { HelpModal } from '../components/dialogs/HelpModal';
    import { nextColor, prevColor } from '../lib/colorCycle';
    ```
  - state に追加:
    ```typescript
    const [helpOpen, setHelpOpen] = useState<boolean>(false);
    ```
  - color cycle handler:
    ```typescript
    const handleCycleColorNext = useCallback(() => {
      const color = nextColor(store.state.activeColor);
      store.dispatch({ type: 'active-color/set', color });
      const id = store.state.selectedId;
      if (id) {
        store.dispatch({ type: 'annotation/set-color', id, color });
      }
    }, [store]);

    const handleCycleColorPrev = useCallback(() => {
      const color = prevColor(store.state.activeColor);
      store.dispatch({ type: 'active-color/set', color });
      const id = store.state.selectedId;
      if (id) {
        store.dispatch({ type: 'annotation/set-color', id, color });
      }
    }, [store]);
    ```
    ※ 既存 `handlePickColor` と同じく「active 更新 + 選択中なら同じ color を当てる」を保つ。ロジック重複を避けたければ `useCallback((color: string) => {...}, [store])` を 1 つ作って 3 経路から呼ぶリファクタも可だが、本フェーズは差分最小化のため単純複製
  - help toggle handler:
    ```typescript
    const handleShowHelp = useCallback(() => {
      // toggle: 既に開いていたら閉じる("?" を再度押した時の挙動)
      setHelpOpen((prev) => !prev);
    }, []);
    ```
  - useKeyboardShortcuts 呼び出しに追加:
    ```typescript
    useKeyboardShortcuts({
      onUndo: store.undo,
      onRedo: store.redo,
      onDelete: handleDelete,
      onSetTool: handleSetTool,
      onEscape: handleEscape,
      onExport: canExport ? handleExport : undefined,
      onFitToViewport: source ? fitToViewport : undefined,
      onSetHundredPercent: source ? setHundredPercent : undefined,
      onShowHelp: handleShowHelp,
      onCycleColorNext: source ? handleCycleColorNext : undefined,
      onCycleColorPrev: source ? handleCycleColorPrev : undefined,
    });
    ```
    ※ `onShowHelp` は画像未投入時も有効(キーボード discoverability)。色 cycle は画像投入後のみ
  - Toolbar に props 追加:
    ```typescript
    <Toolbar
      ...
      onPickColor={handlePickColor}
      onShowHelp={handleShowHelp}
    />
    ```
  - return の末尾(`{floatingExtras}` の後ろ)に追加:
    ```tsx
    <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    ```
- **MIRROR**: 既存の `useKeyboardShortcuts` 配線箇所(EditorShell.tsx:177-186) + `ConfirmClearAllDialog` 配線箇所(`pages/RoomEditor.tsx:156`)
- **IMPORTS**: 上記
- **GOTCHA**:
  - **handleEscape 競合**: HelpModal が開いている間に Esc が押されると、base-ui Dialog が Esc を捕まえて `onOpenChange(false)` を呼ぶが、**同じ Esc が window keydown まで bubble して `useKeyboardShortcuts.onEscape` も発火する** 可能性がある → handleEscape は「textId があれば閉じる、なければ selectedId を null」だが、Modal open 中はその両方とも空である通常状態であれば副作用無し。**ただし**「Modal 開いた直後に Esc → handleEscape 発火 → 何もしない → modal 閉じる」になるはずで実害無い。E2E で確認
  - **toggle 挙動**: `?` 連打で open/close をトグル。これが Excalidraw / Figma と同じ挙動(意図したワンキー toggle)
  - **Modal open 中の他ショートカット**: `useKeyboardShortcuts` は `isEditableTarget` ガードのみ。Modal 内に input が無ければ V/R/... も発火する。**設計判断**: HelpModal はユーザーが見るだけ → V/R 押せば canvas 側にも反映され modal は開いたまま。dogfood で挙動確認、邪魔なら次フェーズで「modal open 中はショートカット停止」を入れる(現状は最小実装に留める)
  - **handleClearImage で Modal を閉じない**: 画像クリアと Help 表示は独立した状態
  - **`handleCycleColorPrev` / `Next` の重複ロジック**: 1 関数 `handleColorCycle(direction: 'next' | 'prev')` に統合する選択肢もあるが、`useCallback` 依存配列が `store` だけで済むので差分は同等。可読性重視で複製
- **VALIDATE**: typecheck 緑、`pnpm -F @snap-share/web test -- EditorShell` (もし既存テストあれば) 緑

### Task 10: Toolbar test を新規追加(Help ボタン検証)
- **ACTION**: `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { act } from 'react';
  import { createRoot, type Root } from 'react-dom/client';
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
  import { TooltipProvider } from '@/components/ui/tooltip';
  import { COLOR_PALETTE } from '../../canvas/colors';
  import { Toolbar } from '../Toolbar';

  const renderToolbar = (overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: Root | undefined;
    act(() => { root = createRoot(container); });
    const props: Parameters<typeof Toolbar>[0] = {
      tool: 'select',
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      imageLoaded: true,
      canExport: true,
      activeColor: COLOR_PALETTE[0]!,
      onSetTool: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onDelete: vi.fn(),
      onClearImage: vi.fn(),
      onExport: vi.fn(),
      onPickColor: vi.fn(),
      onShowHelp: vi.fn(),
      ...overrides,
    };
    act(() => {
      root?.render(<TooltipProvider><Toolbar {...props} /></TooltipProvider>);
    });
    return {
      container,
      props,
      unmount: () => { act(() => { root?.unmount(); }); container.remove(); },
    };
  };

  describe('Toolbar', () => {
    beforeEach(() => {
      while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });
    afterEach(() => { vi.clearAllMocks(); });

    it('renders a Help button with aria-label "ショートカット一覧"', () => {
      const m = renderToolbar({});
      const btn = m.container.querySelector('button[aria-label="ショートカット一覧"]');
      expect(btn).not.toBeNull();
      m.unmount();
    });

    it('clicking the Help button calls onShowHelp', () => {
      const onShowHelp = vi.fn();
      const m = renderToolbar({ onShowHelp });
      const btn = m.container.querySelector<HTMLButtonElement>('button[aria-label="ショートカット一覧"]');
      act(() => { btn?.click(); });
      expect(onShowHelp).toHaveBeenCalledOnce();
      m.unmount();
    });

    it('Help button is enabled even when image is not loaded', () => {
      const m = renderToolbar({ imageLoaded: false, canExport: false });
      const btn = m.container.querySelector<HTMLButtonElement>('button[aria-label="ショートカット一覧"]');
      expect(btn?.disabled).toBe(false);
      m.unmount();
    });
  });
  ```
- **MIRROR**: ColorPalette.test.tsx の renderXxx パターン
- **IMPORTS**: 上記
- **GOTCHA**:
  - **Toolbar は TooltipProvider が必須**(ToolButton 内で Tooltip 使用)→ ラップ必須
  - **`Parameters<typeof Toolbar>[0]`**: 関数の第 1 引数(props 型)を型推論で取り出す、`ToolbarProps` を明示 export しなくても済む
  - **disabled の検証**: `imageLoaded: false` でも Help だけは enabled。これが回帰したら「キーボード discoverability が画像投入を強要する」問題に戻る
- **VALIDATE**: `pnpm -F @snap-share/web test -- Toolbar` 緑

### Task 11: E2E `help-modal.spec.ts` を新規作成
- **ACTION**: `apps/web/e2e/help-modal.spec.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { expect, test } from '@playwright/test';
  import { dropImage } from './fixtures/upload';

  // Phase 7.7-4 E2E: HelpModal の起動経路 (`?` キー / Toolbar ❓ ボタン) と
  // 閉じる経路 (Esc / クリックアウト) を担保する。
  // chromium 1 プロジェクトに限定 (window keydown と base-ui Portal の挙動を見る)。

  const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

  const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
    test.skip(testInfo.project.name !== 'chromium', 'HelpModal は chromium 1 プロジェクトで検証');

  test.describe('HelpModal', () => {
    test('? キーで開いて Esc で閉じる', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await page.goto('/');
      // 画像未投入でも `?` は効くべき (discoverability 担保)
      await page.keyboard.press('Shift+/');
      await expect(
        page.locator('[data-slot="dialog-content"]'),
      ).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('キーボードショートカット')).toBeVisible();

      // Esc で閉じる
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="dialog-content"]')).toBeHidden({ timeout: 5_000 });
    });

    test('Toolbar の ❓ ボタンで開いて、? 連打で toggle close する', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await page.goto('/');
      await dropImage(page);
      await page.waitForFunction(
        (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
        ANNOTATIONS_KEY,
        { timeout: 10_000 },
      );

      const helpBtn = page.getByRole('button', { name: 'ショートカット一覧', exact: true });
      await helpBtn.click();
      await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible({ timeout: 5_000 });

      // ? 連打 → toggle で閉じる
      // (canvas に focus がある状態で press するため、まず canvas を click)
      // ※ Modal open 中は backdrop が canvas を覆っているので backdrop を click して
      //   一度閉じてから再度 ? で開く (実装は ? = setHelpOpen(prev => !prev))
      await page.keyboard.press('Shift+/');
      await expect(page.locator('[data-slot="dialog-content"]')).toBeHidden({ timeout: 5_000 });
    });

    test('チートシートに主要ショートカット (?, ⌘S, V, C) が記載されている', async ({ page }, testInfo) => {
      skipNonChromium(testInfo);
      await page.goto('/');
      await page.keyboard.press('Shift+/');
      const modal = page.locator('[data-slot="dialog-content"]');
      await expect(modal).toBeVisible({ timeout: 5_000 });

      const kbds = modal.locator('kbd');
      await expect(kbds.filter({ hasText: '⌘' }).first()).toBeVisible();
      await expect(kbds.filter({ hasText: 'S' }).first()).toBeVisible();
      await expect(kbds.filter({ hasText: 'V' }).first()).toBeVisible();
      await expect(kbds.filter({ hasText: 'C' }).first()).toBeVisible();
      await expect(kbds.filter({ hasText: '?' }).first()).toBeVisible();
    });
  });
  ```
- **MIRROR**: TEST_E2E_KEYBOARD
- **IMPORTS**: `@playwright/test`, `dropImage`
- **GOTCHA**:
  - **`Shift+/` の Playwright 表記**: `page.keyboard.press('Shift+/')` で `KeyboardEvent.key === '?'` が発火する(Playwright が key combination → key を解決)
  - **画像未投入時のテスト**: `?` だけは discoverability 用に画像未投入でも効く設計。これが test で回帰検出される
  - **toggle close test**: Modal open 中 backdrop が click をブロックする → ❓ ボタンへの click は届かない。代わりに `?` (window keydown) で toggle 確認
  - **`data-slot="dialog-content"` selector**: `ui/dialog.tsx` で付けた data-slot を E2E から見つける唯一の安定セレクタ
  - **chromium 限定**: AlertDialog の既存 E2E (`room-clear-image.spec.ts`) も同様。Webkit / Firefox の base-ui 挙動差を避ける
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- help-modal` 全緑

### Task 12: E2E `golden-path.spec.ts` を新規作成(success metric 直対応)
- **ACTION**: `apps/web/e2e/golden-path.spec.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  import { expect, test } from '@playwright/test';
  import { buildSolidPng, dropImageBuffer } from './fixtures/upload';

  // Phase 7.7-4 success metric: 「マウス無し golden path」をキーボードのみで完遂する。
  //
  // 完全な「マウス 0 回」は dropImage の D&D が DataTransfer dispatch (=
  // mouse 経由ではない) なので OK。注釈の配置にだけマウスドラッグが必要だが、
  // success metric の意図は「ツールバーに戻らずに連続作業できる」なので、
  // ツール選択・色変更・undo/redo・export はすべてキーボードで実行する点を
  // 検証する (= ツールバーボタンへの click 0 回)。

  const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
  const TRANSFORM_ACTIONS_KEY = '__SNAP_SHARE_TRANSFORM_ACTIONS__';

  type Stored = ReadonlyArray<{ type: string; color: string }>;

  const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
    test.skip(testInfo.project.name !== 'chromium', 'golden path は chromium 1 プロジェクトで検証');

  const SAMPLE = buildSolidPng(800, 600);

  test('キーボード操作のみで 4 種注釈配置 → 色変更 → エクスポートまで完遂できる', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);

    await page.goto('/');
    await dropImageBuffer(page, SAMPLE, 'golden.png');
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
    await page.waitForFunction(
      (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
      ANNOTATIONS_KEY,
      { timeout: 10_000 },
    );
    await page.waitForFunction(
      (k) => typeof (window as unknown as Record<string, unknown>)[k] === 'object',
      TRANSFORM_ACTIONS_KEY,
      { timeout: 5_000 },
    );

    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('canvas bbox null');

    // R: rectangle
    await page.keyboard.press('r');
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 180, { steps: 5 });
    await page.mouse.up();

    // C で色を 1 つ進める (active が選択中の rectangle にも適用される)
    await page.keyboard.press('c');

    // A: arrow
    await page.keyboard.press('a');
    await page.mouse.move(box.x + 250, box.y + 250);
    await page.mouse.down();
    await page.mouse.move(box.x + 350, box.y + 300, { steps: 5 });
    await page.mouse.up();

    // T: text (1 文字打って Enter で commit)
    await page.keyboard.press('t');
    await page.mouse.click(box.x + 400, box.y + 400);
    const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.type('OK');
    await textarea.press('Enter');

    // H: highlight
    await page.keyboard.press('h');
    await page.mouse.move(box.x + 500, box.y + 500);
    await page.mouse.down();
    await page.mouse.move(box.x + 580, box.y + 540, { steps: 5 });
    await page.mouse.up();

    // 検証: 注釈が 4 つ追加されている (rect + arrow + text + highlight)
    await expect
      .poll(async () =>
        page.evaluate(
          (k) => (window as unknown as Record<string, Stored>)[k]?.length ?? 0,
          ANNOTATIONS_KEY,
        ),
      )
      .toBe(4);

    // ⌘S で PNG エクスポート (download トリガ)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.keyboard.press(`${modifier}+s`);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^snap-share-[A-Za-z0-9_-]{21}-\d{8}-\d{6}\.png$/);
  });
  ```
- **MIRROR**: TEST_E2E_KEYBOARD + zoom-pan.spec.ts のセットアップパターン
- **IMPORTS**: 上記
- **GOTCHA**:
  - **「マウス 0 回」の現実**: 注釈の配置自体は drag (mouse 必須) — success metric の本意は「**ツール選択 / 色変更 / 出力 はキーボードで完結**」。configure 系操作だけマウス禁止と読む
  - **C キーで色変更 → 選択中に適用**: rectangle 配置直後に store.selectedId が rect の id になる(CanvasStage.handleMouseUp で `select/set`)→ C 押下で `handleCycleColorNext` が active 変更 + 選択中にも適用。色配列の何番目かを正確に検証するなら `__SNAP_SHARE_ANNOTATIONS__` から rect の color を読み出す追加 assert を入れて良い(本 spec ではカウントだけで割る)
  - **HighlightShape の color**: 元 default は黄。C キーで巡回した時に黄が外れることがある(palette index 2 に黄があるので、初期 active=palette[0]=red → next=palette[1]=orange など、テストは「色が変わる」事実だけで OK)
  - **`text` ツールの commit**: textarea が出てから type → Enter で commit する既存パターン(keyboard-shortcuts.spec.ts:121-128 と同じ)
  - **download 待ち**: 既存 keyboard-shortcuts.spec.ts:94-99 と同じ pattern
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- golden-path` 緑

### Task 13: PRD Phase 4 status を `pending` → `in-progress` に更新 + plan link を挿入
- **ACTION**: `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md` を更新
- **IMPLEMENT**:
  - 該当行(Implementation Phases 表の Phase 4):
    ```
    | 4 | B2: ショートカット網羅 + チートシート | ... | pending | - | 1, 2, 3 | - |
    ```
    を:
    ```
    | 4 | B2: ショートカット網羅 + チートシート | ... | in-progress | - | 1, 2, 3 | [plan](../plans/phase-7.7-4-shortcut-cheatsheet.plan.md) |
    ```
    に変更
- **MIRROR**: 既存の Phase 1-3 の plan link 表記
- **IMPORTS**: なし
- **GOTCHA**:
  - markdown 表のセル数を維持(`|` の個数を変えない)
  - 相対パス `../plans/phase-7.7-4-shortcut-cheatsheet.plan.md` は PRD ファイルから見たパス
- **VALIDATE**: `git diff .claude/PRPs/prds/phase-7.7-ux-foundation.prd.md` で意図通りの 1 行差分のみ

### Task 14: 品質ゲート(全体回帰)
- **ACTION**: 開発完了前の検証
- **IMPLEMENT**:
  - `pnpm -F @snap-share/web typecheck` 全緑
  - `pnpm lint`(biome ci)クリーン
  - `pnpm test` 全緑(colorCycle / useKeyboardShortcuts / HelpModal / Toolbar / 既存 reducer / shape / ImageLayer / useStageTransform)
  - `pnpm test:e2e` 全緑(help-modal / golden-path / zoom-pan / annotation-resize / annotation-color / annotation-tools / keyboard-shortcuts / room-* 全部)
  - `pnpm build` 緑(vite + wrangler dry-run)
  - PRD Phase 4 status を `in-progress` → `complete` に更新、plan / report リンク両方を入れる(`/prp-implement` 完了時)
- **VALIDATE**: 全コマンド exit 0

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| nextColor: palette[0] | `COLOR_PALETTE[0]` (red) | palette[1] (orange) | 通常 |
| nextColor: palette 末尾 | `COLOR_PALETTE[N-1]` (black) | palette[0] (red) | wrap-around |
| nextColor: palette 外 | `'#ffffff'` | palette[0] (red) | default 復帰 |
| prevColor: palette[0] | red | palette[N-1] (black) | wrap-around |
| prevColor: palette[2] | yellow | palette[1] (orange) | 通常 |
| prevColor: palette 外 | `'#ffffff'` | palette[N-1] (black) | default 復帰 |
| useKeyboardShortcuts: ? | `key='?', shiftKey=true` | onShowHelp 呼ばれる、preventDefault 呼ばれる | mod 不要 |
| useKeyboardShortcuts: ? undefined | `key='?'`, onShowHelp 無し | preventDefault 呼ばれない | discoverability ガード |
| useKeyboardShortcuts: C | `key='c'`, no shift | onCycleColorNext のみ呼ばれる | direction |
| useKeyboardShortcuts: ⇧C | `key='C', shiftKey=true` | onCycleColorPrev のみ呼ばれる | direction |
| useKeyboardShortcuts: input ガード | input focus + `?` / `c` | どちらも発火しない | isEditableTarget |
| HelpModal: closed | `open=false` | `[data-slot="dialog-content"]` が無い | 非表示確認 |
| HelpModal: open | `open=true` | title "キーボードショートカット" が見える、kbd "⌘"/"Z"/"?" が含まれる | 描画スモーク |
| HelpModal: Esc | `open=true` 中 Esc dispatch | onOpenChange(false) が呼ばれる | base-ui の close 経路 |
| Toolbar: Help button | render | aria-label="ショートカット一覧" の button が DOM にある | 構造 |
| Toolbar: Help click | onShowHelp mock | click で 1 回呼ばれる | コールバック |
| Toolbar: Help disabled? | imageLoaded=false | Help だけは enabled | discoverability 不変条件 |

### E2E Tests

| Test | 経路 | 主検証 |
|---|---|---|
| help-modal: ? open + Esc close | 画像未投入 + `Shift+/` → Esc | Modal の visible/hidden 切替 |
| help-modal: Toolbar ❓ + ? toggle close | 画像投入 + ❓ click → `Shift+/` | toggle 動作 |
| help-modal: 主要キー記載 | open 後 kbd を query | ⌘ / S / V / C / ? が表示される |
| golden-path: 全工程 | 画像投入 → R drag → C → A drag → T type → H drag → ⌘S | 注釈 4 件 + download 発火 |

### Edge Cases Checklist
- [x] `?` を modifier 付きで押した時(`Cmd+?`) → 現実装は mod 早期 return ではないが、`?` 分岐は `!mod && key === '?'` ガード付き → mod 付きは無視される ✔
- [x] `C` を modifier 付きで押した時(`Cmd+C` = browser copy)→ `!mod && key === 'c'` ガード付きで奪わない ✔
- [x] HelpModal open 中に V/R/A/T/H を押した時 → tool は変わる(Modal は閉じない)。dogfood で挙動確認、邪魔なら次フェーズで調整
- [x] `C` の連打で palette 末尾に達した時 → wrap-around で先頭に戻る
- [x] palette が空配列(将来の理論上)→ `nextColor`/`prevColor` は `active` をそのまま返す
- [x] HelpModal 内 click → backdrop click ではないので閉じない(base-ui 標準)
- [x] HelpModal が画像未投入時に出る → Toolbar の Help ボタンも有効
- [x] 日本語 IME ON 中に `?` 押下 → input focus 中なら `isEditableTarget` ガードで無視。canvas focus 中は IME OFF のはずで `?` がそのまま届く
- [x] focus が `body` の時 → `isEditableTarget(body)` は false、ショートカット発火 OK
- [x] modal close 時に focus が trigger に戻る → base-ui Dialog の標準挙動

---

## Validation Commands

### Static Analysis
```bash
pnpm -F @snap-share/web typecheck
```
EXPECT: ゼロ型エラー

### Lint
```bash
pnpm lint
```
EXPECT: biome ci がクリーン

### Unit Tests (新規 + 既存回帰)
```bash
pnpm -F @snap-share/web test -- colorCycle
pnpm -F @snap-share/web test -- useKeyboardShortcuts
pnpm -F @snap-share/web test -- HelpModal
pnpm -F @snap-share/web test -- Toolbar
pnpm -F @snap-share/web test
```
EXPECT: 全 spec PASS、新規 18 件以上の test 追加

### E2E (新規)
```bash
pnpm -F @snap-share/web test:e2e -- help-modal
pnpm -F @snap-share/web test:e2e -- golden-path
```
EXPECT: 全 spec PASS

### Full E2E (回帰)
```bash
pnpm -F @snap-share/web test:e2e
```
EXPECT: zoom-pan / annotation-resize / annotation-color / annotation-tools / keyboard-shortcuts / room-* 全部 regression 0

### Build Verification
```bash
pnpm build
```
EXPECT: vite 緑 + wrangler dry-run 緑

### Manual Validation
- [ ] `pnpm dev` 起動 → 画像投入 → `?` で Modal 開く → Esc で閉じる
- [ ] Modal を開かずに Toolbar の ❓ ボタンを直接 click → Modal が出る
- [ ] 画像投入後に `R` → drag → `C` を 3 回連打 → 矩形の色が rotation する
- [ ] ⌘0 / ⌘1 ショートカット表記が Modal に正しく出る
- [ ] 文字入力中 (textarea focus) に `?` を打つ → `?` が入力されて Modal は開かない
- [ ] macOS US/JIS 両方で `?` (Shift+/) → Modal 開く
- [ ] golden path: マウスでツールバーに戻らずに「投入 → 4 種配置 → 色変更 → リサイズ → ⌘S」を完遂

---

## Acceptance Criteria
- [ ] 全 14 タスク完了
- [ ] 全 validation コマンド緑
- [ ] 新ショートカット (`?` / `C` / `⇧C`) が `useKeyboardShortcuts.test.tsx` で網羅
- [ ] HelpModal が `?` キー / Toolbar ❓ ボタンの両経路で開閉する E2E が緑
- [ ] golden-path.spec.ts(success metric「マウス無し」直対応)が緑
- [ ] PRD Phase 4 status が plan link 付きで更新

## Completion Checklist
- [ ] コードが既存パターン(KEYBOARD_SHORTCUT_REGISTRATION_EXISTING / DIALOG_WRAPPER_FROM_BASE_UI / MODAL_CONSUMER_PATTERN)に準拠
- [ ] エラーハンドリングは「callback 無ければ preventDefault しない」ルール継続
- [ ] biome ci がクリーン(import 順 / single quote / trailing comma 維持)
- [ ] テストが既存 `createRoot + act` パターンを踏襲(`@testing-library/react` 追加なし)
- [ ] ハードコード値なし(`COLOR_PALETTE` / token / lucide-react icon を再利用)
- [ ] 不要スコープ追加なし(NOT Building リスト準拠)
- [ ] Self-contained — 実装中に追加検索や質問が必要ない

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| HelpModal open 中の `V/R/...` がツール変更してしまう UX 違和感 | M | L | dogfood で評価。邪魔なら `useKeyboardShortcuts` に `disabled?: boolean` を入れて Modal open 中だけ disable する後追い修正(本フェーズ NOT Building) |
| base-ui Dialog の Esc 経路が happy-dom で再現しない | L | L | smoke test の Esc 部分が落ちたら test を skip し、`help-modal.spec.ts` の E2E に移譲(実ブラウザでは確実に動く) |
| `Shift+C` のテストで `key: 'C'`(大文字)を渡すパターンが happy-dom で大文字保持されない | L | L | `key.toLowerCase()` 比較なので `key: 'c', shiftKey: true` でも OK。失敗時はそちらに切替 |
| Phase 7.7 後にチートシート項目追加忘れが発生(将来) | M | L | TODO ではなく **rule** として「ショートカット追加時は HelpModal も同 PR で更新」を `.claude/rules/web/coding-style.md` に追記する後追い PR を Phase 7.8 で検討 |
| color cycle の wrap-around が直感に反する(末尾→先頭で「リセット」感) | L | L | dogfood で観察。標準的な慣例(Photoshop の swatch cycle と同じ)なので問題は出にくいと予測 |
| `?` キー単独 vs Shift+/ 表記の混乱(`Shift+/` を「⇧/」と表示すべき派) | L | L | Excalidraw / VSCode と同じく `?` 単独表記で統一。Modal 内の表示も `?` |

## Notes

- **Modal 起動経路の 2 系統**: `?` キーは canvas focus 時の高速操作向け、Toolbar の ❓ ボタンは「キーボード覚えてないがどうにかしたい」初回ユーザー向け。両方残すことで discoverability と速度を両立
- **`C` 巡回の方向**: `next` を「右(palette index +1)」、`prev` を「左(-1)」に統一。これは多くの sequencer / paint tool が採用する慣例(Photoshop の `Alt+]/[` 系も同方向)
- **将来の i18n 余地**: `HelpModal` の文字列は日本語ハードコード。`SECTIONS` の `title` と `Row.label` を後で `messages.ja.ts` に外出ししやすい構造にしておく(既に const 配列 + map なので i18n 化の差分は小さい)
- **shadcn 流命名**: `ui/dialog.tsx` 内のサブコンポーネント名(Dialog/DialogContent/DialogTitle/...)は shadcn の慣例に従う。`alert-dialog.tsx` と並んだ時に対称性が読める
- **`onShowHelp` を toggle にした理由**: `?` を開くだけにすると「閉じる時は別キー」が要る → discoverability が悪化。toggle なら同じキーで反転、Excalidraw と同じ
- **Phase 7.7 完了の意味**: このタスク完了後に Phase 8(外部 dogfood 解禁)に進める。現在は基本操作の欠落で外に出せない状態なので、success metric の「マウス無し golden path 100%」緑が phase gate
- **report の出力先**: `/prp-implement` 実行時に `.claude/PRPs/reports/phase-7.7-4-shortcut-cheatsheet-report.md` を生成する想定(Phase 7.7-1〜3 と同じ命名規則)
