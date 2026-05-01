import { useEffect, useState } from 'react';

type StageSize = Readonly<{
  width: number;
  height: number;
}>;

export const useStageSize = (): StageSize => {
  const [size, setSize] = useState<StageSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
};
