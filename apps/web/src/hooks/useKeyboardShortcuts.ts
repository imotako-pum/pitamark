import { useEffect, useRef } from 'react';
import { TOOLS, type Tool } from './annotationsReducer';

export type KeyboardShortcuts = Readonly<{
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSetTool: (tool: Tool) => void;
  onEscape: () => void;
  /** Optional. ⌘S/Ctrl+S → PNG export. preventDefault() is only fired when
   *  this is provided, so the browser's "Save Page" dialog is never blocked
   *  for users who haven't loaded an image yet. */
  onExport?: () => void;
  /** Optional. ⌘0/Ctrl+0 → fit-to-viewport. preventDefault only when provided
   *  so we don't steal the browser's "reset zoom" before an image is loaded. */
  onFitToViewport?: () => void;
  /** Optional. ⌘1/Ctrl+1 → 100% scale. preventDefault only when provided so
   *  we don't steal the browser's "go to tab 1" before an image is loaded. */
  onSetHundredPercent?: () => void;
  /** Optional. `?` (Shift+/) → toggle the help cheatsheet. preventDefault only
   *  when provided so the browser keeps `?` for non-app contexts otherwise. */
  onShowHelp?: () => void;
  /** Optional. `C` → cycle to the next palette color. */
  onCycleColorNext?: () => void;
  /** Optional. `⇧C` → cycle to the previous palette color. */
  onCycleColorPrev?: () => void;
  /** Optional. Enter (no modifier, no shift) → confirm pending auto-arrow.
   *  preventDefault only when provided so Enter keeps its default elsewhere
   *  (e.g. button focus, form submit) when there is no pending arrow. */
  onConfirmAutoArrow?: () => void;
  /** Optional. `]` → activeFontSize + STEP / 選択中 text にも適用。
   *  preventDefault only when provided so `]` keeps its default elsewhere. */
  onIncrementFontSize?: () => void;
  /** Optional. `[` → activeFontSize - STEP / 選択中 text にも適用。 */
  onDecrementFontSize?: () => void;
}>;

// Phase 8.x extensibility review #7 M1 案 B: declare the tool→key direction
// as `Record<Tool, string>` so adding a new `Tool` becomes a typecheck
// failure here (forces the implementer to choose a key). Lookup by key
// goes through `TOOL_BY_KEY`, an inverse `Map` derived from the same
// source — single SSOT, no manual sync.
const TOOL_KEYS: Readonly<Record<Tool, string>> = {
  select: 'v',
  rectangle: 'r',
  arrow: 'a',
  text: 't',
  highlight: 'h',
};

// Phase 8.x PR #15 self-review L2: build the inverse map by iterating
// `TOOLS` (typed `readonly Tool[]`) so `TOOL_KEYS[t]` is type-safe and we
// avoid `Object.entries`'s loss of key types. `TOOLS` lives upstream so
// that adding a new `Tool` triggers a typecheck in `TOOL_KEYS` first.
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
      // `?` (Shift+/) — toggle help. JIS/US keyboards both produce `e.key === '?'`
      // when Shift+/ is pressed. Place this before the mod-only early return so
      // a no-modifier `?` never falls through to the tool-key branch.
      if (!mod && e.key === '?') {
        const cb = ref.current.onShowHelp;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      // Enter — confirm pending auto-arrow (Phase 7.8-2). text 編集中は textarea が
      // stopPropagation するためここに届かない。pending != null のときだけ
      // EditorShell が provide する経路で発火し、それ以外は browser default の
      // Enter (ボタン focus 等) を温存。Shift+Enter / Cmd+Enter は除外。
      if (!mod && e.key === 'Enter' && !e.shiftKey) {
        const cb = ref.current.onConfirmAutoArrow;
        if (cb) {
          e.preventDefault();
          cb();
        }
        return;
      }
      // `C` / `⇧C` — palette cycle. Shift reverses direction. `c` is reserved
      // exclusively for color cycling (intentionally not in TOOL_KEY_MAP).
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
