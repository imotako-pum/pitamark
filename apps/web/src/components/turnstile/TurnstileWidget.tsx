import { useEffect, useRef } from 'react';

// Phase 7: thin wrapper around `window.turnstile` injected by the
// `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js">`
// tag in `index.html`. The widget renders invisibly; users only see a
// challenge if Cloudflare flags the request.

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          size?: 'invisible' | 'normal' | 'compact';
        },
      ): string;
      reset(widgetId?: string): void;
      remove(widgetId?: string): void;
    };
  }
}

export type TurnstileWidgetProps = Readonly<{
  siteKey: string;
  onSuccess: (token: string) => void;
  onError?: () => void;
}>;

export const TurnstileWidget = ({ siteKey, onSuccess, onError }: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // The Turnstile script is `async defer` so it may not have finished
    // executing by the time React mounts this component. Poll briefly until
    // `window.turnstile` shows up; bail out if the script never loads.
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const tryRender = () => {
      if (cancelled) return;
      const ts = window.turnstile;
      if (!ts) {
        attempts += 1;
        if (attempts > 50) {
          // ~5s of polling at 100ms each — give up rather than hang forever.
          onError?.();
          return;
        }
        pollTimer = setTimeout(tryRender, 100);
        return;
      }
      widgetIdRef.current = ts.render(container, {
        sitekey: siteKey,
        size: 'invisible',
        callback: onSuccess,
        'error-callback': onError,
      });
    };

    tryRender();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, onSuccess, onError]);

  // `aria-hidden` because the widget is invisible; nothing to announce.
  return <div ref={containerRef} aria-hidden="true" />;
};
