import { Stage, Layer, Image as KonvaImage, Rect as KonvaRect } from 'react-konva';
import useImage from 'use-image';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Rect } from '../../lib/rect';

const ACCENT_FILL = 'rgba(99, 102, 241, 0.20)';
const ACCENT_STROKE = 'rgba(99, 102, 241, 0.95)';
const SELECTED_STROKE_WIDTH = 3;
const DEFAULT_STROKE_WIDTH = 2;

type SpikeStageProps = Readonly<{
  imageSrc: string;
  width: number;
  height: number;
  rects: ReadonlyArray<Rect>;
  selectedId: string | null;
  onStageClick: (e: KonvaEventObject<MouseEvent>) => void;
  onRectDragEnd: (id: string, x: number, y: number) => void;
  onRectClick: (id: string) => void;
}>;

export const SpikeStage = ({
  imageSrc,
  width,
  height,
  rects,
  selectedId,
  onStageClick,
  onRectDragEnd,
  onRectClick,
}: SpikeStageProps) => {
  const [image] = useImage(imageSrc);

  return (
    <Stage width={width} height={height} onClick={onStageClick}>
      <Layer>
        {image && <KonvaImage image={image} />}
        {rects.map((r) => (
          <KonvaRect
            key={r.id}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={ACCENT_FILL}
            stroke={ACCENT_STROKE}
            strokeWidth={selectedId === r.id ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH}
            draggable
            onClick={(e) => {
              e.cancelBubble = true;
              onRectClick(r.id);
            }}
            onDragEnd={(e) => onRectDragEnd(r.id, e.target.x(), e.target.y())}
          />
        ))}
      </Layer>
    </Stage>
  );
};
