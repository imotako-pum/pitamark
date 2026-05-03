import type { Annotation, Point } from '@snap-share/shared';
import {
  addAnnotation,
  moveAnnotation,
  removeAnnotation,
  resizeHighlight,
  resizeRectangle,
  setArrowEndpoints,
  setText,
} from '../domain/annotation/operations';

export const TOOLS = ['select', 'rectangle', 'arrow', 'text', 'highlight'] as const;
export type Tool = (typeof TOOLS)[number];

export type AnnotationsState = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  selectedId: string | null;
  tool: Tool;
}>;

export type AnnotationsAction =
  | { type: 'tool/set'; tool: Tool }
  | { type: 'select/set'; id: string | null }
  | { type: 'annotation/add'; annotation: Annotation }
  | { type: 'annotation/remove'; id: string }
  | { type: 'annotation/move'; id: string; dx: number; dy: number }
  | {
      type: 'annotation/resize-rect';
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: 'annotation/resize-highlight';
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | { type: 'annotation/set-arrow-endpoints'; id: string; from: Point; to: Point }
  | { type: 'annotation/set-text'; id: string; text: string };

export const initialAnnotationsState: AnnotationsState = {
  annotations: [],
  selectedId: null,
  tool: 'select',
};

export const annotationsReducer = (
  state: AnnotationsState,
  action: AnnotationsAction,
): AnnotationsState => {
  switch (action.type) {
    case 'tool/set':
      return { ...state, tool: action.tool };
    case 'select/set':
      return { ...state, selectedId: action.id };
    case 'annotation/add':
      return { ...state, annotations: addAnnotation(state.annotations, action.annotation) };
    case 'annotation/remove':
      return {
        ...state,
        annotations: removeAnnotation(state.annotations, action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    case 'annotation/move':
      return {
        ...state,
        annotations: moveAnnotation(state.annotations, action.id, action.dx, action.dy),
      };
    case 'annotation/resize-rect':
      return {
        ...state,
        annotations: resizeRectangle(
          state.annotations,
          action.id,
          action.x,
          action.y,
          action.width,
          action.height,
        ),
      };
    case 'annotation/resize-highlight':
      return {
        ...state,
        annotations: resizeHighlight(
          state.annotations,
          action.id,
          action.x,
          action.y,
          action.width,
          action.height,
        ),
      };
    case 'annotation/set-arrow-endpoints':
      return {
        ...state,
        annotations: setArrowEndpoints(state.annotations, action.id, action.from, action.to),
      };
    case 'annotation/set-text':
      return {
        ...state,
        annotations: setText(state.annotations, action.id, action.text),
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
};

const COMMITTING_ACTIONS: ReadonlyArray<AnnotationsAction['type']> = [
  'annotation/add',
  'annotation/remove',
  'annotation/move',
  'annotation/resize-rect',
  'annotation/resize-highlight',
  'annotation/set-arrow-endpoints',
  'annotation/set-text',
];

export const isCommittingAction = (action: AnnotationsAction): boolean =>
  (COMMITTING_ACTIONS as ReadonlyArray<string>).includes(action.type);
