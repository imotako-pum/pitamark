import { Lock } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const errorId = useId();

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
          <div className="pointer-events-auto flex flex-col gap-2 rounded-lg bg-(--color-surface) p-3 shadow-sm ring-1 ring-black/5 backdrop-blur">
            <div className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={protect}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setProtect(next);
                  if (!next) setPassword('');
                }}
              />
              <Lock aria-hidden="true" className="h-4 w-4 text-(--color-accent)" />
              <Label htmlFor={checkboxId} className="cursor-pointer">
                パスワードで保護する（任意）
              </Label>
            </div>
            {protect && (
              <Input
                id={passwordId}
                type="password"
                placeholder="パスワード"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="ルームのパスワード"
                aria-invalid={blockedByEmptyPassword || undefined}
                aria-describedby={blockedByEmptyPassword ? errorId : undefined}
              />
            )}
            {blockedByEmptyPassword && (
              <p id={errorId} className="text-xs text-destructive">
                パスワードを入力してください
              </p>
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
