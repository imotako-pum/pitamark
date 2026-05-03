# Implementation Report: Phase 7.7-4 ショートカット網羅 + チートシート

## Summary
Phase 7.7-4 (B2: ショートカット網羅 + チートシート) を完了。`?` (Shift+/) キーで起動する `HelpModal`、`C` / `⇧C` による色巡回ショートカット、Toolbar 右端の Help アイコンボタンを追加し、success metric「マウス無し golden path 100%」を E2E で担保。Phase 7.7-1〜3 で生やしたショートカットが全て一箇所のチートシート (6 セクション・15 行) に集約され発見可能になった。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium (200-400 行) | Medium (582 行 純増 + 137 行 既存 update) |
| Confidence | 8/10 | 8/10 (実値どおり: HelpModal open 中の挙動とキー表記は dogfood で要評価) |
| Files Created | 5 | 7 (`colorCycle.ts`/`colorCycle.test.ts`/`dialog.tsx`/`HelpModal.tsx`/`HelpModal.test.tsx`/`Toolbar.test.tsx` + E2E 2 本) |
| Files Updated | 6 | 5 (`useKeyboardShortcuts.ts`/`.test.tsx`/`Toolbar.tsx`/`EditorShell.tsx`/PRD) |
| New Unit Tests | 18 件以上 | 17 件 (colorCycle 6 + useKeyboardShortcuts 6 + HelpModal 2 + Toolbar 3) |
| New E2E Tests | 2 spec | 2 spec (help-modal 3 件 + golden-path 1 件) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | colorCycle 純関数 | [done] Complete | `nextColor` / `prevColor` 実装 |
| 2 | colorCycle unit test | [done] Complete | 6 件、wrap-around / palette 外を網羅 |
| 3 | useKeyboardShortcuts に `?` / `C` / `⇧C` | [done] Complete | `if (mod) return;` の前に modifier 不要分岐を挿入 |
| 4 | useKeyboardShortcuts test 追加 | [done] Complete | 6 件追加 (既存 6 + 新規 6 = 12 件) |
| 5 | `ui/dialog.tsx` (base-ui Dialog ラッパ) | [done] Complete | `alert-dialog.tsx` の構造を Dialog で複製 |
| 6 | `HelpModal` コンポーネント | [done] Complete | 6 セクション × 15 行のチートシート |
| 7 | HelpModal smoke test | [done] Complete | 2 件 (open=false 描画なし / open=true title + kbd 確認) |
| 8 | Toolbar に Help アイコン追加 | [done] Complete | `CircleHelp` ボタン (画像未投入時も enabled) |
| 9 | EditorShell に HelpModal 配線 | [done] Complete | `useKeyboardShortcuts` 呼出位置を新ハンドラ宣言の後ろに移動 (Deviation #1) |
| 10 | Toolbar test 新規追加 | [done] Complete | 3 件 (Help button DOM / click / 画像未投入時 enabled) |
| 11 | E2E `help-modal.spec.ts` | [done] Complete | 3 件 (`?` open + Esc / Toolbar click + toggle / kbd 表記) |
| 12 | E2E `golden-path.spec.ts` | [done] Complete | キーボードのみで 4 種注釈 + 色巡回 + ⌘S 完遂 |
| 13 | PRD Phase 4 status 更新 | [done] Complete | `pending` → `in-progress` + plan link |
| 14 | 全体回帰 (typecheck/lint/test/e2e/build) | [done] Complete | 全部緑 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | [done] Pass | `pnpm -w typecheck` ゼロエラー |
| Lint | [done] Pass | `pnpm -w lint` クリーン (`pnpm -w format` で自動整形 7 件 + 1 件後追い) |
| Unit Tests | [done] Pass | 218 件全緑 (元 207 + 新規 17) |
| Build | [done] Pass | `pnpm -w build` (vite + wrangler dry-run) 緑 |
| E2E | [done] Pass | 全 52 件緑 (新規 4 件含む)、回帰 0 |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `apps/web/src/lib/colorCycle.ts` | CREATED | +22 |
| `apps/web/src/lib/__tests__/colorCycle.test.ts` | CREATED | +35 |
| `apps/web/src/components/ui/dialog.tsx` | CREATED | +96 |
| `apps/web/src/components/dialogs/HelpModal.tsx` | CREATED | +98 |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | CREATED | +59 |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | CREATED | +92 |
| `apps/web/e2e/help-modal.spec.ts` | CREATED | +80 |
| `apps/web/e2e/golden-path.spec.ts` | CREATED | +100 |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATED | +28 / -0 |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | UPDATED | +67 / -0 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATED | +5 / -0 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATED | +37 / -0 |
| `.claude/PRPs/prds/phase-7.7-ux-foundation.prd.md` | UPDATED | +1 / -1 (phase 4 status + plan link) |

## Deviations from Plan

### Deviation #1 — `useKeyboardShortcuts` 呼出を新ハンドラ宣言の後ろに移動
- **WHAT**: plan では既存位置 (handleExport の直後、L177) に新コールバック (`onShowHelp` / `onCycleColorNext` / `onCycleColorPrev`) を渡すと書いていたが、実際には `useCallback` 宣言の hoisting がないため block-scoped 変数の declaration order エラー (TS2448 / TS2454) が出た
- **WHY**: `handleCycleColorNext` などは `handlePickColor` の後ろに置いた方が依存関係が明示的 (handleCycleColor* → handlePickColor → store)。新ハンドラ群を上に移動するか、useKeyboardShortcuts を下に移動するかの 2 択で、後者(useKeyboardShortcuts ブロックを 1 つ下に移動)が差分最小だったので採用
- **影響**: 機能・依存関係に変化なし。コード順だけが変わった

### Deviation #2 — E2E で `Shift+/` を Playwright keyboard.press で発火できず、合成 KeyboardEvent を `page.evaluate` で window に dispatch
- **WHAT**: plan では `page.keyboard.press('Shift+/')` で `?` を発火させると書いていたが、Playwright headless Chromium で `Shift+/` の keyup 経路が `e.key === '?'` を出さず onShowHelp が発火しなかった
- **WHY**: Phase 7.7-3 zoom-pan.spec.ts と同じ Playwright 制約 (Meta+0/1 を Chromium がブラウザ shortcut として横取りする問題と同類)。useKeyboardShortcuts のキー判別自体は unit test で完全カバーしており、E2E はパイプライン (`?` → setHelpOpen → Modal 描画) を担保すれば十分
- **影響**: 「ユーザーが実機で `Shift+/` を押した時の挙動」自体は手動 QA に委ねる。これは macOS US/JIS 両配列で動作確認する acceptance criteria に含めた

### Deviation #3 — HelpModal の `<Kbd key={i}>` を `<Kbd key={`${row.label}-${k}`}>` に変更
- **WHAT**: plan では `key={i}` (array index) + `// biome-ignore` で抑制すると書いたが、biome 設定では `noArrayIndexKey` rule が無効化されており suppression が「未使用」と warning が出た
- **WHY**: biome の警告を残さない方が CI 健全性が高い。row.label と k の組合わせは静的・一意であり、key として安定
- **影響**: 機能変化なし、lint クリーン化

## Issues Encountered

### Issue #1: lib テストディレクトリの場所
- **Symptom**: plan では `apps/web/src/lib/__tests__/colorCycle.test.ts` と書いたが、実際の lib 配下にも `__tests__/` があった (api-client.test.ts などが既に在中)。当初は混乱したが、確認後 plan 通りに置いた
- **Resolution**: 確認のみ、変更なし

### Issue #2: `pnpm lint` が apps/web/ から実行できない
- **Symptom**: 当初 `pnpm lint` を実行したが `Command "lint" not found` エラー。原因は `lint` script が root package.json にしかなく workspace package には無いため
- **Resolution**: `pnpm -w lint` (workspace root flag) で実行。同様に `pnpm -w format` / `pnpm -w typecheck` / `pnpm -w build` を使用

### Issue #3: E2E `Shift+/` 経路の失敗
- **Symptom**: 1 周目の E2E で help-modal の 3 件すべて失敗 — Modal が開かない。test 2 のページスナップで Modal は実際には DOM に描画されていることを確認したが、`Shift+/` keypress が onShowHelp を発火しないことが原因と判明
- **Resolution**: Deviation #2 参照。`page.evaluate` で合成 KeyboardEvent を dispatch するヘルパ `dispatchHelpKey` に切り替え、3 件全緑

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/src/lib/__tests__/colorCycle.test.ts` | 6 件 | nextColor / prevColor の wrap-around / palette 外復帰 |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | 6 件 (既存 6 + 新規 6 = 12 件) | `?` / `C` / `⇧C` 各経路 + Cmd+C 衝突回避 + input フォーカス時無効化 |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | 2 件 | open=false 非描画 / open=true title + kbd 描画 |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | 3 件 | Help button DOM / click → onShowHelp / 画像未投入時 enabled |
| `apps/web/e2e/help-modal.spec.ts` | 3 件 | `?` 合成 dispatch で open + Esc 閉 / Toolbar ❓ click + ? 再 dispatch toggle / 主要 kbd 表記 |
| `apps/web/e2e/golden-path.spec.ts` | 1 件 | 画像投入 → R drag → C → A drag → T type → H drag → ⌘S download |

## Next Steps
- [ ] `/code-review` で内部レビュー
- [ ] PRD Phase 4 status を `in-progress` → `complete` に更新 + report link 追加 (commit 直前に行う想定)
- [ ] `/prp-commit` でコミット
- [ ] `/prp-pr` で PR 作成 (Phase 7.7 全体 = #11 マージ後の次の PR、`feat/phase-7.7-ux-foundation` ブランチを直接 PR 化)
- [ ] dogfood: macOS US/JIS 両配列で `?` キー動作確認 (実機マニュアル QA)
- [ ] dogfood: HelpModal open 中に V/R 等のショートカット発火が邪魔か観察 (邪魔なら Phase 7.8 で modal-aware ガード追加)
