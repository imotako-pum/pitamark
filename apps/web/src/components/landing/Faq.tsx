import type { I18nKey } from '../../i18n';
import { useTranslation } from '../../i18n';

type FaqItem = Readonly<{
  question: I18nKey;
  answer: I18nKey;
}>;

const ITEMS: ReadonlyArray<FaqItem> = [
  { question: 'landing.faq.q1', answer: 'landing.faq.a1' },
  { question: 'landing.faq.q2', answer: 'landing.faq.a2' },
  { question: 'landing.faq.q3', answer: 'landing.faq.a3' },
  { question: 'landing.faq.q4', answer: 'landing.faq.a4' },
] as const;

// Native <details>/<summary> for FAQ accordion — keyboard / SR semantics
// come for free, no shadcn / framer-motion / aria-controls plumbing needed.
export const Faq = () => {
  const t = useTranslation();
  return (
    <section
      aria-labelledby="landing-faq-heading"
      className="flex flex-col gap-4 px-4 py-8 sm:px-6"
    >
      <h2
        id="landing-faq-heading"
        className="text-center text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {t('landing.faq.heading')}
      </h2>
      <ul className="flex flex-col gap-2">
        {ITEMS.map((item) => (
          <li
            key={item.question}
            className="rounded-lg bg-(--color-toolbar-bg) ring-1 ring-(--color-toolbar-border)"
          >
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium sm:text-base">
                <span>{t(item.question)}</span>
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-(--color-accent) transition-transform duration-(--duration-fast) ease-(--ease-out-expo) group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-4 pb-4 text-sm opacity-80 sm:text-base">{t(item.answer)}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
};
