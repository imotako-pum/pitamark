import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { I18nKey } from '../../i18n';
import { useTranslation } from '../../i18n';

// Phase 10.J-2 ADR-0007 D4: 長押し成立時に shape 上の anchor 座標へ pop する menu。
// position: fixed で stage の transform から独立、画面端では flip して viewport 内に
// 収める。各 button は min-w-11 / min-h-11 (= MIN_TAP_TARGET_PX = 44px、iOS HIG / Material 3) で
// 誤タップ回避、destructive (削除) は色分けで視認性向上 + 項目順 last で位置による誤タップ抑止。
// Tailwind の `min-w-11 min-h-11` は class 名が静的解析対象のため、定数値を直接埋め込まず
// コメントで MIN_TAP_TARGET_PX を参照するに留める (Phase 10.J-3 ADR-0007 D2 付帯条件)。

export type ContextMenuItemId = 'duplicate' | 'bring-front' | 'send-back' | 'delete';

type ContextMenuItem = Readonly<{
  id: ContextMenuItemId;
  labelKey: I18nKey;
  variant?: 'destructive';
}>;

// Material 寄り (削除を最後)。Q2 の暫定決定 — iOS 慣習に変える場合はここで順序を変える。
export const CONTEXT_MENU_ITEMS: ReadonlyArray<ContextMenuItem> = [
  { id: 'duplicate', labelKey: 'contextMenu.duplicate' },
  { id: 'bring-front', labelKey: 'contextMenu.bringFront' },
  { id: 'send-back', labelKey: 'contextMenu.sendBack' },
  { id: 'delete', labelKey: 'contextMenu.delete', variant: 'destructive' },
];

type ContextMenuProps = Readonly<{
  open: boolean;
  /** screen 座標 (clientX/clientY)。null なら render しない */
  anchor: { x: number; y: number } | null;
  onSelect: (id: ContextMenuItemId) => void;
  onClose: () => void;
}>;

const VIEWPORT_MARGIN_PX = 8;

/**
 * anchor 座標を viewport 内に収まるようクランプ。
 * - 右端を超えるなら anchor から left 方向に flip
 * - 下端を超えるなら anchor から top 方向に flip
 * - 左/上にも margin を確保
 */
const clampToViewport = (
  anchor: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = anchor.x;
  let y = anchor.y;
  if (x + size.width + VIEWPORT_MARGIN_PX > vw) {
    x = Math.max(VIEWPORT_MARGIN_PX, vw - size.width - VIEWPORT_MARGIN_PX);
  }
  if (x < VIEWPORT_MARGIN_PX) x = VIEWPORT_MARGIN_PX;
  if (y + size.height + VIEWPORT_MARGIN_PX > vh) {
    y = Math.max(VIEWPORT_MARGIN_PX, vh - size.height - VIEWPORT_MARGIN_PX);
  }
  if (y < VIEWPORT_MARGIN_PX) y = VIEWPORT_MARGIN_PX;
  return { x, y };
};

export const ContextMenu = ({ open, anchor, onSelect, onClose }: ContextMenuProps) => {
  const t = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  // open + anchor 確定後に menu の実サイズを計測して clamp。layout effect で flicker 回避。
  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) {
      setPosition(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    setPosition(clampToViewport(anchor, { width: rect.width, height: rect.height }));
  }, [open, anchor]);

  // menu 外 pointerdown で close。menu 内の interaction は上で stopPropagation するため除外される。
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    // capture で先回りに拾う (canvas の onPointerDown より早く)
    document.addEventListener('pointerdown', handler, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', handler, { capture: true });
    };
  }, [open, onClose]);

  if (!open || !anchor) return null;

  // 初期 render 時 (position 未確定) は anchor の生座標で先に描画 → useLayoutEffect で再配置。
  // visibility: hidden を使うと幅計測ができないため、position だけ仮置きして show する。
  const style = position ?? anchor;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t('contextMenu.delete')}
      className={cn(
        'fixed z-50 min-w-44 select-none rounded-lg border bg-popover py-1 shadow-md',
        'border-border text-popover-foreground',
      )}
      style={{ left: style.x, top: style.y }}
      // menu 自身のクリックが click-outside-to-close をトリガしないように capture phase で stop。
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      {CONTEXT_MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={cn(
            'flex w-full items-center px-4 text-left text-sm',
            'min-h-11 hover:bg-accent hover:text-accent-foreground',
            item.variant === 'destructive' && 'text-destructive hover:bg-destructive/10',
          )}
          onClick={() => {
            onSelect(item.id);
            onClose();
          }}
        >
          {t(item.labelKey)}
        </button>
      ))}
    </div>
  );
};
