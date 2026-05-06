import { useCallback, useReducer } from 'react';
import {
  type AnnotationsAction,
  type AnnotationsState,
  annotationsReducer,
  initialAnnotationsState,
  isCommittingAction,
} from './annotationsReducer';
import { createHistoryState, type HistoryState, historyReducer } from './historyReducer';

export type AnnotationsStore = Readonly<{
  state: AnnotationsState;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (action: AnnotationsAction) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  /**
   * 同 React event 内で連続する複数の committing dispatch を、意図的に独立した undo step
   * に分割するための break point。room モードの Yjs UndoManager は default
   * captureTimeout=500ms で同 origin の連続操作を 1 step に merge するため、Auto-next-A
   * の「矢印 add → text add」を別 step にしたい場合に間で呼ぶ。local モードの
   * historyReducer は元から commit ごとに別 step なので no-op。
   */
  stopUndoCapture: () => void;
}>;

type StoreAction =
  | { type: 'annotation'; action: AnnotationsAction }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' };

const storeReducer = (
  state: HistoryState<AnnotationsState>,
  action: StoreAction,
): HistoryState<AnnotationsState> => {
  if (action.type === 'undo') return historyReducer(state, { type: 'undo' });
  if (action.type === 'redo') return historyReducer(state, { type: 'redo' });
  if (action.type === 'reset')
    return historyReducer(state, { type: 'reset', value: initialAnnotationsState });

  const next = annotationsReducer(state.present, action.action);
  if (next === state.present) return state;
  if (isCommittingAction(action.action)) {
    return historyReducer(state, { type: 'commit', value: next });
  }
  return historyReducer(state, { type: 'replace', value: next });
};

export const useAnnotationsStore = (): AnnotationsStore => {
  const [history, dispatch] = useReducer(storeReducer, initialAnnotationsState, createHistoryState);

  const dispatchAnnotation = useCallback(
    (action: AnnotationsAction) => dispatch({ type: 'annotation', action }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return {
    state: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dispatch: dispatchAnnotation,
    undo,
    redo,
    reset,
    // local モードは historyReducer が commit ごとに別 step として past に積むため
    // step 分離は元から達成されている。no-op で AnnotationsStore 型を満たす。
    stopUndoCapture: noopStopUndoCapture,
  };
};

const noopStopUndoCapture = (): void => {};
