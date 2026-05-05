import { type Annotation, AnnotationSchema } from '@pitamark/shared';
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
      m.set('color', annotation.color);
      m.set('strokeWidth', annotation.strokeWidth);
      break;
    case 'arrow':
      // Flat 4 fields: nesting Y.Map inside Y.Map complicates observeDeep.
      m.set('fromX', annotation.from.x);
      m.set('fromY', annotation.from.y);
      m.set('toX', annotation.to.x);
      m.set('toY', annotation.to.y);
      m.set('color', annotation.color);
      m.set('strokeWidth', annotation.strokeWidth);
      break;
    case 'text':
      m.set('x', annotation.x);
      m.set('y', annotation.y);
      m.set('text', annotation.text);
      m.set('fontSize', annotation.fontSize);
      m.set('color', annotation.color);
      break;
    case 'highlight':
      m.set('x', annotation.x);
      m.set('y', annotation.y);
      m.set('width', annotation.width);
      m.set('height', annotation.height);
      m.set('color', annotation.color);
      break;
    default: {
      const _exhaustive: never = annotation;
      return _exhaustive;
    }
  }
  return m;
};

// Phase 8.x extensibility review #7 M1 案 A: switch + `const _: never` で
// 網羅性をコンパイル時に enforce。新しい annotation 種を `Annotation` union
// に追加した瞬間、ここで switch case 漏れがエラーになるので「忘れたら気付か
// ない場所」が消える。runtime safeParse は引き続き Yjs migration safety net
// として残す (外部ピアからの malformed sync を弾く)。
export const yMapToAnnotation = (m: Y.Map<unknown>): Annotation | null => {
  const rawType = m.get('type');
  if (typeof rawType !== 'string') return null;
  const type = rawType as Annotation['type'];
  let candidate: unknown;
  switch (type) {
    case 'arrow':
      candidate = {
        id: m.get('id'),
        type: 'arrow',
        createdAt: m.get('createdAt'),
        from: { x: m.get('fromX'), y: m.get('fromY') },
        to: { x: m.get('toX'), y: m.get('toY') },
        color: m.get('color'),
        strokeWidth: m.get('strokeWidth'),
      };
      break;
    case 'rectangle':
      candidate = {
        id: m.get('id'),
        type: 'rectangle',
        createdAt: m.get('createdAt'),
        x: m.get('x'),
        y: m.get('y'),
        width: m.get('width'),
        height: m.get('height'),
        color: m.get('color'),
        strokeWidth: m.get('strokeWidth'),
      };
      break;
    case 'text':
      candidate = {
        id: m.get('id'),
        type: 'text',
        createdAt: m.get('createdAt'),
        x: m.get('x'),
        y: m.get('y'),
        text: m.get('text'),
        fontSize: m.get('fontSize'),
        color: m.get('color'),
      };
      break;
    case 'highlight':
      candidate = {
        id: m.get('id'),
        type: 'highlight',
        createdAt: m.get('createdAt'),
        x: m.get('x'),
        y: m.get('y'),
        width: m.get('width'),
        height: m.get('height'),
        color: m.get('color'),
      };
      break;
    default: {
      // Unknown stringly-typed kind — ignore. Same lenient fallback as the
      // pre-switch `else { return null }` to keep room for migrations from
      // an old peer pushing a future annotation type. Compile-time
      // exhaustiveness is enforced by the assignment to `never` below.
      const _exhaustive: never = type;
      void _exhaustive;
      return null;
    }
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
