import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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

// `danger` tone は shadcn の `--destructive` bridge 変数を経由する。inline OKLCH
// literal を直接書くと toolbar palette が `tokens.css` と乖離するため、変数 1 本に
// 揃えて将来の destructive 色変更を 1 箇所で済ませる。
const TONE_CLASS: Record<NonNullable<ToolButtonProps['tone']>, string> = {
  default:
    'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:border-(--color-accent)',
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
      className={cn('rounded-md border border-transparent', TONE_CLASS[tone])}
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
