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

// Phase 10.J-2: 既存 annotation を offset 付きで複製する。新 id + 新 createdAt を採番、
// 表示順 (= createdAt 昇順、yjs-codec.ts:130 の sort) が「複製は元の手前」になるように
// 元の createdAt より大きい値を割り当てる。座標は (16, 16) px ずらして元と完全重ならない
// ようにする。drag や resize と独立した純粋関数で、副作用なし。
const DUPLICATE_OFFSET_PX = 16;

export const cloneAnnotationWithOffset = (
  source: Annotation,
  newId: string,
  newCreatedAt: number,
): Annotation => {
  switch (source.type) {
    case 'rectangle':
      return {
        ...source,
        id: newId,
        createdAt: newCreatedAt,
        x: source.x + DUPLICATE_OFFSET_PX,
        y: source.y + DUPLICATE_OFFSET_PX,
      };
    case 'highlight':
      return {
        ...source,
        id: newId,
        createdAt: newCreatedAt,
        x: source.x + DUPLICATE_OFFSET_PX,
        y: source.y + DUPLICATE_OFFSET_PX,
      };
    case 'text':
      return {
        ...source,
        id: newId,
        createdAt: newCreatedAt,
        x: source.x + DUPLICATE_OFFSET_PX,
        y: source.y + DUPLICATE_OFFSET_PX,
      };
    case 'arrow':
      return {
        ...source,
        id: newId,
        createdAt: newCreatedAt,
        from: { x: source.from.x + DUPLICATE_OFFSET_PX, y: source.from.y + DUPLICATE_OFFSET_PX },
        to: { x: source.to.x + DUPLICATE_OFFSET_PX, y: source.to.y + DUPLICATE_OFFSET_PX },
      };
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
};

// Phase 10.J-2: 表示順 (= createdAt 昇順) を更新して z-order を変更する。前面 = 既存
// 最大 createdAt + 1、背面 = 既存最小 createdAt - 1。schema を変えずに済むのは
// yjs-codec.ts:130 の sort が既に createdAt を render order key として使っているため。
// 対象 id が見つからないか、すでに端 (front は max、back は min) に居て変更不要なら
// 同一参照を返し、reducer が reference equality で空 undo step を抑止できる契約を維持。
export const reorderAnnotation = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  direction: 'front' | 'back',
): ReadonlyArray<Annotation> => {
  const target = annotations.find((a) => a.id === id);
  if (!target) return annotations;
  if (annotations.length <= 1) return annotations;
  if (direction === 'front') {
    const maxCreatedAt = annotations.reduce(
      (m, a) => (a.createdAt > m ? a.createdAt : m),
      -Infinity,
    );
    if (target.createdAt >= maxCreatedAt) return annotations;
    const next = maxCreatedAt + 1;
    return annotations.map((a) => (a === target ? { ...a, createdAt: next } : a));
  }
  const minCreatedAt = annotations.reduce((m, a) => (a.createdAt < m ? a.createdAt : m), Infinity);
  if (target.createdAt <= minCreatedAt) return annotations;
  const next = minCreatedAt - 1;
  return annotations.map((a) => (a === target ? { ...a, createdAt: next } : a));
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
