import type { ReactNode } from 'react';
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
// The bottom AdSlot lives in EditorShell (page-shell level, fixed bottom)
// rather than here, so it stays pinned regardless of scroll position.
export const LandingShell = ({ dropzone }: LandingShellProps) => (
  <div className="flex h-full w-full flex-col overflow-y-auto">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 pb-12 sm:gap-4">
      <Hero dropzone={dropzone} />
      <Features />
      <HowTo />
      <Faq />
    </div>
  </div>
);
