import { useEffect, useState } from 'react';

// `(pointer: coarse)` は CSS Media Query Level 4 仕様。最も精度の低い入力ポインタが
// 「coarse」 (= 指 / スタイラス) のとき true。デスクトップマウスは `pointer: fine`。
// Konva canvas は CSS variable / media query を resolve しないため、JS 経由で参照して
// React state に持ち、shape 単位で adaptive な hit area / handle サイズを描画する。
const QUERY = '(pointer: coarse)';

/**
 * Returns whether the current device is a touch (coarse-pointer) device.
 *
 * SSR / hydration safety: 初回 render は `false` を返す (window アクセスなし)。
 * useEffect の中で実値を同期し、変化を `change` event で reactive 反映する。
 *
 * 詳細は docs/adr/ADR-0006-pointer-events-unification.md / Phase 10.I PRD。
 */
export const useTouchDevice = (): boolean => {
  const [isTouch, setIsTouch] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    setIsTouch(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isTouch;
};
