import { z } from 'zod';

export const ANNOTATION_TYPES = ['rectangle', 'arrow', 'text', 'highlight'] as const;
export type AnnotationKind = (typeof ANNOTATION_TYPES)[number];

export const MAX_ANNOTATIONS_PER_ROOM = 200;
export const MAX_TEXT_LENGTH = 500;
export const MAX_FONT_SIZE = 200;
export const MAX_STROKE_WIDTH = 20;
export const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const ColorSchema = z.string().regex(COLOR_REGEX);

export const PointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .readonly();
export type Point = z.infer<typeof PointSchema>;

const baseFields = {
  id: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
};

export const RectangleAnnotationSchema = z
  .object({
    ...baseFields,
    type: z.literal('rectangle'),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
    stroke: ColorSchema,
    strokeWidth: z.number().positive().max(MAX_STROKE_WIDTH),
  })
  .readonly();
export type RectangleAnnotation = z.infer<typeof RectangleAnnotationSchema>;

export const ArrowAnnotationSchema = z
  .object({
    ...baseFields,
    type: z.literal('arrow'),
    from: PointSchema,
    to: PointSchema,
    stroke: ColorSchema,
    strokeWidth: z.number().positive().max(MAX_STROKE_WIDTH),
  })
  .readonly();
export type ArrowAnnotation = z.infer<typeof ArrowAnnotationSchema>;

export const TextAnnotationSchema = z
  .object({
    ...baseFields,
    type: z.literal('text'),
    x: z.number().finite(),
    y: z.number().finite(),
    text: z.string().max(MAX_TEXT_LENGTH),
    fontSize: z.number().positive().max(MAX_FONT_SIZE),
    fill: ColorSchema,
  })
  .readonly();
export type TextAnnotation = z.infer<typeof TextAnnotationSchema>;

export const HighlightAnnotationSchema = z
  .object({
    ...baseFields,
    type: z.literal('highlight'),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
    fill: ColorSchema,
  })
  .readonly();
export type HighlightAnnotation = z.infer<typeof HighlightAnnotationSchema>;

export const AnnotationSchema = z.discriminatedUnion('type', [
  RectangleAnnotationSchema,
  ArrowAnnotationSchema,
  TextAnnotationSchema,
  HighlightAnnotationSchema,
]);
export type Annotation = z.infer<typeof AnnotationSchema>;
