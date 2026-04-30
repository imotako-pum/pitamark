import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
  MAX_IMAGE_BYTES,
} from '@snap-share/shared';

export type ValidImage = Readonly<{
  ok: true;
  contentType: AllowedImageMimeType;
  bytes: number;
}>;

export type InvalidImage = Readonly<{
  ok: false;
  error: string;
}>;

export type ValidationResult = ValidImage | InvalidImage;

const isAllowedMime = (type: string): type is AllowedImageMimeType =>
  (ALLOWED_IMAGE_MIME_TYPES as ReadonlyArray<string>).includes(type);

export const validateImageFile = (file: File): ValidationResult => {
  if (!isAllowedMime(file.type)) {
    return {
      ok: false,
      error: '画像ファイルをドロップしてください (PNG / JPEG / WebP / SVG)。',
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: '画像サイズが大きすぎます (上限 10MB)。',
    };
  }
  return { ok: true, contentType: file.type, bytes: file.size };
};
