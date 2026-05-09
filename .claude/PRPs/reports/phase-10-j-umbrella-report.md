# Phase 10.J umbrella report — Touch UX Standards Compliance

**Date**: 2026-05-09
**Branch**: `phase-10-j-touch-ux-standards`
**Source PRD**: [`phase-10-j-touch-ux-standards.prd.md`](../prds/phase-10-j-touch-ux-standards.prd.md)
**ADR**: [`ADR-0007-touch-ux-standards.md`](../../../docs/adr/ADR-0007-touch-ux-standards.md)
**Sub-phases**: 10.J-1 (paired binding + タイミング定数 SSOT) / 10.J-2 (長押しコンテキストメニュー) / 10.J-3 (Transformer coarse anchor 再調整 + サイズ定数 SSOT) / 10.J-4 (E2E migration + 実機 QA + 本 umbrella)

> **本 report が Phase 10.J-4 の個別 report を兼ねる**。Phase 10.I の前例 (受入 phase の性質上 umbrella と重複) を踏襲し、`phase-10-j-4-...-report.md` は作成せず、本 umbrella で代替する判断を Plan 段階で確定済 (`phase-10-j-4-e2e-migration-and-manual-qa.plan.md` Notes 参照)。

---

## 1. PRD Acceptance Criteria 達成度

| Metric | Target | Achieved | 根拠 |
|---|---|:--:|---|
| **paired binding (`onTap`) の動作** | 全 4 Shape で touch tap → 選択 dispatch が走る | ✅ (CI 自動) / ⚠ (実機手動 docs/qa 待ち) | `touch-paired-binding.spec.ts` 4 件 mobile-chrome 全緑 (本物 touch event 経路で `onTap` → `onClick(id)` → toolbar の `hasSelection=true` まで踏む)。実機検証は `docs/qa/phase-10-j-touch-manual-qa.md §1B #20-23` で著者消費待ち |
| **長押しコンテキストメニュー** | 500ms 長押しで menu 表示 + 4 項目 (削除 / 複製 / 前面 / 背面) すべて動作 | ✅ (CI 自動) / ⚠ (実機手動 docs/qa 待ち) | `touch-long-press-menu.spec.ts` 5 件 mobile-chrome 全緑 (open / short tap / 削除 / 複製 / 前面背面)。実機検証は `docs/qa/phase-10-j-touch-manual-qa.md §1B #24-31` で著者消費待ち |
| **Transformer 20px anchor** | tldraw 業界標準値で隣接 shape を覆わず実効 ~44px tap zone | ✅ (CI 自動) / ⚠ (実機手動 docs/qa 待ち) | `colors.test.ts` で `ANCHOR_SIZE_TOUCH = 20` lock-in、`touch-acceptance-edit.spec.ts` の resize-1 / resize-2 / endpoint-1 / endpoint-2 が本物 touch 経路で全緑。実機検証は `docs/qa/phase-10-j-touch-manual-qa.md §1B #32` |
| **既存 19 件 E2E が本物 touch event を踏む** | 旧 `page.mouse` 経路 (MouseEvent のみ) → 新 `dispatchTouchEvent` 経路 (PointerEvent + TouchEvent) に migration | ✅ (CI 自動) | `touch-helpers.ts` 内部書き換えで `tapStage` / `dragOnStage` が本物 touch 化。`touch-acceptance.spec.ts` 12 件 + `touch-acceptance-edit.spec.ts` 7 件 = 19 件すべて mobile-chrome 緑 (単独実行)。並列負荷の setupEditor flaky は punch-list (§3) |
| **誤操作率** | 5 試行平均 < 1/5 | ⚠ (手動) | `docs/qa/phase-10-j-touch-manual-qa.md §2` で消費する手順 + 結果欄テンプレート完備 |
| **selection handle ヒット率** | 40 試行で 36/40 以上 (90%) | ⚠ (手動) | `docs/qa/phase-10-j-touch-manual-qa.md §3` で 5 試行 × 4 形状 × 2 デバイス = 40 セルテーブル完備 |
| **CWV (mobile)** | LCP < 2500ms / INP < 200ms / CLS < 0.1 | ⚠ (手動 + Phase 10.G) | `docs/qa/phase-10-j-touch-manual-qa.md §5` で Lighthouse mobile profile spot check 手順 |
| **デスクトップ非劣化** | 既存 unit / E2E (chromium) すべて緑、視覚 regression なし | ✅ (CI 自動) | chromium project 78 件 e2e 全緑 (回帰ゼロ、Phase 10.J-1 / -2 / -3 / -4 で都度確認)。`ANCHOR_SIZE_DESKTOP = 10` は据え置きで desktop 視覚も完全維持 |
| **リアルタイム共同編集 mobile→PC** | 各 annotation 反映 < 1000ms | ⚠ (手動) | `docs/qa/phase-10-j-touch-manual-qa.md §4` で 4 形状 × 2 デバイス = 8 セルテーブル完備 |

**達成サマリ**:
- 自動化可能な項目 (paired binding / 長押し menu / Transformer 20px / 既存 19 件 migration / デスクトップ非劣化) は ✅ 達成
- 自動化困難な項目 (誤操作率 / handle hit / 同期 / CWV / 実機 sanity) は手動 docs テンプレート完備で実機 QA 着手可能な状態
- Phase 10.J の **客観的 complete 宣言** は CI lock + 手動 docs 起票の両輪で確定する設計 (Phase 10.I と同方針、ADR-0007 D6 = 実機 QA Must)

---

## 2. Sub-phase deliverable

### 10.J-1: paired binding 規約適用 + タイミング定数 SSOT

- **Commits**:
  - `c4873d6 docs(phase-10-j-1): paired binding + touch-thresholds.ts SSOT の Plan を起票`
  - `fb5a382 feat(phase-10-j-1): paired binding 規約適用 + touch-thresholds.ts SSOT`
- **Plan**: [`phase-10-j-1-paired-binding-and-touch-thresholds.plan.md`](../plans/completed/phase-10-j-1-paired-binding-and-touch-thresholds.plan.md)
- **Deliverable**:
  - 全 4 Shape (`RectangleShape` / `ArrowShape` / `HighlightShape` / `TextShape`) に `onTap` を `onClick` と paired bind (Konva 公式 `Desktop_and_Mobile.mdx` 規約)
  - `ArrowShape` の Circle handle 2 箇所に `onTouchStart` を追加 (Stage `onTouchMove` multi-touch 経路でも cancelBubble が効く)
  - `apps/web/src/lib/touch-thresholds.ts` を新設 — `LONG_PRESS_DURATION_MS / DOUBLE_TAP_INTERVAL_MS / DOUBLE_TAP_POSITION_THRESHOLD_PX / DRAG_SLOP_PX_FINE / DRAG_SLOP_PX_COARSE` の 5 定数を業界標準 (Excalidraw / tldraw / iOS HIG / Android) で SSOT 化
  - 各 Shape の unit test に paired binding assertion 追加 (`onTap` が `onClick` と同一 callback を呼ぶ)
  - `Event.isTrusted` の grep ゼロ件確認 (10.J-4 の `dispatchEvent` 経路 default 化と整合)

### 10.J-2: 長押しコンテキストメニュー

- **Commits**:
  - `4ec4ead docs(phase-10-j-2): 長押しコンテキストメニュー実装の Plan を起票`
  - `8b239fe feat(phase-10-j-2): useLongPress hook + ContextMenu UI foundation`
  - `7420673 feat(phase-10-j-2): 長押し menu の data model + Shape 配線 + EditorShell 統合`
- **Plan**: [`phase-10-j-2-long-press-context-menu.plan.md`](../plans/completed/phase-10-j-2-long-press-context-menu.plan.md)
- **Deliverable**:
  - `apps/web/src/hooks/useLongPress.ts` 実装 (500ms timer + 6px slop + cancel 条件 + visual feedback callback、`navigator.vibrate(15)` Android only)
  - `apps/web/src/components/canvas/ContextMenu.tsx` 実装 (4 項目 menu、`role="menu"` / `role="menuitem"`、画面端 flip で viewport 内に収める)
  - 全 4 Shape に `onLongPress` props を配線、`useLongPress` hook を Shape 内部で消費
  - `EditorShell.tsx` で context menu の state (open / position / target id) を hold + 4 項目の dispatch を annotations store に追加
  - **z-order 案 B** (`createdAt` 流用) を採用 — schema 変更なしで前面/背面を表現 (Y.UndoManager 互換)
  - `domain/annotation/operations.ts` に `bringFront` / `sendBack` / `duplicate` の純粋関数追加 + reducer / yjs-mutations 配線
  - i18n (`ja.ts` / `en.ts`) に `contextMenu.{duplicate,bringFront,sendBack,delete}` の 4 key 追加
  - test count 362 → 390 (+28: useLongPress 8 / ContextMenu 8 / operations 9 / reducer 5 / yjs-mutations 6)

### 10.J-3: Transformer coarse anchor 再調整 + サイズ定数 SSOT

- **Commits**:
  - `5150700 docs(phase-10-j-3): Transformer coarse anchor 再調整 + サイズ定数 SSOT の Plan を起票`
  - `9da7dcb feat(phase-10-j-3): ANCHOR_SIZE_TOUCH 24→20 + size 定数 SSOT 化 + lock-in test`
- **Plan**: [`phase-10-j-3-transformer-coarse-anchor-and-size-constants.plan.md`](../plans/completed/phase-10-j-3-transformer-coarse-anchor-and-size-constants.plan.md)
- **Deliverable**:
  - `colors.ts` の `ANCHOR_SIZE_TOUCH` を 24 → **20** に再調整 (tldraw `coarseHandleRadius` 業界標準値、ADR-0007 D3)
  - `touch-thresholds.ts` に `MIN_TAP_TARGET_PX = 44` (HIG / Material 3) と `HIT_TEST_MARGIN_PX = 8` (tldraw `hitTestMargin`) を追記 — UI 各所のマジックナンバーを SSOT に逃がす
  - `ContextMenu.tsx` のコメントから `MIN_TAP_TARGET_PX` を参照 (Tailwind class `min-w-11 min-h-11` との二重管理は注記で明示)
  - `touch-thresholds.test.ts` (7 件) と `colors.test.ts` (4 件) を新設 — 業界標準値の意図せぬドリフトを CI で検知する lock-in test
  - test count 390 → 401 (+11)

### 10.J-4: E2E migration + 実機 QA + umbrella report

- **Commits**:
  - `a51f0d4 docs(phase-10-j-4): E2E migration + 実機 QA + umbrella report の Plan を起票`
  - `554d261 refactor(phase-10-j-4): 既存 19 件 E2E を本物 touch event 経路に migration`
  - `54e8789 feat(phase-10-j-4): paired binding sanity + long-press menu の新規 E2E spec を追加`
  - (本 commit) `docs(phase-10-j-4): manual QA rename + 拡張 + umbrella report 起票`
- **Plan**: [`phase-10-j-4-e2e-migration-and-manual-qa.plan.md`](../plans/completed/phase-10-j-4-e2e-migration-and-manual-qa.plan.md)
- **Deliverable**:
  - `apps/web/e2e/fixtures/touch-helpers.ts` に `dispatchTouchEvent` / `touchSequence` / `dragViewport` / `dblTapViewport` / `commitTextAnnotation` / `setupEditor` を新設
  - `dispatchTouchEvent` は **PointerEvent + TouchEvent を pair で発火** (W3C Pointer Events 仕様の発火順を再現)。Stage の `onPointerDown` 経路 (Phase 10.I-1 ADR-0006) と Shape の `onTap` / `onTouchStart` 経路 (Phase 10.J-1 ADR-0007 D1) を CI で同時に踏む
  - `tapStage` / `dragOnStage` を内部で touch 経路に書き換え (signature 不変) → 既存 19 件 E2E が無編集で本物 touch event を踏む
  - text 関連 4 spec は本物 touch event で textarea が正しく focus される結果、旧テストが偶然依存していた幻の挙動 (空文字 Esc で annotation 残存) が露呈。`commitTextAnnotation` で non-empty content を確定する正しいフローに修正、`edit-text-cancel` は dbltap で既存 text を再編集 → Esc で cancel → 残存、の正しい assertion に置き換え
  - 新規 spec 2 件:
    - `touch-paired-binding.spec.ts` (4 件) — 全 4 Shape で touch tap → 削除ボタン enable まで踏む paired binding sanity
    - `touch-long-press-menu.spec.ts` (5 件) — 500ms 長押し / 短い tap / 削除 / 複製 / 前面背面 の 5 ケース
  - `touch-rectangle-draw.spec.ts` (10.I-1 smoke) を helper 経由に統一して flaky 緩和
  - `docs/qa/phase-10-i-touch-manual-qa.md` を `phase-10-j-touch-manual-qa.md` に rename + Phase 10.J 追加チェック §1B (#20-33) 14 ケース追加
  - 本 umbrella report 起票
  - mobile-chrome E2E 件数: 22 (10.I 時点) → 31 (10.J-4 後、+9)

---

## 3. Phase 内で発見された未解決事項 / 次フェーズへの引き継ぎ

| Issue | 重要度 | 引き継ぎ先 |
|---|---|---|
| **並列 5 workers 下で setupEditor の URL redirect が flaky** (`/r/<id>` redirect timeout)。単独実行では 100% 緑。原因は webServer の API negotiation が複数 workers 同時 hit で遅延すること | Medium | Phase 11+ retainer。workers 数調整 (現 5 → 3) / spec シリアライズ / api-server warm-up を検討。本 plan では timeout 20s で対症療法、本質解は別 plan |
| **`HIT_TEST_MARGIN_PX = 8` の実 runtime 消費** (forward-looking 定数のまま) | Low | Phase 11+ retainer。Arrow / Highlight の `hitFunc` 拡張で touch hit zone を視覚 stroke 幅より広く取る場合に消費 |
| **paired binding ESLint custom rule** (`onClick` だけ bind して `onTap` 忘れを CI 検知) | Low | Phase 11+ retainer。本 plan では unit test での hardcode assertion で代替済 (10.J-1 NOT Building) |
| **Tailwind `min-w-11 min-h-11` と `MIN_TAP_TARGET_PX = 44` の二重管理 drift** | Low | Phase 11+ retainer。Custom lint rule で整合性チェック (10.J-3 NOT Building) |
| **実機 QA 100% 通過の人間 ceremony pending** (`docs/qa/phase-10-j-touch-manual-qa.md` §1-§5 の手動消費) | High (merge ブロッカー、ADR-0007 D6) | 著者 + 知人 1 名で iPhone Safari + Android Chrome で消費。完了後に本 report の §1 Acceptance Criteria 表を ⚠ → ✅ で update |

---

## 4. 工数 retrospective

- **Commits**: 11 (Phase 10.J 全体)
- **LOC**: 4713 insertions / 106 deletions = +4607 net
- **File scope**:
  - 新規ファイル 14: `touch-thresholds.ts` / `useLongPress.ts` / `ContextMenu.tsx` / `operations.ts` (+ test) / `touch-paired-binding.spec.ts` / `touch-long-press-menu.spec.ts` / `colors.test.ts` / `touch-thresholds.test.ts` / 4 plan + 1 ADR + 1 PRD + 1 manual QA + 1 umbrella report
  - 更新ファイル 26: 4 Shape + 4 Shape test + AnnotationLayer / CanvasStage / EditorShell / annotationsReducer / yjs-annotations-context / yjs-mutations / annotationsReducer test / yjs-mutations test / colors.ts / i18n ja/en / 既存 e2e helper + 4 spec / PRD / docs/qa rename
- **期間**: 2026-05-09 開始、同日 4 sub-phase 完了 (1 セッション内、Plan 起票 → 実装 → migration → 新規 spec → docs)
- **PR**: Draft #22 (`https://github.com/imotako-pum/pitamark/pull/22`、本 umbrella report commit 後に Ready 化検討)

---

## 5. Decisions Log

PRD (`phase-10-j-touch-ux-standards.prd.md`) Decisions Log を継承。本 umbrella で確定追加した点:

| Decision | Choice | 根拠 |
|---|---|---|
| E2E `dispatchEvent` の発火順 | PointerEvent → TouchEvent の **pair で連続発火** | W3C Pointer Events 仕様で touch 入力時は `pointerdown` → `touchstart` の順。Stage `onPointerDown` (ADR-0006) と Shape `onTap` (ADR-0007 D1) を両方踏むため必須 (10.J-4 実装で発覚した制約) |
| text 編集中 Esc の正しい assertion | 空文字 → `handleTextCancel` で remove (既存実装維持) | 旧 e2e は textarea が focus 取れず Esc が空振り → annotation 残存を assert していたが、本物 touch event で focus 取得が動く結果、実装側挙動 (空文字 remove) が露呈。実装は intent 通りなのでテスト側を修正 |

---

*Generated: 2026-05-09*
*Status: IMPLEMENTED — 実機 QA pending (`docs/qa/phase-10-j-touch-manual-qa.md` 著者消費待ち)*
