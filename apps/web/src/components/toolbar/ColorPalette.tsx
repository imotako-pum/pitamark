import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTouchDevice } from '../../hooks/useTouchDevice';
import { interpolate, useTranslation } from '../../i18n';
import { COLOR_PALETTE } from '../canvas/colors';

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
  // Phase 10.I-3: touch 時は swatch の visual (16px) を保ったまま hit zone を 44px に拡張。
  const isTouch = useTouchDevice();
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
                    'rounded-full border border-transparent p-0',
                    isTouch && 'min-w-11 min-h-11',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="block size-4 rounded-full"
                    style={{
                      background: color,
                      // TM-B 二重 ring: 内側 1px chip border + 1.5px white gap + 3.5px Y1 赤。
                      // pressed 以外は現状通り 1px の inset border のみ。
                      boxShadow: pressed
                        ? 'inset 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 1.5px oklch(98% 0 0), 0 0 0 3.5px oklch(60% 0.22 28)'
                        : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
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
