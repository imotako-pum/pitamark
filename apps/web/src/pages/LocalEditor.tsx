import { Lock } from 'lucide-react';
import { type ReactNode, useCallback, useId, useState } from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LandingShell } from '../components/landing/LandingShell';
import { TurnstileWidget } from '../components/turnstile/TurnstileWidget';
import { useAnnotationsStore } from '../hooks/useAnnotationsStore';
import { useImageSource } from '../hooks/useImageSource';
import { useTurnstileToken } from '../hooks/useTurnstileToken';
import { useTranslation } from '../i18n';
import { setRoomIdInUrl } from '../lib/url-room';
import { EditorShell } from './EditorShell';

type Props = Readonly<{
  onRoomIdChange: (roomId: string | null) => void;
}>;

// Phase 8.x typesafety review #6 M2: vite-env.d.ts now declares the
// VITE_* shape so direct property access typechecks without the cast.
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

/**
 * Local-only editor — Phase 3 behavior, extended in Phase 5 with optional
 * password protection and Phase 7 with invisible Cloudflare Turnstile.
 * Uploaded images call `POST /rooms` (with `password` if the user opted in
 * and a Turnstile token) and, on success, transition the URL to /r/:id;
 * the parent App then swaps in `RoomEditor`.
 */
export const LocalEditor = ({ onRoomIdChange }: Props) => {
  const t = useTranslation();
  const handleRoomCreated = useCallback(
    (roomId: string) => {
      setRoomIdInUrl(roomId);
      onRoomIdChange(roomId);
    },
    [onRoomIdChange],
  );

  const { source, errorKey, loadFromFile, clear } = useImageSource({
    onRoomCreated: handleRoomCreated,
  });
  // Translate at render time so lang switches mid-error update the message
  // shown in <DropZone>. `errorKey` is the source of truth; the translation
  // is derived state.
  const error = errorKey ? t(errorKey) : null;
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
        toast.error(t('gate.toast.passwordRequired'));
        return;
      }
      if (turnstile.state.status === 'pending') {
        toast.error(t('gate.toast.authenticating'));
        return;
      }
      if (turnstile.state.status === 'error') {
        toast.error(t('gate.toast.authFailed'));
        return;
      }
      const pw = protect && password.length > 0 ? password : undefined;
      loadFromFile(file, turnstile.consumeToken(), pw);
      // After consuming the (single-use) token, reset so the next upload
      // attempt waits for a fresh one. `disabled` resets back to `disabled`.
      turnstile.reset();
    },
    [blockedByEmptyPassword, protect, password, loadFromFile, turnstile, t],
  );

  // Phase 10.H: protect-password panel renders **inline** within the landing
  // flow (right under DropZone) instead of as a floating overlay below the
  // header. The earlier `belowHeader` overlay design (Phase 7.6 既知-2 fix)
  // collided with the new Hero h2 when source === null, because Hero starts
  // at the top of the stage area and the floating panel sat on top of it.
  // Inline placement removes the overlap, keeps the password panel close to
  // the upload action it modifies, and frees `belowHeader` for editor-mode
  // floating chrome should it be needed in the future.
  const protectPanel =
    source === null ? (
      <div className="flex flex-col gap-2 rounded-lg bg-(--color-surface) p-3 shadow-sm ring-1 ring-black/5">
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
            {t('localEditor.protectPassword.label')}
          </Label>
        </div>
        {protect && (
          <Input
            id={passwordId}
            type="password"
            placeholder={t('gate.password.placeholder')}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label={t('gate.password.aria')}
            aria-invalid={blockedByEmptyPassword || undefined}
            aria-describedby={blockedByEmptyPassword ? errorId : undefined}
          />
        )}
        {blockedByEmptyPassword && (
          <p id={errorId} className="text-xs text-destructive">
            {t('localEditor.protectPassword.required')}
          </p>
        )}
      </div>
    ) : null;

  return (
    <>
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
        landingSlot={(dropzone: ReactNode) => (
          <LandingShell
            dropzone={
              <>
                {dropzone}
                {protectPanel}
              </>
            }
          />
        )}
      />
    </>
  );
};
