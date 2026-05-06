import { useCallback, useMemo, useState } from 'react';

// invisible Turnstile widget の state machine。
// `disabled` は dev で site key 未設定の状態 — `consumeToken()` は空文字列を返し、
// API 側は `BYPASS_TURNSTILE=true` で short-circuit する。`pending` は「site key 設定済、
// widget が未発火」、`ready` は使い捨て token を保持、`error` は描画失敗。
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
   * 現在使える token を返す。widget が disabled なときは空文字列を返すので、caller 側で
   * "ゲートしない" 扱いにすること。server は `BYPASS_TURNSTILE=true` (dev/CI default)
   * 以外で空 token を Zod validation error として弾く。
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
  // 全体オブジェクトに依存する consumer (例: page component の
  // `useCallback([..., turnstile])`) が毎 render で invalidate されないように memo 化する。
  return useMemo(
    () => ({ state, setToken, setError, reset, consumeToken }),
    [state, setToken, setError, reset, consumeToken],
  );
};
