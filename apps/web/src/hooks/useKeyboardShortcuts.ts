import { useEffect, useRef } from 'react';
import { TOOLS, type Tool } from './annotationsReducer';

export type KeyboardShortcuts = Readonly<{
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSetTool: (tool: Tool) => void;
  onEscape: () => void;
  /** 任意。⌘S/Ctrl+S → PNG export。提供時のみ preventDefault する (画像未ロード時に
   *  browser の "Save Page" を奪わないため)。 */
  onExport?: () => void;
  /** 任意。⌘0/Ctrl+0 → fit-to-viewport。提供時のみ preventDefault (画像未ロード時に
   *  browser の reset zoom を奪わないため)。 */
  onFitToViewport?: () => void;
  /** 任意。⌘1/Ctrl+1 → 100% scale。提供時のみ preventDefault (画像未ロード時に
   *  browser の "go to tab 1" を奪わないため)。 */
  onSetHundredPercent?: () => void;
  /** 任意。`?` (Shift+/) → help cheatsheet を toggle。提供時のみ preventDefault し、
   *  それ以外の context では browser の `?` を温存する。 */
  onShowHelp?: () => void;
  /** 任意。`C` → palette の次の色に cycle。 */
  onCycleColorNext?: () => void;
  /** 任意。`⇧C` → palette の前の色に cycle。 */
  onCycleColorPrev?: () => void;
  /** 任意。Enter (modifier / shift なし) → 保留中の auto-arrow を確定。pending が無いとき
   *  Enter は browser default (button focus / form submit など) として温存。 */
  onConfirmAutoArrow?: () => void;
  /** 任意。`]` → activeFontSize + STEP / 選択中 text にも適用。提供時のみ preventDefault。 */
  onIncrementFontSize?: () => void;
  /** 任意。`[` → activeFontSize - STEP / 選択中 text にも適用。 */
  onDecrementFontSize?: () => void;
}>;

// tool → key の方向を `Record<Tool, string>` で宣言。新 `Tool` を追加するとここが
// typecheck で落ちるため、key の選択が強制される。逆向きの key→tool 解決は同じ source
// から派生させた `TOOL_BY_KEY` が担当 — 1 SSOT で手動同期が要らない。
const TOOL_KEYS: Readonly<Record<Tool, string>> = {
  select: 'v',
  rectangle: 'r',
  arrow: 'a',
  text: 't',
  highlight: 'h',
};

// 逆 map は `TOOLS` (`readonly Tool[]`) を回して構築するので `TOOL_KEYS[t]` が型安全に
// 引け、`Object.entries` の key 型欠落を回避できる。`TOOLS` を SSOT に置くことで、
// 新 `Tool` 追加時はまず `TOOL_KEYS` で typecheck エラーが出る順序になっている。
const TOOL_BY_KEY: ReadonlyMap<string, Tool> = new Map(
  TOOLS.map((t) => [TOOL_KEYS[t], t] as const),
);

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
  return target.isContentEditable;
};

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts): void => {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === 's' && !e.shiftKey) {
        const onExport = ref.current.onExport;
        if (onExport) {
          e.preventDefault();
          onExport();
        }
        return;
      }
      if (mod && key === '0' && !e.shiftKey) {
        const cb = ref.current.onFitToViewport;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      if (mod && key === '1' && !e.shiftKey) {
        const cb = ref.current.onSetHundredPercent;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        ref.current.onUndo();
        return;
      }
      if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        ref.current.onRedo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        ref.current.onDelete();
        return;
      }
      if (e.key === 'Escape') {
        ref.current.onEscape();
        return;
      }
      // `?` (Shift+/) — help を toggle。JIS/US 両配列で Shift+/ は `e.key === '?'` になる。
      // mod-only の早期 return より前に置くことで、modifier なし `?` が tool-key 経路に
      // 流れないようにしている。
      if (!mod && e.key === '?') {
        const cb = ref.current.onShowHelp;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      // Enter — 保留中の auto-arrow を確定。text 編集中は textarea が stopPropagation
      // するためここに届かない。pending != null のときだけ EditorShell 側の経路で
      // 発火し、それ以外は browser default の Enter (ボタン focus 等) を温存する。
      // Shift+Enter / Cmd+Enter は除外。
      if (!mod && e.key === 'Enter' && !e.shiftKey) {
        const cb = ref.current.onConfirmAutoArrow;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      // `C` / `⇧C` — palette を cycle。Shift で逆方向。`c` は color cycling 専用に
      // 予約 (意図的に TOOL_KEYS には載せていない)。
      if (!mod && key === 'c') {
        const cb = e.shiftKey ? ref.current.onCycleColorPrev : ref.current.onCycleColorNext;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      // `[` / `]` — フォントサイズ ±STEP (Photoshop 流)。`e.key` 文字判定なので
      // JIS/US 両配列で同じ挙動。Shift+] は `}` に化けるため誤発火しない。
      // `isEditableTarget` ガードは関数冒頭で効くので text 編集中は素通し。
      if (!mod && e.key === ']') {
        const cb = ref.current.onIncrementFontSize;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      if (!mod && e.key === '[') {
        const cb = ref.current.onDecrementFontSize;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      if (mod) return;

      const tool = TOOL_BY_KEY.get(key);
      if (tool) {
        ref.current.onSetTool(tool);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
