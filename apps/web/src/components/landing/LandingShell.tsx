import type { ReactNode } from 'react';
import { Faq } from './Faq';
import { Features } from './Features';
import { Hero } from './Hero';
import { HowTo } from './HowTo';

type LandingShellProps = Readonly<{
  /** DropZone slot。primary CTA を動かさないため Hero の中央に保持する。 */
  dropzone: ReactNode;
}>;

// `useImageSource.source === null` のときに表示する landing 用 shell。
// 縦スクロールを wrapping div に持たせて、editor area の `h-dvh` 制約が壊れない
// (親で overflow が chrome を侵食しない) ようにする。bottom AdSlot は EditorShell
// (page-shell 直下、fixed bottom) に置くので、スクロール位置に関係なく常時表示される。
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
