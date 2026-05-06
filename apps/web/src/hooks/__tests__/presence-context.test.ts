import { describe, expect, it, vi } from 'vitest';
import type { LocalUser } from '../../lib/local-user';
import { type AwarenessLike, createPresenceContext } from '../presence-context';

const makeAwareness = (clientID = 1) => {
  const states = new Map<number, Record<string, unknown>>();
  // `Awareness.on/off` (y-protocols) は handler を Observable の広い event 表面である
  // `Function` で型付けする。`AwarenessLike` を `Pick<Awareness, ...>` 派生にした以上、
  // stub も同じ width (= `Function`、`() => void` ではない) で揃える必要がある。
  // biome-ignore lint/complexity/noBannedTypes: y-protocols の Observable.on と同じ型に揃えるため
  const handlers = new Set<Function>();
  states.set(clientID, {});

  const fire = () => {
    for (const h of handlers) (h as () => void)();
  };

  const aw: AwarenessLike = {
    clientID,
    setLocalState: (s) => {
      if (s === null) {
        states.delete(clientID);
      } else {
        states.set(clientID, s);
      }
      fire();
    },
    setLocalStateField: (k, v) => {
      const cur = states.get(clientID) ?? {};
      states.set(clientID, { ...cur, [k]: v });
      fire();
    },
    getStates: () => states,
    on: (_evt, h) => {
      handlers.add(h);
    },
    off: (_evt, h) => {
      handlers.delete(h);
    },
  };

  return {
    awareness: aw,
    states,
    fire,
    addRemote: (id: number, state: Record<string, unknown>) => {
      states.set(id, state);
      fire();
    },
  };
};

const localUser: LocalUser = {
  userId: 'self-user',
  displayName: 'Self',
  color: '#5b6dff',
};

describe('createPresenceContext.initLocal', () => {
  it('writes user / cursor / selectedId fields onto the local awareness state', () => {
    const { awareness } = makeAwareness();
    const ctx = createPresenceContext(awareness, localUser);

    ctx.initLocal();

    expect(awareness.getStates().get(1)).toEqual({
      user: {
        userId: localUser.userId,
        displayName: localUser.displayName,
        color: localUser.color,
      },
      cursor: null,
      selectedId: null,
    });
  });
});

describe('createPresenceContext.setCursor / setSelectedId', () => {
  it('updates the local awareness cursor field', () => {
    const { awareness } = makeAwareness();
    const ctx = createPresenceContext(awareness, localUser);
    ctx.initLocal();

    ctx.setCursor({ x: 10, y: 20 });

    expect(awareness.getStates().get(1)?.cursor).toEqual({ x: 10, y: 20 });
  });

  it('updates the local awareness selectedId field', () => {
    const { awareness } = makeAwareness();
    const ctx = createPresenceContext(awareness, localUser);
    ctx.initLocal();

    ctx.setSelectedId('annot-1');

    expect(awareness.getStates().get(1)?.selectedId).toBe('annot-1');
  });
});

describe('createPresenceContext.others / subscribe', () => {
  it('excludes the local clientID from the others list', () => {
    const helpers = makeAwareness(1);
    const ctx = createPresenceContext(helpers.awareness, localUser);
    ctx.initLocal();
    const listener = vi.fn();
    const unsub = ctx.subscribe(listener);

    helpers.addRemote(2, {
      user: { userId: 'remote', displayName: 'Remote', color: '#e74c3c' },
      cursor: { x: 5, y: 6 },
      selectedId: null,
    });

    const others = ctx.others();
    expect(others.map((u) => u.userId)).toEqual(['remote']);
    expect(others[0]?.cursor).toEqual({ x: 5, y: 6 });
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('skips remote clients without a user payload', () => {
    const helpers = makeAwareness(1);
    const ctx = createPresenceContext(helpers.awareness, localUser);
    const listener = vi.fn();
    const unsub = ctx.subscribe(listener);

    helpers.addRemote(2, { cursor: { x: 1, y: 2 } });

    expect(ctx.others()).toEqual([]);
    unsub();
  });

  it('returns the same frozen reference between change events', () => {
    const helpers = makeAwareness(1);
    const ctx = createPresenceContext(helpers.awareness, localUser);
    const unsub = ctx.subscribe(() => {});

    const a = ctx.others();
    const b = ctx.others();

    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    unsub();
  });
});

describe('createPresenceContext.dispose', () => {
  it('broadcasts a null state when leaving', () => {
    const helpers = makeAwareness(1);
    const ctx = createPresenceContext(helpers.awareness, localUser);
    ctx.initLocal();
    expect(helpers.states.has(1)).toBe(true);

    ctx.dispose();

    expect(helpers.states.has(1)).toBe(false);
  });
});
