import { useCallback, useRef, useState } from 'react';

/**
 * 値を `useState` として保持しつつ、最新値を ref からも読める hook。
 * `useCallback([])` で 1 度だけ作るような closure が、render 時点の値ではなく
 * 最新の値を `ref.current` で参照できる。CanvasStage の drag 時 state と同じ
 * `useRef` パターンを React state と組み合わせた版。
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
