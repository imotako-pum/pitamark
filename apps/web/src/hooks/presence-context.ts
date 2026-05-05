import { type UserPresence, UserPresenceSchema } from '@pitamark/shared';
import type { Awareness } from 'y-protocols/awareness';
import type { LocalUser } from '../lib/local-user';

/**
 * Minimal subset of `y-protocols/awareness`'s Awareness surface that
 * `createPresenceContext` exercises. Tests pass a plain stub that records
 * the calls; real callers pass `provider.awareness`.
 *
 * Phase 8.x typesafety review #6 M3: derive the shape via `Pick` from the
 * upstream `Awareness` type so that minor version drift in y-protocols is
 * caught at compile time. The previous hand-rolled type silently allowed
 * structural divergence (e.g. signature changes in `on` / `off`).
 */
export type AwarenessLike = Pick<
  Awareness,
  'clientID' | 'setLocalState' | 'setLocalStateField' | 'getStates' | 'on' | 'off'
>;

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

// Phase 8.x typesafety review #6 L2: `awareness.getStates()` returns a map
// of `Record<string, unknown>` so each client's state must be parsed
// before flowing into `UserPresence`. Validating the assembled record via
// `UserPresenceSchema` rejects malformed peers (missing displayName /
// color, malformed cursor) without crashing the whole presence layer.
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
