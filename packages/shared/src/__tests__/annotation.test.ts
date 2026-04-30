import { describe, expect, it } from 'vitest';
import {
  ANNOTATION_TYPES,
  type Annotation,
  AnnotationSchema,
  type ArrowAnnotation,
  ArrowAnnotationSchema,
  COLOR_REGEX,
  type HighlightAnnotation,
  HighlightAnnotationSchema,
  MAX_FONT_SIZE,
  MAX_STROKE_WIDTH,
  MAX_TEXT_LENGTH,
  type Point,
  PointSchema,
  type RectangleAnnotation,
  RectangleAnnotationSchema,
  type TextAnnotation,
  TextAnnotationSchema,
} from '../annotation';

const validRect: RectangleAnnotation = {
  id: 'a1',
  type: 'rectangle',
  createdAt: 1_714_435_200_000,
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  stroke: '#5b6dff',
  strokeWidth: 2,
};

const validArrow: ArrowAnnotation = {
  id: 'a2',
  type: 'arrow',
  createdAt: 1_714_435_200_000,
  from: { x: 0, y: 0 },
  to: { x: 100, y: 100 },
  stroke: '#ff5566',
  strokeWidth: 3,
};

const validText: TextAnnotation = {
  id: 'a3',
  type: 'text',
  createdAt: 1_714_435_200_000,
  x: 5,
  y: 6,
  text: 'こんにちは',
  fontSize: 18,
  fill: '#101010',
};

const validHighlight: HighlightAnnotation = {
  id: 'a4',
  type: 'highlight',
  createdAt: 1_714_435_200_000,
  x: 0,
  y: 0,
  width: 50,
  height: 30,
  fill: '#ffe066',
};

describe('ANNOTATION_TYPES', () => {
  it('contains exactly the four MVP types', () => {
    expect([...ANNOTATION_TYPES].sort()).toEqual(['arrow', 'highlight', 'rectangle', 'text']);
  });
});

describe('PointSchema', () => {
  it('parses a valid point', () => {
    const parsed: Point = PointSchema.parse({ x: 1.5, y: -2 });
    expect(parsed).toEqual({ x: 1.5, y: -2 });
  });

  it('rejects non-finite coordinates', () => {
    expect(() => PointSchema.parse({ x: Number.POSITIVE_INFINITY, y: 0 })).toThrow();
    expect(() => PointSchema.parse({ x: 0, y: Number.NaN })).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => PointSchema.parse({ x: 0 })).toThrow();
  });
});

describe('COLOR_REGEX', () => {
  it('accepts hex 6 with both cases', () => {
    expect(COLOR_REGEX.test('#abcdef')).toBe(true);
    expect(COLOR_REGEX.test('#ABCDEF')).toBe(true);
    expect(COLOR_REGEX.test('#012345')).toBe(true);
  });

  it('rejects shorthand hex 3', () => {
    expect(COLOR_REGEX.test('#fff')).toBe(false);
  });

  it('rejects missing hash', () => {
    expect(COLOR_REGEX.test('abcdef')).toBe(false);
  });

  it('rejects rgba functional notation', () => {
    expect(COLOR_REGEX.test('rgba(255,0,0,0.5)')).toBe(false);
  });
});

describe('RectangleAnnotationSchema', () => {
  it('parses a happy-path rectangle', () => {
    const parsed = RectangleAnnotationSchema.parse(validRect);
    expect(parsed).toEqual(validRect);
  });

  it('rejects non-positive width or height', () => {
    expect(() => RectangleAnnotationSchema.parse({ ...validRect, width: 0 })).toThrow();
    expect(() => RectangleAnnotationSchema.parse({ ...validRect, height: -1 })).toThrow();
  });

  it('rejects malformed stroke color', () => {
    expect(() => RectangleAnnotationSchema.parse({ ...validRect, stroke: '#fff' })).toThrow();
  });

  it('rejects strokeWidth above the cap', () => {
    expect(() =>
      RectangleAnnotationSchema.parse({ ...validRect, strokeWidth: MAX_STROKE_WIDTH + 0.1 }),
    ).toThrow();
  });

  it('rejects wrong discriminator', () => {
    expect(() => RectangleAnnotationSchema.parse({ ...validRect, type: 'arrow' })).toThrow();
  });
});

describe('ArrowAnnotationSchema', () => {
  it('parses a happy-path arrow', () => {
    expect(ArrowAnnotationSchema.parse(validArrow)).toEqual(validArrow);
  });

  it('rejects malformed endpoints', () => {
    expect(() =>
      ArrowAnnotationSchema.parse({ ...validArrow, from: { x: Number.NaN, y: 0 } }),
    ).toThrow();
  });
});

describe('TextAnnotationSchema', () => {
  it('parses a happy-path text annotation', () => {
    expect(TextAnnotationSchema.parse(validText)).toEqual(validText);
  });

  it('accepts an empty text body', () => {
    const parsed = TextAnnotationSchema.parse({ ...validText, text: '' });
    expect(parsed.text).toBe('');
  });

  it('rejects text longer than MAX_TEXT_LENGTH', () => {
    const tooLong = 'a'.repeat(MAX_TEXT_LENGTH + 1);
    expect(() => TextAnnotationSchema.parse({ ...validText, text: tooLong })).toThrow();
  });

  it('rejects fontSize above the cap', () => {
    expect(() =>
      TextAnnotationSchema.parse({ ...validText, fontSize: MAX_FONT_SIZE + 1 }),
    ).toThrow();
  });
});

describe('HighlightAnnotationSchema', () => {
  it('parses a happy-path highlight', () => {
    expect(HighlightAnnotationSchema.parse(validHighlight)).toEqual(validHighlight);
  });

  it('rejects non-positive size', () => {
    expect(() => HighlightAnnotationSchema.parse({ ...validHighlight, width: 0 })).toThrow();
  });
});

describe('AnnotationSchema (discriminated union)', () => {
  it('parses each kind via the union', () => {
    const cases: Annotation[] = [validRect, validArrow, validText, validHighlight];
    for (const annotation of cases) {
      const parsed = AnnotationSchema.parse(annotation);
      expect(parsed.type).toBe(annotation.type);
      expect(parsed.id).toBe(annotation.id);
    }
  });

  it('rejects an unknown discriminator', () => {
    expect(() => AnnotationSchema.parse({ ...validRect, type: 'unknown' })).toThrow();
  });

  it('narrows correctly on the type discriminator', () => {
    const parsed = AnnotationSchema.parse(validArrow);
    if (parsed.type === 'arrow') {
      // Type narrowing means `from`/`to` are accessible without a cast.
      expect(parsed.from.x).toBe(0);
      expect(parsed.to.x).toBe(100);
    } else {
      throw new Error('discriminated union narrowing failed');
    }
  });

  it('rejects when required fields are missing', () => {
    expect(() => AnnotationSchema.parse({ type: 'rectangle' })).toThrow();
  });
});
