# Local Review: Phase 7.7-4 ショートカット網羅 + チートシート

**Reviewed**: 2026-05-03
**Branch**: `feat/phase-7.7-ux-foundation`
**Mode**: Local Review (uncommitted changes)
**Decision**: **APPROVE** with comments

## Summary

Phase 7.7-4 (B2: チートシート + 色 cycle ショートカット) の実装は plan 通りに完成し、CRITICAL / HIGH 級の問題は無い。218 unit test + 52 E2E test がすべて緑、typecheck/lint/build もクリーン。Modal 起動経路 (`?` キー / Toolbar ❓ ボタン) と success metric「マウス無し golden path」が E2E でロックされた。dogfood で確認すべき UX 課題が 1 件 (MEDIUM、Modal open 中の Esc 競合) あるが、実害は限定的で plan の NOT Building 文脈とも整合する。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

#### M1: HelpModal open 中の Esc が `handleEscape` と競合する
- **File**: `apps/web/src/pages/EditorShell.tsx:133-141`, `apps/web/src/hooks/useKeyboardShortcuts.ts:92-95`
- **Issue**: Modal が開いている状態で Esc を押すと、base-ui Dialog が `onOpenChange(false)` で閉じる + 同じ Esc が window keydown まで bubble して `useKeyboardShortcuts.onEscape` → `handleEscape` も発火する。「画像投入 + 注釈 1 個選択中 + Help Modal open」というトリプル条件のとき、ユーザーが Esc 1 回押下で意図せず「選択も解除される」副作用が起きる
- **Impact**: 機能は壊れない。UX 的な小不快感が出る可能性
- **Suggested fix**: `helpOpen` を `useKeyboardShortcuts` の発火条件にも組み込む。`handleEscape` の冒頭で `if (helpOpen) return;` を追加するか、より構造的には `useKeyboardShortcuts` 全体を modal-aware にする
- **Priority**: Phase 7.8 で dogfood 結果に応じて修正。本フェーズの NOT Building (「Modal open 中の他ショートカット」項目) に明示的に含めても良い
- **Status**: ACKNOWLEDGED — 実装は plan の NOT Building 方針に整合。dogfood 後判断

### LOW

#### L1: `aria-labelledby` の ID に日本語文字を含む
- **File**: `apps/web/src/components/dialogs/HelpModal.tsx:74,76`
- **Issue**: `id={\`help-section-${section.title}\`}` で `section.title` が日本語のため、`id="help-section-ツール"` のような Unicode ID が生成される
- **Impact**: HTML5 では valid。スクリーンリーダーも問題なし。ただし将来 CSS セレクタで `#help-section-ツール` を書く場合エスケープが必要
- **Suggested fix**: `Section` 型に `slug: string` フィールドを追加して `'tool' | 'color' | 'edit' | ...` のような ASCII slug を ID に使う。本フェーズで対応不要
- **Status**: NOTE — 実害無し、将来検討

#### L2: `useKeyboardShortcuts.ts` の onKey 関数が 76 行 (50 行ガイドライン超過)
- **File**: `apps/web/src/hooks/useKeyboardShortcuts.ts:48-123`
- **Issue**: 既存コードに新ショートカットを追加した結果、合計 9 つの分岐 if が並ぶ。`coding-style.md` の「Functions <50 lines」推奨に超過
- **Impact**: 可読性は維持されている (1 分岐 = 1 ショートカット の単純構造)。ロジックはフラット
- **Suggested fix**: テーブル駆動への refactor (`SHORTCUT_TABLE: ReadonlyArray<{ matcher, callbackKey, preventDefault }>`)。本フェーズの差分最小化方針に反するため次フェーズで検討
- **Status**: NOTE — 既存コードの肥大化、Phase 7.8 でリファクタ余地

#### L3: EditorShell.tsx が 354 行と肥大化傾向
- **File**: `apps/web/src/pages/EditorShell.tsx`
- **Issue**: 800 行ガイドライン以内だが、Phase 7.7-1〜4 で 200 行 → 354 行に拡大。state 管理 / 5 種以上のハンドラ / window 露出 useEffect が同居
- **Impact**: 既存コードに追従。可読性は維持
- **Suggested fix**: `useEditorShellHandlers` のような custom hook 抽出、または page-mode-specific (Local/Room) ハンドラの分離は Phase 7.8 検討課題
- **Status**: NOTE — 太ってきたが許容範囲

#### L4: `process.platform` 判定なしで `⌘` 表記固定
- **File**: `apps/web/src/components/dialogs/HelpModal.tsx:31-32,38-41,44`
- **Issue**: HelpModal は `⌘` 記号で macOS modifier を表記。Windows / Linux ユーザーは `Ctrl` 表記を期待する
- **Impact**: 現状のターゲット (オーナー dogfood) は macOS 1 名なので影響なし。Phase 8 で外部 dogfood 解禁後に問題化する可能性
- **Suggested fix**: 実行時に `navigator.platform` または `navigator.userAgent` から OS 判定して `⌘` / `Ctrl` を切り替える
- **Status**: NOTE — Phase 8 (外部 dogfood) 開始時に必須課題化

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm -w typecheck`) | Pass |
| Lint (`pnpm -w lint`) | Pass |
| Unit Tests (`pnpm -w test`) | Pass — 218 件全緑 (新規 17 件含む) |
| Build (`pnpm -w build`) | Pass — vite + wrangler dry-run |
| E2E (`pnpm -F @snap-share/web test:e2e`) | Pass — 52 件全緑 (新規 4 件含む)、回帰 0 |

## Files Reviewed

| File | Change Type | Lines |
|---|---|---|
| `apps/web/src/lib/colorCycle.ts` | Added | 22 |
| `apps/web/src/lib/__tests__/colorCycle.test.ts` | Added | 35 |
| `apps/web/src/components/ui/dialog.tsx` | Added | 96 |
| `apps/web/src/components/dialogs/HelpModal.tsx` | Added | 98 |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | Added | 59 |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | Added | 92 |
| `apps/web/e2e/help-modal.spec.ts` | Added | 80 |
| `apps/web/e2e/golden-path.spec.ts` | Added | 100 |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | Modified | +28 / -0 |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | Modified | +67 / -0 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | Modified | +5 / -0 |
| `apps/web/src/pages/EditorShell.tsx` | Modified | +37 / -0 |
| `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md` | Modified | +1 / -1 |
| `.claude/PRPs/plans/completed/phase-7.7-4-shortcut-cheatsheet.plan.md` | Added (archived plan) | — |
| `.claude/PRPs/reports/phase-7.7-4-shortcut-cheatsheet-report.md` | Added | — |

## Pattern Compliance

| Aspect | Status | Notes |
|---|---|---|
| AnnotationSchema 拡張 | N/A | 本フェーズではスキーマ変更なし |
| LOCAL_ORIGIN / Yjs transact 規約 | N/A | UI のみ、Yjs 操作なし |
| `<KonvaImage> listening={false}` | N/A | Canvas は触らず |
| Konva 色は hex literal | N/A | shadcn token のみ使用 |
| `data-slot` 命名 | OK | `ui/dialog.tsx` と既存 `alert-dialog.tsx` で対称的 |
| `Readonly<{...}>` 型 | OK | `Props` / `Row` / `Section` 全て Readonly |
| `import type` 分離 | OK | base-ui 型は `import type * as React from 'react'` 等で分離 |
| 既存 test pattern (`createRoot + act`) | OK | `@testing-library/react` 追加なし |
| biome formatter | OK | single quote / trailing comma / semicolon 維持 |
| 日本語ファースト原則 (CLAUDE.md) | OK | UI 文字列・コメント・テスト名すべて日本語、識別子は英語 |

## Security Assessment

| Category | Status |
|---|---|
| Hardcoded credentials | None |
| XSS | Safe — HelpModal の表示文字列は全て static const、外部入力なし |
| Injection | N/A |
| Path traversal | N/A |
| CSRF | N/A — UI のみ |
| Secret exposure | None |

## Final Verdict

**APPROVE with comments**: CRITICAL / HIGH 0 件。MEDIUM 1 件 (M1) は plan の NOT Building 「Modal open 中の他ショートカット」方針と整合し、Phase 7.8 dogfood 後の判断対象。LOW 4 件 (L1-L4) はいずれもスタイル / 将来課題で本フェーズのブロッカーにならない。

> Next steps: `/everything-claude-code:prp-commit` でコミット → `/everything-claude-code:prp-pr` で Phase 7.7 全体の PR 作成 (feat/phase-7.7-ux-foundation を main に向けて出す)。
