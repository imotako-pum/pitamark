import type { Annotation, Point } from '@snap-share/shared';
import { DEFAULT_HIGHLIGHT_COLOR, DEFAULT_SYNC_COLOR } from '../components/canvas/colors';
import {
  addAnnotation,
  moveAnnotation,
  removeAnnotation,
  resizeHighlight,
  resizeRectangle,
  setArrowEndpoints,
  setColor,
  setText,
} from '../domain/annotation/operations';

export const TOOLS = ['select', 'rectangle', 'arrow', 'text', 'highlight'] as const;
export type Tool = (typeof TOOLS)[number];

// `sync` is shared by rectangle / arrow / text. `highlight` is independent
// because highlight color carries semantic meaning (semi-transparent marker)
// and changing it together with stroke colors would be confusing.
export type DefaultColors = Readonly<{ sync: string; highlight: string }>;

export type AnnotationsState = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  selectedId: string | null;
  tool: Tool;
  defaultColors: DefaultColors;
}>;

export type AnnotationsAction =
  | { type: 'tool/set'; tool: Tool }
  | { type: 'select/set'; id: string | null }
  | { type: 'default-color/set-sync'; color: string }
  | { type: 'default-color/set-highlight'; color: string }
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
  | { type: 'annotation/set-text'; id: string; text: string }
  | { type: 'annotation/set-color'; id: string; color: string };

export const initialAnnotationsState: AnnotationsState = {
  annotations: [],
  selectedId: null,
  tool: 'select',
  defaultColors: {
    sync: DEFAULT_SYNC_COLOR,
    highlight: DEFAULT_HIGHLIGHT_COLOR,
  },
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
    case 'default-color/set-sync':
      return {
        ...state,
        defaultColors: { ...state.defaultColors, sync: action.color },
      };
    case 'default-color/set-highlight':
      return {
        ...state,
        defaultColors: { ...state.defaultColors, highlight: action.color },
      };
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
    case 'annotation/set-color':
      return {
        ...state,
        annotations: setColor(state.annotations, action.id, action.color),
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
  'annotation/set-color',
];

export const isCommittingAction = (action: AnnotationsAction): boolean =>
  (COMMITTING_ACTIONS as ReadonlyArray<string>).includes(action.type);
