import { useEffect, useRef } from 'react';
import type { Tool } from './annotationsReducer';

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
}>;

const TOOL_KEY_MAP: Readonly<Record<string, Tool>> = {
  v: 'select',
  r: 'rectangle',
  a: 'arrow',
  t: 'text',
  h: 'highlight',
};

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
      if (mod) return;

      const tool = TOOL_KEY_MAP[key];
      if (tool) {
        ref.current.onSetTool(tool);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
