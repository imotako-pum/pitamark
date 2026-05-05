import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { interpolate, useTranslation } from '../../i18n';
import { COLOR_PALETTE, OUTLINE_ACCENT } from '../canvas/colors';

type ColorPaletteProps = Readonly<{
  // Color shown as the current "ring" indicator. Reflects what the next draw
  // will use AND, when something is selected, that thing's current color.
  activeColor: string;
  disabled: boolean;
  // Single click handler — the parent (EditorShell) decides whether to also
  // apply the color to the currently selected annotation. The palette itself
  // does not know about selection.
  onPickColor: (color: string) => void;
}>;

export const ColorPalette = ({ activeColor, disabled, onPickColor }: ColorPaletteProps) => {
  const t = useTranslation();
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset would inherit unwanted form semantics; role="group" + aria-label cleanly groups the palette swatches.
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label={t('toolbar.colorPalette.groupLabel')}
    >
      {COLOR_PALETTE.map((color) => {
        const pressed = activeColor === color;
        return (
          <Tooltip key={color}>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={interpolate(t('toolbar.colorPalette.swatchAria'), { color })}
                  aria-pressed={pressed}
                  disabled={disabled}
                  onClick={() => onPickColor(color)}
                  className={cn(
                    'rounded-md border border-transparent p-0',
                    pressed && 'border-(--color-accent)',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="block size-4 rounded-[3px]"
                    style={{
                      background: color,
                      boxShadow: pressed
                        ? `0 0 0 2px ${OUTLINE_ACCENT} inset`
                        : '0 0 0 1px rgba(0,0,0,0.12) inset',
                    }}
                  />
                </Button>
              }
            />
            <TooltipContent side="bottom">
              <span>{color}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
