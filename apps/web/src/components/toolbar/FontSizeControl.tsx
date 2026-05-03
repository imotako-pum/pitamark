import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../../lib/fontSize';

type FontSizeControlProps = Readonly<{
  // 現在の activeFontSize。中央表示と +/- ボタンの境界 disable に使う。
  activeFontSize: number;
  // 画像未読込時に palette 等と一緒に丸ごと無効化される。
  disabled: boolean;
  onIncrementFontSize: () => void;
  onDecrementFontSize: () => void;
}>;

export const FontSizeControl = ({
  activeFontSize,
  disabled,
  onIncrementFontSize,
  onDecrementFontSize,
}: FontSizeControlProps) => {
  const atMin = activeFontSize <= MIN_FONT_SIZE;
  const atMax = activeFontSize >= MAX_FONT_SIZE;
  return (
    // biome-ignore lint/a11y/useSemanticElements: ColorPalette と同じく role="group" でグルーピング
    <div className="flex items-center gap-0.5" role="group" aria-label="フォントサイズ">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="フォントサイズを小さくする"
              disabled={disabled || atMin}
              onClick={onDecrementFontSize}
              className="rounded-md"
            >
              <Minus aria-hidden="true" />
            </Button>
          }
        />
        <TooltipContent side="bottom">
          <span>小さく [</span>
        </TooltipContent>
      </Tooltip>
      <span
        // role="status" + aria-live で SR が値変化を読み上げる。aria-label は
        // 付けない (親 div の aria-label="フォントサイズ" + 中身のテキスト "18px"
        // で SR は「フォントサイズ 18px」と読む。子に aria-label を重ねると
        // 冗長読み上げになる)。
        // data-testid: E2E から値を一意に取得するためのフック (aria-label を
        // 削った代わり)。複数 role="status" 要素が DOM 内にあっても安全に取れる。
        role="status"
        data-testid="font-size-value"
        className="min-w-10 px-1 text-center text-xs tabular-nums select-none"
        aria-live="polite"
      >
        {activeFontSize}px
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="フォントサイズを大きくする"
              disabled={disabled || atMax}
              onClick={onIncrementFontSize}
              className="rounded-md"
            >
              <Plus aria-hidden="true" />
            </Button>
          }
        />
        <TooltipContent side="bottom">
          <span>大きく ]</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
