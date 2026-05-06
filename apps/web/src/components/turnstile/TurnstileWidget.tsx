import { useEffect, useRef } from 'react';

// `index.html` の `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js">`
// で読み込まれる `window.turnstile` の薄い wrapper。widget は invisible で描画され、
// Cloudflare が request を flag したときだけユーザに challenge が見える。

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

    // Turnstile script は `async defer` のため、React がこのコンポーネントを mount する
    // 時点でまだ実行が終わっていないことがある。`window.turnstile` が現れるまで短く
    // poll し、永遠に読み込まれない場合は諦める。
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const tryRender = () => {
      if (cancelled) return;
      const ts = window.turnstile;
      if (!ts) {
        attempts += 1;
        if (attempts > 50) {
          // 100ms × 50 回 ≒ 5 秒で諦める (永遠に hang するのを避ける)。
          container.dataset.turnstileStatus = 'error';
          onError?.();
          return;
        }
        pollTimer = setTimeout(tryRender, 100);
        return;
      }
      // `data-turnstile-status` は verification callback の発火状態を E2E から観測する
      // ための唯一の signal で、upload gate が外れた後にファイルを drop したいテストで
      // 使う。production code は読まない。
      container.dataset.turnstileStatus = 'pending';
      widgetIdRef.current = ts.render(container, {
        sitekey: siteKey,
        size: 'invisible',
        callback: (token) => {
          container.dataset.turnstileStatus = 'ready';
          onSuccess(token);
        },
        'error-callback': () => {
          container.dataset.turnstileStatus = 'error';
          onError?.();
        },
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

  // widget は invisible なので screen reader にも知らせる必要が無く `aria-hidden`。
  return <div ref={containerRef} aria-hidden="true" />;
};
