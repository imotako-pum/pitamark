import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TOOLS, type Tool } from '../../hooks/annotationsReducer';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

type Row = Readonly<{ label: string; keys: ReadonlyArray<string> }>;
type Section = Readonly<{ title: string; rows: ReadonlyArray<Row> }>;

// Phase 8.x extensibility review #7 M1 案 B: `Readonly<Record<Tool, Row>>`
// 化することで、新しい `Tool` を追加した時点でこの map に key 漏れが
// コンパイルエラーで surface する。`TOOL_ROWS` (配列) は `TOOLS` から
// 順序を借りて生成する。
const TOOL_ROW_BY_TOOL: Readonly<Record<Tool, Row>> = {
  select: { label: '選択', keys: ['V'] },
  rectangle: { label: '矩形', keys: ['R'] },
  arrow: { label: '矢印', keys: ['A'] },
  text: { label: 'テキスト', keys: ['T'] },
  highlight: { label: 'ハイライト', keys: ['H'] },
};

const TOOL_ROWS: ReadonlyArray<Row> = TOOLS.map((t) => TOOL_ROW_BY_TOOL[t]);

const COLOR_ROWS: ReadonlyArray<Row> = [
  { label: '次の色', keys: ['C'] },
  { label: '前の色', keys: ['⇧', 'C'] },
];

const TEXT_ROWS: ReadonlyArray<Row> = [
  { label: 'フォントサイズ +2', keys: [']'] },
  { label: 'フォントサイズ -2', keys: ['['] },
];

// Phase 7.8-5: 次手予測 (矢印→テキスト / 矩形→矢印) のキー規約。Enter は
// pending サジェスト確定 (矩形→矢印プレビューを矢印に確定 + Auto-next-A 連鎖)、
// Esc は pending クリア + 選択解除、Backspace は pending クリア優先 (pending
// なし時は通常の選択削除に戻る)。Backspace は他セクションの「Del」と挙動が
// 異なるため記号 ⌫ で視覚的に分離する。
const PREDICT_ROWS: ReadonlyArray<Row> = [
  { label: 'サジェスト確定', keys: ['Enter'] },
  { label: 'サジェスト破棄', keys: ['Esc'] },
  { label: 'pending クリア', keys: ['⌫'] },
];

const EDIT_ROWS: ReadonlyArray<Row> = [
  { label: '元に戻す', keys: ['⌘', 'Z'] },
  { label: 'やり直し', keys: ['⌘', '⇧', 'Z'] },
  { label: '削除', keys: ['Del'] },
  { label: '選択解除', keys: ['Esc'] },
];

const ZOOM_ROWS: ReadonlyArray<Row> = [
  { label: '全体表示', keys: ['⌘', '0'] },
  { label: '100%', keys: ['⌘', '1'] },
  { label: 'ズーム', keys: ['⌘', 'ホイール'] },
  { label: 'パン', keys: ['Space', 'ドラッグ'] },
];

const EXPORT_ROWS: ReadonlyArray<Row> = [{ label: 'PNG 保存', keys: ['⌘', 'S'] }];

const HELP_ROWS: ReadonlyArray<Row> = [{ label: 'このパネル', keys: ['?'] }];

const SECTIONS: ReadonlyArray<Section> = [
  { title: 'ツール', rows: TOOL_ROWS },
  { title: '色', rows: COLOR_ROWS },
  { title: 'テキスト', rows: TEXT_ROWS },
  { title: '次手予測', rows: PREDICT_ROWS },
  { title: '編集', rows: EDIT_ROWS },
  { title: 'ズーム', rows: ZOOM_ROWS },
  { title: '出力', rows: EXPORT_ROWS },
  { title: 'ヘルプ', rows: HELP_ROWS },
];

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
    {children}
  </kbd>
);

export const HelpModal = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>キーボードショートカット</DialogTitle>
        <DialogDescription>
          すべての操作はキーボードで完結できます。閉じるには Esc か外側をクリック。
          矢印→テキスト・矩形→矢印 のサジェストは Enter で確定 / Esc で破棄。
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <section key={section.title} aria-labelledby={`help-section-${section.title}`}>
            <h3
              id={`help-section-${section.title}`}
              className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {section.title}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {section.rows.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
                  <span>{row.label}</span>
                  <span className="flex items-center gap-1">
                    {row.keys.map((k) => (
                      <Kbd key={`${row.label}-${k}`}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
