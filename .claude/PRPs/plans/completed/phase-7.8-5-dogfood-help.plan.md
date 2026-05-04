# Plan: Phase 7.8-5 — dogfood + チューニング + HelpModal 追記

## Summary

Phase 7.8 (1/2/3 で実装完了、4 Smart snap は 2026-05-04 ユーザー判断で defer) の dogfood を 1 週間オーナー本人で回し、success metric を実測 + 主要定数 (offset / arrow length / font step) を再評価する。同時に HelpModal に **次手予測** セクションを追加して 7.8-1/-2 を可視化する。コード変更は HelpModal とそのテストのみ、それ以外は計測ドキュメント + PRD 整合のみ。

## User Story

As a **snap-share オーナー (=主要ユーザー)**,
I want **Phase 7.8-1/-2/-3 を実業務で 1 週間使い倒して仮説の検証 + 仕上げチューニングをする** + **新規ユーザーが `?` で次手予測の存在を発見できる**,
So that **success metric (15 秒以内 3 連発 / 邪魔頻度 1 回未満) が実測で緑になり、デフォルト値が dogfood 由来で確定し、未学習ユーザーへの発見性も担保される**.

## Problem → Solution

**Current**:
- Phase 7.8-1/-2/-3 は実装と E2E は通っているが **実業務での体感は未検証**。`AUTO_NEXT_TEXT_OFFSET_PX=8` / `AUTO_ARROW_DEFAULT_LENGTH_PX=100` / `FONT_SIZE_STEP=2` は plan 段階の暫定値で「dogfood で再評価」とコメントされたまま。
- HelpModal (`?`) は Phase 7.7 までのキー一覧に留まり、矢印→テキスト / 矩形→矢印 の **次手予測サジェスト** や Enter 確定 / Backspace 破棄の規約がどこにも書かれていない。新規ユーザーは存在を知る手段が無い。
- PRD では Phase 5 が `depends: 1, 2, 3, 4` だが Phase 4 は defer 確定済 (stash@{0})。PRD の依存表が現実と乖離。

**Desired**:
- 1 週間 / 30 画像以上の dogfood を回し、success metric 表 (PRD §Success Metrics) を実測で埋める。
- 体感に基づき 3 定数 (offset / arrow length / font step) を据え置きか調整かを判断、同時に offset/length のコメント TODO ("dogfood で再評価") を解消する。
- HelpModal に「次手予測」セクションが 1 つ増え、`Enter` (サジェスト確定) / `Esc` (サジェスト破棄) / `Backspace` (pending クリア) を網羅。
- PRD の Phase 4 行が defer 表記に、Phase 5 の依存性は `1, 2, 3` に縮約、Decisions Log に Smart snap defer 経緯を追記。

## Metadata

- **Complexity**: **Small** (実コード変更は HelpModal 1 ファイル + そのテスト 1 ファイル。残りはドキュメント整備と dogfood 実施)
- **Source PRD**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md`
- **PRD Phase**: Phase 5: dogfood + チューニング + HelpModal 追記
- **Estimated Files**: 5 (UPDATE 4, CREATE 1)
- **Estimated LOC**: 80-150 (production + test)、ドキュメントを除く

---

## UX Design

### Before (Phase 7.8-3 完了時点の HelpModal)

```
┌──────────────────────────────────────────┐
│  キーボードショートカット             ✕  │
│  すべての操作はキーボードで完結できます  │
├────────────────┬─────────────────────────┤
│ ツール         │ 編集                    │
│  選択   V      │  元に戻す  ⌘ Z          │
│  矩形   R      │  やり直し  ⌘ ⇧ Z        │
│  矢印   A      │  削除      Del          │
│  テキスト T    │  選択解除  Esc          │
│  ハイライト H  │                         │
├────────────────┼─────────────────────────┤
│ 色             │ ズーム                  │
│  次の色   C    │  全体表示  ⌘ 0          │
│  前の色   ⇧ C  │  100%      ⌘ 1          │
├────────────────┼─────────────────────────┤
│ テキスト       │ 出力                    │
│  サイズ +2  ]  │  PNG 保存  ⌘ S          │
│  サイズ -2  [  │                         │
└────────────────┴─────────────────────────┘
```
矢印→テキスト / 矩形→矢印 の Auto-next の存在も Enter/BS の特別挙動も **どこにも書かれていない**。

### After (Phase 7.8-5 完了時点)

```
┌──────────────────────────────────────────────┐
│  キーボードショートカット                 ✕  │
│  すべての操作はキーボードで完結できます。     │
│  矢印→テキスト・矩形→矢印 のサジェストは     │
│  Enter で確定 / Esc で破棄。                 │
├────────────────┬─────────────────────────────┤
│ ツール         │ 次手予測                    │
│  ...           │  サジェスト確定  Enter      │
│                │  サジェスト破棄  Esc        │
│                │  pending クリア  ⌫          │
├────────────────┼─────────────────────────────┤
│ (以下 既存セクション)                        │
└──────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `?` 押下時のモーダル内容 | 7.7 までのキー + テキストサイズ | 加えて「次手予測」セクション (3 行) と DialogDescription 追記 | 発見性 |
| 既定 offset / length / font step | コード上 `8 / 100 / 2`、コメントに「dogfood で再評価」TODO | dogfood 結果に基づき値据え置き or 調整、コメント TODO は解消 | 値変更は dogfood 結果次第 |
| PRD Phase 4 (Smart snap) 行 | `pending` / `depends: -` | `deferred` (注記) | 現実と整合 |
| PRD Phase 5 行 | `depends: 1, 2, 3, 4` | `depends: 1, 2, 3` | Smart snap 切離 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/components/dialogs/HelpModal.tsx` | 全 105 行 | 改修対象。`Section` / `Row` 型と `SECTIONS` 配列に追加するパターンを完全に踏襲する |
| P0 | `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | 全 70 行 | テストパターン (`renderModal` ハーネス、`document.body.textContent` / `querySelectorAll('kbd')` の assertion 流儀) |
| P0 | `apps/web/src/hooks/useKeyboardShortcuts.ts` | 116-156 | 次手予測関連の Enter / Esc / Backspace の発火条件 (説明の正確性確認) |
| P1 | `apps/web/src/pages/EditorShell.tsx` | 166-202, 399-435 | `handleEscape` / `handleDelete` / `handleConfirmAutoArrow` の優先順位 (HelpModal の説明文の根拠) |
| P1 | `apps/web/src/lib/autoNextOffset.ts` | 全 31 行 | `AUTO_NEXT_TEXT_OFFSET_PX` のチューニング対象、コメントの "dogfood で再評価" を解消する場所 |
| P1 | `apps/web/src/lib/autoArrowDefault.ts` | 全 27 行 | `AUTO_ARROW_DEFAULT_LENGTH_PX` のチューニング対象 |
| P1 | `apps/web/src/lib/fontSize.ts` | 全 18 行 | `FONT_SIZE_STEP` のチューニング対象 |
| P2 | `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | 199-294 | Implementation Phases / Phase Details の更新箇所 (Phase 4 deferred、Phase 5 依存縮約) |
| P2 | `.claude/PRPs/plans/completed/phase-7.8-3-font-size-ui.plan.md` | Validation 節 | Phase 7.8-3 で確認した JIS/US `[`/`]` 動作 (重複作業を避ける) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| なし | — | Phase 7.8-5 は完全に内部チューニングと既存コンポーネント拡張のみ。外部ライブラリ調査は不要 |

---

## Patterns to Mirror

### HELP_MODAL_SECTION_PATTERN
```tsx
// SOURCE: apps/web/src/components/dialogs/HelpModal.tsx:30-33
const TEXT_ROWS: ReadonlyArray<Row> = [
  { label: 'フォントサイズ +2', keys: [']'] },
  { label: 'フォントサイズ -2', keys: ['['] },
];
```
新セクションは **同じ型 (`ReadonlyArray<Row>`) + 同じ命名規則 (`*_ROWS`) + 同じ位置 (SECTIONS 配列に追加)** で書く。Section 順は「ツール → 色 → テキスト → **次手予測** → 編集 → ズーム → 出力 → ヘルプ」を提案 (テキスト直後 = 関連機能で隣接、編集 (Esc/Del) より前)。

### HELP_MODAL_TEST_PATTERN
```tsx
// SOURCE: apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx:60-69
it('lists the [ and ] shortcuts under "テキスト" section', () => {
  const m = renderModal({ open: true });
  expect(document.body.textContent).toContain('テキスト');
  expect(document.body.textContent).toContain('フォントサイズ +2');
  ...
  const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
  expect(kbds).toContain(']');
  m.unmount();
});
```
新テストも同じハーネス (`renderModal`) + 同じ assertion 流儀 (`textContent.toContain` + `querySelectorAll('kbd')`)。

### KBD_LABEL_CONVENTION
```tsx
// SOURCE: apps/web/src/components/dialogs/HelpModal.tsx:35-40
{ label: '元に戻す', keys: ['⌘', 'Z'] },
{ label: 'やり直し', keys: ['⌘', '⇧', 'Z'] },
{ label: '削除', keys: ['Del'] },
{ label: '選択解除', keys: ['Esc'] },
```
- 修飾キー: `⌘` `⇧` `⌥` の Unicode 記号 (既存 row 全部この流儀)
- 削除: `Del` の 3 文字略 (`Backspace` ではなく `Del`、ただし Phase 7.8-5 で **明示的に Backspace を意味するなら `⌫` 記号** を使う方針 — 既存に前例ないので新セクションで導入)。`useKeyboardShortcuts.ts:97` は `Delete || Backspace` 両対応のため、ラベルとしては「Del」のままで良いが、**「pending クリア」行は `⌫` を用いて Backspace 限定の挙動を視覚的に分離** する。

### CONSTANT_TUNING_COMMENT
```ts
// SOURCE: apps/web/src/lib/autoNextOffset.ts:3-6
// Phase 7.8-1 Auto-next-A: 矢印終端から空 text を生成する位置の offset。矢印方向の
// 単位ベクトルに distance を掛けるシンプル設計で、矢印の延長線上に text が並ぶ。
// dogfood で 8/12/16 のどれが快適かは Phase 5 で再評価する。
export const AUTO_NEXT_TEXT_OFFSET_PX = 8;
```
Phase 7.8-5 完了時にコメント末尾の "Phase 5 で再評価する" を **「dogfood (2026-05-XX) で N px 据置確定 / X px → Y px へ調整」** に書き換え、`autoArrowDefault.ts` も同様にする。値変更が無ければコメント差し替えのみ。

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/dialogs/HelpModal.tsx` | UPDATE | 「次手予測」`PREDICT_ROWS` 追加 + `SECTIONS` に組込 + `DialogDescription` を 1 行追記 |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | UPDATE | 新セクションのテストケース 1 件追加 |
| `apps/web/src/lib/autoNextOffset.ts` | UPDATE (条件付き) | dogfood 後にコメントの "Phase 5 で再評価する" 文言を更新 (値据置でもコメントは変える) |
| `apps/web/src/lib/autoArrowDefault.ts` | UPDATE (条件付き) | 同上 |
| `apps/web/src/lib/fontSize.ts` | UPDATE (条件付き) | 同上 (現状コメントに TODO 文言は無いが dogfood 結果のメモを足す) |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | UPDATE | Phase 4 行を `deferred`、Phase 5 行を `depends: 1, 2, 3`、Decisions Log に Smart snap defer 追記 |
| `.claude/PRPs/reports/phase-7.8-5-dogfood-checklist.md` | CREATE | 計測指標・観察ポイント・dogfood 手順の作業ドキュメント (Phase 5 完了報告とは別、実施中ノート) |

## NOT Building

- **Smart snap (Phase 7.8-4) の本実装** — stash@{0} に保管、ユーザー判断 (2026-05-04) で defer 確定
- **HelpModal に Auto-next の動作を文章で長文解説する** — `Row` 1 行 = 1 ショートカットの既存規約を壊さない。学習負荷は触って覚えてもらう想定 (DialogDescription 1 行と Section ラベル「次手予測」で発見性は担保)
- **テレメトリ計測** (Esc/BS の発火回数を localStorage や Worker に送る) — PRD §"What We're NOT Building" にある opt-out / テレメトリと同根、dogfood 自己申告で代替
- **新規 dogfood 専用ビルドフラグ / debug overlay** — オーナー本人 dogfood で観察するだけなので不要
- **HelpModal の i18n 化 / アクセシビリティ強化** — 既存 dialog の作法を維持、スコープ外

---

## Step-by-Step Tasks

### Task 1: HelpModal に「次手予測」セクションを追加
- **ACTION**: `HelpModal.tsx` に `PREDICT_ROWS` 定数を新設し、`SECTIONS` 配列に組込む。`DialogDescription` を 2 行表記に変える。
- **IMPLEMENT**:
  ```tsx
  const PREDICT_ROWS: ReadonlyArray<Row> = [
    { label: 'サジェスト確定', keys: ['Enter'] },
    { label: 'サジェスト破棄', keys: ['Esc'] },
    { label: 'pending クリア', keys: ['⌫'] },
  ];

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
  ```
  `DialogDescription` 中身を:
  ```tsx
  <DialogDescription>
    すべての操作はキーボードで完結できます。閉じるには Esc か外側をクリック。
    矢印→テキスト・矩形→矢印 のサジェストは Enter で確定 / Esc で破棄。
  </DialogDescription>
  ```
  に変更 (改行は CSS の word-wrap で自然折返し、`<br/>` は使わない)。
- **MIRROR**: HELP_MODAL_SECTION_PATTERN
- **IMPORTS**: 既存の `Dialog*` import のみで足りる、追加 import 不要
- **GOTCHA**:
  - `PREDICT_ROWS` の挿入位置は `TEXT_ROWS` 直後 + `EDIT_ROWS` の前 (Esc/Del と semantic に近接させ、ユーザーが「Esc は何に効くんだっけ?」と探したときに **次手予測 → 編集** の順で見つかるレイアウト)。
  - `⌫` 記号 (U+232B) は新規導入。既存 row には無いが kbd タグ内のフォント・余白は同じ Tailwind class (`min-w-6` `font-mono`) で破綻しないことを **手動でブラウザ確認** する (フォントによっては記号が小さい場合があるが、`min-w-6` で枠サイズは固定)。
  - DialogDescription の長文化 (1 行 → 2 文) で modal 高さが伸びる。`size="lg"` (105 行目) のままで overflow しないかブラウザで確認。
- **VALIDATE**:
  - `pnpm -F @snap-share/web typecheck` — 0 error
  - 開発サーバ (`pnpm dev`) で `?` を押し、「次手予測」セクションが表示されること、`Enter`/`Esc`/`⌫` の kbd が描画されること、modal が overflow しないことを目視確認

### Task 2: HelpModal テストを追加
- **ACTION**: `HelpModal.test.tsx` に新セクションを検証するテストケースを 1 件追加。
- **IMPLEMENT**:
  ```tsx
  it('lists the Auto-next predict section with Enter / Esc / ⌫ kbds', () => {
    const m = renderModal({ open: true });
    expect(document.body.textContent).toContain('次手予測');
    expect(document.body.textContent).toContain('サジェスト確定');
    expect(document.body.textContent).toContain('サジェスト破棄');
    expect(document.body.textContent).toContain('pending クリア');
    const kbds = Array.from(document.body.querySelectorAll('kbd')).map((k) => k.textContent);
    expect(kbds).toContain('Enter');
    expect(kbds).toContain('⌫');
    m.unmount();
  });
  ```
  既存の `'open=true renders the cheatsheet title and key kbd entries'` テストにも `expect(document.body.textContent).toContain('次手予測');` を追記 (主要セクションリストのスナップショット代わり)。
- **MIRROR**: HELP_MODAL_TEST_PATTERN
- **IMPORTS**: 既存のもので足りる
- **GOTCHA**:
  - kbd の判定で `'Esc'` を含めると既存の「選択解除」行とラベル衝突するため、**新セクション固有の `'Enter'` と `'⌫'` で識別** する (Esc は SECTIONS 内に複数現れて当然なので一意性は不要)。
- **VALIDATE**:
  - `pnpm -F @snap-share/web test -- src/components/dialogs/__tests__/HelpModal.test.tsx`
  - 既存 3 ケース + 新規 1 ケース = 4 ケース、全 pass

### Task 3: PRD を Smart snap defer に整合
- **ACTION**: `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` の Implementation Phases 表と Decisions Log を更新。
- **IMPLEMENT**:
  - 199-205 行目の表で:
    - Phase 4 行: `pending` → `deferred (2026-05-04)`、PRP Plan 列に `(skipped, stash@{0})` を追記
    - Phase 5 行: `Depends: 1, 2, 3, 4` → `Depends: 1, 2, 3`、Description から「snap 閾値」を除く
  - 265-278 行目の Phase 4 詳細はそのまま残し、ヘッダに `**(deferred 2026-05-04)**` を 1 行追記
  - 279-287 行目の Phase 5 詳細から:
    - Scope の「snap 閾値、offset 距離、フォントサイズ shortcut のキー」 → 「offset 距離、矢印 default 長、フォントサイズ shortcut のキー」
    - HelpModal 説明から「Alt snap 抑制」を削除、代わりに「次手予測 (Enter/Esc) と pending クリア (⌫)」追記
  - 298-323 行目の Decisions Log に末尾 1 行追加:
    ```
    | Smart snap (Phase 4) の defer | **defer 確定 (2026-05-04)** | 実装続行 / 完全廃止 | dogfood 前段階で実装試行したが UX 的に問題が多そうと判断、stash@{0} に保管。Phase 7.8-5 dogfood で本当に必要かを再評価し、必要なら別 phase で再実装 |
    ```
- **MIRROR**: 既存の表組フォーマット (sentinel: `|---|---|---|---|`)、Decisions Log の `Choice / Alternatives / Rationale` 三列構成
- **IMPORTS**: なし (markdown)
- **GOTCHA**: PRD は他 phase (7.7 等) からも参照される歴史ドキュメント。**stash 削除や Smart snap 完全削除は行わない**、あくまで「defer」「保留」表記。
- **VALIDATE**:
  - `git diff .claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` で表行数・Decisions Log 行数の増減が想定どおりであること
  - markdown 表のパイプ数が崩れていないこと (lint なしのため目視)

### Task 4: dogfood checklist ドキュメントを作成
- **ACTION**: `.claude/PRPs/reports/phase-7.8-5-dogfood-checklist.md` を新規作成。実施中の作業ノート + 計測フォーマットとして使う。
- **IMPLEMENT** (テンプレ骨子):
  ```markdown
  # Phase 7.8-5 dogfood checklist (2026-05-XX 〜 2026-05-XX)

  ## 目標
  1 週間 / 30 画像以上の実業務注釈で Phase 7.8-1/-2/-3 を回し、success metric を実測 + 主要定数を再評価する。

  ## 計測指標 (PRD §Success Metrics)
  | Metric | Target | 実測 | 達成 |
  |---|---|---|---|
  | 矢印+テキスト 3 連発 所要時間 | 15 秒以内 | __ 秒 | ☐ |
  | 1 画像あたり注釈数中央値 | Phase 7.7 比 1.5 倍 | __ vs __ | ☐ |
  | 次手予測「邪魔」頻度 | 1 セッション 1 回未満 | __ 回/__セッション | ☐ |
  | フォントサイズ変更が必要な場面で実際に変更できる | 100% | __ / __ 場面 | ☐ |
  | Yjs 多人数で次手予測が暴発しない | データ崩壊なし | ☐ |  |

  ## チューニング対象定数
  | 定数 | 現値 | dogfood 後の判断 | 場所 |
  |---|---|---|---|
  | AUTO_NEXT_TEXT_OFFSET_PX | 8 | (据置 / N px) | apps/web/src/lib/autoNextOffset.ts:6 |
  | AUTO_ARROW_DEFAULT_LENGTH_PX | 100 | (据置 / N px) | apps/web/src/lib/autoArrowDefault.ts:5 |
  | FONT_SIZE_STEP | 2 | (据置 / N px) | apps/web/src/lib/fontSize.ts:8 |

  ## 観察ポイント (自己申告)
  - 矢印終端の text offset は近すぎ/遠すぎないか
  - 矩形→矢印の既定 (右下 45° / 100px) で 8 割の指摘がカバーできるか
  - フォントサイズ `[`/`]` を 1 セッションで何回押すか / Δ2 が刻みすぎていないか
  - キャンセル誤操作 (BS で矩形まで消えてしまった等) が起きるか

  ## 完了条件
  - [ ] 30 画像以上に注釈
  - [ ] 上記 metric 全て計測
  - [ ] 3 定数の据置/調整を判定
  - [ ] PRD §Success Metrics に実測値を反映
  - [ ] HelpModal がオーナー以外 (もし機会があれば) にも見つけてもらえるかを確認
  ```
- **MIRROR**: 既存の `.claude/PRPs/reports/*-report.md` の表組と H2 構成
- **IMPORTS**: なし
- **GOTCHA**:
  - report ディレクトリは Phase 完了 **報告** が本来の用途、checklist は変則。ファイル名で `-checklist.md` を付与し用途を明示。dogfood 完了後にこの checklist ファイルを正式な `*-report.md` に統合する想定 (Task 6)。
- **VALIDATE**:
  - `ls .claude/PRPs/reports/phase-7.8-5-*` でファイルが作成されていること
  - markdown プレビューで表が崩れないこと

### Task 5: dogfood 実施 (実装外、所要 1 週間)
- **ACTION**: snap-share を 1 週間 / 30 画像以上の実業務で使用、Task 4 の checklist を埋める。
- **IMPLEMENT**: 該当なし (実運用)
- **GOTCHA**:
  - **Plan 段階では Task 5 はトリガしない**。`/prp-implement` で Task 1-4 を完了させ、Task 5 はオーナーが手動で実施期間を確保する。
  - dogfood 中に新たに発見されたバグや UX 摩擦は別 phase / 別 PRD として切出す (Phase 7.8-5 のスコープには **値の調整 + コメント更新** までしか含めない)。
- **VALIDATE**: checklist の指標が全て埋まる + 完了条件全 check

### Task 6: チューニング適用 + 完了報告
- **ACTION**: dogfood 結果に基づき:
  - 3 定数を据置 or 調整
  - 該当ファイルのコメント末尾の "dogfood で再評価する" 文言を、実施日と判断結果に書換
  - `.claude/PRPs/reports/phase-7.8-5-dogfood-checklist.md` を `phase-7.8-5-dogfood-report.md` にリネームしつつ最終結果を記入
  - PRD §Success Metrics の表に実測値を追記 (or 別添リンク)
- **IMPLEMENT**:
  - `autoNextOffset.ts:5-6` のコメント例:
    ```ts
    // dogfood (2026-05-XX, 32 画像) で 8px が体感ベスト → 据置。
    // 12/16 は矢印先と text の視線移動が増えてリズムが切れる。
    export const AUTO_NEXT_TEXT_OFFSET_PX = 8;
    ```
  - 値を変える場合は対応する `__tests__/autoNextOffset.test.ts` (もしあれば) のスナップショット更新 + `pnpm test` で regression 0
- **MIRROR**: CONSTANT_TUNING_COMMENT
- **IMPORTS**: なし
- **GOTCHA**:
  - 値変更時は `apps/web/e2e/auto-next-*.spec.ts` (Phase 7.8-1/-2 の E2E) が暫定値に依存していないか確認 (一般に E2E は座標 ±1px の許容を見ているはずだが、offset を倍に振ると range を超える可能性)
  - `AUTO_ARROW_DEFAULT_LENGTH_PX` を変えると `autoArrowDefault.test.ts` が `tailExtension = LENGTH / Math.SQRT2` を計算しているので自動追従、値ベタ書きでは無いことを確認
- **VALIDATE**:
  - `pnpm -F @snap-share/web typecheck && pnpm -F @snap-share/web test && pnpm -F @snap-share/web test:e2e`
  - 全 pass、定数変更時もテスト regression 0

---

## Testing Strategy

### Unit Tests (Task 2)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| 「次手予測」セクションが描画される | open=true | `'次手予測'` が textContent に含まれる | 主流 |
| サジェスト確定/破棄/pending クリアの 3 行が出る | open=true | 3 つのラベル文字列が textContent | 主流 |
| Enter / ⌫ の kbd が描画される | open=true | querySelectorAll('kbd') の textContent に `'Enter'` と `'⌫'` | 主流 |
| 既存セクションの主要 kbd は引続き存在 (regression) | open=true | `']'` `'['` `'⌘'` `'?'` 等が引続き存在 | regression |

### Edge Cases Checklist (Task 1 + Task 6)

- [ ] modal を `open=false` で再 mount → 表示なし、メモリリークなし (既存テストでカバー済)
- [ ] `⌫` 文字が表示フォントで適切なサイズで描画される (手動確認)
- [ ] DialogDescription の 2 文がモバイル幅 (320px) で折返しても破綻しない (Phase 7.8 はデスクトップ前提だが念のため)
- [ ] `[`/`]` の JIS/US 配列確認 — Phase 7.8-3 で確認済 (`useKeyboardShortcuts.ts:138-156` の `e.key === ']'` 文字判定方式)。Phase 7.8-5 で **再確認は不要**、ただし dogfood 中に発火しないケースに当たれば別 issue 化

### dogfood Validation (Task 5)

- [ ] 30 画像以上で注釈
- [ ] 1 セッション = 1 画像 / 5-10 注釈想定で Esc/BS の使用回数を mental count
- [ ] 「Shottr に戻りたいと思わない」の自己申告 yes/no
- [ ] HelpModal を一度開き、新セクションが意図どおり読めるか

---

## Validation Commands

### Static Analysis
```bash
pnpm -F @snap-share/web typecheck
```
EXPECT: Zero type errors

### Lint
```bash
pnpm lint
```
EXPECT: Zero lint errors

### Unit Tests (HelpModal)
```bash
pnpm -F @snap-share/web test -- src/components/dialogs/__tests__/HelpModal.test.tsx
```
EXPECT: 4 tests pass (3 既存 + 1 新規)

### Full Web Suite (regression)
```bash
pnpm -F @snap-share/web test
```
EXPECT: 全 pass、Phase 7.8-1/-2/-3 の test に regression 0

### E2E (任意、Task 6 で値変更時のみ必須)
```bash
pnpm -F @snap-share/web test:e2e
```
EXPECT: Phase 7.8-1/-2 の auto-next E2E が pass

### Build
```bash
pnpm build
```
EXPECT: Zero error

### Manual Validation
- [ ] `pnpm dev` で `?` を押し、「次手予測」セクションが表示されること
- [ ] `Enter` `Esc` `⌫` の kbd が他のセクションと同じスタイルで描画されること
- [ ] DialogDescription 2 文目が読めること、modal が viewport 内に収まること
- [ ] (Task 6 後) 矢印を引き text が表示される位置が違和感ないか

---

## Acceptance Criteria

- [ ] HelpModal に「次手予測」セクションが追加され、`Enter` / `Esc` / `⌫` の 3 行が出る
- [ ] DialogDescription が 2 文に拡張され、サジェストの確定/破棄キーが明文化される
- [ ] HelpModal.test.tsx に新セクションのテストが追加され、全 pass
- [ ] PRD の Phase 4 行が `deferred (2026-05-04)`、Phase 5 行が `depends: 1, 2, 3`
- [ ] Decisions Log に Smart snap defer 行が追加される
- [ ] dogfood checklist 文書が `.claude/PRPs/reports/` 配下に作成される
- [ ] (Task 6 完了後) 3 定数のコメントが dogfood 結果で更新される
- [ ] (Task 6 完了後) PRD §Success Metrics に実測値が反映される
- [ ] typecheck / lint / test / build 全 pass

## Completion Checklist

- [ ] HELP_MODAL_SECTION_PATTERN を踏襲、新規型/別レイアウトを導入していない
- [ ] HELP_MODAL_TEST_PATTERN を踏襲、別ハーネスを導入していない
- [ ] エラーハンドリングは既存 `Dialog` のまま、追加 try/catch なし
- [ ] console.log / debug 文なし (CLAUDE.md noConsole rule)
- [ ] PRD は historical 性質を維持、削除ではなく追記/書換
- [ ] dogfood checklist は実施前に作成、実施後に report として再利用可能
- [ ] Self-contained — Task 1-4 はこの plan だけで完結、Task 5-6 のみ dogfood 結果待ち

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `⌫` (U+232B) が一部フォントで小さく/欠字になる | L | M | Task 1 の手動確認で代替 (`Backspace` 文字列ラベルへの fallback) |
| dogfood 1 週間が確保できず Task 5/6 が長期 stuck | M | M | Plan は Task 1-4 で **HelpModal+PRD 整合まで完了** とし PR 化、Task 5-6 は別途 progress report で追跡 |
| dogfood 結果で大幅な UX 変更要求が出る | L | H | Phase 7.8-5 のスコープ外として別 phase / 別 PRD で扱う (本 plan の "NOT Building" 参照) |
| HelpModal modal 高さが伸びてスクロールが必要になる | L | L | DialogDescription を簡潔に保つ + section 数増加は 1 のみ。`size="lg"` のままで viewport 内に収まると見込む |
| 値変更時に Phase 7.8-1/-2 E2E が壊れる | L | M | Task 6 GOTCHA で明記、E2E は ±1px 許容で書かれているはずだが念のため変更前に grep で値ベタ書き箇所を確認 |

## Notes

- **Smart snap (Phase 7.8-4) との関係**: 2026-05-04 ユーザー判断で defer 確定。実装は stash@{0} に保管されており、本 plan で復活させない。dogfood 後に「やっぱり snap が要る」と判明したら別 phase (例: 7.9-x) で再着手、その際は stash の復元か再実装かを別途判断する。
- **複数の小さなコミット推奨**: Task 1+2 (HelpModal + テスト) → 1 コミット、Task 3 (PRD) → 1 コミット、Task 4 (checklist) → 1 コミット、Task 6 → 1 コミット。Phase 単位で 1 ブランチ・1 PR (memory: feedback_branch_per_phase)。
- **JIS/US 配列の `[`/`]` 確認**: PRD 残論点として上がっていたが、Phase 7.8-3 plan の Validation で確認済 (`e.key === ']'` の文字判定で両配列対応)。本 plan で再確認は不要、dogfood 中に発火しなければ別 issue。
- **テレメトリ計測なし**: PRD §"What We're NOT Building" + Decisions Log と整合、すべて自己申告。
- **このファイル自体は `plans/`、完了後 `plans/completed/` に移動** (`/prp-implement` の最終ステップ + Phase 7.8-3 と同じ運用)。
