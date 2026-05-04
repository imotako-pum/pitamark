import { useLayoutEffect, useState } from 'react';

type StageSize = Readonly<{
  width: number;
  height: number;
}>;

const measureViewport = (): StageSize =>
  typeof window !== 'undefined'
    ? { width: window.innerWidth, height: window.innerHeight }
    : { width: 0, height: 0 };

/**
 * Track the viewport size for Konva's logical stage dimensions.
 *
 * Phase 8.x perf review #10 M2: previously this hook listened to
 * `window.resize`. EditorShell also listened to `window.resize` separately
 * for `stageRect`, so a single resize triggered two React re-renders.
 * Switching to ResizeObserver on `document.documentElement` (which always
 * mirrors the viewport) collapses the registration into a single
 * observation source. EditorShell's `stageRect` observer now watches the
 * stage container directly, so the two concerns never share a listener.
 */
export const useStageSize = (): StageSize => {
  const [size, setSize] = useState<StageSize>(measureViewport);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () => setSize(measureViewport());
    measure();
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    observer.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return size;
};
