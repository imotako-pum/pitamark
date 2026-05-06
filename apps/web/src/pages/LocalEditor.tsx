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

// vite-env.d.ts で VITE_* の shape を宣言しているので、cast 無しの直接 property
// アクセスでも typecheck が通る。
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

/**
 * local-only editor。任意の password 保護と invisible Cloudflare Turnstile を伴う
 * upload 経路を持つ。画像 upload は `POST /rooms` (opt-in 時は password、常に
 * Turnstile token 同梱) を叩き、成功時に URL を /r/:id に遷移させる。親 App は
 * URL 変化を検知して `RoomEditor` に切り替える。
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
  // render 時点で翻訳することで、error 表示中に言語切替されても <DropZone> 内の
  // 文言が追従する。SSOT は `errorKey` で、翻訳は derived state。
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

  // 「保護する」を ON にしたまま password が空のときは file load を block。黙って
  // unprotected で upload するより安全。
  const blockedByEmptyPassword = protect && password.length === 0;

  // `loadFromFile` を wrap して、opt-in 時の password を `POST /rooms` に流す。
  // 空白だけの password は api-client 層で unprotected に正規化される。Turnstile
  // token は呼び出し毎に消費し、disabled モードでは widget が空文字列を返す。
  //
  // gating は onLoadFile を undefined に差し替えるのではなく inline (toast + early
  // return) で行う。undefined にすると EditorShell の DropZone branch が room-mode
  // の「画像を読み込んでいます…」ヒントに崩れ、Turnstile pending 中の初回 paint で
  // flicker していたため。
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
      // 単発 token を consume した後は reset し、次の upload は新しい token を待つ。
      // `disabled` モードは reset 後も `disabled` のまま。
      turnstile.reset();
    },
    [blockedByEmptyPassword, protect, password, loadFromFile, turnstile, t],
  );

  // protect-password panel は landing flow の DropZone 直下に **inline** で描画する
  // (header 下の floating overlay ではない)。旧 `belowHeader` overlay は source === null
  // のとき Hero h2 と衝突していた (Hero が stage 領域上端から始まり、floating panel が
  // その上に重なる) ため。inline 配置で重なりを解消しつつ、password panel と upload
  // action の物理距離を近く保ち、`belowHeader` slot は将来 editor-mode の floating
  // chrome に再利用できるよう空けておく。
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
