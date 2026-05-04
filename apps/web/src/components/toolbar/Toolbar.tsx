import {
  ArrowUpRight,
  CircleHelp,
  Download,
  Eraser,
  Highlighter,
  MousePointer2,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TOOLS, type Tool } from '../../hooks/annotationsReducer';
import { type I18nKey, useTranslation } from '../../i18n';
import { ColorPalette } from './ColorPalette';
import { FontSizeControl } from './FontSizeControl';
import { ToolButton } from './ToolButton';

type ToolbarProps = Readonly<{
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  imageLoaded: boolean;
  canExport: boolean;
  activeColor: string;
  activeFontSize: number;
  onSetTool: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onClearImage: () => void;
  onExport: () => void;
  onPickColor: (color: string) => void;
  onIncrementFontSize: () => void;
  onDecrementFontSize: () => void;
  onShowHelp: () => void;
}>;

type ToolDef = Readonly<{
  icon: typeof MousePointer2;
  labelKey: I18nKey;
  shortcut: string;
}>;

// Phase 8.x extensibility review #7 M1 案 B: `Readonly<Record<Tool, ToolDef>>`
// 化することで、`Tool` union に新しい kind を足すと TS が「TOOL_DEFS に key
// が足りない」とコンパイル時に教えてくれる。iteration 順序は `TOOLS` 配列
// (= `['select', ...ANNOTATION_TYPES]`、annotationsReducer.ts) に従う。
// Phase 10.E: `label` を i18n key に置換。実文字列は `useTranslation()` で
// レンダ時に解決する。
const TOOL_DEFS: Readonly<Record<Tool, ToolDef>> = {
  select: { icon: MousePointer2, labelKey: 'toolbar.tool.select', shortcut: 'V' },
  rectangle: { icon: Square, labelKey: 'toolbar.tool.rectangle', shortcut: 'R' },
  arrow: { icon: ArrowUpRight, labelKey: 'toolbar.tool.arrow', shortcut: 'A' },
  text: { icon: Type, labelKey: 'toolbar.tool.text', shortcut: 'T' },
  highlight: { icon: Highlighter, labelKey: 'toolbar.tool.highlight', shortcut: 'H' },
};

const Divider = () => (
  <div aria-hidden="true" className="hidden h-6 w-px bg-(--color-toolbar-border) sm:block" />
);

export const Toolbar = ({
  tool,
  canUndo,
  canRedo,
  hasSelection,
  imageLoaded,
  canExport,
  activeColor,
  activeFontSize,
  onSetTool,
  onUndo,
  onRedo,
  onDelete,
  onClearImage,
  onExport,
  onPickColor,
  onIncrementFontSize,
  onDecrementFontSize,
  onShowHelp,
}: ToolbarProps) => {
  const t = useTranslation();
  return (
    <TooltipProvider delay={150}>
      <div
        role="toolbar"
        aria-label={t('toolbar.group.label')}
        className={[
          'pointer-events-auto flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-(--color-toolbar-bg)',
          'border-(--color-toolbar-border) px-3 py-2 shadow-sm backdrop-blur',
        ].join(' ')}
      >
        <div className="flex items-center gap-1">
          {TOOLS.map((tool_) => {
            const def = TOOL_DEFS[tool_];
            return (
              <ToolButton
                key={tool_}
                icon={def.icon}
                label={t(def.labelKey)}
                shortcut={def.shortcut}
                pressed={tool === tool_}
                disabled={!imageLoaded}
                onClick={() => onSetTool(tool_)}
              />
            );
          })}
        </div>
        <Divider />
        <div className="flex items-center gap-1">
          <ToolButton
            icon={Undo2}
            label={t('toolbar.action.undo')}
            shortcut="⌘Z"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolButton
            icon={Redo2}
            label={t('toolbar.action.redo')}
            shortcut="⌘⇧Z"
            disabled={!canRedo}
            onClick={onRedo}
          />
          <ToolButton
            icon={Trash2}
            label={t('toolbar.action.delete')}
            shortcut="Del"
            tone="danger"
            disabled={!hasSelection}
            onClick={onDelete}
          />
        </div>
        <Divider />
        <ColorPalette activeColor={activeColor} disabled={!imageLoaded} onPickColor={onPickColor} />
        <Divider />
        <FontSizeControl
          activeFontSize={activeFontSize}
          disabled={!imageLoaded}
          onIncrementFontSize={onIncrementFontSize}
          onDecrementFontSize={onDecrementFontSize}
        />
        <Divider />
        <div className="flex items-center gap-1">
          <ToolButton
            icon={Download}
            label={t('toolbar.action.exportPng')}
            shortcut="⌘S"
            disabled={!canExport}
            onClick={onExport}
          />
          <ToolButton
            icon={Eraser}
            label={t('toolbar.action.clearAll')}
            disabled={!imageLoaded}
            onClick={onClearImage}
          />
        </div>
        <Divider />
        <ToolButton
          icon={CircleHelp}
          label={t('toolbar.action.help')}
          shortcut="?"
          onClick={onShowHelp}
        />
      </div>
    </TooltipProvider>
  );
};
