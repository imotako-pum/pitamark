// Phase 10.H: AdSense slot placeholder. Reserves space for future Google
// AdSense placement so that wiring `<ins class="adsbygoogle">` later (Phase
// 11+) does not introduce CLS or layout shift. The visible content is a
// neutral label only — no script, no `<ins>` tag, no policy-flag inducing
// copy. `min-height` is fixed in **px** (not `clamp()` / `dvh`) per the
// CLS guidance from Google Publisher Tag docs.

import { useTranslation } from '../../i18n';

type Variant = 'rail' | 'bottom';

type AdSlotProps = Readonly<{
  variant: Variant;
  /** Only used by `rail`. Determines `left-0` vs `right-0`. */
  side?: 'left' | 'right';
}>;

// Tailwind `lg:w-40` (10rem) — kept in sync with EditorShell stage inset
// so the rail does not overlap the canvas.
export const RAIL_WIDTH_PX = 160;
export const RAIL_MIN_HEIGHT_PX = 600;
export const BOTTOM_HEIGHT_PX = 100;

const baseSurface =
  'flex flex-col items-center justify-center gap-1 bg-(--color-toolbar-bg) text-xs uppercase tracking-wider opacity-50 select-none ring-1 ring-(--color-toolbar-border) ring-inset';

export const AdSlot = ({ variant, side = 'left' }: AdSlotProps) => {
  const t = useTranslation();
  const ariaLabel = t('ad.placeholder.aria');
  const label = t('ad.placeholder.label');
  const note = t('ad.placeholder.note');

  if (variant === 'rail') {
    const sideClass = side === 'left' ? 'left-0' : 'right-0';
    return (
      <aside
        aria-label={ariaLabel}
        data-testid={`ad-slot-rail-${side}`}
        className={`pointer-events-none absolute inset-y-0 ${sideClass} z-0 hidden lg:flex`}
        style={{ width: RAIL_WIDTH_PX, minHeight: RAIL_MIN_HEIGHT_PX }}
      >
        <div className={`h-full w-full ${baseSurface}`}>
          <span>{label}</span>
          <span className="text-[10px] normal-case opacity-80">{note}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label={ariaLabel}
      data-testid="ad-slot-bottom"
      className="relative w-full lg:hidden"
      style={{ minHeight: BOTTOM_HEIGHT_PX, height: BOTTOM_HEIGHT_PX }}
    >
      <div className={`h-full w-full ${baseSurface}`}>
        <span>{label}</span>
        <span className="text-[10px] normal-case opacity-80">{note}</span>
      </div>
    </aside>
  );
};
