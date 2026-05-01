import type { Annotation } from '@snap-share/shared';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AwarenessLayer } from '../components/canvas/AwarenessLayer';
import { ConnectionBadge } from '../components/connection/ConnectionBadge';
import { CopyUrlButton } from '../components/toolbar/CopyUrlButton';
import { type PresenceHandle, usePresence } from '../hooks/usePresence';
import { useYjsAnnotationsStore, type YjsAnnotationsStore } from '../hooks/useYjsAnnotationsStore';
import { buildImageUrl, fetchRoom } from '../lib/api-client';
import { getOrCreateLocalUser } from '../lib/local-user';
import { EditorShell } from './EditorShell';

type Props = Readonly<{ roomId: string }>;

type ImageState = { kind: 'loading' } | { kind: 'ready'; url: string } | { kind: 'not-found' };

const CLEAR_ALL_CONFIRM =
  'ルーム内の注釈をすべて削除します。この操作は他の参加者にも反映されます。続行しますか？';

export const RoomEditor = ({ roomId }: Props) => {
  const [imageState, setImageState] = useState<ImageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setImageState({ kind: 'loading' });
    void fetchRoom(roomId).then((room) => {
      if (cancelled) return;
      setImageState(room ? { kind: 'ready', url: buildImageUrl(room) } : { kind: 'not-found' });
    });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const store = useYjsAnnotationsStore(roomId);
  // Lazy useState init: idempotent + matches the Storage-touching pattern
  // better than `useMemo([])` (which is not guaranteed-once under StrictMode).
  const [localUser] = useState(getOrCreateLocalUser);
  const presence = usePresence(store.awareness, localUser);

  // 「画像をクリア」は CRDT 全消去 = 他参加者の注釈にも影響するため、
  // 確認ダイアログを挟む。CRDT を破壊せずにルームを抜けたい場合は
  // ブラウザの戻るボタンで `/` に戻る経路がある。
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
