import { useCallback, useEffect, useRef, useState } from 'react';
import { validateImageFile } from '../lib/imageValidation';
import { logger } from '../lib/logger';

type ImageSource = Readonly<{
  url: string;
  contentType: string;
  bytes: number;
}>;

type UseImageSource = Readonly<{
  source: ImageSource | null;
  error: string | null;
  loadFromFile: (file: File) => void;
  clear: () => void;
}>;

export const useImageSource = (): UseImageSource => {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  const loadFromFile = useCallback((file: File) => {
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
