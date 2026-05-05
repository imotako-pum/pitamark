export const HISTORY_LIMIT = 50;

export type HistoryState<T> = Readonly<{
  past: ReadonlyArray<T>;
  present: T;
  future: ReadonlyArray<T>;
}>;

export type HistoryAction<T> =
  | { type: 'commit'; value: T }
  | { type: 'replace'; value: T }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T };

export const createHistoryState = <T>(initial: T): HistoryState<T> => ({
  past: [],
  present: initial,
  future: [],
});

export const historyReducer = <T>(
  state: HistoryState<T>,
  action: HistoryAction<T>,
): HistoryState<T> => {
  switch (action.type) {
    case 'commit': {
      if (action.value === state.present) {
        return state;
      }
      const appended = [...state.past, state.present];
      const past =
        appended.length > HISTORY_LIMIT
          ? appended.slice(appended.length - HISTORY_LIMIT)
          : appended;
      return { past, present: action.value, future: [] };
    }
    case 'replace':
      return { ...state, present: action.value };
    case 'undo': {
      if (state.past.length === 0) {
        return state;
      }
      // `as T` だと noUncheckedIndexedAccess の保護が外れるため `!` を採用。
      // biome-ignore lint/style/noNonNullAssertion: length > 0 は直上の guard で保証
      const previous = state.past[state.past.length - 1]!;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) {
        return state;
      }
      // biome-ignore lint/style/noNonNullAssertion: length > 0 は直上の guard で保証
      const next = state.future[0]!;
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    case 'reset':
      return { past: [], present: action.value, future: [] };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
};
