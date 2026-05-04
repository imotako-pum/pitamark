import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TOOLS, type Tool } from '../../hooks/annotationsReducer';
import { type I18nKey, useTranslation } from '../../i18n';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

// Phase 10.E: rows are described as i18n keys instead of literal strings, so
// the cheat-sheet swaps language with the rest of the UI. Some keycaps are
// also locale-specific (`ホイール` / `ドラッグ` vs `Wheel` / `Drag`); they go
// through the dict via `keyKeys`. Plain symbols stay as literals.

type KeyAtom = string | { readonly key: I18nKey };
type Row = Readonly<{ labelKey: I18nKey; keys: ReadonlyArray<KeyAtom> }>;
type Section = Readonly<{ titleKey: I18nKey; rows: ReadonlyArray<Row> }>;

// Phase 8.x extensibility review #7 M1 案 B: `Readonly<Record<Tool, Row>>`
// 化することで、新しい `Tool` を追加した時点でこの map に key 漏れが
// コンパイルエラーで surface する。`TOOL_ROWS` (配列) は `TOOLS` から
// 順序を借りて生成する。
const TOOL_ROW_BY_TOOL: Readonly<Record<Tool, Row>> = {
  select: { labelKey: 'help.row.select', keys: ['V'] },
  rectangle: { labelKey: 'help.row.rectangle', keys: ['R'] },
  arrow: { labelKey: 'help.row.arrow', keys: ['A'] },
  text: { labelKey: 'help.row.text', keys: ['T'] },
  highlight: { labelKey: 'help.row.highlight', keys: ['H'] },
};

const TOOL_ROWS: ReadonlyArray<Row> = TOOLS.map((t) => TOOL_ROW_BY_TOOL[t]);

const COLOR_ROWS: ReadonlyArray<Row> = [
  { labelKey: 'help.row.nextColor', keys: ['C'] },
  { labelKey: 'help.row.prevColor', keys: ['⇧', 'C'] },
];

const TEXT_ROWS: ReadonlyArray<Row> = [
  { labelKey: 'help.row.fontSizeIncrease', keys: [']'] },
  { labelKey: 'help.row.fontSizeDecrease', keys: ['['] },
];

// Phase 7.8-5: 次手予測 (矢印→テキスト / 矩形→矢印) のキー規約。Enter は
// pending サジェスト確定 (矩形→矢印プレビューを矢印に確定 + Auto-next-A 連鎖)、
// Esc は pending クリア + 選択解除、Backspace は pending クリア優先 (pending
// なし時は通常の選択削除に戻る)。Backspace は他セクションの「Del」と挙動が
// 異なるため記号 ⌫ で視覚的に分離する。
const PREDICT_ROWS: ReadonlyArray<Row> = [
  { labelKey: 'help.row.suggestionAccept', keys: ['Enter'] },
  { labelKey: 'help.row.suggestionDismiss', keys: ['Esc'] },
  { labelKey: 'help.row.pendingClear', keys: ['⌫'] },
];

const EDIT_ROWS: ReadonlyArray<Row> = [
  { labelKey: 'help.row.undo', keys: ['⌘', 'Z'] },
  { labelKey: 'help.row.redo', keys: ['⌘', '⇧', 'Z'] },
  { labelKey: 'help.row.delete', keys: ['Del'] },
  { labelKey: 'help.row.deselect', keys: ['Esc'] },
];

const ZOOM_ROWS: ReadonlyArray<Row> = [
  { labelKey: 'help.row.fitView', keys: ['⌘', '0'] },
  { labelKey: 'help.row.zoomReset', keys: ['⌘', '1'] },
  { labelKey: 'help.row.zoom', keys: ['⌘', { key: 'help.key.wheel' }] },
  { labelKey: 'help.row.pan', keys: ['Space', { key: 'help.key.drag' }] },
];

const EXPORT_ROWS: ReadonlyArray<Row> = [
  { labelKey: 'help.row.exportPng', keys: ['⌘', 'S'] },
];

const HELP_ROWS: ReadonlyArray<Row> = [{ labelKey: 'help.row.toggleHelp', keys: ['?'] }];

const SECTIONS: ReadonlyArray<Section> = [
  { titleKey: 'help.section.tools', rows: TOOL_ROWS },
  { titleKey: 'help.section.colors', rows: COLOR_ROWS },
  { titleKey: 'help.section.text', rows: TEXT_ROWS },
  { titleKey: 'help.section.predict', rows: PREDICT_ROWS },
  { titleKey: 'help.section.edit', rows: EDIT_ROWS },
  { titleKey: 'help.section.zoom', rows: ZOOM_ROWS },
  { titleKey: 'help.section.export', rows: EXPORT_ROWS },
  { titleKey: 'help.section.help', rows: HELP_ROWS },
];

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
    {children}
  </kbd>
);

export const HelpModal = ({ open, onOpenChange }: Props) => {
  const t = useTranslation();
  const renderKey = (atom: KeyAtom): string => (typeof atom === 'string' ? atom : t(atom.key));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('help.title')}</DialogTitle>
          <DialogDescription>{t('help.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {SECTIONS.map((section) => {
            const title = t(section.titleKey);
            return (
              <section key={section.titleKey} aria-labelledby={`help-section-${section.titleKey}`}>
                <h3
                  id={`help-section-${section.titleKey}`}
                  className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {title}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {section.rows.map((row) => {
                    const label = t(row.labelKey);
                    return (
                      <li
                        key={row.labelKey}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span>{label}</span>
                        <span className="flex items-center gap-1">
                          {row.keys.map((k, i) => {
                            const txt = renderKey(k);
                            return (
                              <Kbd key={`${row.labelKey}-${i}-${txt}`}>{txt}</Kbd>
                            );
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
