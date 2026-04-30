import { useCallback, useMemo, useReducer } from 'react';
import { createHistoryState, historyReducer } from './historyReducer';

export type HistoryControls<T> = Readonly<{
  state: T;
  canUndo: boolean;
  canRedo: boolean;
  commit: (next: T) => void;
  replace: (next: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (initial: T) => void;
}>;

export const useHistory = <T>(initial: T): HistoryControls<T> => {
  const [history, dispatch] = useReducer(historyReducer<T>, initial, createHistoryState);

  const commit = useCallback((value: T) => dispatch({ type: 'commit', value }), []);
  const replace = useCallback((value: T) => dispatch({ type: 'replace', value }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), []);

  return useMemo(
    () => ({
      state: history.present,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      commit,
      replace,
      undo,
      redo,
      reset,
    }),
    [history, commit, replace, undo, redo, reset],
  );
};
