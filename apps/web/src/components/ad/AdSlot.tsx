// 将来の Google AdSense 配置用 placeholder。後で `<ins class="adsbygoogle">` を
// 配線するときに CLS / layout shift を起こさないよう領域だけ確保しておく。中身は
// neutral label のみで、script や `<ins>` tag、policy 違反になりそうなコピーは
// 一切持たない。`min-height` は Google Publisher Tag docs の CLS ガイダンスに従い、
// `clamp()` / `dvh` ではなく **px** で固定する。

import { useTranslation } from '../../i18n';

type Variant = 'rail' | 'bottom';

type AdSlotProps = Readonly<{
  variant: Variant;
  /** `rail` のときのみ使う。`left-0` / `right-0` を決定する。 */
  side?: 'left' | 'right';
}>;

// Tailwind の `lg:w-40` (10rem) と同期。EditorShell の stage inset と揃えて
// rail が canvas と重ならないようにする。
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

  // bottom variant は sticky/fixed で、narrow 幅のとき viewport bottom にスクロール
  // 位置に関係なく常時表示する (要望: 常に出てないと困る → bottom 固定)。layout
  // consumer (EditorShell / LandingShell) 側で `BOTTOM_HEIGHT_PX` の bottom inset を
  // 確保しているので、この fixed bar が content に被らない。
  //
  // iOS safe-area: `padding-bottom: env(safe-area-inset-bottom)` で notch/pill の
  // home indicator より上に visible content (label + note) を保つ。Tailwind preflight
  // の `box-sizing: border-box` により padding は 100px 内に含まれるので、bar の外形
  // 100px は不変、EditorShell の stage inset 計算も変わらない。
  return (
    <aside
      aria-label={ariaLabel}
      data-testid="ad-slot-bottom"
      className="fixed inset-x-0 bottom-0 z-20 lg:hidden"
      style={{
        minHeight: BOTTOM_HEIGHT_PX,
        height: BOTTOM_HEIGHT_PX,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className={`h-full w-full ${baseSurface}`}>
        <span>{label}</span>
        <span className="text-[10px] normal-case opacity-80">{note}</span>
      </div>
    </aside>
  );
};
