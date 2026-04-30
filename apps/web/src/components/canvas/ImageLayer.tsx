import { Image as KonvaImage, Layer } from 'react-konva';
import useImage from 'use-image';

type ImageLayerProps = Readonly<{
  src: string;
}>;

export const ImageLayer = ({ src }: ImageLayerProps) => {
  const [image] = useImage(src);
  return <Layer>{image && <KonvaImage image={image} />}</Layer>;
};
