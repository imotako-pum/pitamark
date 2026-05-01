import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoom } from '../lib/api-client';
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
   * Validates and previews the image, then fires `POST /rooms`. When `password`
   * is supplied (non-empty), the resulting room is password-protected.
   */
  loadFromFile: (file: File, password?: string) => void;
  clear: () => void;
}>;

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

  const loadFromFile = useCallback((file: File, password?: string) => {
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
    // local-only mode (the ObjectURL above keeps the UX intact); success
    // transitions the URL to /r/:id via the caller's onRoomCreated callback.
    //
    // NOTE: this IIFE intentionally outlives the hook. The only state it
    // touches after `await` is `onRoomCreatedRef.current`, which is null-safe.
    // The parent (LocalEditor) only unmounts in response to that callback
    // firing — i.e. the hook is alive whenever the callback would matter.
    void (async () => {
      const room = await createRoom(file, password);
      if (room) {
        onRoomCreatedRef.current?.(room.id);
      }
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
