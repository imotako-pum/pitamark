import type { ReactNode } from 'react';
import { AdSlot } from '../ad/AdSlot';
import { Faq } from './Faq';
import { Features } from './Features';
import { Hero } from './Hero';
import { HowTo } from './HowTo';

type LandingShellProps = Readonly<{
  /** DropZone slot, kept central in Hero so the primary CTA never moves. */
  dropzone: ReactNode;
}>;

// Phase 10.H: Conditional landing shell rendered when `useImageSource.source
// === null`. The wrapping div owns the vertical scroll so the editor area's
// `h-dvh` constraint stays intact (no chrome-eating overflow on the parent).
// `bottom AdSlot` is only emitted here because Q1 暫定: ad rails appear on
// `lg:` always, but the bottom slot only on the landing surface (not in
// editor mode where workspace must be uninterrupted).
export const LandingShell = ({ dropzone }: LandingShellProps) => (
  <div className="flex h-full w-full flex-col overflow-y-auto">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 pb-12 sm:gap-4">
      <Hero dropzone={dropzone} />
      <Features />
      <HowTo />
      <Faq />
    </div>
    <AdSlot variant="bottom" />
  </div>
);
