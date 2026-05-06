// I18nKey union を JA 辞書の shape から派生させる。新文言の追加は `ja.ts` を編集する
// だけで済み、TS が `en.ts` の対応 key を要求してくれる。SSOT 設計で union ↔ ja ↔ en
// の 3 重 drift を防ぐ。

import type { ja } from './ja';

export type I18nKey = keyof typeof ja;

// サポート言語。LangToggle UI がこの union を走査してボタンを描画し、`setLang(...)` も
// この値しか受け付けないので、安定させること。
export type Lang = 'ja' | 'en';
export const SUPPORTED_LANGS: readonly Lang[] = ['ja', 'en'] as const;
