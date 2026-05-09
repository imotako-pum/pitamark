# Implementation Report: Phase 10.I-2 — 2-finger pinch / pan + ヒットエリア拡大

**Date**: 2026-05-09
**Branch**: `phase-10-i-touch-optimization`
**Source PRD**: [`.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`](../prds/phase-10-i-touch-optimization.prd.md)
**Source Plan**: [`.claude/PRPs/plans/completed/phase-10-i-2-multitouch-and-hit-areas.plan.md`](../plans/completed/phase-10-i-2-multitouch-and-hit-areas.plan.md)

---

## Summary

Konva 公式 multi-touch sandbox に準拠した `<Stage onTouchMove>` + `e.evt.touches[0/1]` 経路で 2-finger pinch zoom と 2-finger pan を実装し、`Konva.hitOnDragEnabled = true` を bootstrap で有効化した。Phase 10.I-1 の Pointer Events 経路は single-pointer (描画 / 移動 / Space+pan) 専用に維持し、2 本指検知時は Pointer 側の in-flight state (`dragStartRef` / `draftRef` / `panActiveRef`) を強制中断する責務分離設計を採った。並行して `useTouchDevice` hook (`window.matchMedia('(pointer: coarse)')`) を新設し、ArrowShape の handle radius (6 → 12)、`hitStrokeWidth` (`annotation.strokeWidth` → 20)、Rectangle / Highlight Transformer の `anchorSize` (10 → 24) を touch 環境のみ拡張する adaptive 化を実装。デスクトップは従来サイズ完全維持で非劣化を担保した。ADR-0006 に Status Update セクションを追記して並列共存設計の根拠を文書化した。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium (10 ファイル / 12 タスク / 350-500 行差分) | **Medium** (12 ファイル / 12 タスク / 約 480 行差分) |
| Confidence | 8/10 | **8/10 → 達成**: single-pass 完了、validation 全緑、E2E pinch smoke 一発で通過 |
| Files Changed | 10 | **12** (CanvasStage / EditorShell の 2 ファイルが想定外に変更必要だった: useStageTransform から `setTransformDirect` を expose したため) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | ADR-0006 Status Update | ✅ Complete | 「Status Update (Phase 10.I-2)」セクション追加 (75 行)。並列共存設計の根拠 + 撤去条件を明記 |
| 2 | `Konva.hitOnDragEnabled = true` | ✅ Complete | `main.tsx` に 1 行追加 (`capturePointerEventsEnabled` の直下) |
| 3 | `useTouchDevice` hook + test | ✅ Complete | 新規 hook (29 行) + 4 件 unit test (`vi.stubGlobal('matchMedia', ...)` mock + reactive change event 検証) |
| 4 | `useStageTransform` 純粋 helper | ✅ Complete | `getDistance` / `getCenter` / `applyPinch` 追加 + `setTransformDirect` を expose。**Deviation**: signature を `(StageTransform) => void` から `(StageTransform \| (prev) => StageTransform) => void` の updater 形式に拡張 (stale state 防止) |
| 5 | `applyPinch` unit test | ✅ Complete | 9 件追加 (中点固定 / pure pan / clamp 上限下限 / 中点固定の不変条件) |
| 6 | CanvasStage multi-touch | ✅ Complete | `onPinchPan` props 追加、`onTouchMove` / `onTouchEnd` ハンドラ + multi-touch state ref 2 個 + Pointer 経路の in-flight state 中断ロジック。EditorShell 側で `applyPinch(prev, ...)` を `setTransformDirect` に渡す bridge を実装 |
| 7 | `colors.ts` touch 用定数 | ✅ Complete | `HANDLE_RADIUS_TOUCH=12` / `ANCHOR_SIZE_DESKTOP=10` / `ANCHOR_SIZE_TOUCH=24` / `HIT_STROKE_WIDTH_TOUCH=20` を追加 |
| 8 | `ArrowShape` adaptive | ✅ Complete | `useTouchDevice()` 取り込み、handle radius adaptive、`hitStrokeWidth` 追加 (touch 限定で 20px、desktop は `annotation.strokeWidth` 維持) |
| 9 | `RectangleShape` / `HighlightShape` adaptive | ✅ Complete | 両 file の Transformer に `anchorSize={isTouch ? ANCHOR_SIZE_TOUCH : ANCHOR_SIZE_DESKTOP}` 追加 |
| 10 | shape test 更新 | ✅ Complete | ArrowShape (4 件) + RectangleShape (2 件) + HighlightShape (2 件) で adaptive 経路を `useTouchDeviceMock` 切替で検証 |
| 11 | Playwright pinch smoke | ✅ Complete | `touch-pinch-zoom.spec.ts` 新規 (mobile-chrome 限定 1 件)。**CDPSession `Input.dispatchTouchEvent` で 2-finger pinch を発火**、scale 増加を assert |
| 12 | PRD 更新 | ✅ Complete | sub-phase 10.I-2 行を `pending` → `in-progress` → `complete`、本 report への link 追加 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `pnpm typecheck` 全 workspace 緑 |
| Lint (biome ci) | ✅ Pass | 215 ファイル clean (auto-fix で test ファイル 3 件 + useStageTransform 1 件の import sort / format を自動修正) |
| Unit Tests | ✅ Pass | **web: 38 file / 342 件 緑** (10.I-1 完了時 321 件 + 10.I-2 で 21 件追加: useTouchDevice 4 + applyPinch 9 + shape adaptive 8) / api: 18 / 187 件 緑 |
| Build | ✅ Pass | web (vite) + api (wrangler dry-run) 成功。`vendor-canvas-DZpl8YBB.js` 317.96 kB / `index-BrlaPnnp.js` 287.94 kB で 10.I-1 と同等 (10 行未満の差) |
| E2E (mobile-chrome pinch smoke) | ✅ Pass | 新規 spec が 3.2s で緑。**CDPSession 経由の 2-finger touch event で Stage scale が増加することを E2E 実証** |
| E2E (chromium 全件回帰) | ✅ Pass | **78 passed / 4 skipped、回帰ゼロ**。zoom-pan / annotation-tools / room-share / auto-next-arrow-text 系すべて緑 |
| Edge Cases | ✅ Pass | unit test + E2E のカバレッジで実質達成 (実機検証は推奨だがブロッカーではない) |

### Edge Cases 結果

Plan の Edge Cases Checklist 達成度:

- ✅ 1 本指 → 2 本指で Pointer 経路の draft / dragStart / panActive 中断 — `handleTouchMove` 実装で確認
- ✅ 2 本指 → 1 本指への遷移で multi-touch state リセット — `handleTouchEnd` + 1 本指時の早期 return で実装
- ✅ touchend で `lastCenter` / `lastDist` リセット
- ✅ 初回検知 frame の jitter 防止 — `lastCenterRef.current` / `lastDistRef.current === 0` check
- ✅ PC chromium で `useTouchDevice = false` 経路 — 既存 e2e 78 件すべて緑、handle / anchor 視覚変化なし
- ✅ 細い arrow (strokeWidth=2) を touch で hit — unit test で `hitStrokeWidth = 20` を assert
- ✅ Transformer anchor の adaptive — unit test で 4 ケース (Rectangle / Highlight × touch / desktop) assert
- ✅ Stage 外 swipe で `clampPan` 効く — `setTransformDirect` 内で clampPan 適用
- ✅ scale 上限 / 下限 — `applyPinch` 純粋関数 unit test 4 件で検証
- ⚠ iOS Safari の system gesture 介入で `pointercancel` + multi-touch state リセット — 自動化未実装、実機検証推奨
- ✅ desktop wheel zoom / Cmd+wheel zoom 非劣化 — chromium e2e zoom-pan.spec.ts 全件緑
- ✅ Space+drag pan 非劣化 — 同上
- ✅ 既存 unit test (321 件 → 342 件) すべて緑

## Files Changed

| File | Action | Lines |
|---|---|---|
| `docs/adr/ADR-0006-pointer-events-unification.md` | UPDATED | +75 / -1 (Status Update セクション追記) |
| `apps/web/src/main.tsx` | UPDATED | +5 / -0 (`Konva.hitOnDragEnabled = true`) |
| `apps/web/src/hooks/useTouchDevice.ts` | CREATED | +29 |
| `apps/web/src/hooks/__tests__/useTouchDevice.test.tsx` | CREATED | +120 |
| `apps/web/src/hooks/useStageTransform.ts` | UPDATED | +60 / -2 (`getDistance` / `getCenter` / `applyPinch` + `setTransformDirect`) |
| `apps/web/src/hooks/__tests__/useStageTransform.test.ts` | UPDATED | +75 / -1 (9 件 test 追加) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATED | +75 / -3 (`onPinchPan` props + `handleTouchMove` / `handleTouchEnd` + multi-touch state) |
| `apps/web/src/pages/EditorShell.tsx` | UPDATED | +24 / -1 (`setTransformDirect` 取得 + `handlePinchPan` callback + `<CanvasStage onPinchPan>`) |
| `apps/web/src/components/canvas/colors.ts` | UPDATED | +15 / -0 (4 定数追加) |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATED | +9 / -2 (`useTouchDevice` + adaptive radius + `hitStrokeWidth`) |
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | UPDATED | +10 / -1 (`useTouchDevice` + Transformer `anchorSize`) |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | UPDATED | +10 / -1 (同上) |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | UPDATED | +47 / -2 (4 件 adaptive test) |
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | UPDATED | +24 / -2 (2 件 adaptive test) |
| `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | UPDATED | +24 / -1 (2 件 adaptive test) |
| `apps/web/e2e/touch-pinch-zoom.spec.ts` | CREATED | +85 |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | UPDATED | +1 / -1 (10.I-2 行) |

## Deviations from Plan

### Deviation 1: `setTransformDirect` を updater 形式に拡張

- **WHAT**: Plan の Task 4 で書いた signature `setTransformDirect: (next: StageTransform) => void` を、実装時に `setTransformDirect: (input: StageTransform | ((prev: StageTransform) => StageTransform)) => void` に拡張した
- **WHY**: pinch handler が CanvasStage → EditorShell の bridge を経由するため、props 経由の `transform` は 1 render 古い値になる。`applyPinch(stale_transform, ...)` で計算すると毎 frame 1 frame 前の state を基準にして transform が drift する。updater 形式 `setTransformDirect((prev) => applyPinch(prev, ...))` で setState の最新 state を直接読むことで stale を回避
- **JUSTIFICATION**: React の `setState` 自体が同種の dual signature (value + updater) を持つ慣習に沿う。本 deviation は ADR-0006 や Plan の本旨を変えない API 細部の改善

### Deviation 2: EditorShell も変更対象に追加 (Plan の Files to Change にはなかった)

- **WHAT**: Plan の Files to Change テーブルに EditorShell.tsx は明示されていなかったが、`setTransformDirect` を `useStageTransform` から取り出して `<CanvasStage onPinchPan={handlePinchPan}>` に渡す bridge が必要となった
- **WHY**: Plan Task 6b で「useStageTransform を呼ぶ側 (おそらく EditorShell.tsx か直近の親) で setTransformDirect を receive」と書いていたが、Files to Change テーブルへの記載を漏らしていた
- **JUSTIFICATION**: Plan 本文 (Task 6b) では言及済。Plan の意図通り

## Issues Encountered

### Issue 1: Biome の import sort + format 違反

shape の test ファイル 3 件 + useStageTransform.ts で import 順 / format が違反していた (`vi.mock` を import 文の間に挟む構造のため、biome の organize-imports と衝突)。

**Resolution**: `pnpm exec biome check --write <files>` で auto-fix。fix 後の構造は `vi.mock` を保つために import 文が分割される形になったが、機能等価。

### Issue 2: `pnpm lint` script が root で未定義

`pnpm lint` を root で実行すると `Command "lint" not found` で失敗。CLAUDE.md の記載 (`pnpm lint` で `biome ci .`) は実は root の workspace script を経由しない直接呼び出しが必要。

**Resolution**: `pnpm exec biome ci .` を直接呼ぶ形に切替。本 plan の Validation Commands に記載した形 (`pnpm lint`) は CLAUDE.md の記載に合わせた抽象表現で、実際は `pnpm exec biome ci .`。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/src/hooks/__tests__/useTouchDevice.test.tsx` | 4 | matchMedia 初期 false / 初期 true / change event reactive / cleanup removeEventListener |
| `apps/web/src/hooks/__tests__/useStageTransform.test.ts` | +9 | `getDistance` (2) / `getCenter` (2) / `applyPinch` (5: 基本 / pure pan / clamp 上下限 / 中点固定不変) |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | +4 | desktop default radius / touch radius / desktop hitStrokeWidth / touch hitStrokeWidth |
| `apps/web/src/components/canvas/__tests__/RectangleShape.test.tsx` | +2 | desktop / touch anchorSize |
| `apps/web/src/components/canvas/__tests__/HighlightShape.test.tsx` | +2 | desktop / touch anchorSize |
| `apps/web/e2e/touch-pinch-zoom.spec.ts` | +1 | mobile-chrome で CDPSession 2-finger pinch → scale 増加 |

合計: **新規 21 件 unit + 1 件 E2E** (web 全体: 321 → 342 件)

## Next Steps

- [ ] 実機 iPhone Safari + Android Chrome での手動検証 (pinch zoom / 2-finger pan / pinch-while-drag / hit area が指で確実に掴めるか)
- [ ] Phase 10.I-3 (Toolbar bottom 固定 + safe-area) Plan 起票
- [ ] Phase 10.I-3 完了後に同 PR 内で 10.I-4 (E2E 12 ケース受入) を続行
- [ ] 全 sub-phase 完了後に `/code-review` → PR 作成

### 着手推奨順

```
/everything-claude-code:prp-plan .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md
```

これで次の eligible pending phase = **10.I-3 (Toolbar bottom 固定 + safe-area)** が選択されます。

---

## Notes

### 設計検証 (context7 経由 Konva 公式 docs)

Plan 起票時の context7 調査と、本実装で実測した結果が一致:

- **Pointer Events 一本化 (10.I-1)** + **TouchEvent 経路 (10.I-2)** の **並列共存** は Konva 公式の sample 構造に整合 (Konva 公式の multi-touch sample は touchstart/touchmove ベース、Pointer Events と並走できる)
- **`Konva.capturePointerEventsEnabled = true`** (10.I-1) と **`Konva.hitOnDragEnabled = true`** (10.I-2) はそれぞれ独立した bootstrap 設定で、互いに干渉しない
- **`useTouchDevice` の `(pointer: coarse)`** 判定は CSS Media Query Level 4 仕様準拠、Excalidraw / tldraw も同種の判定を持つ

### 自動化していないが手動確認推奨の項目 (実機 / 本番デプロイ前)

1. **iPhone Safari 実機**:
   - 2-finger pinch zoom (中点固定で滑らかにズーム)
   - 2-finger pan (中点移動分だけ画像移動)
   - 1-finger 描画と pinch の切替が衝突しない
   - selection handle / Transformer anchor を指で確実に掴める (radius 12 / size 24)
   - 細い arrow を tap で選択できる (`hitStrokeWidth: 20`)
   - 図形を片手で押さえつつ別の指で pinch (`hitOnDragEnabled = true` の効果)
2. **Android Chrome 実機**: 同上
3. **PC**:
   - selection handle が radius 6、Transformer anchor が 10 を維持 (DevTools で目視)
   - wheel zoom / Cmd+wheel zoom / Space+drag pan が劣化していない

### 後続 sub-phase に渡す前提

- 10.I-3 (Toolbar bottom): `useTouchDevice` 再利用で Toolbar ボタンの adaptive サイズも書ける素地あり
- 10.I-4 (E2E 受入): 本 plan の `touch-rectangle-draw.spec.ts` (10.I-1) + `touch-pinch-zoom.spec.ts` (10.I-2) を base に 12 ケース (4 形状 × 3 操作) + pinch 中の描画衝突回避テスト + Stage 外 drag 継続検証を加える。CDPSession 経由 `Input.dispatchTouchEvent` のパターンは確立済 (本 plan で実証)

### 設計上の良い副作用

- `applyPinch` を純粋関数として export したことで、将来の Phase 11+ で「Pointer Events ベースの multi-touch (`stage.getPointersPositions()` 経由)」に移行する際にもロジックが再利用できる
- `setTransformDirect` の updater 形式は、pinch 以外の用途 (例: Phase 11+ で複数のジェスチャを atomic に適用する場合) にも転用可能
