import { lazy, Suspense } from 'react';

// Phase 8.x perf review #10 H1+M1: split LocalEditor and RoomEditor into
// independent code-split boundaries so that:
//   - The landing/local-mode visit only fetches `vendor-canvas` (Konva +
//     react-konva + use-image) and the LocalEditor chunk.
//   - The room-mode visit additionally fetches `vendor-yjs` (yjs + y-websocket
//     + y-protocols) on demand. Local mode never pays for Yjs network code.
// `vite.config.ts` couples this with manualChunks so vendor splits are
// stable across builds. `Suspense` fallback uses `aria-busy` so SR users
// hear the transition rather than seeing a blank canvas in silence.
const LocalEditor = lazy(() => import('./LocalEditor').then((m) => ({ default: m.LocalEditor })));
const RoomEditor = lazy(() => import('./RoomEditor').then((m) => ({ default: m.RoomEditor })));

type Props = Readonly<{
  roomId: string | null;
  onRoomIdChange: (roomId: string | null) => void;
}>;

/**
 * Dispatches to either the local-only or the Yjs-backed room editor.
 * The hook-order rule is satisfied by mounting two distinct components, so
 * navigating between modes unmounts/remounts cleanly.
 */
export const EditorPage = ({ roomId, onRoomIdChange }: Props) => (
  <Suspense fallback={<div aria-busy="true" className="h-screen w-screen" />}>
    {roomId ? (
      <RoomEditor key={roomId} roomId={roomId} />
    ) : (
      <LocalEditor onRoomIdChange={onRoomIdChange} />
    )}
  </Suspense>
);
