import type { ConnectionStatus } from '../../hooks/yjs-annotations-context';
import { type I18nKey, useTranslation } from '../../i18n';

type Props = Readonly<{ status: ConnectionStatus }>;

const STATUS_KEY: Record<ConnectionStatus, I18nKey> = {
  connecting: 'connection.connecting',
  connected: 'connection.connected',
  disconnected: 'connection.disconnected',
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connecting: 'bg-amber-400 animate-pulse',
  connected: 'bg-emerald-500',
  disconnected: 'bg-rose-500 animate-pulse',
};

export const ConnectionBadge = ({ status }: Props) => {
  const t = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute right-4 bottom-14 z-10 flex items-center gap-2 rounded-full bg-(--color-surface) px-3 py-1.5 text-xs shadow-sm ring-1 ring-black/10"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
      <span>{t(STATUS_KEY[status])}</span>
    </div>
  );
};
