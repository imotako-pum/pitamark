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
 * Konva の logical stage 寸法用に viewport size を追跡する。
 * `document.documentElement` (常に viewport を反映) に対する ResizeObserver で
 * 1 つの観測源にまとめている。EditorShell の `stageRect` 観測は stage container を
 * 直接見ているので、`window.resize` を共有して二重再レンダーになる経路は避けてある。
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
