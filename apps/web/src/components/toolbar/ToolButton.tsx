import type { ComponentType } from 'react';

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
    'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface)] aria-pressed:border-[color:var(--color-accent)] aria-pressed:text-[color:var(--color-accent)]',
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
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent',
        'transition-colors duration-(--duration-fast) ease-(--ease-out-expo)',
        'focus-visible:outline focus-visible:outline-(--color-accent) focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        TONE_CLASS[tone],
      ].join(' ')}
    >
      <Icon size={18} strokeWidth={1.75} />
    </button>
  );
};
