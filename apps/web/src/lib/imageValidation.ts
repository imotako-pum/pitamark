import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
  MAX_IMAGE_BYTES,
} from '@pitamark/shared';
import type { I18nKey } from '../i18n';

export type ValidImage = Readonly<{
  ok: true;
  contentType: AllowedImageMimeType;
  bytes: number;
}>;

// 翻訳済み string ではなく i18n key を露出することで、consumer は validation を
// 再実行せずに言語切替できる。`errorKey` を generic な `I18nKey` ではなく narrow な
// union にしてあるので、call site が失敗 reason ごとに log / toast を網羅的に分岐できる。
export type ImageValidationErrorKey = 'error.image.unsupportedFormat' | 'error.image.tooLarge';

export type InvalidImage = Readonly<{
  ok: false;
  errorKey: ImageValidationErrorKey;
}>;

export type ValidationResult = ValidImage | InvalidImage;

// コンパイル時 guard: `ImageValidationErrorKey` が i18n 辞書から外れた瞬間に
// この代入が型エラーになる。安価で runtime コスト 0。
type _Assert = ImageValidationErrorKey extends I18nKey ? true : never;
const _check: _Assert = true;
void _check;

const isAllowedMime = (type: string): type is AllowedImageMimeType =>
  (ALLOWED_IMAGE_MIME_TYPES as ReadonlyArray<string>).includes(type);

export const validateImageFile = (file: File): ValidationResult => {
  if (!isAllowedMime(file.type)) {
    return { ok: false, errorKey: 'error.image.unsupportedFormat' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, errorKey: 'error.image.tooLarge' };
  }
  return { ok: true, contentType: file.type, bytes: file.size };
};
