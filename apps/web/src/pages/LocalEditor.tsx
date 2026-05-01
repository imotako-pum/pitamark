import { useCallback } from 'react';
import { useAnnotationsStore } from '../hooks/useAnnotationsStore';
import { useImageSource } from '../hooks/useImageSource';
import { setRoomIdInUrl } from '../lib/url-room';
import { EditorShell } from './EditorShell';

type Props = Readonly<{
  onRoomIdChange: (roomId: string | null) => void;
}>;

/**
 * Local-only editor — Phase 3 behavior. Uploaded images call `POST /rooms`
 * out-of-band and, on success, transition the URL to /r/:id; the parent App
 * then swaps in `RoomEditor`.
 */
export const LocalEditor = ({ onRoomIdChange }: Props) => {
  const handleRoomCreated = useCallback(
    (roomId: string) => {
      setRoomIdInUrl(roomId);
      onRoomIdChange(roomId);
    },
    [onRoomIdChange],
  );

  const { source, error, loadFromFile, clear } = useImageSource({
    onRoomCreated: handleRoomCreated,
  });
  const store = useAnnotationsStore();

  const handleClear = useCallback(() => {
    clear();
    store.reset();
  }, [clear, store]);

  return (
    <EditorShell
      source={source}
      imageError={error}
      onLoadFile={loadFromFile}
      onClearImage={handleClear}
      store={store}
    />
  );
};
