import type { UserPresence } from '@snap-share/shared';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { LocalUser } from '../lib/local-user';
import {
  type AwarenessLike,
  createPresenceContext,
  type PresenceContext,
} from './presence-context';

const useRafThrottle = <T>(fn: (arg: T) => void): ((arg: T) => void) => {
  const queuedRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback((arg: T) => {
    queuedRef.current = arg;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const next = queuedRef.current;
      queuedRef.current = null;
      if (next !== null) fnRef.current(next);
    });
  }, []);
};

export type PresenceHandle = Readonly<{
  setCursor: (point: { x: number; y: number } | null) => void;
  setSelectedId: (id: string | null) => void;
  others: ReadonlyArray<UserPresence>;
}>;

const EMPTY_OTHERS: ReadonlyArray<UserPresence> = Object.freeze([]);

const NO_OP_HANDLE: PresenceHandle = Object.freeze({
  setCursor: () => {},
  setSelectedId: () => {},
  others: EMPTY_OTHERS,
});

export const usePresence = (
  awareness: AwarenessLike | null,
  localUser: LocalUser,
): PresenceHandle => {
  const ctxRef = useRef<PresenceContext | null>(null);
  const ctx = useMemo(() => {
    const next = awareness ? createPresenceContext(awareness, localUser) : null;
    ctxRef.current = next;
    return next;
  }, [awareness, localUser]);

  useEffect(() => {
    if (!ctx) return;
    ctx.initLocal();
    return () => ctx.dispose();
  }, [ctx]);

  const subscribe = useCallback((cb: () => void) => (ctx ? ctx.subscribe(cb) : () => {}), [ctx]);
  const getSnapshot = useCallback(() => (ctx ? ctx.others() : EMPTY_OTHERS), [ctx]);
  const others = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setCursor = useRafThrottle((point: { x: number; y: number } | null) => {
    ctxRef.current?.setCursor(point);
  });

  const setSelectedId = useCallback((id: string | null) => {
    ctxRef.current?.setSelectedId(id);
  }, []);

  return useMemo(
    () => (ctx ? { setCursor, setSelectedId, others } : NO_OP_HANDLE),
    [ctx, setCursor, setSelectedId, others],
  );
};
