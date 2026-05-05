import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type I18nKey, useTranslation } from '../i18n';
import { type CreateRoomFailure, createRoom } from '../lib/api-client';
import { setRoomToken } from '../lib/auth-storage';
import { type ImageValidationErrorKey, validateImageFile } from '../lib/imageValidation';
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
  // Phase 10.E: surface a stable i18n key instead of a pre-translated string
  // so DropZone can re-render in the user's chosen language even if the
  // validation ran while the previous language was active.
  errorKey: ImageValidationErrorKey | null;
  /**
   * Validates and previews the image, then fires `POST /rooms`. The
   * `turnstileToken` argument carries the Turnstile widget value (empty
   * string when the widget is disabled in dev). `password` is optional;
   * when supplied (non-empty), the resulting room is password-protected.
   */
  loadFromFile: (file: File, turnstileToken: string, password?: string) => void;
  clear: () => void;
}>;

const FAILURE_KEY: Record<CreateRoomFailure['reason'], I18nKey> = {
  'rate-limited': 'error.upload.rateLimited',
  'image-blocked': 'error.upload.blocked',
  turnstile: 'error.upload.turnstileFailed',
  invalid: 'error.upload.invalidFormat',
  network: 'error.upload.network',
};

export const useImageSource = (options: UseImageSourceOptions = {}): UseImageSource => {
  const t = useTranslation();
  const [source, setSource] = useState<ImageSource | null>(null);
  const [errorKey, setErrorKey] = useState<ImageValidationErrorKey | null>(null);
  const urlRef = useRef<string | null>(null);
  const onRoomCreatedRef = useRef(options.onRoomCreated);
  onRoomCreatedRef.current = options.onRoomCreated;
  // Translation function ref so the async createRoom failure handler can fire
  // toasts without re-running the loadFromFile callback on every lang change.
  const tRef = useRef(t);
  tRef.current = t;

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
      setErrorKey(result.errorKey);
      return;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setErrorKey(null);
    setSource({ url, contentType: result.contentType, bytes: result.bytes });
    logger.info('image loaded', { type: result.contentType, bytes: result.bytes });

    // Fire-and-forget room creation. API failure leaves the editor in
    // local-only mode (the ObjectURL above keeps the UX intact); a toast
    // surfaces the specific reason. Success transitions the URL to /r/:id
    // via the caller's onRoomCreated callback.
    void (async () => {
      const out = await createRoom(file, password, turnstileToken);
      if (out.ok) {
        // Phase 7.6 既知-5 fix: protected room の uploader は server が返した
        // token を sessionStorage に書いてから URL push する。これで
        // RoomEditor の getRoomToken() が即ヒットし RoomGate を skip できる。
        // 受信者経路 (URL 共有された別 browser) は sessionStorage が空なので
        // 従来通り RoomGate → POST /rooms/:id/auth → token 取得。
        if (out.token) setRoomToken(out.room.id, out.token);
        onRoomCreatedRef.current?.(out.room.id);
        return;
      }
      toast.error(tRef.current(FAILURE_KEY[out.reason]));
    })();
  }, []);

  const clear = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setSource(null);
    setErrorKey(null);
  }, []);

  return { source, errorKey, loadFromFile, clear };
};
