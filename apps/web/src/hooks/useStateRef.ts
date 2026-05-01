import { useCallback, useRef, useState } from 'react';

/**
 * `useState` whose latest value is also accessible via a ref. Closures that
 * are constructed once (e.g. the `dispatch` returned from `useCallback([])`)
 * can read the up-to-date value through `ref.current` instead of capturing
 * the value at render time. Mirrors the `useRef` pattern used in
 * `apps/web/src/components/canvas/CanvasStage.tsx` for drag-time state.
 */
export const useStateRef = <T>(
  initial: T,
): readonly [T, (next: T) => void, { readonly current: T }] => {
  const [value, setValue] = useState<T>(initial);
  const ref = useRef<T>(initial);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, set, ref] as const;
};
