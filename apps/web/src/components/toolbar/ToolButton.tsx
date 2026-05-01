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

const TONE_CLASS: Record<NonNullable<ToolButtonProps['tone']>, string> = {
  default:
    'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:border-(--color-accent)',
  danger: 'text-[color:oklch(54%_0.22_27)] hover:bg-[color:oklch(96%_0.05_27)]',
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
  // Radix-style triggers don't open on disabled buttons. We always render the
  // Tooltip but rely on Tooltip's own focus/hover gating, which is fine because
  // a disabled native <button> doesn't fire focus events.
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
