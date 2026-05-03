import { useEffect } from 'react';
import { Image as KonvaImage, Layer } from 'react-konva';
import useImage from 'use-image';

type ImageLayerProps = Readonly<{
  src: string;
  /** Fired when the underlying HTMLImageElement reaches natural dimensions.
   *  Null is sent on src change so callers can reset derived state (transform). */
  onImageLoaded?: (size: { width: number; height: number } | null) => void;
}>;

export const ImageLayer = ({ src, onImageLoaded }: ImageLayerProps) => {
  // 'anonymous' marks the underlying <img> as a CORS-enabled fetch so the
  // cross-origin image served by the API (Pages → Workers in production)
  // does not taint the canvas and break PNG export via toBlob().
  const [image] = useImage(src, 'anonymous');

  // Notify caller of src change first so downstream state (e.g. stage
  // transform) resets before the new natural size arrives.
  useEffect(() => {
    onImageLoaded?.(null);
  }, [src, onImageLoaded]);

  useEffect(() => {
    if (!image) return;
    onImageLoaded?.({ width: image.naturalWidth, height: image.naturalHeight });
  }, [image, onImageLoaded]);

  // listening={false} keeps the image purely visual so pointer events fall
  // through to the stage and the annotation tools work over the image.
  return <Layer listening={false}>{image && <KonvaImage image={image} listening={false} />}</Layer>;
};
