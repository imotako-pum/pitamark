import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExportFilename, triggerDownload } from '../exportPng';

describe('buildExportFilename', () => {
  it('formats roomId-bound filenames as snap-share-{room}-YYYYMMDD-HHMMSS.png', () => {
    const now = new Date(2026, 4, 1, 15, 30, 12); // 2026-05-01 15:30:12 local
    expect(buildExportFilename(now, 'abc123')).toBe('snap-share-abc123-20260501-153012.png');
  });

  it('omits the roomId segment when roomId is null', () => {
    const now = new Date(2026, 4, 1, 15, 30, 12);
    expect(buildExportFilename(now, null)).toBe('snap-share-20260501-153012.png');
  });

  it('zero-pads single-digit components', () => {
    const now = new Date(2026, 0, 1, 0, 0, 0); // 2026-01-01 00:00:00
    expect(buildExportFilename(now, 'a')).toBe('snap-share-a-20260101-000000.png');
  });
});

describe('triggerDownload', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let originalCreate: typeof URL.createObjectURL | undefined;
  let originalRevoke: typeof URL.revokeObjectURL | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    if (originalCreate) URL.createObjectURL = originalCreate;
    if (originalRevoke) URL.revokeObjectURL = originalRevoke;
    vi.useRealTimers();
  });

  it('creates an anchor with download attribute and revokes the blob URL on the next tick', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    triggerDownload(blob, 'snap-share-test.png');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    // Synchronous revoke would break Safari downloads; we defer to setTimeout(0).
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    clickSpy.mockRestore();
  });

  it('still revokes the URL even if anchor click throws', () => {
    const blob = new Blob(['x']);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => triggerDownload(blob, 'fail.png')).toThrow('boom');
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    clickSpy.mockRestore();
  });
});
