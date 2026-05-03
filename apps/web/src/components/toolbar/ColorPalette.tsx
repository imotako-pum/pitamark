import { Brush, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { COLOR_PALETTE, OUTLINE_ACCENT } from '../canvas/colors';

type ColorPaletteProps = Readonly<{
  pickedColor: string;
  hasSelection: boolean;
  disabled: boolean;
  onPickColor: (color: string) => void;
  onApplyAsDefault: (color: string) => void;
  onApplyToSelected: (color: string) => void;
}>;

export const ColorPalette = ({
  pickedColor,
  hasSelection,
  disabled,
  onPickColor,
  onApplyAsDefault,
  onApplyToSelected,
}: ColorPaletteProps) => (
  // biome-ignore lint/a11y/useSemanticElements: fieldset would inherit unwanted form semantics; role="group" + aria-label cleanly groups the swatch + 2 apply buttons.
  <div className="flex items-center gap-1" role="group" aria-label="色パレット">
    <div className="flex items-center gap-0.5">
      {COLOR_PALETTE.map((color) => {
        const pressed = pickedColor === color;
        return (
          <Tooltip key={color}>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`色: ${color}`}
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
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="新規描画のデフォルト色に設定"
            disabled={disabled}
            onClick={() => onApplyAsDefault(pickedColor)}
            className="rounded-md border border-transparent"
          >
            <Brush size={18} strokeWidth={1.75} />
          </Button>
        }
      />
      <TooltipContent side="bottom">
        <span>新規デフォルトに設定</span>
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="選択中の注釈に色を適用"
            disabled={disabled || !hasSelection}
            onClick={() => onApplyToSelected(pickedColor)}
            className="rounded-md border border-transparent"
          >
            <Wand2 size={18} strokeWidth={1.75} />
          </Button>
        }
      />
      <TooltipContent side="bottom">
        <span>選択中に適用</span>
      </TooltipContent>
    </Tooltip>
  </div>
);
