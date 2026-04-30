import type { Annotation, Point } from '@snap-share/shared';

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
  width: number,
  height: number,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => (a.id === id && a.type === 'rectangle' ? { ...a, width, height } : a));

export const resizeHighlight = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  width: number,
  height: number,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => (a.id === id && a.type === 'highlight' ? { ...a, width, height } : a));

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

export const setStroke = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  stroke: string,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => {
    if (a.id !== id) {
      return a;
    }
    if (a.type === 'rectangle' || a.type === 'arrow') {
      return { ...a, stroke };
    }
    return a;
  });

export const setFill = (
  annotations: ReadonlyArray<Annotation>,
  id: string,
  fill: string,
): ReadonlyArray<Annotation> =>
  annotations.map((a) => {
    if (a.id !== id) {
      return a;
    }
    if (a.type === 'text' || a.type === 'highlight') {
      return { ...a, fill };
    }
    return a;
  });
