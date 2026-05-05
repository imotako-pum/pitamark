import type Konva from 'konva';

const pad2 = (n: number): string => n.toString().padStart(2, '0');

const formatTimestamp = (now: Date): string => {
  const ymd = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const hms = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `${ymd}-${hms}`;
};

export const buildExportFilename = (now: Date, roomId: string | null): string => {
  const ts = formatTimestamp(now);
  return roomId ? `pitamark-${roomId}-${ts}.png` : `pitamark-${ts}.png`;
};

export type StageBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export const stageToBlob = async (
  stage: Konva.Stage,
  pixelRatio = 2,
  bounds?: StageBounds,
): Promise<Blob> => {
  const canvas = bounds
    ? stage.toCanvas({ ...bounds, pixelRatio })
    : stage.toCanvas({ pixelRatio });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });
};

export const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Defer revoke to the next macrotask: Safari aborts the download if the
    // ObjectURL is revoked synchronously after `a.click()`.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};
