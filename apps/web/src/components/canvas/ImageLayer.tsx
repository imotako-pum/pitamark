import { Image as KonvaImage, Layer } from 'react-konva';
import useImage from 'use-image';

type ImageLayerProps = Readonly<{
  src: string;
}>;

export const ImageLayer = ({ src }: ImageLayerProps) => {
  const [image] = useImage(src);
  // listening={false} keeps the image purely visual so pointer events fall
  // through to the stage and the annotation tools work over the image.
  return <Layer listening={false}>{image && <KonvaImage image={image} listening={false} />}</Layer>;
};
