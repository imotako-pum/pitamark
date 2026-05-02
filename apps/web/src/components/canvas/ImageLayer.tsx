import { Image as KonvaImage, Layer } from 'react-konva';
import useImage from 'use-image';

type ImageLayerProps = Readonly<{
  src: string;
}>;

export const ImageLayer = ({ src }: ImageLayerProps) => {
  // 'anonymous' marks the underlying <img> as a CORS-enabled fetch so the
  // cross-origin image served by the API (Pages → Workers in production)
  // does not taint the canvas and break PNG export via toBlob().
  const [image] = useImage(src, 'anonymous');
  // listening={false} keeps the image purely visual so pointer events fall
  // through to the stage and the annotation tools work over the image.
  return <Layer listening={false}>{image && <KonvaImage image={image} listening={false} />}</Layer>;
};
