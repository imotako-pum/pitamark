// Phase 10.E: minimal language toggle. Two-button segmented control (JA / EN)
// keyed off the i18n core's external store. Placed in the Toolbar (room +
// local modes) and as a floating control in the empty-state DropZone, so
// the user can switch language regardless of which surface they're on.

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
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> would inherit unwanted form semantics + browser default border. role="group" + aria-label cleanly groups the two language buttons without form coupling.
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
