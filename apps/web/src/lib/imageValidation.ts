import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
  MAX_IMAGE_BYTES,
} from '@snap-share/shared';
import type { I18nKey } from '../i18n';

export type ValidImage = Readonly<{
  ok: true;
  contentType: AllowedImageMimeType;
  bytes: number;
}>;

// Phase 10.E: surface i18n keys instead of pre-translated strings, so the
// consumer can switch language without re-running validation. The narrow
// `errorKey` union (vs. a generic `I18nKey`) lets call sites exhaustively
// switch on the failure reason if they need to log / toast differently.
export type ImageValidationErrorKey =
  | 'error.image.unsupportedFormat'
  | 'error.image.tooLarge';

export type InvalidImage = Readonly<{
  ok: false;
  errorKey: ImageValidationErrorKey;
}>;

export type ValidationResult = ValidImage | InvalidImage;

// Compile-time guard: if `ImageValidationErrorKey` ever drifts from the i18n
// dict, this assignment fails. Cheap, zero runtime cost.
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
