import { ANNOTATION_TYPES, type Annotation, type Point } from '@snap-share/shared';
import { DEFAULT_FONT_SIZE, DEFAULT_SYNC_COLOR } from '../components/canvas/colors';
import {
  addAnnotation,
  moveAnnotation,
  removeAnnotation,
  resizeHighlight,
  resizeRectangle,
  setArrowEndpoints,
  setColor,
  setFontSize,
  setText,
} from '../domain/annotation/operations';

// Phase 8.x extensibility review #7 L4: derive the editor's tool set from
// `ANNOTATION_TYPES` (in `packages/shared`) so adding a new annotation kind
// to the SSOT automatically flows into `Tool`. `'select'` stays at the head
// because it has no annotation counterpart and several call sites depend on
// it being position 0.
export const TOOLS = ['select', ...ANNOTATION_TYPES] as const;
export type Tool = (typeof TOOLS)[number];

export type AnnotationsState = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  selectedId: string | null;
  tool: Tool;
  // Single active color shared across all annotation types. Picking a swatch
  // updates this; subsequent draws use it regardless of tool. The previous
  // sync/highlight lane separation produced an indicator discontinuity when
  // switching tools (the swatch ring jumped to a different color), so we
  // collapsed it to one source of truth.
  activeColor: string;
  // Single active font size for new text annotations. Mirrors activeColor's
  // SSOT model — Toolbar A-/A+ and `[`/`]` shortcut update this; subsequent
  // text creation (manual + Auto-next-A + Auto-next-B) reads from this.
  activeFontSize: number;
}>;

export type AnnotationsAction =
  | { type: 'tool/set'; tool: Tool }
  | { type: 'select/set'; id: string | null }
  | { type: 'active-color/set'; color: string }
  | { type: 'active-font-size/set'; fontSize: number }
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
  | { type: 'annotation/set-color'; id: string; color: string }
  | { type: 'annotation/set-font-size'; id: string; fontSize: number };

export const initialAnnotationsState: AnnotationsState = {
  annotations: [],
  selectedId: null,
  tool: 'select',
  activeColor: DEFAULT_SYNC_COLOR,
  activeFontSize: DEFAULT_FONT_SIZE,
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
    case 'active-color/set':
      return { ...state, activeColor: action.color };
    case 'active-font-size/set':
      return { ...state, activeFontSize: action.fontSize };
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
    case 'annotation/set-font-size': {
      // Phase 8.x tests review #8 M2: when `setFontSize` returns the same
      // array reference (no-op for non-text or unknown id), preserve the
      // outer state identity too. Without this, `historyReducer` sees a
      // freshly-allocated wrapper and appends an empty undo step — Phase
      // 7.8-3 already gated this from the handler side; this is the
      // belt-and-suspenders reducer-level guarantee.
      const nextAnnotations = setFontSize(state.annotations, action.id, action.fontSize);
      if (nextAnnotations === state.annotations) return state;
      return { ...state, annotations: nextAnnotations };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
};

// Phase 8.x extensibility review #7 M1 案 C: switch + `const _: never` で
// 網羅性をコンパイル時に enforce。新 action variant を追加した瞬間に
// 「committing にするか UI-only か」をここで明示する必要が出るので、
// 配列ベース `includes` 時代の「足し忘れて undo に積まれない」事故が
// 発生しなくなる。
export const isCommittingAction = (action: AnnotationsAction): boolean => {
  switch (action.type) {
    case 'tool/set':
    case 'select/set':
    case 'active-color/set':
    case 'active-font-size/set':
      return false;
    case 'annotation/add':
    case 'annotation/remove':
    case 'annotation/move':
    case 'annotation/resize-rect':
    case 'annotation/resize-highlight':
    case 'annotation/set-arrow-endpoints':
    case 'annotation/set-text':
    case 'annotation/set-color':
    case 'annotation/set-font-size':
      return true;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return false;
    }
  }
};
