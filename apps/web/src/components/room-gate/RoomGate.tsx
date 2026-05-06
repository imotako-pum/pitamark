import { Lock } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type I18nKey, useTranslation } from '../../i18n';
import { type AuthFailure, authenticateRoom } from '../../lib/api-client';
import { setRoomToken } from '../../lib/auth-storage';

type Props = Readonly<{
  roomId: string;
  onAuthenticated: (token: string) => void;
}>;

// AuthFailure → i18n key の map。公開メッセージで rate limit 閾値 (RL_AUTH の
// 10 req/min など) を漏らさない方針は、key 経由でも維持する。
const ERROR_KEY: Record<AuthFailure, I18nKey> = {
  'wrong-password': 'gate.error.wrongPassword',
  'rate-limited': 'gate.error.rateLimited',
  network: 'gate.error.network',
  unexpected: 'gate.error.unexpected',
};

export const RoomGate = ({ roomId, onAuthenticated }: Props) => {
  const t = useTranslation();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const inputId = useId();
  const errorId = useId();
  const headingId = useId();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || password.length === 0) return;
    setSubmitting(true);
    setError(null);
    // `authenticateRoom` は既に fetch を try/catch で包み `{ ok: false, reason: 'network' }`
    // で失敗を露出するが、その契約が将来 regress した場合や下流のバグでこの async
    // handler が unhandled rejection を出すことがある。call site でも try/catch を持つ
    // ことで契約を明示し、`submitting` が常に解除される保証も得る。
    try {
      const result = await authenticateRoom(roomId, password);
      if (result.ok) {
        setRoomToken(roomId, result.token);
        onAuthenticated(result.token);
        // 成功時は `submitting` を解除しない (親が unmount するため)。
        return;
      }
      setError(result.reason);
    } catch {
      setError('unexpected');
    }
    setSubmitting(false);
  };

  const disabled = submitting || password.length === 0;

  return (
    <main className="flex h-dvh w-dvw items-center justify-center bg-(--color-surface) text-(--color-text)">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-6 text-card-foreground shadow-md ring-1 ring-foreground/10"
        aria-labelledby={headingId}
      >
        <div className="flex items-center gap-2">
          <Lock aria-hidden="true" className="h-5 w-5 text-(--color-accent)" />
          <h1 id={headingId} className="text-base font-semibold">
            {t('gate.heading')}
          </h1>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <Label htmlFor={inputId}>{t('gate.password.label')}</Label>
          <Input
            id={inputId}
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="h-10 text-base md:text-base"
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {t(ERROR_KEY[error])}
          </p>
        )}
        <Button type="submit" disabled={disabled} size="lg">
          {submitting ? t('gate.button.submitting') : t('gate.button.submit')}
        </Button>
      </form>
    </main>
  );
};
