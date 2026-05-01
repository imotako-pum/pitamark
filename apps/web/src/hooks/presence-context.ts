import type { UserPresence } from '@snap-share/shared';
import type { LocalUser } from '../lib/local-user';

/**
 * Minimal subset of `y-protocols/awareness`'s Awareness surface that
 * `createPresenceContext` exercises. Tests pass a plain stub that records
 * the calls; real callers pass `provider.awareness`.
 */
export type AwarenessLike = {
  clientID: number;
  setLocalState: (state: Record<string, unknown> | null) => void;
  setLocalStateField: (field: string, value: unknown) => void;
  getStates: () => Map<number, Record<string, unknown>>;
  on: (event: 'change', handler: () => void) => void;
  off: (event: 'change', handler: () => void) => void;
};

export type PresenceContext = Readonly<{
  setCursor: (point: { x: number; y: number } | null) => void;
  setSelectedId: (id: string | null) => void;
  /** Reads a frozen list of *other* clients' presence (self excluded). */
  others: () => ReadonlyArray<UserPresence>;
  /** Subscribe to remote presence changes. Returns unsubscribe. */
  subscribe: (cb: () => void) => () => void;
  /** Initialize local state with the user identity. */
  initLocal: () => void;
  /** Tear down local state (broadcast departure). */
  dispose: () => void;
}>;

const buildOthers = (awareness: AwarenessLike): ReadonlyArray<UserPresence> => {
  const states = awareness.getStates();
  const result: UserPresence[] = [];
  for (const [clientId, raw] of states) {
    if (clientId === awareness.clientID) continue;
    const user = raw.user as { userId: string; displayName: string; color: string } | undefined;
    if (!user?.userId) continue;
    result.push({
      userId: user.userId,
      displayName: user.displayName,
      color: user.color,
      cursor: (raw.cursor as { x: number; y: number } | null | undefined) ?? null,
      selectedId: (raw.selectedId as string | null | undefined) ?? null,
    });
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
