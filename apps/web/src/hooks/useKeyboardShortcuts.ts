import { useEffect, useRef } from 'react';
import type { Tool } from './annotationsReducer';

export type KeyboardShortcuts = Readonly<{
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSetTool: (tool: Tool) => void;
  onEscape: () => void;
}>;

const TOOL_KEY_MAP: Readonly<Record<string, Tool>> = {
  v: 'select',
  r: 'rectangle',
  a: 'arrow',
  t: 'text',
  h: 'highlight',
};

const isEditableTarget = (target: EventTarget | null): boolean => {
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
