import { lazy, Suspense } from 'react';

// LocalEditor と RoomEditor を独立した code-split 境界に分ける:
//   - landing / local モード訪問では `vendor-canvas` (Konva + react-konva + use-image)
//     と LocalEditor chunk のみを fetch。
//   - room モード訪問では追加で `vendor-yjs` (yjs + y-websocket + y-protocols) を
//     遅延 fetch。local モードは Yjs network code を一切 download しない。
// `vite.config.ts` の manualChunks と組み合わせて build 間で vendor split が安定する。
// `Suspense` fallback は `aria-busy` を持たせて、screen reader 利用者が遷移を
// 無音で見ずに済むようにする。
const LocalEditor = lazy(() => import('./LocalEditor').then((m) => ({ default: m.LocalEditor })));
const RoomEditor = lazy(() => import('./RoomEditor').then((m) => ({ default: m.RoomEditor })));

type Props = Readonly<{
  roomId: string | null;
  onRoomIdChange: (roomId: string | null) => void;
}>;

/**
 * local-only か Yjs-backed room editor かを切り替える dispatcher。
 * 2 つの別 component として mount するので React の hook 順序ルールを満たし、
 * モード切替時の unmount/remount も綺麗に走る。
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
