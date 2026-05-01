import type { Annotation } from '@snap-share/shared';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AwarenessLayer } from '../components/canvas/AwarenessLayer';
import { ConnectionBadge } from '../components/connection/ConnectionBadge';
import { RoomGate } from '../components/room-gate/RoomGate';
import { CopyUrlButton } from '../components/toolbar/CopyUrlButton';
import { type PresenceHandle, usePresence } from '../hooks/usePresence';
import { useYjsAnnotationsStore, type YjsAnnotationsStore } from '../hooks/useYjsAnnotationsStore';
import { buildImageUrl, fetchProtectedImage, fetchRoom } from '../lib/api-client';
import { clearRoomToken, getRoomToken } from '../lib/auth-storage';
import { getOrCreateLocalUser } from '../lib/local-user';
import { EditorShell } from './EditorShell';

type Props = Readonly<{ roomId: string }>;

// 4-state machine:
//   loading      — fetchRoom is in flight
//   gate         — protected room with no usable token; show RoomGate
//   ready        — image is fetchable; `url` is either a public URL (unprotected)
//                  or a blob: ObjectURL (protected, fetched with Bearer)
//   not-found    — fetchRoom returned null (TTL expired / typo)
type ImageState =
  | { kind: 'loading' }
  | { kind: 'gate' }
  | { kind: 'ready'; url: string; ownsObjectUrl: boolean }
  | { kind: 'not-found' };

const CLEAR_ALL_CONFIRM =
  'ルーム内の注釈をすべて削除します。この操作は他の参加者にも反映されます。続行しますか？';

export const RoomEditor = ({ roomId }: Props) => {
  const [imageState, setImageState] = useState<ImageState>({ kind: 'loading' });
  // `token` is hoisted into state so a successful RoomGate auth re-runs the
  // image-fetch effect AND propagates the JWT into useYjsAnnotationsStore so
  // the WebSocket reconnects with `?token=`.
  const [token, setToken] = useState<string | null>(() => getRoomToken(roomId));

  // Reset state when navigating between rooms.
  useEffect(() => {
    setToken(getRoomToken(roomId));
    setImageState({ kind: 'loading' });
  }, [roomId]);

  // Image-fetch effect. Handles unprotected (direct URL), protected w/ token
  // (blob fetch), and protected w/o token (RoomGate). Cleans up ObjectURLs
  // on unmount or when the resolved URL changes.
  useEffect(() => {
    let cancelled = false;
    let createdObjectUrl: string | null = null;

    void (async () => {
      const room = await fetchRoom(roomId);
      if (cancelled) return;
      if (!room) {
        setImageState({ kind: 'not-found' });
        return;
      }
      if (!room.protected) {
        setImageState({ kind: 'ready', url: buildImageUrl(room), ownsObjectUrl: false });
        return;
      }
      if (!token) {
        setImageState({ kind: 'gate' });
        return;
      }
      const result = await fetchProtectedImage(roomId, token);
      if (cancelled) {
        if (result.ok) URL.revokeObjectURL(result.objectUrl);
        return;
      }
      if (result.ok) {
        createdObjectUrl = result.objectUrl;
        setImageState({ kind: 'ready', url: result.objectUrl, ownsObjectUrl: true });
        return;
      }
      if (result.reason === 'unauthorized') {
        // Stale token (e.g. server secret rotated) — clear and re-prompt.
        clearRoomToken(roomId);
        setToken(null);
        setImageState({ kind: 'gate' });
        return;
      }
      if (result.reason === 'not-found') {
        setImageState({ kind: 'not-found' });
        return;
      }
      // Network: fall back to gate so the user can retry.
      setImageState({ kind: 'gate' });
    })();

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [roomId, token]);

  const handleAuthenticated = useCallback((next: string) => {
    setToken(next);
  }, []);

  const store = useYjsAnnotationsStore(roomId, undefined, token);
  // Lazy useState init: idempotent + matches the Storage-touching pattern
  // better than `useMemo([])` (which is not guaranteed-once under StrictMode).
  const [localUser] = useState(getOrCreateLocalUser);
  const presence = usePresence(store.awareness, localUser);

  const handleClearImage = useCallback(() => {
    if (window.confirm(CLEAR_ALL_CONFIRM)) {
      store.reset();
    }
  }, [store]);

  if (imageState.kind === 'not-found') {
    return (
      <main className="flex h-dvh w-dvw items-center justify-center bg-(--color-surface) text-(--color-text)">
        <div className="text-center">
          <p className="text-base font-semibold">ルームが見つかりません</p>
          <p className="mt-2 text-sm opacity-70">
            URL の有効期限が切れている可能性があります（TTL 7 日）。
          </p>
          <a href="/" className="mt-4 inline-block text-sm text-(--color-accent) underline">
            トップに戻る
          </a>
        </div>
      </main>
    );
  }

  if (imageState.kind === 'gate') {
    return <RoomGate roomId={roomId} onAuthenticated={handleAuthenticated} />;
  }

  const source = imageState.kind === 'ready' ? { url: imageState.url } : null;
  const awarenessLayer = (annotations: ReadonlyArray<Annotation>): ReactNode => (
    <AwarenessLayer others={presence.others} annotations={annotations} />
  );

  return (
    <RoomShellAdapter
      source={source}
      store={store}
      presence={presence}
      awarenessLayer={awarenessLayer}
      onClearImage={handleClearImage}
    />
  );
};

type AdapterProps = Readonly<{
  source: { url: string } | null;
  store: YjsAnnotationsStore;
  presence: PresenceHandle;
  awarenessLayer: (annotations: ReadonlyArray<Annotation>) => ReactNode;
  onClearImage: () => void;
}>;

const RoomShellAdapter = ({
  source,
  store,
  presence,
  awarenessLayer,
  onClearImage,
}: AdapterProps) => (
  <EditorShell
    source={source}
    imageError={null}
    onClearImage={onClearImage}
    store={store}
    onCursorMove={presence.setCursor}
    awarenessLayer={awarenessLayer}
    onSelectedIdChange={presence.setSelectedId}
    toolbarRight={<CopyUrlButton />}
    floatingExtras={<ConnectionBadge status={store.status} />}
  />
);
