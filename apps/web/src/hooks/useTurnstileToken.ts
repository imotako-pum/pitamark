import { useCallback, useMemo, useState } from 'react';

// Phase 7: state machine for the invisible Turnstile widget.
//
// `disabled` is the dev-without-key state — `consumeToken()` returns an
// empty string and the API short-circuits via `BYPASS_TURNSTILE=true`.
// `pending` is "site key configured, widget hasn't fired yet". `ready`
// carries the single-use token; `error` is an explicit failure to render.

export type TurnstileTokenState =
  | { status: 'disabled' }
  | { status: 'pending' }
  | { status: 'ready'; token: string }
  | { status: 'error' };

export type UseTurnstileTokenResult = Readonly<{
  state: TurnstileTokenState;
  setToken: (token: string) => void;
  setError: () => void;
  reset: () => void;
  /**
   * Returns the current usable token, or the empty string when the widget is
   * disabled (caller must handle the empty-string case as "don't gate"); the
   * server treats an empty token as a Zod validation error UNLESS
   * `BYPASS_TURNSTILE=true`, which is the dev/CI default.
   */
  consumeToken: () => string;
}>;

export const useTurnstileToken = (siteKey: string | undefined): UseTurnstileTokenResult => {
  const [state, setState] = useState<TurnstileTokenState>(() =>
    siteKey ? { status: 'pending' } : { status: 'disabled' },
  );
  const setToken = useCallback((token: string) => setState({ status: 'ready', token }), []);
  const setError = useCallback(() => setState({ status: 'error' }), []);
  const reset = useCallback(
    () => setState(siteKey ? { status: 'pending' } : { status: 'disabled' }),
    [siteKey],
  );
  const consumeToken = useCallback(() => {
    if (state.status === 'ready') return state.token;
    return '';
  }, [state]);
  // Memoize the result so consumers depending on the whole object (e.g. a
  // `useCallback([..., turnstile])` in the page component) do not invalidate
  // every render.
  return useMemo(
    () => ({ state, setToken, setError, reset, consumeToken }),
    [state, setToken, setError, reset, consumeToken],
  );
};
