import { type Annotation, AnnotationSchema } from '@snap-share/shared';
import * as Y from 'yjs';

export const annotationToYMap = (annotation: Annotation): Y.Map<unknown> => {
  const m = new Y.Map<unknown>();
  m.set('id', annotation.id);
  m.set('type', annotation.type);
  m.set('createdAt', annotation.createdAt);
  switch (annotation.type) {
    case 'rectangle':
      m.set('x', annotation.x);
      m.set('y', annotation.y);
      m.set('width', annotation.width);
      m.set('height', annotation.height);
      m.set('stroke', annotation.stroke);
      m.set('strokeWidth', annotation.strokeWidth);
      break;
    case 'arrow':
      // Flat 4 fields: nesting Y.Map inside Y.Map complicates observeDeep.
      m.set('fromX', annotation.from.x);
      m.set('fromY', annotation.from.y);
      m.set('toX', annotation.to.x);
      m.set('toY', annotation.to.y);
      m.set('stroke', annotation.stroke);
      m.set('strokeWidth', annotation.strokeWidth);
      break;
    case 'text':
      m.set('x', annotation.x);
      m.set('y', annotation.y);
      m.set('text', annotation.text);
      m.set('fontSize', annotation.fontSize);
      m.set('fill', annotation.fill);
      break;
    case 'highlight':
      m.set('x', annotation.x);
      m.set('y', annotation.y);
      m.set('width', annotation.width);
      m.set('height', annotation.height);
      m.set('fill', annotation.fill);
      break;
    default: {
      const _exhaustive: never = annotation;
      return _exhaustive;
    }
  }
  return m;
};

export const yMapToAnnotation = (m: Y.Map<unknown>): Annotation | null => {
  const type = m.get('type');
  let candidate: unknown;
  if (type === 'arrow') {
    candidate = {
      id: m.get('id'),
      type: 'arrow',
      createdAt: m.get('createdAt'),
      from: { x: m.get('fromX'), y: m.get('fromY') },
      to: { x: m.get('toX'), y: m.get('toY') },
      stroke: m.get('stroke'),
      strokeWidth: m.get('strokeWidth'),
    };
  } else if (type === 'rectangle') {
    candidate = {
      id: m.get('id'),
      type: 'rectangle',
      createdAt: m.get('createdAt'),
      x: m.get('x'),
      y: m.get('y'),
      width: m.get('width'),
      height: m.get('height'),
      stroke: m.get('stroke'),
      strokeWidth: m.get('strokeWidth'),
    };
  } else if (type === 'text') {
    candidate = {
      id: m.get('id'),
      type: 'text',
      createdAt: m.get('createdAt'),
      x: m.get('x'),
      y: m.get('y'),
      text: m.get('text'),
      fontSize: m.get('fontSize'),
      fill: m.get('fill'),
    };
  } else if (type === 'highlight') {
    candidate = {
      id: m.get('id'),
      type: 'highlight',
      createdAt: m.get('createdAt'),
      x: m.get('x'),
      y: m.get('y'),
      width: m.get('width'),
      height: m.get('height'),
      fill: m.get('fill'),
    };
  } else {
    return null;
  }
  const parsed = AnnotationSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
};

export const buildAnnotationsSnapshot = (
  yAnnotations: Y.Map<Y.Map<unknown>>,
): ReadonlyArray<Annotation> => {
  const result: Annotation[] = [];
  for (const yEntry of yAnnotations.values()) {
    const annotation = yMapToAnnotation(yEntry);
    if (annotation !== null) {
      result.push(annotation);
    }
  }
  result.sort((a, b) => a.createdAt - b.createdAt);
  return Object.freeze(result);
};
