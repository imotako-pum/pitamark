import type { Annotation } from '@snap-share/shared';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import {
  type ConnectionStatus,
  createYjsAnnotationsContext,
  type ProviderFactory,
  type YjsProviderLike,
} from '../yjs-annotations-context';

type StatusHandler = (event: { status: ConnectionStatus }) => void;

const makeProviderFactory = () => {
  const handlers = new Set<StatusHandler>();
  let destroyedFlag = false;
  let providerInstance: YjsProviderLike | null = null;

  const factory: ProviderFactory = () => {
    const provider: YjsProviderLike = {
      on: (event, handler) => {
        if (event === 'status') handlers.add(handler);
      },
      off: (event, handler) => {
        if (event === 'status') handlers.delete(handler);
      },
      destroy: () => {
        destroyedFlag = true;
      },
    };
    providerInstance = provider;
    return provider;
  };

  return {
    factory,
    emit: (status: ConnectionStatus) => {
      for (const handler of handlers) handler({ status });
    },
    destroyed: () => destroyedFlag,
    provider: () => {
      if (!providerInstance) throw new Error('provider not created');
      return providerInstance;
    },
  };
};

const rect = (id: string, createdAt = 1): Annotation => ({
  id,
  type: 'rectangle',
  createdAt,
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  color: '#5b6dff',
  strokeWidth: 2,
});

describe('createYjsAnnotationsContext.applyDataAction', () => {
  it('inserts annotations and reflects them in the snapshot', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);

    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });

    // snapshot is recomputed on observeDeep — drive it via subscribe.
    const listener = vi.fn();
    const unsub = ctx.subscribe(listener);
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r2', 2) });
    unsub();

    expect(ctx.snapshot().map((a) => a.id)).toEqual(['r1', 'r2']);
  });

  it('removes annotations on annotation/remove', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const unsub = ctx.subscribe(() => {});
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });

    ctx.applyDataAction({ type: 'annotation/remove', id: 'r1' });
    unsub();

    expect(ctx.snapshot()).toEqual([]);
  });

  it('move/resize actions update the underlying Y.Map data', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const unsub = ctx.subscribe(() => {});
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });

    ctx.applyDataAction({ type: 'annotation/move', id: 'r1', dx: 5, dy: 7 });
    ctx.applyDataAction({
      type: 'annotation/resize-rect',
      id: 'r1',
      x: 25,
      y: 35,
      width: 200,
      height: 80,
    });
    unsub();

    expect(ctx.snapshot()[0]).toMatchObject({
      x: 25,
      y: 35,
      width: 200,
      height: 80,
    });
  });

  it('ignores client-only actions (tool/set, select/set, active-color/set) without mutating Y.Doc', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const unsub = ctx.subscribe(() => {});
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });
    const before = ctx.snapshot();

    ctx.applyDataAction({ type: 'tool/set', tool: 'rectangle' });
    ctx.applyDataAction({ type: 'select/set', id: 'r1' });
    ctx.applyDataAction({ type: 'active-color/set', color: '#3a86ff' });
    unsub();

    expect(ctx.snapshot()).toEqual(before);
  });

  it('annotation/set-color updates the color field in Yjs (any annotation type)', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const unsub = ctx.subscribe(() => {});
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });

    ctx.applyDataAction({ type: 'annotation/set-color', id: 'r1', color: '#abcdef' });
    unsub();

    expect(ctx.snapshot()[0]).toMatchObject({ color: '#abcdef' });
  });
});

describe('createYjsAnnotationsContext.subscribe', () => {
  it('invokes the listener on deep changes', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const listener = vi.fn();
    const unsub = ctx.subscribe(listener);

    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });

    expect(listener).toHaveBeenCalled();
    expect(ctx.snapshot()).toEqual([rect('r1')]);
    unsub();
  });

  it('stops invoking the listener after unsubscribe', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const listener = vi.fn();
    const unsub = ctx.subscribe(listener);
    unsub();

    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createYjsAnnotationsContext UndoManager wiring', () => {
  it('tracks local actions so they are reversible via undo()', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const unsub = ctx.subscribe(() => {});
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });
    expect(ctx.snapshot()).toHaveLength(1);

    ctx.undoManager.undo();
    unsub();

    expect(ctx.snapshot()).toEqual([]);
  });

  it('does not track remote (non-LOCAL_ORIGIN) merges', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);

    ctx.doc.transact(() => {
      ctx.yAnnotations.set('remote', new Y.Map<unknown>());
    });

    expect(ctx.undoManager.undoStack.length).toBe(0);
  });
});

describe('createYjsAnnotationsContext.destroy / reset', () => {
  it('destroys the provider on destroy()', () => {
    const ph = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(ph.factory);

    ctx.destroy();

    expect(ph.destroyed()).toBe(true);
  });

  it('clears all annotations on reset()', () => {
    const { factory } = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(factory);
    const unsub = ctx.subscribe(() => {});
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r1') });
    ctx.applyDataAction({ type: 'annotation/add', annotation: rect('r2', 2) });

    ctx.reset();
    unsub();

    expect(ctx.snapshot()).toEqual([]);
  });
});

describe('provider status pass-through', () => {
  it('emits status events to subscribed handlers', () => {
    const ph = makeProviderFactory();
    const ctx = createYjsAnnotationsContext(ph.factory);
    const handler = vi.fn();
    ctx.provider.on('status', handler);

    ph.emit('connected');
    ph.emit('disconnected');

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { status: 'connected' });
    expect(handler).toHaveBeenNthCalledWith(2, { status: 'disconnected' });
  });
});
