// Phase 10.E: I18nKey union derived from the JA dict shape so adding a new
// string anywhere requires only editing `ja.ts` (and TypeScript will then
// force matching keys in `en.ts`). The single-source design avoids the
// 3-way drift problem (union ↔ ja ↔ en).

import type { ja } from './ja';

export type I18nKey = keyof typeof ja;

// Supported languages. Keep this stable — the LangToggle UI iterates over
// this union to render buttons, and `setLang(...)` accepts only these.
export type Lang = 'ja' | 'en';
export const SUPPORTED_LANGS: readonly Lang[] = ['ja', 'en'] as const;
