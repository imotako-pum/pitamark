import type { Annotation, UserPresence } from '@snap-share/shared';
import type Konva from 'konva';
import { forwardRef, type JSX } from 'react';
import { Group, Layer, Line, Rect, Text } from 'react-konva';

type Props = Readonly<{
  others: ReadonlyArray<UserPresence>;
  annotations: ReadonlyArray<Annotation>;
}>;

// Triangle path for the cursor pointer (top-left anchored).
const CURSOR_TRIANGLE: ReadonlyArray<number> = [0, 0, 0, 16, 4, 12, 12, 12];

const findTarget = (
  annotations: ReadonlyArray<Annotation>,
  selectedId: string | null,
): Annotation | null => {
  if (!selectedId) return null;
  return annotations.find((a) => a.id === selectedId) ?? null;
};

const renderSelectionRect = (target: Annotation, key: string, color: string) => {
  if (target.type === 'arrow' || target.type === 'text') return null;
  return (
    <Rect
      key={key}
      x={target.x - 2}
      y={target.y - 2}
      width={target.width + 4}
      height={target.height + 4}
      stroke={color}
      strokeWidth={1}
      dash={[4, 4]}
    />
  );
};

export const AwarenessLayer = forwardRef<Konva.Layer, Props>(({ others, annotations }, ref) => (
  <Layer ref={ref} listening={false}>
    {others.flatMap((u) => {
      const items: Array<JSX.Element> = [];
      if (u.cursor) {
        items.push(
          <Group key={`${u.userId}-cursor`} x={u.cursor.x} y={u.cursor.y}>
            <Line points={[...CURSOR_TRIANGLE]} closed fill={u.color} />
            <Text x={14} y={2} text={u.displayName} fontSize={12} fill={u.color} />
          </Group>,
        );
      }
      const target = findTarget(annotations, u.selectedId);
      if (target) {
        const sel = renderSelectionRect(target, `${u.userId}-sel`, u.color);
        if (sel) items.push(sel);
      }
      return items;
    })}
  </Layer>
));

AwarenessLayer.displayName = 'AwarenessLayer';
