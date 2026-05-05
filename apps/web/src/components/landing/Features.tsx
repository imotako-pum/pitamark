import { Link2, Timer, Users } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import type { I18nKey } from '../../i18n';
import { useTranslation } from '../../i18n';

type FeatureItem = Readonly<{
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  titleKey: I18nKey;
  bodyKey: I18nKey;
}>;

const ITEMS: ReadonlyArray<FeatureItem> = [
  {
    icon: Link2,
    titleKey: 'landing.features.urlShare.title',
    bodyKey: 'landing.features.urlShare.body',
  },
  {
    icon: Users,
    titleKey: 'landing.features.collab.title',
    bodyKey: 'landing.features.collab.body',
  },
  {
    icon: Timer,
    titleKey: 'landing.features.ttl.title',
    bodyKey: 'landing.features.ttl.body',
  },
] as const;

export const Features = () => {
  const t = useTranslation();
  return (
    <section
      aria-labelledby="landing-features-heading"
      className="flex flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <h2
        id="landing-features-heading"
        className="text-center text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {t('landing.features.heading')}
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.titleKey}
              className="flex flex-col items-start gap-2 rounded-xl bg-(--color-toolbar-bg) p-5 ring-1 ring-(--color-toolbar-border)"
            >
              <Icon
                aria-hidden="true"
                strokeWidth={1.5}
                className="h-7 w-7 text-(--color-accent)"
              />
              <h3 className="text-base font-semibold sm:text-lg">{t(item.titleKey)}</h3>
              <p className="text-sm opacity-75">{t(item.bodyKey)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
