import { useState, useRef, useEffect, useCallback } from 'react';
import type { DragEvent } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { SpikeStage } from './components/spike-stage/SpikeStage';
import type { Rect } from './lib/rect';
import { addRect, moveRect, removeRect } from './lib/rect';

const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_RECT_W = 120;
const DEFAULT_RECT_H = 80;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const useStageSize = () => {
  const [size, setSize] = useState(() => ({
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

export const App = () => {
  const { width, height } = useStageSize();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rects, setRects] = useState<ReadonlyArray<Rect>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);
    const file = e.dataTransfer.files[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      console.error('[spike:konva] non-image file dropped', { type: file.type });
      setError('画像ファイルをドロップしてください (PNG / JPEG / SVG)。');
      return;
    }
    if (file.size > MAX_BYTES) {
      console.warn('[spike:konva] oversized image', { bytes: file.size });
      setError('10MB を超える画像はスパイクの対象外です。');
      return;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageSrc(url);
    setRects([]);
    setSelectedId(null);
    console.info('[spike:konva] image loaded', { type: file.type, bytes: file.size });
  };

  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) {
      return;
    }
    if (e.target !== stage) {
      return;
    }
    const pos = stage.getPointerPosition();
    if (!pos) {
      return;
    }
    const r: Rect = {
      id: generateId(),
      x: pos.x - DEFAULT_RECT_W / 2,
      y: pos.y - DEFAULT_RECT_H / 2,
      w: DEFAULT_RECT_W,
      h: DEFAULT_RECT_H,
    };
    setRects((prev) => addRect(prev, r));
    setSelectedId(r.id);
  }, []);

  const handleRectDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      setRects((prev) => {
        const target = prev.find((r) => r.id === id);
        if (!target) {
          return prev;
        }
        return moveRect(prev, id, x - target.x, y - target.y);
      });
    },
    [],
  );

  const handleRectClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setRects((prev) => removeRect(prev, selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  return (
    <div className="spike-root" onDragOver={handleDragOver} onDrop={handleDrop}>
      {!imageSrc && (
        <div className="spike-hint">
          <h1>Spike A — Konva Canvas</h1>
          <p>画像をこの領域にドラッグ&amp;ドロップしてください</p>
          <p className="spike-hint-small">クリックで矩形追加 / ドラッグで移動 / Delete で削除</p>
        </div>
      )}
      {error && <div className="spike-error" role="alert">{error}</div>}
      {imageSrc && (
        <SpikeStage
          imageSrc={imageSrc}
          width={width}
          height={height}
          rects={rects}
          selectedId={selectedId}
          onStageClick={handleStageClick}
          onRectClick={handleRectClick}
          onRectDragEnd={handleRectDragEnd}
        />
      )}
    </div>
  );
};
