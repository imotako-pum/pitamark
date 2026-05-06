import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';

type HeroProps = Readonly<{
  /** DropZone slot — primary CTA を可視に保つため中央に配置する。 */
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
        {/* h2 にしてあるのは、既存の header h1 "pitamark" をページの primary heading の
            ままにするため。header h1 は `md:` breakpoint 未満で `hidden md:block` により
            非表示になるが、landing 面ではこの h2 が「このサイトは何か」を伝える役割を担う。 */}
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
      {/* dropzone slot は兄弟要素 (例: LocalEditor の protect-password パネル) を
          持つことがある。flex gap で見やすく区切り、slot 側の要素同士が互いを意識
          しなくて済むようにする。 */}
      <div className="flex w-full max-w-2xl flex-col gap-3">{dropzone}</div>
      {/* バイナリアセット無しで動くよう SVG editor mock を採用。将来は実 editor の
          WebP スクリーンショットに差し替える予定で、`<picture>` wrapper を残してある
          ので `<source srcSet="/landing-hero.webp" />` 追加が 1 行で済む。 */}
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
