import type { Annotation } from '@pitamark/shared';
import type Konva from 'konva';
import { type ReactNode, type Ref, useCallback, useEffect, useState } from 'react';
import { AwarenessLayer } from '../components/canvas/AwarenessLayer';
import { ConnectionBadge } from '../components/connection/ConnectionBadge';
import { ConfirmClearAllDialog } from '../components/dialogs/ConfirmClearAllDialog';
import { RoomGate } from '../components/room-gate/RoomGate';
import { CopyUrlButton } from '../components/toolbar/CopyUrlButton';
import { type PresenceHandle, usePresence } from '../hooks/usePresence';
import { useYjsAnnotationsStore, type YjsAnnotationsStore } from '../hooks/useYjsAnnotationsStore';
import { useTranslation } from '../i18n';
import { buildImageUrl, fetchProtectedImage, fetchRoom } from '../lib/api-client';
import { clearRoomToken, getRoomToken } from '../lib/auth-storage';
import { getOrCreateLocalUser } from '../lib/local-user';
import { EditorShell } from './EditorShell';

type Props = Readonly<{ roomId: string }>;

// 4 状態の state machine:
//   loading   — fetchRoom が in-flight
//   gate      — 利用可能な token を持たない protected room。RoomGate を表示
//   ready     — 画像取得可能。`url` は public URL (unprotected) か blob: ObjectURL
//               (protected を Bearer で取得した結果)
//   not-found — fetchRoom が null を返した (TTL 切れ / typo)
type ImageState =
  | { kind: 'loading' }
  | { kind: 'gate' }
  | { kind: 'ready'; url: string; ownsObjectUrl: boolean }
  | { kind: 'not-found' };

export const RoomEditor = ({ roomId }: Props) => {
  const t = useTranslation();
  const [imageState, setImageState] = useState<ImageState>({ kind: 'loading' });
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  // `token` は state に hoist。RoomGate での auth 成功時に image-fetch effect が再実行
  // され、同時に JWT が useYjsAnnotationsStore に伝わって WebSocket が `?token=` 付きで
  // 再接続される。
  const [token, setToken] = useState<string | null>(() => getRoomToken(roomId));

  // 別 room へ navigate したときに state をリセットする。
  useEffect(() => {
    setToken(getRoomToken(roomId));
    setImageState({ kind: 'loading' });
  }, [roomId]);

  // image fetch effect。unprotected (直接 URL)、protected + token (blob fetch)、
  // protected + token なし (RoomGate) の 3 経路を処理する。ObjectURL は unmount 時 /
  // 解決後 URL が変わったときに revoke する。
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
        // 期限切れ token (例: server secret rotation) — 削除して再 gate へ。
        clearRoomToken(roomId);
        setToken(null);
        setImageState({ kind: 'gate' });
        return;
      }
      if (result.reason === 'not-found') {
        setImageState({ kind: 'not-found' });
        return;
      }
      // network 失敗時は gate に戻して、ユーザがリトライできる形にする。
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
  // useState の lazy init を使う。idempotent で、Storage に触る初期化として
  // `useMemo([])` (StrictMode で 1 回保証されない) より安全。
  const [localUser] = useState(getOrCreateLocalUser);
  const presence = usePresence(store.awareness, localUser);

  const handleClearImage = useCallback(() => {
    setConfirmClearOpen(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    store.reset();
    setConfirmClearOpen(false);
  }, [store]);

  if (imageState.kind === 'not-found') {
    return (
      <main className="flex h-dvh w-dvw items-center justify-center bg-(--color-surface) text-(--color-text)">
        <div className="text-center">
          <p className="text-base font-semibold">{t('notFound.title')}</p>
          <p className="mt-2 text-sm opacity-70">{t('notFound.ttlNotice')}</p>
          <a href="/" className="mt-4 inline-block text-sm text-(--color-accent) underline">
            {t('notFound.backToTop')}
          </a>
        </div>
      </main>
    );
  }

  if (imageState.kind === 'gate') {
    return <RoomGate roomId={roomId} onAuthenticated={handleAuthenticated} />;
  }

  const source = imageState.kind === 'ready' ? { url: imageState.url } : null;
  const awarenessLayer = (
    annotations: ReadonlyArray<Annotation>,
    layerRef: Ref<Konva.Layer>,
  ): ReactNode => (
    <AwarenessLayer ref={layerRef} others={presence.others} annotations={annotations} />
  );

  return (
    <>
      <RoomShellAdapter
        roomId={roomId}
        source={source}
        store={store}
        presence={presence}
        awarenessLayer={awarenessLayer}
        onClearImage={handleClearImage}
      />
      <ConfirmClearAllDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        onConfirm={handleConfirmClear}
      />
    </>
  );
};

type AdapterProps = Readonly<{
  roomId: string;
  source: { url: string } | null;
  store: YjsAnnotationsStore;
  presence: PresenceHandle;
  awarenessLayer: (annotations: ReadonlyArray<Annotation>, layerRef: Ref<Konva.Layer>) => ReactNode;
  onClearImage: () => void;
}>;

const RoomShellAdapter = ({
  roomId,
  source,
  store,
  presence,
  awarenessLayer,
  onClearImage,
}: AdapterProps) => (
  <EditorShell
    roomId={roomId}
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
