import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTranslation } from '../../i18n';
import { logger } from '../../lib/logger';

const FEEDBACK_MS = 1800;

export const CopyUrlButton = () => {
  const t = useTranslation();
  const [copied, setCopied] = useState(false);
  // Keep timer in a ref so unmount can cancel it (avoid setState on unmounted).
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
      toast.success(t('toolbar.copyUrl.toastSuccess'));
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
      toast.error(t('toolbar.copyUrl.toastError'));
    }
  }, [t]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopy}
      aria-label={t('toolbar.copyUrl.aria')}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      <span>{copied ? t('toolbar.copyUrl.copied') : t('toolbar.copyUrl.idle')}</span>
    </Button>
  );
};
