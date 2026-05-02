import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type CreateRoomFailure, createRoom } from '../lib/api-client';
import { validateImageFile } from '../lib/imageValidation';
import { logger } from '../lib/logger';

type ImageSource = Readonly<{
  url: string;
  contentType: string;
  bytes: number;
}>;

export type UseImageSourceOptions = Readonly<{
  /** Fired with the created room id when `POST /rooms` succeeds. */
  onRoomCreated?: (roomId: string) => void;
}>;

type UseImageSource = Readonly<{
  source: ImageSource | null;
  error: string | null;
  /**
   * Validates and previews the image, then fires `POST /rooms`. The
   * `turnstileToken` argument carries the Turnstile widget value (empty
   * string when the widget is disabled in dev). `password` is optional;
   * when supplied (non-empty), the resulting room is password-protected.
   */
  loadFromFile: (file: File, turnstileToken: string, password?: string) => void;
  clear: () => void;
}>;

const FAILURE_TOASTS: Record<CreateRoomFailure['reason'], string> = {
  'rate-limited': 'しばらく経ってからお試しください（アクセスが多すぎます）',
  'image-blocked': 'この画像はアップロードできません',
  turnstile: '認証に失敗しました。再度お試しください',
  invalid: 'アップロードできない形式です',
  network: '通信に失敗しました。ネットワークを確認してください',
};

export const useImageSource = (options: UseImageSourceOptions = {}): UseImageSource => {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const onRoomCreatedRef = useRef(options.onRoomCreated);
  onRoomCreatedRef.current = options.onRoomCreated;

  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  const loadFromFile = useCallback((file: File, turnstileToken: string, password?: string) => {
    const result = validateImageFile(file);
    if (!result.ok) {
      logger.warn('image rejected', {
        name: file.name,
        type: file.type,
        bytes: file.size,
      });
      setError(result.error);
      return;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setError(null);
    setSource({ url, contentType: result.contentType, bytes: result.bytes });
    logger.info('image loaded', { type: result.contentType, bytes: result.bytes });

    // Fire-and-forget room creation. API failure leaves the editor in
    // local-only mode (the ObjectURL above keeps the UX intact); a toast
    // surfaces the specific reason. Success transitions the URL to /r/:id
    // via the caller's onRoomCreated callback.
    void (async () => {
      const out = await createRoom(file, password, turnstileToken);
      if (out.ok) {
        onRoomCreatedRef.current?.(out.room.id);
        return;
      }
      toast.error(FAILURE_TOASTS[out.reason]);
    })();
  }, []);

  const clear = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setSource(null);
    setError(null);
  }, []);

  return { source, error, loadFromFile, clear };
};
