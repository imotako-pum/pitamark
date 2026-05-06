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
  /** `POST /rooms` 成功時に作成された roomId を流す callback。 */
  onRoomCreated?: (roomId: string) => void;
}>;

type UseImageSource = Readonly<{
  source: ImageSource | null;
  // 翻訳済 string ではなく安定した i18n key を露出する。validation 実行時の言語と
  // DropZone の re-render 時の言語が違っても、key 経由で正しい翻訳を引ける。
  errorKey: ImageValidationErrorKey | null;
  /**
   * 画像を validate + preview してから `POST /rooms` を発火する。`turnstileToken` は
   * Turnstile widget の値 (dev で無効化されているときは空文字列)。`password` は省略可で、
   * non-empty を渡すと protected room として作成される。
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
  // 翻訳関数を ref 経由で保持。非同期 createRoom 失敗時の toast が、言語切替のたびに
  // loadFromFile callback を作り直さなくても最新の翻訳を引ける。
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

    // fire-and-forget で room を作成。API 失敗時は editor を local-only モードのまま残し
    // (ObjectURL で UX は維持)、reason を toast で出す。成功時は caller の onRoomCreated
    // 経由で URL を /r/:id に遷移させる。
    void (async () => {
      const out = await createRoom(file, password, turnstileToken);
      if (out.ok) {
        // protected room の uploader は server から受け取った token を sessionStorage に
        // 入れてから URL push する。RoomEditor の getRoomToken() が即ヒットし RoomGate を
        // skip できる。受信者 (URL 共有された別 browser) は sessionStorage が空なので
        // 従来通り RoomGate → POST /rooms/:id/auth → token 取得 の経路を辿る。
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
