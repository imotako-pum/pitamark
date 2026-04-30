import { useCallback } from 'react';
import {
  type AnnotationsAction,
  type AnnotationsState,
  annotationsReducer,
  initialAnnotationsState,
  isCommittingAction,
} from './annotationsReducer';
import { useHistory } from './useHistory';

export type AnnotationsStore = Readonly<{
  state: AnnotationsState;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (action: AnnotationsAction) => void;
  replace: (action: AnnotationsAction) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}>;

export const useAnnotationsStore = (): AnnotationsStore => {
  const history = useHistory<AnnotationsState>(initialAnnotationsState);
  const { state, commit, replace: setPresent, undo, redo, reset } = history;

  const dispatch = useCallback(
    (action: AnnotationsAction) => {
      const next = annotationsReducer(state, action);
      if (next === state) return;
      if (isCommittingAction(action)) {
        commit(next);
      } else {
        setPresent(next);
      }
    },
    [state, commit, setPresent],
  );

  const replace = useCallback(
    (action: AnnotationsAction) => {
      const next = annotationsReducer(state, action);
      if (next !== state) {
        setPresent(next);
      }
    },
    [state, setPresent],
  );

  const handleReset = useCallback(() => {
    reset(initialAnnotationsState);
  }, [reset]);

  return {
    state,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    dispatch,
    replace,
    undo,
    redo,
    reset: handleReset,
  };
};
