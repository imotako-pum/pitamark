# Plan: Phase 10.I-4 — E2E 受入 (4 形状 × 3 操作) + 実機検証チェックリスト + umbrella report

## Summary

Phase 10.I の最終 sub-phase として、mobile-chrome (Pixel 5 emulation) project に「4 形状 (rectangle / arrow / highlight / text) × 3 操作 (add / move / delete) = 12 ケース」の受入 spec を新設し、PRD Acceptance Criteria の「基本機能パリティ」を CI で lock する。並行して、自動化が困難な実機検証 (誤操作率 / selection handle ヒット率 / CWV / mobile→PC リアルタイム同期) を著者 + 知人ドッグフードで遂行するための手動チェックリスト docs を作成する。最後に Phase 10.I 全体 (10.I-1〜10.I-4) の umbrella report を起票して 4 sub-phase の deliverable / 引き継ぎ事項 / 工数を記録し、Phase 10.I を complete に確定する。

## User Story

As **the snap-share Phase 10.I owner**, I want **mobile-chrome E2E 12 ケースで自動回帰を保証し、実機チェックリスト docs で手動受入の道筋を残し、umbrella report で 4 sub-phase の経過を 1 か所に集約する**, so that **Phase 10.I を客観的に complete 宣言でき、次の Phase (10.H ランディング → 10.F v1.0.0) に安心して進める**.

## Problem → Solution

**Current state (10.I-3 完了時点)**:
- mobile-chrome smoke 3 件 (10.I-1: 矩形描画 / 10.I-2: pinch / 10.I-3: toolbar bottom) は緑で **個別の機能** が動くことは実証済
- しかし **4 形状 × 3 操作 = 12 ケースの全網羅** は未だ自動 lock されていない
- PRD Acceptance Criteria の「誤操作率 < 1/5」「handle hit 90%」「CWV < 2.5s/200ms/0.1」「mobile→PC 同期」は自動測定が困難、手動チェックリストが未起票
- Phase 10.I 全体 (4 sub-phase) を概観する umbrella report が未起票 (CLAUDE.md memory: Phase 9 以降必須)

**Desired state**:
- `e2e/touch-acceptance.spec.ts` で 12 ケース全件が緑、CI で回帰検出
- `docs/qa/phase-10-i-touch-manual-qa.md` に実機チェックリスト (iPhone Safari + Pixel Chrome × 5 試行 × 4 形状) があり、ドッグフード時に消費可能な状態
- `.claude/PRPs/reports/phase-10-i-umbrella-report.md` に 4 sub-phase の deliverable + 工数 + 引き継ぎ事項を集約
- PRD 10.I-4 行と Phase 10 親行が complete

## Metadata

- **Complexity**: Medium (3 ファイル新規 + 1 helper + PRD 更新、推定 600〜800 行差分 — 自動 spec 12 ケースで嵩む)
- **Source PRD**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`
- **PRD Phase**: 10.I-4 (E2E + 実機検証 + 受入)
- **Estimated Files**: 5 (e2e helper 新規 / e2e spec 新規 / docs/qa 新規 / umbrella report 新規 / PRD 更新)

---

## UX Design

**Internal change — 受入測定とドキュメント化のみ**。ユーザー向けの UI 変更なし。

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| CI 自動検出範囲 | mobile smoke 3 件 (個別機能) | mobile 12 ケース (4 形状 × 3 操作) | 受入 spec で全網羅 |
| 著者の実機検証手順 | アドホック | 手動チェックリスト docs を消費 | dogfood 時に印刷 / iPad で開いて使う想定 |
| Phase 10.I の複数 sub-phase レビュー | 各 report を個別に読む | umbrella report 1 か所で完結 | 引き継ぎ + 振り返りに有用 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/e2e/touch-rectangle-draw.spec.ts` | 全体 (60 行) | mobile-chrome project skip / dropImage / page.mouse.down/move/up + ANNOTATIONS_KEY 経由 assert。最小 helper のテンプレート |
| **P0** | `apps/web/e2e/touch-toolbar-bottom.spec.ts` | 全体 (63 行) | `page.tap` で aria-label ボタンを押すパターン (`getByRole('button', { name: '矩形' }).tap()`)。ボトム配置 Toolbar との連携検証済 |
| **P0** | `apps/web/e2e/touch-pinch-zoom.spec.ts` | 全体 (85 行) | CDPSession `Input.dispatchTouchEvent` で 2-finger pinch を発火するパターン (本 plan では使わないが参考) |
| **P0** | `apps/web/e2e/annotation-tools.spec.ts` | 全体 (推定 ~150 行) | chromium project の 4 形状 × add の既存 spec。本 plan はこれの mobile-chrome 版 + move + delete を作る |
| **P0** | `apps/web/e2e/fixtures/upload.ts` | 全体 (160 行) | `dropImage` helper 既存。本 plan で `e2e/fixtures/touch-helpers.ts` を同じ場所に新設 |
| **P1** | `apps/web/src/i18n/ja.ts` | 20-30 (toolbar.tool.* / toolbar.action.delete) | aria-label 文字列: 矩形 / 矢印 / ハイライト / テキスト / 削除 |
| **P1** | `apps/web/src/hooks/annotationsReducer.ts` | 37-90 (action types) | annotation/add / move / remove の dispatch 経路。e2e は dispatch を直接呼ばず UI 経由で発火させる |
| **P1** | `packages/shared/src/annotation.ts` | 14-85 (Annotation discriminated union) | `type: 'rectangle' | 'arrow' | 'highlight' | 'text'` と各 shape の位置プロパティ (`x`, `y`, `from`, `to` 等)。assert で型分岐に使う |
| **P1** | `apps/web/playwright.config.ts` | 34-37 (projects) | mobile-chrome project (Pixel 5) は既存。本 plan で新規 spec を追加するだけ |
| **P2** | `.claude/PRPs/reports/phase-10-i-1-pointer-events-migration-report.md` | 全体 | 10.I-1 report の構造。umbrella report はこれを集約する形式 |
| **P2** | `.claude/PRPs/reports/phase-10-i-2-multitouch-and-hit-areas-report.md` | 全体 | 10.I-2 report |
| **P2** | `.claude/PRPs/reports/phase-10-i-3-toolbar-bottom-and-safe-area-report.md` | 全体 | 10.I-3 report |
| **P2** | `apps/web/e2e/golden-path.spec.ts` | ANNOTATIONS_KEY 周辺 | window 経由で annotation array を取得する既存パターン (line 12 ~) |
| **P2** | `CLAUDE.md` (`umbrella report` 必須化記述) | 該当行 | umbrella report の必須要素: Acceptance Criteria 表 / sub-phase deliverable + report link / 未解決事項 / 工数 retrospective |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Playwright `page.tap()` 仕様 | [Playwright tap docs](https://playwright.dev/docs/api/class-page#page-tap) | hasTouch:true の context (mobile-chrome) で利用可。要素の中央を tap する |
| Playwright `expect.poll()` | [Playwright polling docs](https://playwright.dev/docs/test-assertions#expectpoll) | annotation 数の async 確認に既存実装で使われている |
| iOS HIG / Material 44pt 検証 | (10.I-3 で実装済、本 plan は spec assert のみ) | tap zone 44px は CI で自動検証済 (Toolbar.test) |
| Lighthouse mobile profile | [web.dev Lighthouse](https://web.dev/measure/) | 自動化は `lhci` 等が必要。本 plan では **手動 spot check** を docs に明記 |

---

## Patterns to Mirror

### TOUCH_HELPER_LOCATION
```ts
// SOURCE (NEW): apps/web/e2e/fixtures/touch-helpers.ts
// 既存 dropImage と並列に置く。test ファイルからは `import { dragOnStage, ... } from './fixtures/touch-helpers';`
// 12 ケース spec が個別に dragOnStage / placeText / deleteSelected を実装すると重複が増えるため、
// 共通化して 1 spec ファイルでまとまるようにする。

import type { Page } from '@playwright/test';

export const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

/** Stage canvas の bounding box を取得。失敗時はわかりやすい例外を投げる。 */
export const getStageBox = async (page: Page) => {
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
  return box;
};

/** 矩形 / 矢印 / ハイライト 共通: Stage 上を 1 本指 drag する。
 *  startOffset / endOffset は box 左上基準。 */
export const dragOnStage = async (
  page: Page,
  startOffset: { x: number; y: number },
  endOffset: { x: number; y: number },
) => {
  const box = await getStageBox(page);
  await page.mouse.move(box.x + startOffset.x, box.y + startOffset.y);
  await page.mouse.down();
  await page.mouse.move(box.x + endOffset.x, box.y + endOffset.y, { steps: 5 });
  await page.mouse.up();
};

/** テキスト用: Stage の指定座標を tap して text annotation を即時配置する。 */
export const tapStage = async (page: Page, offset: { x: number; y: number }) => {
  const box = await getStageBox(page);
  await page.mouse.move(box.x + offset.x, box.y + offset.y);
  await page.mouse.down();
  await page.mouse.up();
};

/** annotation 配列を window 経由で取得 (既存 ANNOTATIONS_KEY 経路)。 */
export const readAnnotations = (page: Page) =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, ReadonlyArray<unknown>>)[k] ??
        []) as ReadonlyArray<{
        id: string;
        type: 'rectangle' | 'arrow' | 'text' | 'highlight';
        x?: number;
        y?: number;
        from?: { x: number; y: number };
        to?: { x: number; y: number };
      }>,
    ANNOTATIONS_KEY,
  );

/** 1 件目の annotation を取得 (本 spec の構造上、各 it は 1 件のみ作成)。 */
export const readFirstAnnotation = async (page: Page) => {
  const arr = await readAnnotations(page);
  return arr[0] ?? null;
};

/** ツール選択 (i18n aria-label 経由)。 */
export const selectTool = async (page: Page, label: string) => {
  await page.getByRole('button', { name: label }).tap();
};

/** select ツールで shape を tap して選択し、削除ボタン tap で削除する。 */
export const tapShapeAndDelete = async (
  page: Page,
  shapeOffset: { x: number; y: number },
) => {
  await selectTool(page, '選択'); // 'toolbar.tool.select'
  await tapStage(page, shapeOffset);
  await page.getByRole('button', { name: '削除' }).tap();
};
```

### MOBILE_CHROME_TEST_SKIP
```ts
// SOURCE: 既存 apps/web/e2e/touch-rectangle-draw.spec.ts:25-30
// 既存 3 spec が同じパターンを使用している。本 plan の 12 ケースも同じ skip ロジックを共有する。
test.skip(
  testInfo.project.name !== 'mobile-chrome',
  'touch acceptance は mobile-chrome project のみ実行する',
);
```

### ANNOTATION_ASSERT_BY_TYPE
```ts
// SOURCE (NEW): 各 it 内
// PRD Acceptance Criteria「4 形状 × 3 操作 = 12 ケース」を満たすため、各 it で
// annotation の type 分岐を assert する。Add / Move / Delete それぞれ確認方法が異なる。

// Add: 個数が 0 → 1 + 期待 type
const after = await readAnnotations(page);
expect(after).toHaveLength(1);
expect(after[0]?.type).toBe('rectangle');

// Move: 同 id の annotation の x/y (or from/to) が変化
const before = await readFirstAnnotation(page);
expect(before?.type).toBe('rectangle');
// drag 後に再取得
const after = await readFirstAnnotation(page);
// rectangle/highlight: x/y / arrow: from.x/y / text: x/y で位置を確認
const moved =
  after?.type === 'arrow'
    ? after.from?.x !== before?.from?.x || after.from?.y !== before?.from?.y
    : after?.x !== before?.x || after?.y !== before?.y;
expect(moved).toBe(true);

// Delete: 個数が 1 → 0
expect(await readAnnotations(page)).toHaveLength(0);
```

### MANUAL_QA_DOCS_FORMAT
```markdown
<!-- SOURCE (NEW): docs/qa/phase-10-i-touch-manual-qa.md -->
# Phase 10.I — 実機タッチ手動 QA チェックリスト

**対象**: iPhone Safari + Android Chrome (Pixel 5 / 6 / 7 系)
**最終更新**: 2026-05-09
**実施手順**: ngrok or 同 LAN で `pnpm dev` を露出 → 実機 Safari/Chrome から URL 開く

## 1. 基本機能パリティ (4 形状 × 3 操作 = 12 ケース)

| # | 操作 | iPhone Safari | Pixel Chrome | 備考 |
|---|---|:--:|:--:|---|
| 1 | 矩形を 1 本指 drag で追加 | ☐ | ☐ | 100×100 程度の矩形が描けること |
| ... |
| 12 | テキストを delete |  ☐ | ☐ | 選択 → 削除ボタン tap |

## 2. 誤操作率 (5 試行)
...

## 3. selection handle ヒット率 (5 試行 × 4 形状 × 2 デバイス = 40 試行)
...

## 4. リアルタイム共同編集 (mobile → PC)
...

## 5. CWV (Lighthouse mobile profile)
...
```

### UMBRELLA_REPORT_FORMAT
```markdown
<!-- SOURCE (NEW): .claude/PRPs/reports/phase-10-i-umbrella-report.md -->
# Phase 10.I umbrella report — タッチデバイス操作最適化

**Date**: 2026-05-09
**Branch**: `phase-10-i-touch-optimization`
**Source PRD**: phase-10-i-touch-optimization.prd.md
**Sub-phases**: 10.I-1 / 10.I-2 / 10.I-3 / 10.I-4

## 1. PRD Acceptance Criteria 達成度
| Metric | Target | Achieved | 根拠 |
|---|---|:--:|---|
| 基本機能パリティ | 12 ケース | ✅ | touch-acceptance.spec.ts |
| 誤操作率 | < 1/5 | ⚠ 手動 | docs/qa 参照 |
| ... |

## 2. Sub-phase deliverable
- 10.I-1: ... → [report](phase-10-i-1-...-report.md)
- 10.I-2: ...
- 10.I-3: ...
- 10.I-4: 本 report (= 10.I 全体 report 兼)

## 3. 未解決事項 / 引き継ぎ
- 実機 (iPhone Safari) の 1-finger pan の挙動はドッグフードで未検証
- ...

## 4. 工数 (commit 数 + LOC + duration)
- 6 commits, +2900 / -50 LOC, 2026-05-09 (single day session)
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/e2e/fixtures/touch-helpers.ts` | CREATE | 12 ケース spec が共通利用する `dragOnStage` / `tapStage` / `selectTool` / `readAnnotations` / `tapShapeAndDelete` を抽出 (~80 行) |
| `apps/web/e2e/touch-acceptance.spec.ts` | CREATE | mobile-chrome 限定 12 ケース (4 形状 × 3 操作)、~250 行 |
| `docs/qa/phase-10-i-touch-manual-qa.md` | CREATE | 実機チェックリスト (12 ケース手動 + 誤操作率 + handle hit + 同期 + CWV)、~150 行 |
| `.claude/PRPs/reports/phase-10-i-umbrella-report.md` | CREATE | Phase 10.I 全体 (4 sub-phase) のまとめ、~200 行。10.I-4 個別 report は umbrella に統合し別途作らない |
| `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` | UPDATE | sub-phase 10.I-4 行を complete + 親 Phase 10 行 (snap-share.prd.md) で 10.I 完了反映は別 commit (本 plan のスコープ外、umbrella report 後に実施) |

## NOT Building

- **CWV (LCP/INP/CLS) の自動測定** — Playwright + Lighthouse CI 統合は重い、本 plan は手動 spot check を docs に記載するに留める。Phase 10.G の Analytics 観察期間で field data として収集する設計
- **iOS Safari の WebKit Playwright project 追加** — Phase 7.5 で Won't 確定 (chromium + mobile-chrome のみ維持)、Phase 8 dogfood 後に判断する方針
- **新規 unit test** — 10.I-4 は受入の検証フェーズで実装変更がない。新 unit test は不要 (10.I-1〜10.I-3 の 25 件で実装はカバー済)
- **手動 QA 結果の自動収集 / 提出システム** — 著者個人プロジェクトのスケール、docs を消費する形で十分
- **mobile-chrome 以外のモバイル device emulation** (例: iPhone 12 / Galaxy S20) — Pixel 5 (既存 mobile-chrome project) で代表検証、複数 device での回帰は Phase 11+ で必要なら検討
- **`umbrella report` 内での 10.I-4 個別 report** — Plan の方針で **10.I-4 個別 report は省略し、umbrella report で代替**する (4 sub-phase の receiver 役を兼ねる)
- **`snap-share.prd.md` の Phase 10 親行更新** — Phase 10.H / 10.F が未完なので親行 status 更新は本 plan のスコープ外
- **Phase 7.7 / 7.8 PRD への追加更新** — 既に PRD 起票時 (10.I PRD) で Won't 訂正注記済、本 plan で再訂正不要

---

## Step-by-Step Tasks

### Task 1: `e2e/fixtures/touch-helpers.ts` 新規作成

- **ACTION**: `apps/web/e2e/fixtures/touch-helpers.ts` を新規作成
- **IMPLEMENT**: `TOUCH_HELPER_LOCATION` (上記 Patterns to Mirror) のコードをそのまま記述
- **MIRROR**: `TOUCH_HELPER_LOCATION` パターン + 既存 `apps/web/e2e/fixtures/upload.ts` の export スタイル
- **IMPORTS**: `import type { Page } from '@playwright/test';`
- **GOTCHA**:
  - `readAnnotations` の `window[ANNOTATIONS_KEY]` の値は実装側で `useEffect` で設定される (既存規約)。`page.waitForFunction` で配列存在を確認してから呼ぶ前提
  - `tapShapeAndDelete` で `selectTool('選択')` を呼ぶが、これは `toolbar.tool.select = '選択'` (i18n ja.ts)。touch でも desktop でも tap でツール切替できる (10.I-3 の adaptive で tap zone は 44px に拡張済)
  - `dragOnStage` の `steps: 5` は既存 annotation-tools.spec.ts と同値 (Konva の draft 描画が中間点で発火するため必要)
- **VALIDATE**:
  - `pnpm -F @pitamark/web typecheck` 緑
  - `grep -n "dragOnStage\|tapStage\|readAnnotations" apps/web/e2e/fixtures/touch-helpers.ts` で 5 export 以上を確認

### Task 2: `e2e/touch-acceptance.spec.ts` の 12 ケース実装

- **ACTION**: `apps/web/e2e/touch-acceptance.spec.ts` を新規作成、4 形状 × 3 操作 = 12 it ブロックを describe 1 つにまとめる
- **IMPLEMENT**:
  - file 冒頭で mobile-chrome project skip を共通化 (test.beforeEach or test.describe.configure)
  - **Add (4 件)**:
    1. 矩形 add: `selectTool('矩形') → dragOnStage(60,60→160,160) → readAnnotations.length === 1, type === 'rectangle'`
    2. 矢印 add: `selectTool('矢印') → dragOnStage(50,50→200,200) → length 1, type 'arrow'`
    3. ハイライト add: `selectTool('ハイライト') → dragOnStage(70,70→170,170) → length 1, type 'highlight'`
    4. テキスト add: `selectTool('テキスト') → tapStage(100,100) → length 1, type 'text'`
  - **Move (4 件)**: 各形状を add した後、`selectTool('選択')` → 既存 shape 上で `dragOnStage(shape 中央 → +50,+50)` → before/after の x/y or from/to 比較で位置変化を assert
     - 注: text は描画後に IME が出るため、Esc で確定 (or `page.keyboard.press('Escape')`) してから move
  - **Delete (4 件)**: 各形状を add した後、`tapShapeAndDelete(shape 中央)` で削除 → length 0 を assert
- **MIRROR**: `MOBILE_CHROME_TEST_SKIP` + `ANNOTATION_ASSERT_BY_TYPE` + 既存 `touch-rectangle-draw.spec.ts` のフロー
- **IMPORTS**:
  ```ts
  import { expect, test } from '@playwright/test';
  import { dropImage } from './fixtures/upload';
  import {
    ANNOTATIONS_KEY,
    dragOnStage,
    readAnnotations,
    readFirstAnnotation,
    selectTool,
    tapShapeAndDelete,
    tapStage,
  } from './fixtures/touch-helpers';
  ```
- **GOTCHA**:
  - **テキスト Move**: text annotation は配置後に IME が立ち上がる。`page.keyboard.press('Escape')` で確定してから select に切替えないと、次の dragOnStage が IME 上で消費される。本 plan では空文字 text のまま Escape で確定する (Move 検証は位置変化のみ)
  - **テキスト Delete**: text を選択するには text shape の中心 tap が必要。tap stage の y は text 高さも考慮 (空文字でも fontSize 18 の領域)
  - **Add の前に annotation 配列が空** であることを `expect.poll(() => readAnnotations(page)).toHaveLength(0)` で確認しておく (前 test の状態リーク防止)
  - **iPhone-safari 的な多指衝突は本 spec では出ない** (mobile-chrome は Chromium engine、iOS Safari の挙動は手動 QA の責務)
  - **Auto-next-A 連鎖** (矢印 → text 自動配置) は Phase 7.8 機能で 12 ケースに干渉する可能性あり。各 it で `page.evaluate` を使って annotations を毎回 reset する or test 単位で `page.goto('/')` し直す方針が必要 → **本 plan では各 it で `page.goto('/')` + `dropImage` から始める** (test 独立性を最優先)
  - **mobile-chrome project の retries** は既存 config で `process.env.CI ? 2 : 0`。flake が出る箇所 (text move 等) は `test.retry(2)` を inline 付与可能だが、まず素直に書いて緑になるか確認
- **VALIDATE**:
  - `cd apps/web && pnpm exec playwright test e2e/touch-acceptance.spec.ts --project=mobile-chrome` で 12 件全緑
  - `--project=chromium` では skip 動作

### Task 3: `docs/qa/phase-10-i-touch-manual-qa.md` 新規作成

- **ACTION**: `docs/qa/phase-10-i-touch-manual-qa.md` を新規作成 (`docs/qa/` ディレクトリが無ければ併せて作成)
- **IMPLEMENT**:
  - Header: 対象 / 最終更新 / 実施手順
  - **§1 基本機能パリティ (12 ケース)**: 各 it と同じ操作を手動で消費するためのチェックボックス table (iPhone / Pixel 列)
  - **§2 誤操作率 (5 試行)**: 「5 つの annotation を任意の構成で追加するタスクで、意図しない描画 / ジェスチャ衝突が 1 タスク中 1 回未満」を計測する手順 + 結果欄
  - **§3 selection handle ヒット率 (40 試行)**: 5 試行 × 4 形状 × 2 デバイス、各セルに「掴めた / 失敗」を記入
  - **§4 リアルタイム共同編集 (mobile → PC)**: 2 デバイス連携で 1 秒以内反映の手順 + 結果欄
  - **§5 CWV (Lighthouse mobile profile)**: 操作手順 + LCP/INP/CLS の閾値 + 計測値欄
  - **§6 既知の問題 / 推奨事項**: ドッグフード時に発見した問題を著者が後から書き足すスペース
- **MIRROR**: `MANUAL_QA_DOCS_FORMAT` + `docs/observability.md` (既存) のフォーマット
- **IMPORTS**: なし (Markdown)
- **GOTCHA**:
  - 著者が後で結果を埋める前提のため、空 checkbox + 結果欄を残す。テンプレートとして使えること
  - mobile-chrome project (Pixel 5 emulation) と実機 Pixel の挙動差を把握するため、§1 は重複に見えても実機列を残す (E2E と手動の二重チェック)
  - PRD Acceptance Criteria の閾値 (LCP < 2.5s 等) を docs に明記して測定基準のブレを防ぐ
- **VALIDATE**:
  - `ls docs/qa/phase-10-i-touch-manual-qa.md` でファイル存在
  - `grep -c "☐" docs/qa/phase-10-i-touch-manual-qa.md` で空 checkbox 多数 (~50 件) を確認
  - markdown lint は既存リポジトリにないので追加なし

### Task 4: `.claude/PRPs/reports/phase-10-i-umbrella-report.md` 新規作成

- **ACTION**: Phase 10.I 全体 (4 sub-phase) の umbrella report を作成
- **IMPLEMENT**:
  - **Header**: Date / Branch / Source PRD / Sub-phases リスト
  - **§1 PRD Acceptance Criteria 達成度** (table):
    | Metric | Target | Achieved | 根拠 |
    各行に CI 自動 (e2e / unit) or 手動 (docs/qa) の根拠リンク
  - **§2 Sub-phase deliverable** (4 ブロック):
    - 10.I-1: 1-2 sentences + report link + commit hash
    - 10.I-2: 同上
    - 10.I-3: 同上
    - 10.I-4: 本 report (= umbrella、個別 report は省略)
  - **§3 未解決事項 / 次フェーズへの引き継ぎ**:
    - 実機 (iPhone Safari + Pixel Chrome) ドッグフード結果
    - VisualViewport API での IME 吸収 (Should、本 Phase で未実装)
    - awareness layer の touch device 判定 (Should、未実装)
    - palm rejection / ペンモード (Won't、Phase 11+ 候補)
    - Phase 11+ で `stage.getPointersPositions()` ベースの完全 Pointer 統合への移行余地
  - **§4 工数 retrospective**:
    - commit 数 (本 plan 完了時で 6+ コミット)
    - 累積 LOC (`git log --shortstat` ベース)
    - duration (2026-05-09 single day session、PRD 起票から 10.I-4 完了まで)
    - 学び: Pointer Events 一本化と TouchEvent 併用の並列共存設計、`viewport-fit=cover` の latent な safe-area latent bug 解消、useTouchDevice の hook 横展開
- **MIRROR**: `UMBRELLA_REPORT_FORMAT` + 既存 `.claude/PRPs/reports/phase-10-i-1-pointer-events-migration-report.md` の構造を集約形式に変形
- **IMPORTS**: なし
- **GOTCHA**:
  - 「10.I-4 個別 report は umbrella で代替」を明記し、後続作業者が混乱しないようにする
  - 工数の commit 数 / LOC は git で集計してから記載 (`git log --shortstat phase-10-i-touch-optimization` 等)
  - ADR-0006 が Status Update 含めて Accepted 状態であることを明記
- **VALIDATE**:
  - `ls .claude/PRPs/reports/phase-10-i-umbrella-report.md`
  - `grep -c "10.I-1\|10.I-2\|10.I-3\|10.I-4" .claude/PRPs/reports/phase-10-i-umbrella-report.md` で 4 sub-phase が言及されている

### Task 5: PRD 更新

- **ACTION**: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` の sub-phase 10.I-4 行を `pending` → `in-progress` → `complete` に更新、umbrella report への link を追加
- **IMPLEMENT**:
  - 10.I-4 行: Status `pending` → `complete (typecheck/lint/test/build/E2E mobile-chrome 12 ケース + chromium 全件回帰すべて緑、手動 QA docs + umbrella report 起票済)`
  - 10.I-4 行: PRP Plan link `-` → `[plan](../plans/completed/phase-10-i-4-acceptance-and-manual-qa.plan.md) / [umbrella report](../reports/phase-10-i-umbrella-report.md)`
- **MIRROR**: 10.I-1 / 10.I-2 / 10.I-3 と同形式の遷移
- **IMPORTS**: なし
- **VALIDATE**: `grep -n "10.I-4" .claude/PRPs/prds/phase-10-i-touch-optimization.prd.md` で Status / link が更新されている

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| (なし) | - | - | 本 plan は受入フェーズで実装変更ゼロ。新規 unit test は不要 |

### Edge Cases Checklist

- [ ] mobile-chrome 12 ケースすべて緑 (CI 自動)
- [ ] chromium 78 件回帰ゼロ (CI 自動)
- [ ] mobile-chrome 累積 4 smoke + 12 受入 = 計 16 件すべて緑
- [ ] 各 it が `page.goto('/')` + `dropImage` から始まり test 独立性が保たれる
- [ ] テキスト Move / Delete で IME 干渉が起きない (Escape 確定経路)
- [ ] Auto-next-A 連鎖 (矢印 → text) が 12 ケース内で発火しないか、または個別の it 内で意図して捌けている
- [ ] umbrella report が 4 sub-phase 全部に link を持つ
- [ ] docs/qa が空 checkbox を保ち、著者が後から消費可能な状態
- [ ] PRD 10.I-4 行が complete

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
pnpm exec biome ci .
```
EXPECT: ゼロエラー、ゼロ違反 (新規 .ts / .tsx は touch-helpers.ts と touch-acceptance.spec.ts のみ)

### Unit Tests
```bash
pnpm test
```
EXPECT: 既存 web 346 件 / api 187 件すべて緑、新規 unit test は 0 件

### Build
```bash
pnpm build
```
EXPECT: success (本 plan は src/ を触らないため bundle は変化なし)

### E2E
```bash
cd apps/web && pnpm exec playwright test e2e/touch-acceptance.spec.ts --project=mobile-chrome
cd apps/web && pnpm exec playwright test e2e/touch-rectangle-draw.spec.ts e2e/touch-pinch-zoom.spec.ts e2e/touch-toolbar-bottom.spec.ts e2e/touch-acceptance.spec.ts --project=mobile-chrome
cd apps/web && pnpm exec playwright test --project=chromium
```
EXPECT: 12 ケース緑、Phase 10.I 累積 16 ケース緑、chromium 78 件回帰ゼロ

### Manual Validation

- [ ] **実機 iPhone Safari**: docs/qa の §1 12 ケースを実施、結果を docs に書き込む
- [ ] **実機 Pixel Chrome**: 同上
- [ ] **誤操作率**: §2 のタスクを 5 試行 × 2 デバイス、結果記入
- [ ] **handle hit**: §3 を 40 試行、結果記入
- [ ] **mobile→PC 同期**: §4 の 2 デバイス連携テスト
- [ ] **CWV**: §5 の Lighthouse mobile profile spot check (LCP / INP / CLS)
- [ ] umbrella report の §1 達成度 table を実機結果で更新

---

## Acceptance Criteria

- [ ] Task 1〜5 すべて完了
- [ ] `pnpm typecheck` / `biome ci` / `pnpm test` / `pnpm build` 全緑
- [ ] mobile-chrome touch-acceptance.spec.ts 12 件緑
- [ ] mobile-chrome 累積 4 smoke + 12 受入 = 16 件緑
- [ ] chromium 全 e2e 回帰ゼロ
- [ ] docs/qa/phase-10-i-touch-manual-qa.md が著者消費可能な状態 (空 checkbox + 結果欄テンプレート完備)
- [ ] phase-10-i-umbrella-report.md が 4 sub-phase 全部の deliverable + 工数 + 引き継ぎを集約
- [ ] PRD 10.I-4 行が complete + umbrella report link

## Completion Checklist

- [ ] e2e helper を共通化して重複を回避 (`fixtures/touch-helpers.ts`)
- [ ] mobile-chrome 限定 skip ロジックを既存 3 spec と統一
- [ ] annotation type 別の assert を 4 形状すべてでカバー
- [ ] 12 ケース内で test 独立性 (各 it で `page.goto`)
- [ ] 手動 QA docs が PRD Acceptance Criteria すべての metric をカバー
- [ ] umbrella report が CLAUDE.md の必須要素 (Acceptance Criteria 表 / sub-phase deliverable + link / 未解決事項 / 工数 retrospective) を完備
- [ ] No hardcoded values
- [ ] No unnecessary scope additions (NOT Building 準拠)
- [ ] Self-contained — codebase 再検索なしで実装可能

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Auto-next-A 連鎖 (矢印 → text 自動配置) で 12 ケース内に余計な annotation が発生 | High | Medium | 各 it で `page.goto('/')` + `dropImage` から始める test 独立性で吸収。`length === 1` (Add) や `length === 0` (Delete) の expect で表面化したら都度回避策を入れる |
| テキスト Move で IME 干渉、test がハング | Medium | Medium | text 配置後 `page.keyboard.press('Escape')` で確定してから select 切替に進む手順を spec に明記 |
| Konva canvas の hit zone (`hitStrokeWidth`) が touch 環境でだけ拡大 (10.I-2) するため、touch shape の中心 tap がずれる | Low | Low | shape 中心オフセットを `dragOnStage` の end 座標 + `(width/2, height/2)` で計算する spec 設計で吸収 |
| Pixel 5 emulation と実機 Pixel の挙動差で「e2e 緑、実機 NG」が出る | Medium | Low | 手動 QA docs §1 で実機 12 ケースを再消費するロジック。e2e は CI lock、手動は実機保証の二段構え |
| `touch-acceptance.spec.ts` 12 件で webServer 起動の overhead が大きく test 時間が伸びる | Medium | Low | mobile-chrome project は CI で別の workers で並列実行可能。`fullyParallel: true` (既存 config) のため 12 件 → 推定 30〜60 秒で完了 |
| umbrella report の commit 数 / LOC 集計が間違う | Low | Low | `git log --shortstat phase-10-i-touch-optimization` で機械的に取得した値を貼る |
| 手動 QA docs を作っても誰も消費しない | High (現実) | Low | 著者個人プロジェクトなので、作っても消費しない可能性は受け入れる。最低限テンプレートを残すことで Phase 11+ で再利用可能 |
| Phase 10.I umbrella report に「10.I-4 個別 report 省略」を明記しないと後続作業者が探す | Medium | Low | umbrella report 冒頭に明記する task 内 GOTCHA |

## Notes

### 10.I-4 個別 report を作らない理由

CLAUDE.md memory:
> 親 Phase が複数 sub-phase に分かれた場合、各 sub-phase report に加えて親 Phase の **umbrella report** を `reports/phase-N-umbrella-report.md` として作成する。

これは「**各** sub-phase report **に加えて**」umbrella を作る規定。10.I-1 / 10.I-2 / 10.I-3 は個別 report を作成済。**10.I-4 は 受入 phase の性質上、umbrella と内容が重複する** ため、本 plan は **10.I-4 個別 report を省略し、umbrella report で代替** する判断を取る。Plan の Files to Change と Tasks にこれを明示しているのは、後続作業者が「10.I-4 report どこ?」と探さないようにするため。

### Phase 10.I 全体完了後の next step

- 10.I 4 sub-phase 全完了
- 同ブランチ `phase-10-i-touch-optimization` に累積 7-8 コミット (PRP docs 4 + 実装 4)
- `/code-review` で 1 PR ぶんのレビュー → 必要なら fix → PR 作成
- merge 後は **Phase 10.H (ランディング条件付き拡張)** に進む。10.H は本 Phase で実装した `useTouchDevice` を流用してランディング CTA / hero ボタンを adaptive 化できる素地が整っている

### CWV 自動化を Should に留めた理由

Lighthouse CI の設定 (`@lhci/cli` 等) は本リポジトリに無く、本 plan で導入すると CI 構成変更が含まれて scope が肥大する。Phase 10.G (1 ヶ月 Analytics 観察) で CrUX / Cloudflare Web Analytics の field data が取れるため、そちらに集約する設計が PRD `phase-10-direction.prd.md` の方針と整合する。Lighthouse 自動化は Phase 11+ で再評価。

### 後続 Phase との関係

- **Phase 10.H (ランディング)**: 本 Phase で確立した `useTouchDevice` + bottom toolbar + adaptive sizing パターンを流用可能
- **Phase 10.F (v1.0.0)**: 本 Phase が必須 blocker だったため、10.I 完了で 10.F 実行条件が解除される
- **Phase 11+ (palm rejection / ペンモード / `stage.getPointersPositions()` ベースへの完全 Pointer 統合)**: ADR-0006 の Status Update に「将来 Phase 11+ で再評価」を明記済
