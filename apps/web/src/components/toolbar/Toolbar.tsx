import {
  ArrowUpRight,
  Download,
  Highlighter,
  ImageMinus,
  MousePointer2,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Tool } from '../../hooks/annotationsReducer';
import { ToolButton } from './ToolButton';

type ToolbarProps = Readonly<{
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  imageLoaded: boolean;
  canExport: boolean;
  onSetTool: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onClearImage: () => void;
  onExport: () => void;
}>;

type ToolDef = Readonly<{
  tool: Tool;
  icon: typeof MousePointer2;
  label: string;
  shortcut: string;
}>;

const TOOL_DEFS: ReadonlyArray<ToolDef> = [
  { tool: 'select', icon: MousePointer2, label: '選択', shortcut: 'V' },
  { tool: 'rectangle', icon: Square, label: '矩形', shortcut: 'R' },
  { tool: 'arrow', icon: ArrowUpRight, label: '矢印', shortcut: 'A' },
  { tool: 'text', icon: Type, label: 'テキスト', shortcut: 'T' },
  { tool: 'highlight', icon: Highlighter, label: 'ハイライト', shortcut: 'H' },
];

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
  onSetTool,
  onUndo,
  onRedo,
  onDelete,
  onClearImage,
  onExport,
}: ToolbarProps) => (
  <TooltipProvider delay={150}>
    <div
      role="toolbar"
      aria-label="編集ツール"
      className={[
        'pointer-events-auto flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-(--color-toolbar-bg)',
        'border-(--color-toolbar-border) px-3 py-2 shadow-sm backdrop-blur',
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        {TOOL_DEFS.map((def) => (
          <ToolButton
            key={def.tool}
            icon={def.icon}
            label={def.label}
            shortcut={def.shortcut}
            pressed={tool === def.tool}
            disabled={!imageLoaded}
            onClick={() => onSetTool(def.tool)}
          />
        ))}
      </div>
      <Divider />
      <div className="flex items-center gap-1">
        <ToolButton
          icon={Undo2}
          label="元に戻す"
          shortcut="⌘Z"
          disabled={!canUndo}
          onClick={onUndo}
        />
        <ToolButton
          icon={Redo2}
          label="やり直し"
          shortcut="⌘⇧Z"
          disabled={!canRedo}
          onClick={onRedo}
        />
        <ToolButton
          icon={Trash2}
          label="削除"
          shortcut="Del"
          tone="danger"
          disabled={!hasSelection}
          onClick={onDelete}
        />
      </div>
      <Divider />
      <div className="flex items-center gap-1">
        <ToolButton
          icon={Download}
          label="PNG 保存"
          shortcut="⌘S"
          disabled={!canExport}
          onClick={onExport}
        />
        <ToolButton
          icon={ImageMinus}
          label="画像をクリア"
          disabled={!imageLoaded}
          onClick={onClearImage}
        />
      </div>
    </div>
  </TooltipProvider>
);
