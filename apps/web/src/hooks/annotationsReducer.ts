import { ANNOTATION_TYPES, type Annotation, type Point } from '@pitamark/shared';
import { DEFAULT_FONT_SIZE, DEFAULT_SYNC_COLOR } from '../components/canvas/colors';
import {
  addAnnotation,
  moveAnnotation,
  removeAnnotation,
  reorderAnnotation,
  resizeHighlight,
  resizeRectangle,
  setArrowEndpoints,
  setColor,
  setFontSize,
  setText,
} from '../domain/annotation/operations';

// SSOT の `ANNOTATION_TYPES` から派生させ、annotation 種別追加が自動で `Tool` に流れる。
// 'select' は annotation 対応がない head 固定 — index 0 = 'select' を前提にする callsite がある。
export const TOOLS = ['select', ...ANNOTATION_TYPES] as const;
export type Tool = (typeof TOOLS)[number];

export type AnnotationsState = Readonly<{
  annotations: ReadonlyArray<Annotation>;
  selectedId: string | null;
  tool: Tool;
  // 全 annotation 種別で共有する active color。sync/highlight でレーン分離していた頃は
  // tool 切替で swatch ring が別色に飛ぶ不具合があったため 1 SSOT に collapse。
  activeColor: string;
  // 新規 text annotation の active font size。activeColor と同じ SSOT 構造で、
  // Toolbar A-/A+ や `[`/`]` の更新先 / Auto-next 系の参照先を 1 箇所に集約する。
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
  | { type: 'annotation/set-font-size'; id: string; fontSize: number }
  // Phase 10.J-2: 長押し menu の「前面へ」「背面へ」項目で発火。createdAt を更新して
  // yjs-codec の sort 経由で render 順を変える (案 B、Open Question Q1)。
  | { type: 'annotation/reorder'; id: string; direction: 'front' | 'back' };

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
      // `setFontSize` の no-op (非 text / 未知 id) 時は state 参照も同一に保つ。
      // 新 wrapper を返すと historyReducer が空の undo step を積んでしまう。
      const nextAnnotations = setFontSize(state.annotations, action.id, action.fontSize);
      if (nextAnnotations === state.annotations) return state;
      return { ...state, annotations: nextAnnotations };
    }
    case 'annotation/reorder': {
      // `reorderAnnotation` は既に最端 / 未知 id / 1 件以下で同一参照を返すため、
      // setFontSize と同じ no-op 抑止 pattern で undo に空 step を積まない。
      const nextAnnotations = reorderAnnotation(state.annotations, action.id, action.direction);
      if (nextAnnotations === state.annotations) return state;
      return { ...state, annotations: nextAnnotations };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
};

// switch + `const _: never` で網羅性をコンパイル時に enforce。
// 新 action 追加時に committing / UI-only の判断を必ず明示する構造で、
// 配列ベース `includes` 時代の「足し忘れて undo に積まれない」事故を防ぐ。
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
    case 'annotation/reorder':
      return true;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return false;
    }
  }
};
