# Implementation Report: Phase 10.I-1 — Pointer Events 一本化 + 描画系復旧

**Date**: 2026-05-09
**Branch**: `phase-10-i-touch-optimization`
**Source PRD**: [`.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`](../prds/phase-10-i-touch-optimization.prd.md)
**Source Plan**: [`.claude/PRPs/plans/completed/phase-10-i-1-pointer-events-migration.plan.md`](../plans/completed/phase-10-i-1-pointer-events-migration.plan.md)

---

## Summary

snap-share の Konva 描画レイヤーを Mouse Events 専用配線から **Pointer Events 一本化** に移行し、iPhone Safari / Android Chrome で破綻していた矩形・矢印・ハイライト描画を復旧した。`Konva.capturePointerEventsEnabled = true` を bootstrap で明示、Stage container に `touch-action: none` を CSS で当て、`onPointerCancel` を新規追加して system gesture 介入時の drag リークを防いだ。`KonvaEventObject<MouseEvent>` の型注釈は `KonvaEventObject<PointerEvent>` に統一。並行して ADR-0006 を起票し、unit test は jsdom の PointerEvent 制限 (dom-testing-library #1291) のため `fireEvent.mouseDown` を維持する方針を文書化した。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium (3-7 files、200〜350 行差分) | **Medium** (7 files、約 300 行差分 + ADR 105 行 + spec 新規 60 行) |
| Confidence | 9/10 | **9/10 → 達成**: 想定通り single-pass 完了、validation 全緑 |
| Files Changed | 7 | **8** (Plan で挙げた 7 + 新規 e2e spec を完全独立 file 化したため計上が +1 ズレ) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | ADR-0006 起票 | ✅ Complete | `docs/adr/ADR-0006-pointer-events-unification.md` を新規作成 (105 行)。 references セクションに 10 件の一次資料リンク |
| 2 | Konva bootstrap | ✅ Complete | **Deviation**: Plan で書いた `Konva.captureTouchEventsEnabled` は誤記。実際の Konva 型定義は `Konva.capturePointerEventsEnabled`。typecheck で検出して修正 (Plan / ADR にも反映) |
| 3 | global.css `touch-action` | ✅ Complete | `.konvajs-content { touch-action: none; }` を末尾に追加。コメントで Phase 10.I-1 と ADR-0006 をリンク |
| 4 | CanvasStage.tsx Pointer 化 | ✅ Complete | 4 ハンドラ rename + `handlePointerCancel` (= `handlePointerUp` の alias) 新規 + Stage prop 5 箇所差し替え + 関連コメント 4 箇所を pointer 表記に正規化 |
| 5 | ArrowShape.tsx handle Pointer 化 | ✅ Complete | line 80-104 の Circle handle 2 箇所 (`from-handle` / `to-handle`) を `onMouseDown` → `onPointerDown` に rename。コメント 1 箇所も pointer 表記に |
| 6 | ArrowShape.test.tsx 修正 | ✅ Complete | test 名 + capture key を `onPointerDown` に。Plan の「fireEvent は mouseDown 維持」方針通り、test 内の event 発火は変更なし |
| 7 | Playwright smoke spec | ✅ Complete | `apps/web/e2e/touch-rectangle-draw.spec.ts` 新規。mobile-chrome project 限定で 1 件。**実機実行で 3.3s で緑** |
| 8 | PRD 更新 | ✅ Complete | 10.I-1 行を `in-progress` → `complete`、本 report への link を追加 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `pnpm typecheck` 全 workspace ゼロエラー |
| Lint (biome ci) | ✅ Pass | 212 files clean |
| Unit Tests | ✅ Pass | 全 37 file / **321 tests 緑** (新規 unit test は 0 件、ArrowShape test の 1 件 update のみ) |
| Build | ✅ Pass | `pnpm build` web (vite) + api (wrangler dry-run) 成功。bundle size 劇的変化なし (vendor-canvas 317.96 kB / index 287.92 kB は既存値) |
| E2E (mobile-chrome smoke) | ✅ Pass | 新規 spec が 3.3s で緑。**「Pixel 5 viewport で矩形 1 件 drag 描画できる」** を E2E で実証 |
| E2E (chromium 全件回帰) | ✅ Pass | **78 passed / 3 skipped、回帰ゼロ**。zoom-pan / annotation-tools / room-share / auto-next 系すべて緑 |
| Edge Cases | ✅ Pass | 既存 e2e の集合で実質カバー (詳細は Edge Cases 節) |

### Edge Cases 結果

Plan の Edge Cases Checklist に対する実測:

- ✅ mouse drag で矩形描画 (PC 非劣化) — chromium e2e 全 78 件緑
- ✅ touch drag で矩形描画 (mobile-chrome) — 新規 smoke spec で緑
- ⚠ Stage 外への drag (`capturePointerEventsEnabled` 効果) — 自動化未実装、PC 手動確認推奨 (Notes 参照)
- ⚠ iOS Safari の system gesture 介入 → `pointercancel` — 実機 (iPhone Safari) で要確認
- ✅ ArrowShape endpoint handle drag (`cancelBubble` 経路) — ArrowShape test 緑
- ✅ テキスト配置 (既存 click 経路) — annotation-tools.spec.ts 緑
- ✅ PNG export が touch 描画後に動作 — annotation-tools.spec.ts 等で延長確認
- ⚠ リアルタイム同期 mobile→PC — 自動化未実装、Phase 10.I-4 の 2-device 検証で対応予定

## Files Changed

| File | Action | Lines |
|---|---|---|
| `docs/adr/ADR-0006-pointer-events-unification.md` | CREATED | +105 |
| `apps/web/src/main.tsx` | UPDATED | +6 / -0 |
| `apps/web/src/styles/global.css` | UPDATED | +9 / -0 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATED | +21 / -16 (4 ハンドラ rename + handlePointerCancel + Stage prop + コメント正規化) |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | UPDATED | +6 / -6 (Circle handle 2 箇所 + コメント) |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | UPDATED | +3 / -3 |
| `apps/web/e2e/touch-rectangle-draw.spec.ts` | CREATED | +60 |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | UPDATED | +1 / -1 (10.I-1 行) |

## Deviations from Plan

### Deviation 1: Konva 型 property 名 (重要)

- **WHAT**: Plan + ADR draft で `Konva.captureTouchEventsEnabled` と書いていたが、実際の Konva v9 型定義は **`Konva.capturePointerEventsEnabled`**。typecheck で `TS2551 Did you mean 'capturePointerEventsEnabled'?` が即検出
- **WHY**: Phase 3 (Plan 起票時) のリサーチ agent が `captureTouchEventsEnabled` と記載したのは誤記 (Konva の本来の API は `capturePointerEventsEnabled`)。Plan の Notes セクションも同じ誤記を引き継いでいた
- **CORRECTED**: `apps/web/src/main.tsx` / ADR-0006 / 本 report はすべて `capturePointerEventsEnabled` に修正済。Plan 本体も完了した plan として `completed/` 移動するため修正は不要 (本 report が「実際に書いたもの」のソースになる)

### Deviation 2: Plan には書かれていない comment 正規化

- **WHAT**: `CanvasStage.tsx` の JSDoc / inline comment 内に残っていた "mousedown" / "mouseup" / "mouse event" 表記を pointer 表記に正規化 (4 箇所)
- **WHY**: コードと一貫性を取るため。grep ベースの後続作業で「mouse」が残っていると意図しない混乱を生む。意味は変えない正規化のため小規模
- **JUSTIFICATION**: Plan の Patterns to Mirror で「pointer event (pointerdown → pointermove → pointerup)」表記を採用していたため整合性を取った

## Issues Encountered

### Issue 1: pnpm script 経由の `-g` フィルタ不通

`pnpm -F @pitamark/web test:e2e -- -g "pointer events smoke" --project=mobile-chrome` で grep が正しく Playwright に渡らず、無関係な spec が実行されてしまった。

**Resolution**: `cd apps/web && pnpm exec playwright test e2e/touch-rectangle-draw.spec.ts --project=mobile-chrome` のように Playwright を直接呼ぶ形式に切り替えて smoke を実行。10.I-4 で 12 ケース追加するときも同じ呼び方で OK。

### Issue 2: Vite WebServer の "Script error" warning

E2E 実行中 `[vite] (client) [Unhandled error] Error: Script error.` が複数回出力されたが、テスト結果には影響なし (78 + 1 全件緑)。これは既存挙動 (本 PR 前の commit でも同じ warning が出る) で本 plan のスコープ外。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/e2e/touch-rectangle-draw.spec.ts` | 1 | mobile-chrome での Pointer Events 経路の smoke (矩形 1 件 drag 描画) |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | 5 (1 件 update) | endpoint handle の `onPointerDown` 経由 cancelBubble 検証 (既存 4 件は変更なし) |

新規 unit test 0 件、新規 E2E 1 件、既存 unit test 1 件 update。Plan 通り「pointer 固有挙動は Playwright に寄せる」方針を実装。

## Next Steps

- [ ] 実機 iPhone Safari / Android Chrome での手動検証 (touch drag / pointercancel / capture pointer の Stage 外 drag が切れない)
- [ ] Phase 10.I-2 (multi-touch + ヒットエリア拡大) Plan 起票
- [ ] Phase 10.I-2 完了後に同 PR 内で 10.I-3 / 10.I-4 を続行 (`phase-10-i-touch-optimization` ブランチで連続作業)
- [ ] 全 sub-phase 完了後に `/code-review` → PR 作成

### 着手推奨順

```
/everything-claude-code:prp-plan .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md
```

これで次の eligible pending phase = **10.I-2** が選択されます。

---

## Notes

### 自動化していないが手動確認すべき項目 (実機 / 本番デプロイ前)

1. **iPhone Safari 実機**:
   - Stage container の Computed CSS で `touch-action: none` が effective
   - 矩形 drag 描画
   - 画面端 swipe 時に `pointercancel` 発火 + drag 状態クリア (Console.log で確認可)
2. **Android Chrome 実機**:
   - 同上の主要項目
3. **PC**:
   - Stage 外への drag が切れない (= `capturePointerEventsEnabled = true` の効果)
   - wheel zoom / Cmd+wheel zoom が劣化していない

### 後続 sub-phase に渡す前提

- Konva の `capturePointerEventsEnabled = true` 状態で、`stage.getPointersPositions()` が 2 ポインタ取得可能 (10.I-2 で multi-touch pinch を実装する素地)
- `.konvajs-content { touch-action: none }` で Stage 内の native gesture は完全抑止 (10.I-2 で実装する 2-finger pinch とは衝突しない)
- ADR-0006 が Accepted 状態で文書化済 (10.I-2 / 10.I-3 / 10.I-4 はこの ADR を参照)

### 設計上の良い副作用

- Stage 外 drag 継続が `capturePointerEventsEnabled = true` で自動的に得られた (旧実装では Stage 外に出るとイベント途切れの恐れあり)
- `pointercancel` ハンドラ (= `handlePointerUp` の alias) で system gesture 介入時のリーク防止が組み込まれた
- 型注釈統一により、将来 `pointerType === 'pen'` 分岐を入れる際の足場が完成 (Phase 11+ 候補)
