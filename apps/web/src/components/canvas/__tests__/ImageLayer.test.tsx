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

const renderImageLayer = (src: string) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(<ImageLayer src={src} />);
  });
  return {
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
    const m = renderImageLayer(src);

    expect(useImageMock).toHaveBeenCalledWith(src, 'anonymous');

    m.unmount();
  });
});
