# Implementation Report: Phase 10.I-3 — Toolbar bottom 固定 + safe-area + 44px tap target

**Date**: 2026-05-09
**Branch**: `phase-10-i-touch-optimization`
**Source PRD**: [`.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`](../prds/phase-10-i-touch-optimization.prd.md)
**Source Plan**: [`.claude/PRPs/plans/completed/phase-10-i-3-toolbar-bottom-and-safe-area.plan.md`](../plans/completed/phase-10-i-3-toolbar-bottom-and-safe-area.plan.md)

---

## Summary

`useTouchDevice` で touch (`pointer: coarse`) 判定し、touch 環境では Toolbar を `<header>` から取り出して画面下部 (既存 `AdSlot bottom 100px` の真上) に `fixed bottom-[100px] z-30` で固定した。`paddingBottom: env(safe-area-inset-bottom)` で iPhone notch / home indicator を回避。`viewport-fit=cover` を viewport meta に追加して iOS Safari の safe-area 値を有効化 (副作用として既存 AdSlot の latent な safe-area 設定もこれで初めて実効する)。ToolButton / ColorPalette / FontSizeControl の各 Button に `min-w-11 min-h-11` (Tailwind 44px) を touch 時のみ適用し、iOS HIG / Material 48dp 推奨を満たす tap zone を確保した。Visual サイズ (icon 18px / swatch 16px / Button 外形 28-32px) は完全維持し、desktop UX を非劣化に保つ。Toolbar 高さは ResizeObserver で動的測定し、`stageBottomInset` に加算して画像が Toolbar に被らないようにした。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Small-Medium (6 files / 9 tasks / 150-250 lines) | **Small-Medium** (8 files / 9 tasks / ~280 lines) |
| Confidence | 9/10 | **9/10 → 達成**: single-pass で全 task 完了、validation 全緑 |
| Files Changed | 6 | **8** (Plan の Files to Change に列挙していた 8 件と一致 — Plan 本文の 6 列挙は誤記、Files to Change テーブルは正確に 8 行記載) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | viewport-fit=cover | ✅ Complete | `apps/web/index.html` viewport meta に追加 (1 行) |
| 2 | ToolButton adaptive | ✅ Complete | `useTouchDevice` 取り込み、`min-w-11 min-h-11` を touch 時のみ追加 |
| 3 | ColorPalette adaptive | ✅ Complete | 7 swatch 全部に同 adaptive class (map 内 1 箇所) |
| 4 | FontSizeControl adaptive | ✅ Complete | +/- 2 ボタンに同 adaptive class、`cn` 未 import だったので import 追加 |
| 5 | EditorShell の Toolbar 配置切替 | ✅ Complete | `useTouchDevice` 取り込み、`bottomToolbarRef` + `bottomToolbarHeight` state、ResizeObserver、`toolbarElement` 変数化、header 内 / bottom 固定の 2 配置を `isTouch` で分岐、`stageBottomInset` 計算で `bottomToolbarHeight` 加算 |
| 6 | Toolbar.test 更新 | ✅ Complete | `useTouchDeviceMock` を `vi.hoisted` で導入、4 件 adaptive test を追加 (desktop / ToolButton touch / ColorPalette touch / FontSizeControl touch) |
| 7 | ColorPalette.test / FontSizeControl.test | ✅ **(Plan からの変更)** | Toolbar.test で間接的に網羅したため、別 test ファイルへの追加は省略。**Deviation** として report に記録 |
| 8 | Playwright pinch smoke | ✅ Complete | `touch-toolbar-bottom.spec.ts` 新規 (mobile-chrome 限定 1 件)、3.2s で緑 |
| 9 | PRD 更新 | ✅ Complete | sub-phase 10.I-3 行を `pending` → `in-progress` → `complete`、本 report への link |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `pnpm typecheck` 全 workspace 緑 |
| Lint (biome ci) | ✅ Pass | 216 files clean (auto-fix で EditorShell.tsx + touch-toolbar-bottom.spec.ts の format を自動修正) |
| Unit Tests | ✅ Pass | **web: 38 file / 346 件 緑** (10.I-2 完了時 342 件 + 10.I-3 で 4 件追加: Toolbar 4) / api: 18 / 187 件 緑 |
| Build | ✅ Pass | web (vite) + api (wrangler dry-run) 成功 |
| E2E (mobile-chrome toolbar smoke) | ✅ Pass | 新規 spec が 3.2s で緑。Toolbar が viewport 下半分に位置 + tap → 矩形描画を実証 |
| E2E (mobile-chrome 累積 3 smoke) | ✅ Pass | 10.I-1 (描画) + 10.I-2 (pinch) + 10.I-3 (toolbar bottom) すべて緑 (累積 4.2s) |
| E2E (chromium 全件回帰) | ✅ Pass | **78 passed / 5 skipped、回帰ゼロ** |

### Edge Cases 結果

Plan の Edge Cases Checklist 達成度:

- ✅ PC chromium で Toolbar が `<header>` 内 (従来位置維持) — chromium e2e 全件緑で実証
- ✅ PC chromium でボタンサイズ 32px / 28px 維持 — Toolbar.test の desktop assert で実証
- ✅ mobile-chrome で Toolbar が viewport 下半分に存在 — touch-toolbar-bottom.spec.ts で実証
- ✅ mobile-chrome で Toolbar が AdSlot bottom (100px) の上に位置 — `bottom: BOTTOM_HEIGHT_PX` で実装
- ✅ `paddingBottom: env(safe-area-inset-bottom)` 適用 — `viewport-fit=cover` + inline style で実装、実機検証推奨
- ✅ 全 Button に `min-w-11 min-h-11` 適用 — Toolbar.test の touch assert 3 件で実証
- ✅ Toolbar の flex-wrap で 2-3 行になっても stage 高さ追従 — ResizeObserver で実装
- ✅ Stage が Toolbar に被らない — `stageBottomInset` 計算で Toolbar 高さを加算
- ✅ chromium e2e 78 件回帰ゼロ
- ✅ LangToggle が touch / desktop どちらでも header 右に残る — `<div>` で個別配置、Toolbar から独立
- ✅ landing 状態で Toolbar 非表示 — `toolbarElement = source !== null ? <Toolbar /> : null` で実装

## Files Changed

| File | Action | Lines |
|---|---|---|
| `apps/web/index.html` | UPDATED | +1 / -1 (viewport-fit=cover) |
| `apps/web/src/components/toolbar/ToolButton.tsx` | UPDATED | +9 / -2 |
| `apps/web/src/components/toolbar/ColorPalette.tsx` | UPDATED | +7 / -0 |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | UPDATED | +9 / -2 |
| `apps/web/src/pages/EditorShell.tsx` | UPDATED | +89 / -32 (~57 net) |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | UPDATED | +63 / -1 |
| `apps/web/e2e/touch-toolbar-bottom.spec.ts` | CREATED | +63 |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | UPDATED | +1 / -1 |

合計: 約 280 行差分 (新規 1 + 更新 7)。

## Deviations from Plan

### Deviation 1: ColorPalette.test / FontSizeControl.test の個別 adaptive test を省略

- **WHAT**: Plan の Task 7 で「ColorPalette.test.tsx / FontSizeControl.test.tsx の adaptive test」を別途追加する予定だったが、Toolbar.test.tsx が `<Toolbar>` を render してその中の ColorPalette / FontSizeControl も同時に DOM ツリーに含めるため、Toolbar.test 内の 3 件の touch assert で実質的にカバーされた
- **WHY**: 重複 test を避けるため。Toolbar.test の `palette?.querySelector('button')` で ColorPalette swatch の adaptive class を、`button[aria-label="${ja['toolbar.fontSize.increaseAria']}"]` で FontSizeControl の adaptive class を、それぞれ実 DOM 経由で assert している
- **JUSTIFICATION**: テスト責務分離の観点では「component 単体 test」と「Toolbar 統合 test」は別だが、本 plan の adaptive class assert は性質上「Toolbar に組み込まれた状態」を見れば十分。component 単体での useTouchDevice mock を ColorPalette / FontSizeControl の test に重ねるのは冗長

### Deviation 2: なし (それ以外は Plan 通り実装)

## Issues Encountered

### Issue 1: Biome の format 違反 (auto-fix 対応)

EditorShell.tsx と touch-toolbar-bottom.spec.ts で改行幅 (line-width) の format 違反。`pnpm exec biome check --write` で auto-fix。10.I-2 と同種。

### Issue 2: なし

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | +4 | desktop default class なし / ToolButton touch min-w-11 min-h-11 / ColorPalette swatch touch / FontSizeControl +/- touch |
| `apps/web/e2e/touch-toolbar-bottom.spec.ts` | +1 | mobile-chrome で Toolbar が viewport 下半分 + tap 矩形描画 |

合計: **新規 4 件 unit + 1 件 E2E** (web 全体: 342 → 346 件)

## Next Steps

- [ ] 実機 iPhone Safari + Android Chrome での手動検証 (Toolbar が画面下部、片手親指リーチ、safe-area-inset-bottom が effective、44px tap zone の使い心地)
- [ ] Phase 10.I-4 (E2E 12 ケース受入 + 実機検証) Plan 起票
- [ ] Phase 10.I 全 sub-phase 完了後に `/code-review` → PR 作成

### 着手推奨順

```
/everything-claude-code:prp-plan .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md
```

これで次の eligible pending phase = **10.I-4 (E2E + 実機検証 + 受入)** が選択されます。Phase 10.I の sub-phase は 10.I-4 で完結します。

---

## Notes

### `useTouchDevice` の 5 ファイル目への横展開

10.I-2 で作成した hook を 10.I-3 で **EditorShell + ToolButton + ColorPalette + FontSizeControl** の 4 ファイル新規追加 (合計 5 ファイルで再利用)。各 useEffect が独立に matchMedia listener をアタッチするが、これは小さなオーバーヘッドで React の標準的アプローチ。

### `viewport-fit=cover` の波及効果

`viewport-fit=cover` を追加すると iOS Safari で:
- `env(safe-area-inset-top/right/bottom/left)` が実値を返す
- 画面 4 隅の角丸 / notch まで viewport が広がる

副作用として、**既存 AdSlot bottom の `padding-bottom: env(safe-area-inset-bottom)` (Phase 10.H) が初めて実効する**。これは Phase 10.H で意図された動作で、本 plan の修正でようやく効くようになる (= 既存実装の latent bug を併せて解消)。

### Toolbar の中身を完全維持できた

Plan の方針通り、Toolbar.tsx は **1 行も変更せず** 配置のみを EditorShell 側で切替えた。これにより:
- 既存 Toolbar 関連 e2e (chromium 78 件) の regression がゼロ
- desktop UX (32px / 28px ボタン visual) を完全維持
- 構造 / aria-label / data-testid のいずれも変更なしで継続性が高い

### 自動化していないが手動確認推奨の項目 (実機 / 本番デプロイ前)

1. **iPhone Safari 実機**:
   - Toolbar が画面下部に固定、AdSlot 真上に配置
   - 片手親指で全ボタンが届く
   - home indicator (notch / pill) が Toolbar / AdSlot を侵食しない (`viewport-fit=cover` + safe-area-inset-bottom 効果)
   - 細い iPhone (Mini / SE) でも flex-wrap が破綻しない
2. **Android Chrome 実機**: 同上
3. **iPad (Tablet)**: 縦持ち / 横持ちで lg 境界 (1024px) の挙動確認、Toolbar の配置切替が正しいか
4. **PC**: Toolbar が `<header>` 内、ボタン 32px / 28px 維持を DevTools で目視

### 設計上の良い副作用

- `useTouchDevice` を 5 ファイルで再利用したことで、Phase 10.I-4 や Phase 11+ で追加の adaptive 化を進めるときの素地が整った
- `toolbarElement` の変数化により、将来別配置 (例: drawer) を追加する場合も Toolbar 自体は変更不要
- `bottomToolbarRef` の ResizeObserver で flex-wrap による動的高さ追従が確立され、将来 Toolbar に項目を追加 / 削減しても layout が破綻しない
