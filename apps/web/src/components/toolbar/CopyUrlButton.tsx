import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../../lib/logger';

const FEEDBACK_MS = 1800;

export const CopyUrlButton = () => {
  const [copied, setCopied] = useState(false);
  // unmount 後に setState が走らないよう timer ID を ref に保持。
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, FEEDBACK_MS);
    } catch (e: unknown) {
      logger.warn('clipboard write failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="ルームURLをコピー"
      className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-toolbar-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-toolbar-bg)]"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      <span>{copied ? 'コピー完了' : 'URL コピー'}</span>
    </button>
  );
};
