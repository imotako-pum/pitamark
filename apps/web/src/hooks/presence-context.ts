import { type UserPresence, UserPresenceSchema } from '@pitamark/shared';
import type { Awareness } from 'y-protocols/awareness';
import type { LocalUser } from '../lib/local-user';

/**
 * `createPresenceContext` が触れる `y-protocols/awareness` Awareness の最小サブセット。
 * テストは call を記録する plain stub を渡し、本番経路では `provider.awareness` を渡す。
 * `Pick` で upstream `Awareness` から派生させることで、y-protocols の minor version drift
 * (例: `on`/`off` の signature 変更) を runtime ではなくコンパイル時に検知できる。
 */
export type AwarenessLike = Pick<
  Awareness,
  'clientID' | 'setLocalState' | 'setLocalStateField' | 'getStates' | 'on' | 'off'
>;

export type PresenceContext = Readonly<{
  setCursor: (point: { x: number; y: number } | null) => void;
  setSelectedId: (id: string | null) => void;
  /** 自分以外の client presence を frozen list として返す。 */
  others: () => ReadonlyArray<UserPresence>;
  /** remote presence の変化を subscribe。返り値は unsubscribe。 */
  subscribe: (cb: () => void) => () => void;
  /** local state を user identity 込みで初期化。 */
  initLocal: () => void;
  /** local state を解除して departure を broadcast。 */
  dispose: () => void;
}>;

// `awareness.getStates()` は `Record<string, unknown>` を値とする map を返すため、
// `UserPresence` に流す前に `UserPresenceSchema` で validate する。malformed な peer
// (displayName/color 欠落、cursor 形式不正など) は捨て、presence layer 全体を落とさない。
const buildOthers = (awareness: AwarenessLike): ReadonlyArray<UserPresence> => {
  const states = awareness.getStates();
  const result: UserPresence[] = [];
  for (const [clientId, raw] of states) {
    if (clientId === awareness.clientID) continue;
    const candidate = {
      ...((raw.user as Record<string, unknown> | undefined) ?? {}),
      cursor: raw.cursor ?? null,
      selectedId: raw.selectedId ?? null,
    };
    const parsed = UserPresenceSchema.safeParse(candidate);
    if (!parsed.success) continue;
    result.push(parsed.data);
  }
  return Object.freeze(result);
};

export const createPresenceContext = (
  awareness: AwarenessLike,
  localUser: LocalUser,
): PresenceContext => {
  let othersCache: ReadonlyArray<UserPresence> = buildOthers(awareness);

  const initLocal = () => {
    awareness.setLocalStateField('user', {
      userId: localUser.userId,
      displayName: localUser.displayName,
      color: localUser.color,
    });
    awareness.setLocalStateField('cursor', null);
    awareness.setLocalStateField('selectedId', null);
  };

  return {
    setCursor: (point) => {
      awareness.setLocalStateField('cursor', point);
    },
    setSelectedId: (id) => {
      awareness.setLocalStateField('selectedId', id);
    },
    others: () => othersCache,
    subscribe: (cb) => {
      const handler = () => {
        othersCache = buildOthers(awareness);
        cb();
      };
      awareness.on('change', handler);
      return () => awareness.off('change', handler);
    },
    initLocal,
    dispose: () => {
      awareness.setLocalState(null);
    },
  };
};
