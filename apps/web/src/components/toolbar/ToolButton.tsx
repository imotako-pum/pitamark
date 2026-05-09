import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTouchDevice } from '../../hooks/useTouchDevice';

type IconProps = Readonly<{ size?: number; strokeWidth?: number }>;

type ToolButtonProps = Readonly<{
  icon: ComponentType<IconProps>;
  label: string;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
}>;

// Active tool は Y1 logo の赤と整合させる: 薄赤 bg + 中赤 border + 濃赤 icon。
// 値は oklch (token を新設するほどでもないので Tailwind 任意値構文で直書き)。
const TONE_CLASS: Record<NonNullable<ToolButtonProps['tone']>, string> = {
  default: [
    'aria-pressed:bg-[oklch(95%_0.06_28)]',
    'aria-pressed:text-[oklch(40%_0.2_28)]',
    'aria-pressed:border-[oklch(70%_0.18_28)]',
  ].join(' '),
  danger: 'text-destructive hover:bg-destructive/10',
};

export const ToolButton = ({
  icon: Icon,
  label,
  shortcut,
  pressed = false,
  disabled = false,
  tone = 'default',
  onClick,
}: ToolButtonProps) => {
  // Phase 10.I-3: touch 環境では visual サイズ (size="icon" = 32px) は維持しつつ、
  // hit zone のみ iOS HIG 44pt / Material 48dp に拡張する。詳細は ADR-0006 / Phase 10.I PRD。
  const isTouch = useTouchDevice();
  // Radix 系 trigger は disabled button では開かない。常に Tooltip を render して、
  // 開閉判断は Tooltip の focus/hover gating に任せる。disabled な <button> は focus
  // event を発火しないのでこれで十分。
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md border border-transparent',
        TONE_CLASS[tone],
        isTouch && 'min-w-11 min-h-11',
      )}
    >
      <Icon size={18} strokeWidth={1.75} />
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent side="bottom">
        <span>{label}</span>
        {shortcut && (
          <kbd
            data-slot="kbd"
            className="ml-1 rounded bg-(--color-toolbar-bg) px-1 text-[10px] text-(--color-text)"
          >
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
};
