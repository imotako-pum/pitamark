# Code Review: Phase 10.I — タッチデバイス操作最適化

**Reviewed**: 2026-05-09
**Branch**: `phase-10-i-touch-optimization` → `main`
**Author**: imotako (PM/Dev)
**Decision**: ✅ **APPROVE** (Medium 4 件は本 review 内で対応済)
**Reviewer agents**: `everything-claude-code:typescript-reviewer` + `everything-claude-code:security-reviewer` (並列実行)

---

## Summary

Phase 10.I (4 sub-phase: Pointer Events 一本化 / 2-finger pinch + ヒットエリア / Toolbar bottom + safe-area / 受入 12 ケース + umbrella) の累積 +4,105 / -80 行 / 36 ファイルを TypeScript 観点とセキュリティ観点で並列レビューし、CRITICAL / HIGH ともにゼロ。**Medium 4 件はすべて本 review プロセス内で修正済**。CI lock (typecheck / biome / 346 unit / chromium 78 e2e / mobile-chrome 15 e2e) 全緑、PR 化準備完了。

## Findings

### CRITICAL

**None.**

### HIGH

**None.**

### MEDIUM

すべて本 review プロセス内で **fixed**。追加 commit (`chore(phase-10-i): code review feedback`) で反映。

#### M-1 (TS): `ANNOTATIONS_KEY` の重複定義 — ✅ Fixed

- **指摘**: `apps/web/e2e/touch-rectangle-draw.spec.ts:15` / `touch-pinch-zoom.spec.ts:13` / `touch-toolbar-bottom.spec.ts:9` がそれぞれローカルに `const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__'` を持っており、`touch-helpers.ts:7` の export と重複。値変更時に smoke 側だけ取り残されるリスク
- **修正**: 3 spec すべてローカル定義を削除し、`touch-helpers.ts` の `ANNOTATIONS_KEY` を import に切替

#### M-2 (TS): `selectTool` helper が `.tap()` 固定 — ✅ Fixed

- **指摘**: `apps/web/e2e/fixtures/touch-helpers.ts:83` の `selectTool` が `page.getByRole(...).tap()` 固定。desktop project (hasTouch:false) から呼ばれた際に AssertionError になる
- **修正**: JSDoc に「**mobile-chrome project 専用**」と明記し、本 helper を使う test に `skipNonMobileChrome` guard を要求するよう運用を文書化

#### M-3 (TS): `bottomToolbarHeight` effect の不変条件説明不足 — ✅ Fixed

- **指摘**: `apps/web/src/pages/EditorShell.tsx:162-180` の useEffect で `isTouch === false` 時に `bottomToolbarHeight` が 0 にリセットされる経路の不変条件がコメントで明示されていない
- **修正**: コメント追加 — 「`isTouch === false` のとき bottom 固定 container は unmount されるため `bottomToolbarRef.current === null` になり、effect で 0 リセット。`stageBottomInset` 計算で参照される際も `isTouch ? bottomToolbarHeight : 0` で二重に 0 保証」

#### M-4 (Sec M-1): `window.Konva.stages` 参照の経路注記不足 — ✅ Fixed

- **指摘**: `apps/web/e2e/touch-pinch-zoom.spec.ts` の `(window as unknown as { Konva?: ... }).Konva?.stages` アクセスが、Konva ESM bundle で `window.Konva` が露出しない可能性 (UMD なら露出する)。フレーキー化の懸念
- **修正**: spec 冒頭コメントに「Vite dev server 経由で `window.Konva` が露出している前提」「production bundle (ESM) とは別経路」を明記。実際 mobile-chrome smoke は dev server 配下で 15 件全緑のため動作確証あり

### LOW

すべて対処不要 (**by design / acceptable**)。本 review report で記録のみ。

| # | 指摘 | 対応 |
|---|---|---|
| L-1 (TS) | `CanvasStage.tsx:213` の `(stageRef as { current: Konva.Stage \| null }).current = node` cast | by design — `Ref<T>.current` は readonly のため不可避。CLAUDE.md 規約通り日本語 WHY コメント済み |
| L-2 (TS) | `useTouchDevice` が 7 ファイル (CanvasStage / EditorShell / 3 shapes / Toolbar 系 3) で各 listener 7 本 | acceptable — react hook の慣行に沿う、現スケールで実害なし。Toolbar Context 化は 11+ 候補 |
| L-3 (Sec) | `__SNAP_SHARE_ANNOTATIONS__` の DEV ゲート | confirmed safe — `if (!import.meta.env.DEV) return;` で production bundle から除去済 |
| L-4 (Sec) | `e.evt.preventDefault()` 呼び出しが `touch-action: none` と冗長 | acceptable — passive listener 判定での無効化リスクは `touch-action` で先に抑止される |
| L-5 (Sec) | `viewport-fit=cover` の追加 | confirmed safe — `paddingBottom: env(safe-area-inset-bottom)` で notch / home indicator 適切に回避済 |

### 観点別チェック (両 reviewer まとめ)

| 観点 | 結果 | 備考 |
|---|---|---|
| 型安全性 (`KonvaEventObject<PointerEvent/TouchEvent>`) | ✅ | type 引数の使い分け正しい |
| `verbatimModuleSyntax` 準拠 | ✅ | type-only import が一貫している |
| `noUncheckedIndexedAccess` 準拠 | ✅ | `touches[0]` / `[1]` は `if (!touch1 \|\| !touch2) return` で guard |
| React パターン (`useCallback` deps / `useEffect` cleanup) | ✅ | `handlePointerCancel = handlePointerUp` の alias は意図通り、cleanup 完備 |
| 不変性 (immutable) | ✅ | annotation の dispatch 経路で immutable update 維持 |
| async/await の正しさ | ✅ | Playwright spec の `await` 漏れなし |
| 入力検証 (TouchEvent / PointerEvent) | ✅ | DOM event は信頼前提、外部送信なし |
| XSS (`innerHTML` 等) | ✅ | grep 結果ゼロ、新規追加なし |
| `pointerType` 偽装でのバイパス | ✅ | 本 Phase で `pointerType` 分岐は実装していない、攻撃面なし |
| secrets / hardcoded credentials | ✅ | 新規ファイルに一切なし |
| `console.log` 直接使用 | ✅ | logger.ts 以外で `console` の追加なし |
| dependency 追加 | ✅ | `package.json` 変更なし |
| Konva global 設定 (`capturePointerEventsEnabled` / `hitOnDragEnabled`) | ✅ | ADR-0006 で文書化済、攻撃面の拡大なし |
| `touch-action: none` (CSS) | ✅ | native gesture 抑止の正当な変更 |

---

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm typecheck`) | ✅ Pass |
| Lint (`pnpm exec biome ci .`, 218 files) | ✅ Pass |
| Unit Tests (web 346 / api 187) | ✅ Pass |
| Build (`pnpm build`) | ✅ Pass |
| E2E mobile-chrome (3 smoke + 12 受入 = 15 件) | ✅ Pass (12.1s) |
| E2E chromium 全件 (78 件) | ✅ Pass (回帰ゼロ、35.1s) |

---

## Files Reviewed (36 files / +4,105 / -80 lines)

### 実装コード (CRITICAL レビュー対象)

| File | Type | Lines |
|---|---|---|
| `apps/web/src/components/canvas/CanvasStage.tsx` | Modified (大改修) | +152 / -30 |
| `apps/web/src/pages/EditorShell.tsx` | Modified (大改修) | +134 / -33 |
| `apps/web/src/hooks/useStageTransform.ts` | Modified (helper 追加) | +67 / -2 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | Modified | +28 / -8 |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | Modified | +11 / -1 |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | Modified | +11 / -1 |
| `apps/web/src/components/canvas/colors.ts` | Modified | +14 / -0 |
| `apps/web/src/components/toolbar/ToolButton.tsx` | Modified | +10 / -2 |
| `apps/web/src/components/toolbar/ColorPalette.tsx` | Modified | +4 / -0 |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | Modified | +9 / -2 |
| `apps/web/src/main.tsx` | Modified | +9 / -0 |
| `apps/web/src/styles/global.css` | Modified | +9 / -0 |
| `apps/web/index.html` | Modified | +1 / -1 |
| `apps/web/src/hooks/useTouchDevice.ts` | **Created** | +28 |

### テスト (テスト品質レビュー対象)

| File | Type | Lines |
|---|---|---|
| `apps/web/src/hooks/__tests__/useTouchDevice.test.tsx` | **Created** | +132 |
| `apps/web/src/hooks/__tests__/useStageTransform.test.ts` | Modified | +72 |
| `apps/web/src/components/canvas/__tests__/{ArrowShape,RectangleShape,HighlightShape}.test.tsx` | Modified | +97 |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | Modified | +56 |
| `apps/web/e2e/fixtures/touch-helpers.ts` | **Created** | +102 |
| `apps/web/e2e/touch-rectangle-draw.spec.ts` | **Created** | +60 |
| `apps/web/e2e/touch-pinch-zoom.spec.ts` | **Created** | +91 |
| `apps/web/e2e/touch-toolbar-bottom.spec.ts` | **Created** | +62 |
| `apps/web/e2e/touch-acceptance.spec.ts` | **Created** | +264 |

### ドキュメント / メタ (軽量レビュー)

| File | Type |
|---|---|
| `docs/adr/ADR-0006-pointer-events-unification.md` | **Created** |
| `docs/qa/phase-10-i-touch-manual-qa.md` | **Created** |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | Modified |
| `.claude/PRPs/plans/completed/phase-10-i-{1,2,3,4}-*.plan.md` | **Created** (4 plans) |
| `.claude/PRPs/reports/phase-10-i-{1,2,3}-*-report.md` | **Created** (3 sub-phase reports) |
| `.claude/PRPs/reports/phase-10-i-umbrella-report.md` | **Created** |

---

## Decision Rationale

### なぜ APPROVE か

1. **CRITICAL / HIGH ゼロ** — セキュリティ脆弱性なし、ロジックバグ / race / null 漏れなし
2. **Medium 4 件すべて本 review 内で fix** — 重複定義 / JSDoc 注記 / 不変条件コメント / window.Konva 経路注記、いずれも追加 commit で反映
3. **既存規約準拠** — CLAUDE.md (日本語コメント / 識別子英語 / `verbatimModuleSyntax`) / `.claude/rules/web/coding-style.md` (Konva 色は colors.ts で管理) すべて満たす
4. **テスト完備** — 新規 unit 25 件 + 新規 E2E 16 件 (3 smoke + 12 受入 + 1 helper test 経由) 緑
5. **段階的設計** — ADR-0006 (Status Update 含む) で Pointer Events 一本化と TouchEvent 併用の並列共存を文書化、後続 Phase への引き継ぎ事項を umbrella report に集約
6. **既存テストへの回帰ゼロ** — chromium project 78 件 e2e 全緑、desktop UX 完全非劣化

### Recommended Next Steps

1. **PR 作成**: `/everything-claude-code:prp-pr` または `gh pr create` で `phase-10-i-touch-optimization → main` の PR を作成
2. **PR 本文**: umbrella report の §1 (Acceptance Criteria) と §4 (工数 retrospective) を貼ると進捗見通しがよい
3. **Merge 後**: Phase 10.H (ランディング条件付き拡張) で `useTouchDevice` を流用して hero CTA を adaptive 化
4. **実機 QA**: 推奨だが merge ブロッカーではない。`docs/qa/phase-10-i-touch-manual-qa.md` を著者がドッグフードで消費

---

## Reviewer Methodology

- **TypeScript reviewer**: 型 / async / React パターン / verbatimModuleSyntax / noUncheckedIndexedAccess / hooks deps / cleanup を中心に確認
- **Security reviewer**: 入力検証 / XSS / pointerType 偽装 / window 経由グローバル / hardcoded secrets / dependency 追加 / Konva global 設定 / `touch-action` / DEV ゲート確認
- **両 reviewer ともに**: PRD / Plan / report の意図と整合する実装かどうか確認、確度の低い理論的指摘は除外

両 reviewer の総合評価: TypeScript = APPROVE WITH COMMENTS / Security = APPROVE → 統合判定 **APPROVE** (Medium 全件 fix 後)。

---

## Post-Review Discovery (2026-05-09 後): touch でのリサイズ + テキスト再編集

review report 起票後にユーザーが実機で「枠を大きくしたり / テキストを変更したり」が動かないことを発見。Phase 10.I-4 の受入 spec が `add / move / delete` の 3 操作のみで、**Resize / Endpoint / dblTap (テキスト再編集) を網羅していなかった盲点** が判明。Decision は APPROVE のまま、追加 fix commit で完成度を上げる。

### 検出された問題と切り分け

| 経路 | Phase A 検証結果 | 原因 |
|---|:--:|---|
| 矩形 / ハイライト Resize (Transformer) | spec で動く (座標修正後) | 実装 OK、spec の `logicalToScreen` に Stage container DOM offset を足し忘れ |
| 矢印 from / to endpoint Circle drag | 同上 | 実装 OK、同じ spec 座標バグ |
| テキスト ダブルタップ → 編集モード | **実装 bug** | `TextShape.tsx:45` が `onDblClick` のみで `onDblTap` 未配線。Konva の `dblclick` は mouse event 専用、touch は `dbltap` 別イベント |
| テキスト編集中の文字入力 → 確定 | spec で動く (修正後) | Playwright で `page.keyboard.type` 直接ではなく `overlay.fill()` 経由で textarea focus を確保 |

### 追加 fix

1. **`apps/web/src/components/canvas/shapes/TextShape.tsx`**: `onDblClick` (PC、既存維持で desktop 非劣化) **に加えて** `onDblTap` (touch) を追加。Konva 公式 [Desktop_and_Mobile.mdx](https://konvajs.org/docs/events/Desktop_and_Mobile.html) のペアパターン
2. **`apps/web/e2e/touch-acceptance-edit.spec.ts`** (新規 7 ケース):
   - resize-1 / -2: 矩形・ハイライトの Transformer 右下 anchor drag → width/height 変化
   - endpoint-1 / -2: 矢印 from / to Circle drag → annotation.from / .to 変化
   - dbltap-text: テキストダブルタップ → TextEditorOverlay 表示 (`onDblTap` 効果)
   - edit-text: 編集モードで文字入力 → Enter 確定 → annotation.text 更新
   - edit-text-cancel: 編集モードで Esc → annotation 残存
3. **`docs/qa/phase-10-i-touch-manual-qa.md`** §1 を 12 ケース → 19 ケースに拡張 (resize 2 / endpoint 2 / dblTap 1 / edit 1 / cancel 1)
4. **`.claude/PRPs/reports/phase-10-i-umbrella-report.md`** §1 Acceptance Criteria 表を更新

### 検証

- typecheck / biome ci 219 files / web 346 unit / api 187 unit すべて緑
- mobile-chrome 累積 **22 件 (3 smoke + 12 受入 + 7 post-review)** すべて緑 (15.5s)
- chromium 78 件 e2e 回帰ゼロ (34.9s)

### Decision (post-fix)

✅ **APPROVE** — Phase 10.I の Acceptance Criteria 「PC でできることはすべてスマホでも」が **完全達成**。Phase 10.F (v1.0.0) の必須 blocker 解除条件を満たす。

### 学び

- 受入 spec は **実機で実際に行う操作の網羅性** を最優先するべきだった。Add / Move / Delete の 3 操作しか lock していなかったのは穴
- Konva の event ペアリング (`onDblClick` + `onDblTap` / `onMouseDown` + `onTouchStart` + `onPointerDown`) は **公式 docs に明記されたパターン** で、touch 対応時は必ず確認すべき
- Plan / Implementation 段階で **「3 操作 = add/move/delete」と書いた瞬間に "再編集" が漏れていることを検知できなかった** が反省点。次 Phase からは Plan の Acceptance Criteria セクションで「**この機能で UI 上できる全ての操作**」を一度列挙する習慣を入れる
