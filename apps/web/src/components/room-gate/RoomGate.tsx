import { Lock } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { type AuthFailure, authenticateRoom } from '../../lib/api-client';
import { setRoomToken } from '../../lib/auth-storage';

type Props = Readonly<{
  roomId: string;
  onAuthenticated: (token: string) => void;
}>;

const ERROR_TEXT: Record<AuthFailure, string> = {
  'wrong-password': 'パスワードが違います',
  network: 'ネットワークエラーが発生しました',
  unexpected: '入室処理に失敗しました',
};

export const RoomGate = ({ roomId, onAuthenticated }: Props) => {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AuthFailure | null>(null);
  const inputId = useId();
  const errorId = useId();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || password.length === 0) return;
    setSubmitting(true);
    setError(null);
    const result = await authenticateRoom(roomId, password);
    if (result.ok) {
      setRoomToken(roomId, result.token);
      onAuthenticated(result.token);
      // Do NOT clear `submitting`: parent will unmount us on success.
      return;
    }
    setError(result.reason);
    setSubmitting(false);
  };

  const disabled = submitting || password.length === 0;

  return (
    <main className="flex h-dvh w-dvw items-center justify-center bg-(--color-surface) text-(--color-text)">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-white p-6 shadow-md ring-1 ring-black/10"
        aria-labelledby={`${inputId}-heading`}
      >
        <div className="flex items-center gap-2">
          <Lock aria-hidden="true" className="h-5 w-5 text-(--color-accent)" />
          <h1 id={`${inputId}-heading`} className="text-base font-semibold">
            このルームはパスワードで保護されています
          </h1>
        </div>
        <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
          <span>パスワード</span>
          <input
            id={inputId}
            type="password"
            // biome-ignore lint/a11y/noAutofocus: focus the password field on entry — this is the only interactive element.
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="rounded-md border border-(--color-toolbar-border) bg-(--color-surface) px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
          />
        </label>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-rose-600">
            {ERROR_TEXT[error]}
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-(--color-accent) px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '認証中…' : '入室'}
        </button>
      </form>
    </main>
  );
};
