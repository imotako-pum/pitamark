import { Lock } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { useAnnotationsStore } from '../hooks/useAnnotationsStore';
import { useImageSource } from '../hooks/useImageSource';
import { setRoomIdInUrl } from '../lib/url-room';
import { EditorShell } from './EditorShell';

type Props = Readonly<{
  onRoomIdChange: (roomId: string | null) => void;
}>;

/**
 * Local-only editor — Phase 3 behavior, extended in Phase 5 with optional
 * password protection. Uploaded images call `POST /rooms` (with `password`
 * if the user opted in) and, on success, transition the URL to /r/:id; the
 * parent App then swaps in `RoomEditor`.
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
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState('');
  const checkboxId = useId();
  const passwordId = useId();

  const handleClear = useCallback(() => {
    clear();
    store.reset();
  }, [clear, store]);

  // Wraps `loadFromFile` so the active password (when the user opted in) is
  // forwarded to `POST /rooms`. Empty/whitespace passwords are normalized to
  // unprotected by the api-client layer.
  const handleLoad = useCallback(
    (file: File) => {
      const pw = protect && password.length > 0 ? password : undefined;
      loadFromFile(file, pw);
    },
    [protect, password, loadFromFile],
  );

  // Disable file load while the user has ticked "protect" but left the
  // password empty — better than silently uploading unprotected.
  const blockedByEmptyPassword = protect && password.length === 0;
  const onLoadFile = blockedByEmptyPassword ? undefined : handleLoad;

  return (
    <>
      {source === null && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex flex-col gap-2 rounded-lg bg-white/90 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur">
            <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                id={checkboxId}
                type="checkbox"
                checked={protect}
                onChange={(e) => {
                  setProtect(e.target.checked);
                  if (!e.target.checked) setPassword('');
                }}
                className="h-4 w-4 cursor-pointer accent-(--color-accent)"
              />
              <Lock aria-hidden="true" className="h-4 w-4 text-(--color-accent)" />
              <span>パスワードで保護する（任意）</span>
            </label>
            {protect && (
              <input
                id={passwordId}
                type="password"
                placeholder="パスワード"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="ルームのパスワード"
                className="rounded-md border border-(--color-toolbar-border) bg-(--color-surface) px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
              />
            )}
            {blockedByEmptyPassword && (
              <p className="text-xs text-rose-600">パスワードを入力してください</p>
            )}
          </div>
        </div>
      )}
      <EditorShell
        source={source}
        imageError={error}
        onLoadFile={onLoadFile}
        onClearImage={handleClear}
        store={store}
      />
    </>
  );
};
