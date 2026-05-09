# Phase 10.I umbrella report — タッチデバイス操作最適化

**Date**: 2026-05-09
**Branch**: `phase-10-i-touch-optimization`
**Source PRD**: [`phase-10-i-touch-optimization.prd.md`](../prds/phase-10-i-touch-optimization.prd.md)
**Sub-phases**: 10.I-1 (Pointer Events 一本化) / 10.I-2 (2-finger pinch + ヒットエリア) / 10.I-3 (Toolbar bottom + safe-area) / 10.I-4 (受入 + 手動 QA + 本 umbrella)

> **本 report が Phase 10.I-4 の個別 report を兼ねる**。受入 phase の性質上、内容が umbrella と重複するため `phase-10-i-4-...-report.md` は作成せず、本 umbrella で代替する判断を Plan 段階で確定済 (`phase-10-i-4-acceptance-and-manual-qa.plan.md` Notes 参照)。

---

## 1. PRD Acceptance Criteria 達成度

| Metric | Target | Achieved | 根拠 |
|---|---|:--:|---|
| **基本機能パリティ** | iPhone (Safari) + Pixel (Chrome) で 4 形状 × 3 操作 = 12 ケースが 100% 通過 | ✅ (CI 自動) / ⚠ (実機手動 docs/qa 待ち) | `apps/web/e2e/touch-acceptance.spec.ts` 12 件 mobile-chrome project で全緑 (10.0s)。実機検証は `docs/qa/phase-10-i-touch-manual-qa.md` で著者消費待ち |
| **誤操作率** | 5 試行平均 < 1/5 | ⚠ (手動) | `docs/qa §2` で消費する手順 + 結果欄テンプレート完備、著者 + 知人ドッグフードで埋める |
| **selection handle ヒット率** | 40 試行で 36/40 以上 (90%) | ⚠ (手動) | `docs/qa §3` で 5 試行 × 4 形状 × 2 デバイス = 40 セルテーブル完備 |
| **CWV (mobile)** | LCP < 2500ms / INP < 200ms / CLS < 0.1 | ⚠ (手動 + Phase 10.G) | `docs/qa §5` で Lighthouse mobile profile spot check 手順。実 RUM データは Phase 10.G の Cloudflare Web Analytics 1 ヶ月観察で収集する PRD 設計と整合 |
| **デスクトップ非劣化** | 既存 unit / E2E (chromium) すべて緑、視覚 regression なし | ✅ (CI 自動) | chromium project 78 件 e2e 全緑 (回帰ゼロ、Phase 10.I-1 / -2 / -3 で都度確認)。selection handle / Transformer anchor の visual サイズ (8px / 10px) は完全維持で実装 |
| **リアルタイム共同編集 mobile→PC** | 各 annotation 反映 < 1000ms | ⚠ (手動) | `docs/qa §4` で 4 形状 × 2 デバイス = 8 セルテーブル完備 |

**達成サマリ**:
- 自動化可能な項目 (基本機能パリティの CI lock + デスクトップ非劣化) は ✅ 達成
- 自動化困難な項目 (誤操作率 / handle hit / 同期 / CWV) は手動 docs テンプレート完備で実機 QA 着手可能な状態
- Phase 10.I の **客観的 complete 宣言** は CI lock + 手動 docs 起票の両輪で確定する設計

---

## 2. Sub-phase deliverable

### 10.I-1: Pointer Events 一本化 + 描画系復旧

- **Commit**: `c939c43 feat(phase-10-i-1): Konva Stage を Pointer Events 一本化してタッチ描画を復旧`
- **Plan**: [`phase-10-i-1-pointer-events-migration.plan.md`](../plans/completed/phase-10-i-1-pointer-events-migration.plan.md) (archived)
- **Report**: [`phase-10-i-1-pointer-events-migration-report.md`](phase-10-i-1-pointer-events-migration-report.md)
- **Deliverable**:
  - Konva `<Stage>` の `onMouseDown/Move/Up/Leave` を `onPointerDown/Move/Up/Cancel/Leave` に置換、`KonvaEventObject<MouseEvent>` → `<PointerEvent>` 統一
  - `Konva.capturePointerEventsEnabled = true` を `main.tsx` で明示 (Stage 外 drag が切れない効果)
  - `.konvajs-content { touch-action: none }` を `global.css` に追加 (iOS Safari の native gesture 抑止)
  - `ArrowShape` の endpoint Circle handle 2 箇所も `onPointerDown` に
  - `ADR-0006-pointer-events-unification.md` を Accepted で起票 (一次資料リンク 10 件)
  - 新規 E2E smoke (`touch-rectangle-draw.spec.ts`) で mobile-chrome 経路を実証

### 10.I-2: 2-finger pinch / pan + ヒットエリア拡大

- **Commit**: `e9bb3b7 feat(phase-10-i-2): 2-finger pinch zoom + pan + ヒットエリア拡大`
- **Plan**: [`phase-10-i-2-multitouch-and-hit-areas.plan.md`](../plans/completed/phase-10-i-2-multitouch-and-hit-areas.plan.md) (archived)
- **Report**: [`phase-10-i-2-multitouch-and-hit-areas-report.md`](phase-10-i-2-multitouch-and-hit-areas-report.md)
- **Deliverable**:
  - Konva 公式 multi-touch sandbox に準拠した `<Stage onTouchMove>` + `e.evt.touches[0/1]` 経路で 2-finger pinch zoom + 2-finger pan
  - `Konva.hitOnDragEnabled = true` を bootstrap で有効化 (pinch-while-drag 対応)
  - ADR-0006 に **Status Update セクション** を追記し、「Pointer Events 一本化は single-pointer 維持、multi-touch のみ TouchEvent 併用」の並列共存設計を文書化
  - `useTouchDevice` hook を新規作成 (`window.matchMedia('(pointer: coarse)')`、SSR 安全)
  - `useStageTransform` に `getDistance` / `getCenter` / `applyPinch` 純粋関数 + `setTransformDirect` updater 形式 callback を追加
  - 3 shapes (Arrow / Rectangle / Highlight) で `useTouchDevice` 取り込み + adaptive (`HANDLE_RADIUS_TOUCH = 12` / `ANCHOR_SIZE_TOUCH = 24` / `HIT_STROKE_WIDTH_TOUCH = 20`)
  - 新規 unit 21 件 (`useTouchDevice` 4 + `applyPinch` 9 + shape adaptive 8) + 新規 E2E pinch smoke (`touch-pinch-zoom.spec.ts`、CDPSession 2-finger 発火)

### 10.I-3: Toolbar bottom 固定 + safe-area + 44px tap target

- **Commit**: `52f55fb feat(phase-10-i-3): Toolbar bottom 固定 + safe-area + 44px tap target`
- **Plan**: [`phase-10-i-3-toolbar-bottom-and-safe-area.plan.md`](../plans/completed/phase-10-i-3-toolbar-bottom-and-safe-area.plan.md) (archived)
- **Report**: [`phase-10-i-3-toolbar-bottom-and-safe-area-report.md`](phase-10-i-3-toolbar-bottom-and-safe-area-report.md)
- **Deliverable**:
  - touch 環境でのみ Toolbar を `<header>` から取り出して画面下部 (AdSlot bottom 100px の真上) に `fixed bottom-[100px] z-30` で固定
  - `viewport-fit=cover` を viewport meta に追加 (副作用として既存 AdSlot の `safe-area-inset-bottom` も iOS で初めて実効する)
  - ToolButton (32px) / ColorPalette (28px) / FontSizeControl (28px) の各 Button に `min-w-11 min-h-11` (Tailwind 44px) を touch 時のみ追加。**visual サイズは完全維持**で desktop UX 非劣化
  - Toolbar 高さ ResizeObserver で測定 → `stageBottomInset = BOTTOM_HEIGHT_PX + (isTouch ? bottomToolbarHeight : 0)` で動的追従
  - Toolbar 自身は **1 行も変更せず** (構造 / aria-label / data-testid 完全維持で既存 e2e 78 件回帰ゼロ)
  - 新規 unit 4 件 (Toolbar.test の adaptive class assert) + 新規 E2E smoke (`touch-toolbar-bottom.spec.ts`)

### 10.I-4: 受入 (12 ケース) + 手動 QA + 本 umbrella

- **Commit**: (本 commit、umbrella と implement を同 commit にまとめる)
- **Plan**: [`phase-10-i-4-acceptance-and-manual-qa.plan.md`](../plans/completed/phase-10-i-4-acceptance-and-manual-qa.plan.md) (archived)
- **Report**: 本 umbrella report が個別 report を兼ねる
- **Deliverable**:
  - `apps/web/e2e/fixtures/touch-helpers.ts` で `dragOnStage` / `tapStage` / `selectTool` / `readAnnotations` / `tapShapeAndDelete` / `waitForAnnotationsReady` を共通化 (5 helper export)
  - `apps/web/e2e/touch-acceptance.spec.ts` で **mobile-chrome 限定 12 ケース** (4 形状 × 3 操作) — **全件緑 (10.0s)**
  - `docs/qa/phase-10-i-touch-manual-qa.md` で実機チェックリスト (§1〜§7、誤操作率 / handle hit / 同期 / CWV / 既知問題 / 完了 checklist)
  - 本 umbrella report

---

## 3. 未解決事項 / 次フェーズへの引き継ぎ

### 実機 QA (本 Phase 内に消費する想定だが、自動化不可のため本 docs テンプレートで残置)

- iPhone Safari + Pixel Chrome での `docs/qa/phase-10-i-touch-manual-qa.md` 12 ケース実消費 (§1)
- 誤操作率測定 (§2)、selection handle hit 40 試行 (§3)、mobile→PC 同期 (§4)、CWV Lighthouse spot check (§5)
- §6 既知の問題に新規発見を書き足す

### Should から本 Phase で未実装に留めた項目

- **VisualViewport API での IME 出現吸収** — テキスト入力時の virtual keyboard 干渉。10.I PRD で Should、10.I MVP 完了後にドッグフードで Must 昇格判断する設計。本 Phase 内では未実装、Phase 11+ 候補
- **awareness layer (他ユーザーカーソル) の touch device 判定** — touch ユーザーは「カーソル位置」概念がないため、最後タップ位置で代替表示する Should 項目。本 Phase 内では未実装、Phase 11+ 候補

### Won't (PRD で意図的に除外)

- palm rejection / ペンモード (tldraw でも未解決、コスト過大)
- 長押しコンテキストメニュー (Excalidraw でも誤発火多発)
- 3 本指ジェスチャ (iOS Safari がブラウザ側で奪う)
- ダブルタップ zoom 切替 (native double-tap zoom と衝突)
- モバイル専用 UI 分岐 / `react-router` 分離

### Phase 11+ 候補として ADR-0006 に明記済

- `stage.getPointersPositions()` ベースの完全 Pointer Events 統合 (現状は multi-touch のみ TouchEvent 併用の並列共存)
- Konva 自身が公式 sample で Pointer ベース multi-touch を提供すれば撤去可能

---

## 4. 工数 retrospective

### 数値サマリ (2026-05-09 single day session)

- **Commit 数**: 9 (PRP docs 4 + 実装 4 + 本 commit)
- **累積 LOC** (`git log --shortstat main..phase-10-i-touch-optimization`): **45 files changed, +3,374 / -83 lines**
- **Duration**: 2026-05-09 同日に PRD 起票から 10.I-4 完了まで 1 セッション完結
- **CI lock 件数増分**:
  - unit: 321 → 346 件 (+25: useTouchDevice 4 / applyPinch 9 / shape adaptive 8 / Toolbar adaptive 4)
  - E2E mobile-chrome: 0 → 16 件 (+16: 累積 4 smoke + 12 受入)
  - E2E chromium: 78 件回帰ゼロ維持

### 学び (Phase 10.I で確立した知見)

1. **Pointer Events 一本化と TouchEvent 併用の並列共存設計** — Konva 公式が multi-touch sample で TouchEvent ベース実装を提供しているため、Pointer Events 一本化方針の中で multi-touch のみ TouchEvent 併用を許容する scope clarification が ADR-0006 で正当化できた
2. **`useTouchDevice` hook の横展開** — 1 hook を 5 ファイル (CanvasStage / EditorShell / 3 shapes / Toolbar 系 3) で再利用、adaptive 化を統一的に進められた
3. **`viewport-fit=cover` の latent bug 解消** — Phase 10.H で書かれていた既存 AdSlot の `safe-area-inset-bottom` が iOS で実効していなかった事実を Phase 10.I-3 で副次的に発見・解消
4. **テスト戦略の二段構え** — jsdom の PointerEvent 制限により unit test は mouseDown 維持、pointer 固有挙動は Playwright (`mobile-chrome` project) に寄せる責務分離を ADR-0006 で確立
5. **Toolbar の中身を変えずに配置だけ切替** — Toolbar.tsx を 1 行も触らず EditorShell の wrapping container だけで bottom 固定 → 既存 e2e 78 件回帰ゼロを保てた
6. **CDPSession 経由の `Input.dispatchTouchEvent`** — Playwright `page.touchscreen` の制限 (drag 不能) を回避し、2-finger pinch を E2E で発火できる確実な手段を確立

### 反省

- Plan 起票時の Konva property 名 (`captureTouchEventsEnabled` → 実は `capturePointerEventsEnabled`) のリサーチエージェント誤記を実装時 typecheck で検出して修正したが、初稿 ADR と Plan の双方に同誤記が残っていた。**コード片を Plan に書く際は実 Konva 型定義との照合を 1 度入れる** 運用が望ましい
- 12 ケース受入 spec の初回実行で **strict mode violation** (「削除」と「注釈をすべて削除」の部分一致) と **logical→screen 座標変換漏れ** で 9/12 失敗。`exact: true` + `logicalToScreen` ヘルパで 1 修正サイクルで解消したが、Plan 段階で「`削除` ボタンは部分一致衝突する」「Stage transform で coord 変換が必要」を GOTCHA に書いておくべきだった

---

## 5. Phase 10.I 完了の宣言

本 umbrella report の起票をもって、Phase 10.I (タッチデバイス操作最適化) は以下の状態で **complete**:

- ✅ 4 sub-phase すべて complete (実装 4 commit + PRP docs 4 commit + 本 commit)
- ✅ CI lock: web 346 unit / api 187 unit / chromium 78 e2e / mobile-chrome 16 e2e (累積 4 smoke + 12 受入) すべて緑
- ✅ ADR-0006 (Status Update 含む) Accepted
- ✅ PRD 10.I-1 / -2 / -3 / -4 行すべて complete
- ⚠ 実機 QA (`docs/qa/phase-10-i-touch-manual-qa.md`) は **テンプレート完備、消費は著者次第** (PRD Acceptance Criteria の達成証明として実機消費は推奨)
- ✅ Phase 10.F (v1.0.0) の必須 blocker としての 10.I は CI lock 範囲で解除条件を満たす

### Phase 10.H (ランディング条件付き拡張) との関係

Phase 10.I で確立した `useTouchDevice` + adaptive sizing パターンは、Phase 10.H の hero CTA / FAQ / DropZone が touch 環境で 44px tap zone を確保する用途に流用可能。10.H plan 起票時に再利用する。

### Phase 10.F (v1.0.0) との関係

Phase 10.I は Phase 10.F の必須 blocker (PRD Acceptance Criteria)。本 umbrella report の起票で 10.F 着手条件が解除される。10.H 完了後、10.F (ドメイン取得 + 本番デプロイ + v1.0.0 タグ) に進む。

---

## 6. References

### Phase 10.I 内成果物

- PRD: [`phase-10-i-touch-optimization.prd.md`](../prds/phase-10-i-touch-optimization.prd.md)
- ADR: [`docs/adr/ADR-0006-pointer-events-unification.md`](../../../docs/adr/ADR-0006-pointer-events-unification.md)
- Plans (archived):
  - [10.I-1](../plans/completed/phase-10-i-1-pointer-events-migration.plan.md)
  - [10.I-2](../plans/completed/phase-10-i-2-multitouch-and-hit-areas.plan.md)
  - [10.I-3](../plans/completed/phase-10-i-3-toolbar-bottom-and-safe-area.plan.md)
  - [10.I-4](../plans/completed/phase-10-i-4-acceptance-and-manual-qa.plan.md)
- Reports (sub-phase 個別):
  - [10.I-1](phase-10-i-1-pointer-events-migration-report.md)
  - [10.I-2](phase-10-i-2-multitouch-and-hit-areas-report.md)
  - [10.I-3](phase-10-i-3-toolbar-bottom-and-safe-area-report.md)
  - 10.I-4: 本 umbrella report が代替
- 実機 QA docs: [`docs/qa/phase-10-i-touch-manual-qa.md`](../../../docs/qa/phase-10-i-touch-manual-qa.md)
- E2E:
  - smoke 3: `apps/web/e2e/touch-rectangle-draw.spec.ts` / `touch-pinch-zoom.spec.ts` / `touch-toolbar-bottom.spec.ts`
  - 受入 12: `apps/web/e2e/touch-acceptance.spec.ts`
  - 共通 helper: `apps/web/e2e/fixtures/touch-helpers.ts`
- Hook: `apps/web/src/hooks/useTouchDevice.ts`

### 一次資料 (Phase 10.I 全体で参照)

- [Konva Stage docs](https://konvajs.org/api/Konva.Stage.html)
- [Konva Multi-touch Scale Stage sandbox](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html)
- [react-konva makeUpdates.ts](https://github.com/konvajs/react-konva/blob/master/src/makeUpdates.ts)
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [MDN PointerEvent.pointerType](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType)
- [Apple HIG Layout (44pt 推奨)](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Material touch-target](https://m2.material.io/develop/web/supporting/touch-target)
- [Excalidraw PR #788 Pointer Events 一本化](https://github.com/excalidraw/excalidraw/pull/788)
- [tldraw useCanvasEvents](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useCanvasEvents.ts)
