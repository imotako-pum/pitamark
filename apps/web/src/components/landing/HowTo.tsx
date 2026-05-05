import type { I18nKey } from '../../i18n';
import { useTranslation } from '../../i18n';

const STEPS: ReadonlyArray<I18nKey> = [
  'landing.howto.step1',
  'landing.howto.step2',
  'landing.howto.step3',
] as const;

export const HowTo = () => {
  const t = useTranslation();
  return (
    <section
      aria-labelledby="landing-howto-heading"
      className="flex flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <h2
        id="landing-howto-heading"
        className="text-center text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {t('landing.howto.heading')}
      </h2>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
        {STEPS.map((key, index) => (
          <li
            key={key}
            className="flex items-center gap-3 rounded-xl bg-(--color-toolbar-bg) px-4 py-5 ring-1 ring-(--color-toolbar-border)"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-(--color-accent) text-base font-bold text-white"
            >
              {index + 1}
            </span>
            <p className="text-sm font-medium sm:text-base">{t(key)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};
