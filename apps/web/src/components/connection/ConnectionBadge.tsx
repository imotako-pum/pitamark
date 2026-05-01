import type { ConnectionStatus } from '../../hooks/yjs-annotations-context';

type Props = Readonly<{ status: ConnectionStatus }>;

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: '接続中…',
  connected: '同期中',
  disconnected: '再接続中…',
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connecting: 'bg-amber-400 animate-pulse',
  connected: 'bg-emerald-500',
  disconnected: 'bg-rose-500 animate-pulse',
};

export const ConnectionBadge = ({ status }: Props) => (
  <div
    role="status"
    aria-live="polite"
    className="pointer-events-none absolute right-4 bottom-4 z-10 flex items-center gap-2 rounded-full bg-(--color-surface) px-3 py-1.5 text-xs shadow-sm ring-1 ring-black/10"
  >
    <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
    <span>{STATUS_LABEL[status]}</span>
  </div>
);
