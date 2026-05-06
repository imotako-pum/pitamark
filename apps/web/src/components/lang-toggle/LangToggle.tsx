// 最小構成の language toggle。i18n core の external store に紐づいた 2 ボタン
// segmented control (JA / EN)。Toolbar (room + local モード) と empty-state DropZone の
// floating control の両方に置き、どの面にいてもユーザが言語を切り替えられるようにする。

import { cn } from '@/lib/utils';
import { type Lang, SUPPORTED_LANGS, setLang, useCurrentLang, useTranslation } from '../../i18n';

type Props = Readonly<{
  className?: string;
}>;

const LANG_LABEL: Record<Lang, 'JA' | 'EN'> = {
  ja: 'JA',
  en: 'EN',
};

export const LangToggle = ({ className }: Props) => {
  const t = useTranslation();
  const lang = useCurrentLang();
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> だと form semantics と browser default border が付いてくる。role="group" + aria-label で form 結合なしに 2 ボタンをまとめる。
    <div
      role="group"
      aria-label={t('common.langToggle.label')}
      className={cn(
        'inline-flex items-center rounded-md border border-(--color-toolbar-border) bg-(--color-toolbar-bg) p-0.5 text-xs',
        className,
      )}
    >
      {SUPPORTED_LANGS.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={active}
            aria-label={t(`common.langToggle.${l}` as const)}
            onClick={() => setLang(l)}
            className={cn(
              'rounded px-2 py-0.5 font-medium tabular-nums transition-colors',
              active
                ? 'bg-(--color-accent) text-white shadow-sm'
                : 'text-(--color-text) opacity-70 hover:opacity-100',
            )}
          >
            {LANG_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
};
