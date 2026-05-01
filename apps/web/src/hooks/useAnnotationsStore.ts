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
  };
};
