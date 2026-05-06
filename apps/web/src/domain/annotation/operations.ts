import type { Annotation, Point } from '@pitamark/shared';

export const addAnnotation = (
  annotations: ReadonlyArray<Annotation>,
  annotation: Annotation,
): ReadonlyArray<Annotation> => [...annotations, annotation];

export const removeAnnotation = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
): ReadonlyArray<Annotation> => annotations.filter((a) => a.id !== id);

export const moveAnnotation = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  dx: number,
  dy: number,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => {
    if (a.id !== id) {
      return a;
    }
    switch (a.type) {
      case 'rectangle':
        return { ...a, x: a.x + dx, y: a.y + dy };
      case 'highlight':
        return { ...a, x: a.x + dx, y: a.y + dy };
      case 'text':
        return { ...a, x: a.x + dx, y: a.y + dy };
      case 'arrow':
        return {
          ...a,
          from: { x: a.from.x + dx, y: a.from.y + dy },
          to: { x: a.to.x + dx, y: a.to.y + dy },
        };
      default: {
        const _exhaustive: never = a;
        return _exhaustive;
      }
    }
  });

export const resizeRectangle = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ReadonlyArray<Annotation> =>
  annotations.map((a) =>
    a.id === id && a.type === 'rectangle' ? { ...a, x, y, width, height } : a,
  );

export const resizeHighlight = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ReadonlyArray<Annotation> =>
  annotations.map((a) =>
    a.id === id && a.type === 'highlight' ? { ...a, x, y, width, height } : a,
  );

export const setArrowEndpoints = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  from: Point,
  to: Point,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => (a.id === id && a.type === 'arrow' ? { ...a, from, to } : a));

export const setText = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  text: string,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => (a.id === id && a.type === 'text' ? { ...a, text } : a));

// text 専用の fontSize 更新。fontSize は TextAnnotation のみ持つフィールドのため、
// setText と同じ形で type guard を使い text 以外は no-op にする。id が match しない
// (非 text / 未知) ときは入力配列をそのまま返し、reducer が reference equality で
// 空 undo step を抑制できる契約を保つ。
export const setFontSize = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  fontSize: number,
): ReadonlyArray<Annotation> => {
  const target = annotations.find((a) => a.id === id && a.type === 'text');
  if (!target) return annotations;
  return annotations.map((a) => (a === target ? { ...a, fontSize } : a));
};

// 4 種類の annotation が同じ `color` field を共有する。型別に setter を分ける必要が
// あったのは、rectangle/arrow が `stroke` を、text/highlight が `fill` を使っていた頃
// だけ。今は 1 setter / 1 Yjs mutation / 1 reducer action に集約。
export const setColor = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  color: string,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => {
    if (a.id !== id) return a;
    switch (a.type) {
      case 'rectangle':
        return { ...a, color };
      case 'arrow':
        return { ...a, color };
      case 'text':
        return { ...a, color };
      case 'highlight':
        return { ...a, color };
      default: {
        const _exhaustive: never = a;
        return _exhaustive;
      }
    }
  });
