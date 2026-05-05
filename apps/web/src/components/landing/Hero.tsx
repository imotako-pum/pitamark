import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';

type HeroProps = Readonly<{
  /** DropZone slot — placed center so the primary CTA stays visible. */
  dropzone: ReactNode;
}>;

export const Hero = ({ dropzone }: HeroProps) => {
  const t = useTranslation();
  return (
    <section
      aria-labelledby="landing-hero-heading"
      className="flex flex-col items-center gap-6 px-4 pt-6 pb-10 sm:px-6 sm:gap-8 md:pt-10"
    >
      <div className="flex flex-col items-center gap-3">
        {/* h2 (not h1) so the existing header h1 "pitamark" remains the page's
            primary heading. The header h1 is hidden below the `md:` breakpoint
            via `hidden md:block`, but on the landing surface this h2 carries
            the actual "what this site is" message. */}
        <h2
          id="landing-hero-heading"
          className="max-w-3xl text-center text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl"
        >
          {t('landing.hero.headline')}
        </h2>
        <p className="max-w-xl text-center text-sm opacity-75 sm:text-base md:text-lg">
          {t('landing.hero.subhead')}
        </p>
      </div>
      {/* dropzone slot may carry siblings (e.g. LocalEditor's protect-password
          panel). Flex gap keeps them legibly separated without forcing each
          slotted element to know about its neighbours. */}
      <div className="flex w-full max-w-2xl flex-col gap-3">{dropzone}</div>
      {/* Phase 10.H v1: SVG editor mock so the picture works with no binary
          assets. Phase 11+ will swap to a real WebP screenshot of the live
          editor (cf. plan Task 11). The <picture> wrapper is kept so the
          future <source srcSet="/landing-hero.webp" /> is a one-line add. */}
      <picture className="block w-full max-w-3xl">
        <img
          src="/landing-hero.svg"
          alt={t('landing.hero.previewAlt')}
          width={1200}
          height={750}
          loading="eager"
          fetchPriority="high"
          className="aspect-[16/10] w-full rounded-xl bg-(--color-toolbar-bg) object-cover shadow-md ring-1 ring-(--color-toolbar-border)"
        />
      </picture>
    </section>
  );
};
