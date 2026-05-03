import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock `use-image` to spy on the hook's invocation. The real hook would
// instantiate an HTMLImageElement and try to fetch a network resource,
// neither of which is meaningful in a unit test — what matters here is
// the second argument (`crossOrigin`) we pass.
vi.mock('use-image', () => ({
  default: vi.fn(() => [undefined, 'loading'] as const),
}));

// Mock `react-konva` so the component can render without a real canvas.
// Konva's stage requires a canvas backend that happy-dom does not provide.
vi.mock('react-konva', () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Image: () => null,
}));

import useImage from 'use-image';
import { ImageLayer } from '../ImageLayer';

const useImageMock = vi.mocked(useImage);

type RenderProps = {
  src: string;
  onImageLoaded?: (size: { width: number; height: number } | null) => void;
};

const renderImageLayer = (props: RenderProps) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(<ImageLayer src={props.src} onImageLoaded={props.onImageLoaded} />);
  });
  return {
    rerender: (next: RenderProps) => {
      act(() => {
        root?.render(<ImageLayer src={next.src} onImageLoaded={next.onImageLoaded} />);
      });
    },
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

describe('ImageLayer', () => {
  beforeEach(() => {
    useImageMock.mockClear();
    useImageMock.mockReturnValue([undefined, 'loading']);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes crossOrigin="anonymous" to use-image so cross-origin API images do not taint the export canvas', () => {
    const src = 'https://api.example.test/rooms/abc123/image';
    const m = renderImageLayer({ src });

    expect(useImageMock).toHaveBeenCalledWith(src, 'anonymous');

    m.unmount();
  });

  it('notifies onImageLoaded(null) on the initial render to reset downstream transform state', () => {
    const onImageLoaded = vi.fn();
    const m = renderImageLayer({ src: '/a.png', onImageLoaded });

    // First effect: src-change effect runs and emits null.
    expect(onImageLoaded).toHaveBeenCalledWith(null);

    m.unmount();
  });

  it('notifies onImageLoaded with natural dimensions once use-image resolves', () => {
    const onImageLoaded = vi.fn();
    const fakeImage = { naturalWidth: 1920, naturalHeight: 1080 } as HTMLImageElement;
    useImageMock.mockReturnValue([fakeImage, 'loaded']);

    const m = renderImageLayer({ src: '/a.png', onImageLoaded });

    expect(onImageLoaded).toHaveBeenCalledWith({ width: 1920, height: 1080 });

    m.unmount();
  });
});
