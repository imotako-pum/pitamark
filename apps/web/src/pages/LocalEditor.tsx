import { Lock } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TurnstileWidget } from '../components/turnstile/TurnstileWidget';
import { useAnnotationsStore } from '../hooks/useAnnotationsStore';
import { useImageSource } from '../hooks/useImageSource';
import { useTurnstileToken } from '../hooks/useTurnstileToken';
import { setRoomIdInUrl } from '../lib/url-room';
import { EditorShell } from './EditorShell';

type Props = Readonly<{
  onRoomIdChange: (roomId: string | null) => void;
}>;

const TURNSTILE_SITE_KEY = (import.meta.env as { VITE_TURNSTILE_SITE_KEY?: string })
  .VITE_TURNSTILE_SITE_KEY;

/**
 * Local-only editor — Phase 3 behavior, extended in Phase 5 with optional
 * password protection and Phase 7 with invisible Cloudflare Turnstile.
 * Uploaded images call `POST /rooms` (with `password` if the user opted in
 * and a Turnstile token) and, on success, transition the URL to /r/:id;
 * the parent App then swaps in `RoomEditor`.
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
  const turnstile = useTurnstileToken(TURNSTILE_SITE_KEY);
  const [protect, setProtect] = useState(false);
  const [password, setPassword] = useState('');
  const checkboxId = useId();
  const passwordId = useId();
  const errorId = useId();

  const handleClear = useCallback(() => {
    clear();
    store.reset();
  }, [clear, store]);

  // Disable file load while the user has ticked "protect" but left the
  // password empty — better than silently uploading unprotected.
  const blockedByEmptyPassword = protect && password.length === 0;

  // Wraps `loadFromFile` so the active password (when the user opted in) is
  // forwarded to `POST /rooms`. Empty/whitespace passwords are normalized to
  // unprotected by the api-client layer. The Turnstile token is consumed
  // each call; widget state machine returns empty string in `disabled` mode.
  //
  // Gating is done inline (toast + early return) instead of swapping
  // onLoadFile to undefined — passing undefined collapses EditorShell's
  // DropZone branch into the room-mode "画像を読み込んでいます…" hint, which
  // produced a flicker on first paint while Turnstile was still pending.
  const handleLoad = useCallback(
    (file: File) => {
      if (blockedByEmptyPassword) {
        toast.error('パスワードを入力してください');
        return;
      }
      if (turnstile.state.status === 'pending') {
        toast.error('認証中です。少し待ってから再度お試しください');
        return;
      }
      if (turnstile.state.status === 'error') {
        toast.error('認証に失敗しました。再度お試しください');
        return;
      }
      const pw = protect && password.length > 0 ? password : undefined;
      loadFromFile(file, turnstile.consumeToken(), pw);
      // After consuming the (single-use) token, reset so the next upload
      // attempt waits for a fresh one. `disabled` resets back to `disabled`.
      turnstile.reset();
    },
    [blockedByEmptyPassword, protect, password, loadFromFile, turnstile],
  );

  return (
    <>
      {source === null && (
        // Phase 7.6 既知-2 fix: Toolbar (header inset-x-0 top-0 z-10) と panel が
        // 同じ z 帯で衝突し、pointer-events が遮断されてユーザーがチェックを
        // 直接クリックできなかった。top-16 (= 4rem ≒ 64px) で Toolbar の
        // 直下に逃がすことで z-index 競合自体を解消する。
        <div className="pointer-events-none absolute top-16 left-1/2 z-10 -translate-x-1/2">
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
      {TURNSTILE_SITE_KEY && (
        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={turnstile.setToken}
          onError={turnstile.setError}
        />
      )}
      <EditorShell
        source={source}
        imageError={error}
        onLoadFile={handleLoad}
        onClearImage={handleClear}
        store={store}
      />
    </>
  );
};
