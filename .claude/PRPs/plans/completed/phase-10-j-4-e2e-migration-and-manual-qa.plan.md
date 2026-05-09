# Plan: Phase 10.J-4 — E2E migration + 実機 QA + umbrella report

## Summary

Phase 10.J で実装した paired binding (10.J-1) / 長押しメニュー (10.J-2) / Transformer 20px anchor (10.J-3) の振る舞いを、Playwright の **本物の `TouchEvent` を発火する経路** で自動 lock-in する。具体的には:

1. `apps/web/e2e/fixtures/touch-helpers.ts` に `dispatchTouchEvent` + `touchSequence` を追加し、既存 `tapStage` / `dragOnStage` を本物の touch event 経路に書き換える (helper レイヤーで一括 migration、各 spec は無編集)。
2. 新規 spec `touch-paired-binding.spec.ts` で 4 Shape の `onTap` / `onTouchStart` 経路が選択・キャンセル・dbltap で動作することを実証。
3. 新規 spec `touch-long-press-menu.spec.ts` で 500ms 長押し → ContextMenu 表示 → 4 項目 (削除 / 複製 / 前面 / 背面) すべて動作を実証。
4. `docs/qa/phase-10-i-touch-manual-qa.md` を `phase-10-j-touch-manual-qa.md` に rename し、Phase 10.J の項目 (paired binding / long-press menu / Transformer 20px / `MIN_TAP_TARGET_PX` 確認) を追加。著者 + 知人 1 名による iPhone Safari + Android Chrome 実機 QA は本 plan で「手順を整備し空欄を埋める準備状態」までを CI レイヤーで担保 (実機通過は人間レイヤーの commit ceremony)。
5. `phase-10-j-umbrella-report.md` を起票し、PRD Acceptance Criteria 達成度 + 全 sub-phase の deliverable + 工数 retrospective + 引き継ぎ事項を集約。

## User Story

As **a snap-share maintainer**, I want **Phase 10.J で導入した paired binding / 長押しメニュー / 20px anchor が CI で本物の touch event 経路で再現されている**, so that **将来 Konva バージョンアップや refactor で touch 経路が壊れた場合に CI で即検知でき、実機 QA に頼らず回帰を防げる**.

## Problem → Solution

**Current state**: Phase 10.J-1 / J-2 / J-3 の実装は完了しているが、**全 22 件の mobile-chrome E2E (Phase 10.I で 12 + 7 + 3 smoke = 22 件) が `page.mouse.*` 経由で動作している**。Chromium の `hasTouch:true` context でも、`page.mouse.*` は `MouseEvent` を発火し `TouchEvent` ではない。Phase 10.I で実装直後に「emulation 緑 / 実機赤」が起きた根本原因はこれ。Phase 10.J-1 で paired binding (`onTap`) を bind しても、`page.mouse.click` は `onClick` を発火させるだけで `onTap` 経路は検証されない。本物の touch event 経路を CI で踏まないと、Phase 10.J-1 の成果は emulation 上で「動いているように見えるが実機で動かない」可能性を引きずる。

**Desired state**: `dispatchTouchEvent(page, type, x, y)` ヘルパで本物の `TouchEvent` を `document.elementFromPoint(x, y)` 起点に発火する。`tapStage` / `dragOnStage` を内部で本物 touch 経路に書き換えることで、既存 19 spec が **無編集で本物 touch を踏む**。さらに 2 件の新規 spec を追加して 10.J 固有の振る舞い (paired binding sanity / long-press menu) を直接 lock-in する。著者は実機 QA チェックリストを `docs/qa/phase-10-j-...md` で消費し、結果を umbrella report に転記する。

## Metadata

- **Complexity**: Medium (5-7 ファイル、推定 250-400 行差分、新 spec 2 ファイル ~150 行 + helper 拡張 ~80 行 + manual QA 拡張 ~60 行 + report ~200 行)
- **Source PRD**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md`
- **PRD Phase**: 10.J-4 (E2E migration + 実機 QA + umbrella report)
- **Estimated Files**: 7 (touch-helpers.ts / 2 new spec / manual-qa rename + 拡張 / umbrella report 新規 / PRD 更新 / snap-share.prd.md Phase テーブル更新)
- **ADR Reference**: ADR-0007 D5 (E2E `dispatchEvent('touchstart')` default) + D6 (実機 QA Must)

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | `apps/web/e2e/fixtures/touch-helpers.ts` | 全体 | `tapStage` / `dragOnStage` の現状実装。本 plan で本物 touch 経路に書き換える対象 |
| **P0** | `apps/web/e2e/touch-acceptance.spec.ts` | 30-130 | `setupEditor` / `tapStage` 消費パターン。helper 書き換えで spec 側無編集が成立する確認 |
| **P0** | `apps/web/e2e/touch-acceptance-edit.spec.ts` | 200-260 | endpoint Circle drag (page.mouse 直接呼び) と dbltap の現状。helper 拡張で Circle drag も touch 経路に migration できる検討 |
| **P0** | `docs/qa/phase-10-i-touch-manual-qa.md` | 全体 | 19 ケース + 誤操作率 / hit / 同期 / CWV のテンプレート。本 plan で `phase-10-j-...md` に rename + 10.J 項目追加 |
| **P0** | `.claude/PRPs/reports/phase-10-i-umbrella-report.md` | 1-60 | umbrella report の構造 (Acceptance / sub-phase / 工数 / 引き継ぎ)。本 plan の `phase-10-j-umbrella-report.md` のひな形 |
| **P0** | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | 71-86 | paired binding 配線箇所 (`onClick + onTap` / `onPointerDown + onTouchStart`)。新規 spec で発火を lock-in |
| **P0** | `apps/web/src/components/canvas/ContextMenu.tsx` | 全体 | 長押し menu の 4 項目 + role="menu" / role="menuitem"。新規 spec で querySelector |
| **P0** | `apps/web/src/hooks/useLongPress.ts` | 全体 | 500ms timer / 6px slop / cancel 条件。新規 spec の入力タイミング設計の根拠 |
| **P1** | `apps/web/playwright.config.ts` | 全体 | mobile-chrome project 設定 (Pixel 5 emulation, `hasTouch: true`)。本物 touch event は `hasTouch:true` context で `dispatchEvent` 経由なら fire できる |
| **P1** | `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` | Phase 10.J-4 行 + Decisions Log D | scope と Decision の最新値 |
| **P2** | Playwright 公式 [Touch events](https://playwright.dev/docs/api/class-page#page-dispatch-event) | — | `dispatchEvent` の引数仕様、`Touch` オブジェクトの構築方法 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Playwright dispatchEvent | [Page#dispatchEvent](https://playwright.dev/docs/api/class-page#page-dispatch-event) | 第 3 引数 `eventInit` で `Touch` / `TouchEvent` 構造を渡す。`isTrusted=false` の制約 |
| MDN TouchEvent | [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent) | `touches` / `targetTouches` / `changedTouches` の意味。`touchend` の `touches` は空 |
| MDN Touch | [Touch](https://developer.mozilla.org/en-US/docs/Web/API/Touch) | `identifier` (multi-touch 識別) / `clientX/Y` (viewport 座標) |
| Konva touch event mapping | [Konva — Mobile_Events.mdx](https://konvajs.org/docs/events/Mobile_Events.html) | Konva は `touchstart` → `tap` / `touchstart × 2` → `dbltap` を内部で生成 |

---

## Patterns to Mirror

### TOUCH_EVENT_DISPATCH (helper 拡張)

```ts
// SOURCE (NEW): apps/web/e2e/fixtures/touch-helpers.ts (追記)

/** viewport 座標 (x, y) で本物の TouchEvent を発火する。
 * Chromium の `hasTouch:true` context (mobile-chrome project) で有効。
 * `page.mouse.*` は MouseEvent しか発火せず Konva の `tap` / `touchstart` 経路を踏まないため、
 * 本物の paired binding (`onTap`) / `onTouchStart` cancelBubble を CI で lock-in するには本 helper が必須。
 *
 * 制約: `Event.isTrusted = false` だが、本 repo は `isTrusted` を参照しない (Phase 10.J-1 で grep 確認済)。 */
export const dispatchTouchEvent = async (
  page: Page,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  x: number,
  y: number,
  identifier = 0,
) => {
  await page.evaluate(
    ({ type, x, y, identifier }) => {
      const target = (document.elementFromPoint(x, y) ?? document.documentElement) as Element;
      const touch = new Touch({
        identifier,
        target,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
        screenX: x,
        screenY: y,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: 1,
      });
      const isEnd = type === 'touchend' || type === 'touchcancel';
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches: isEnd ? [] : [touch],
        targetTouches: isEnd ? [] : [touch],
        changedTouches: [touch],
      });
      target.dispatchEvent(event);
    },
    { type, x, y, identifier },
  );
};

/** [{action, x, y, ms}] のシーケンスを本物 touch event で発火する。
 * - down: touchstart at (x, y)
 * - move: touchmove at (x, y) — 連続 move の中間点を生成する用途
 * - up: touchend at (前回の x, y) — 内部 last position を保持
 * - wait: ms 待つ (long-press の検証用、useLongPress 500ms 超過に使う) */
export const touchSequence = async (
  page: Page,
  steps: ReadonlyArray<
    | { action: 'down' | 'move'; x: number; y: number }
    | { action: 'up' }
    | { action: 'wait'; ms: number }
  >,
) => {
  let lastX = 0;
  let lastY = 0;
  for (const s of steps) {
    if (s.action === 'down') {
      lastX = s.x;
      lastY = s.y;
      await dispatchTouchEvent(page, 'touchstart', s.x, s.y);
    } else if (s.action === 'move') {
      lastX = s.x;
      lastY = s.y;
      await dispatchTouchEvent(page, 'touchmove', s.x, s.y);
    } else if (s.action === 'up') {
      await dispatchTouchEvent(page, 'touchend', lastX, lastY);
    } else if (s.action === 'wait') {
      await page.waitForTimeout(s.ms);
    }
  }
};
```

### TAP_STAGE_REWRITE (helper 内部の touch 経路化)

```ts
// SOURCE (BEFORE): apps/web/e2e/fixtures/touch-helpers.ts:47-52
export const tapStage = async (page: Page, offset: { x: number; y: number }) => {
  const box = await getStageBox(page);
  await page.mouse.move(box.x + offset.x, box.y + offset.y);
  await page.mouse.down();
  await page.mouse.up();
};

// AFTER (本 plan):
export const tapStage = async (page: Page, offset: { x: number; y: number }) => {
  const box = await getStageBox(page);
  // Phase 10.J-4 ADR-0007 D5: 本物の touch event 経路 (touchstart → touchend) で発火し、
  // Konva の `tap` / `onTap` 経路を通す。`page.mouse` は MouseEvent のみで paired binding
  // (`onClick + onTap`) のうち `onClick` しか踏まないため、本物の touch を保証するには本書き換えが必須。
  await touchSequence(page, [
    { action: 'down', x: box.x + offset.x, y: box.y + offset.y },
    { action: 'up' },
  ]);
};
```

### DRAG_ON_STAGE_REWRITE (描画 drag を touch 経路化)

```ts
// SOURCE (BEFORE): apps/web/e2e/fixtures/touch-helpers.ts:33-43
export const dragOnStage = async (page: Page, startOffset, endOffset) => {
  const box = await getStageBox(page);
  await page.mouse.move(box.x + startOffset.x, box.y + startOffset.y);
  await page.mouse.down();
  await page.mouse.move(box.x + endOffset.x, box.y + endOffset.y, { steps: 5 });
  await page.mouse.up();
};

// AFTER:
export const dragOnStage = async (page: Page, startOffset, endOffset) => {
  const box = await getStageBox(page);
  // 中間 5 点を生成して draft 描画パスを正確に再現 (Phase 10.I-4 既存 spec の挙動を維持)。
  const sx = box.x + startOffset.x;
  const sy = box.y + startOffset.y;
  const ex = box.x + endOffset.x;
  const ey = box.y + endOffset.y;
  const mid = (i: number) => ({
    x: sx + ((ex - sx) * i) / 5,
    y: sy + ((ey - sy) * i) / 5,
  });
  await touchSequence(page, [
    { action: 'down', x: sx, y: sy },
    { action: 'move', ...mid(1) },
    { action: 'move', ...mid(2) },
    { action: 'move', ...mid(3) },
    { action: 'move', ...mid(4) },
    { action: 'move', x: ex, y: ey },
    { action: 'up' },
  ]);
};
```

### NEW_SPEC_PAIRED_BINDING (新規 spec の構造)

```ts
// SOURCE (NEW): apps/web/e2e/touch-paired-binding.spec.ts

import { expect, test } from '@playwright/test';
import {
  dragOnStage,
  readFirstAnnotation,
  selectTool,
  setupEditor,
  tapStage,
  touchSequence,
} from './fixtures/touch-helpers';

// Phase 10.J-1: paired binding (`onClick + onTap` / `onPointerDown + onTouchStart`) が
// 本物の touch event 経路で発火することを CI で lock-in。
// 既存の `touch-acceptance.spec.ts` は helper 書き換えで自動的に touch 経路を踏むが、
// 本 spec は **paired binding 自体の挙動 (= 選択 dispatch が走る)** を直接 assert する。

test.describe('Phase 10.J-1: paired binding sanity', () => {
  for (const shape of ['矩形', '矢印', 'ハイライト', 'テキスト'] as const) {
    test(`${shape} を tap で選択できる (onTap 経路)`, async ({ page }, testInfo) => {
      // mobile-chrome のみ
      test.skip(testInfo.project.name !== 'mobile-chrome');
      await setupEditor(page);
      await selectTool(page, shape);
      // shape を 1 つ追加
      if (shape === 'テキスト') {
        await tapStage(page, { x: 100, y: 100 });
        await page.keyboard.press('Escape');
      } else {
        await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
      }
      const before = await readFirstAnnotation(page);
      expect(before).toBeTruthy();
      // select ツールに切替えて shape を tap → onTap が発火 → Transformer / 編集 UI が出る
      await selectTool(page, '選択');
      // 各 shape の中心 (簡易計算、helper を使う)
      const center = await /* shapeScreenCenter */ ...; // 既存 helper 流用
      await tapStage(page, center);
      // Transformer の Anchor (touch 20px) が DOM 上に出ているか
      // = isSelected が true になり Konva Transformer がレンダリングされる
      const transformer = page.locator('.konvajs-content canvas');
      await expect(transformer).toBeVisible();
      // 直接の selection state を window 経由で検証 (実装側の `__SNAP_SHARE_SELECTED__` を使うか、
      // annotations の isSelected 派生 state を読む — Plan で既存 helper の確認後決定)
    });
  }
});
```

### NEW_SPEC_LONG_PRESS_MENU (新規 spec の構造)

```ts
// SOURCE (NEW): apps/web/e2e/touch-long-press-menu.spec.ts

import { expect, test } from '@playwright/test';
import {
  dragOnStage,
  readFirstAnnotation,
  selectTool,
  setupEditor,
  touchSequence,
} from './fixtures/touch-helpers';

// Phase 10.J-2: 長押しメニューが 500ms hold で開き、4 項目 (削除 / 複製 / 前面 / 背面)
// すべてが annotation 操作を実施することを CI で lock-in。

test.describe('Phase 10.J-2: long-press context menu', () => {
  test('500ms 長押しで menu が開く', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome');
    await setupEditor(page);
    await selectTool(page, '矩形');
    await dragOnStage(page, { x: 60, y: 60 }, { x: 160, y: 160 });
    const a = await readFirstAnnotation(page);
    expect(a?.type).toBe('rectangle');
    // shape の中心で 600ms 長押し (LONG_PRESS_DURATION_MS = 500ms より余裕、useLongPress test と整合)
    const box = await page.locator('.konvajs-content canvas').first().boundingBox();
    if (!box) throw new Error('canvas not found');
    const cx = box.x + 110; // shape 中心 x = (60+160)/2 = 110
    const cy = box.y + 110;
    await touchSequence(page, [
      { action: 'down', x: cx, y: cy },
      { action: 'wait', ms: 600 },
      { action: 'up' },
    ]);
    // ContextMenu の role="menu" が表示される
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible({ timeout: 1000 });
    // 4 項目すべて menuitem で出る
    const items = menu.locator('[role="menuitem"]');
    await expect(items).toHaveCount(4);
  });

  test('短い tap (< 500ms) では menu が開かない', async ({ page }, testInfo) => { ... });

  test('長押し後に「削除」を tap → annotation が消える', async ({ page }, testInfo) => { ... });

  test('長押し後に「複製」を tap → annotation が 2 個になる', async ({ page }, testInfo) => { ... });

  test('長押し後に「前面」/「背面」を tap → createdAt 更新で z-order 変動', async ({ page }, testInfo) => { ... });
});
```

### MANUAL_QA_RENAME_AND_EXTEND (docs 拡張)

```text
SOURCE (BEFORE): docs/qa/phase-10-i-touch-manual-qa.md (既存、19 ケース + 誤操作率 + hit + 同期 + CWV)

AFTER:
- ファイル名 rename: `phase-10-j-touch-manual-qa.md`
- §1 19 ケースは Phase 10.I-4 表記を「Phase 10.I-4 + 10.J 確認」に更新
- §1 末尾に「Phase 10.J 追加チェック」セクション追加:
  - 矩形 / 矢印 / ハイライト / テキストを **シングルタップで選択できる** (onTap 経路、Phase 10.I で破綻していた点)
  - 矩形 / 矢印 / ハイライト / テキストを **500ms 長押しで context menu が開く** (Phase 10.J-2 新規)
  - 長押しメニューの 4 項目 (削除 / 複製 / 前面 / 背面) すべてが意図通り動作
  - Transformer 角ハンドルが **20px 視覚 + 実効 ~44px tap zone** (Phase 10.J-3、隣接 shape を覆わない)
  - text 編集中は長押しメニューが開かない (ADR-0007 D4、edit-mode protection)
- §6 既知の問題 / 推奨事項に Phase 10.J 検証で発見した issue 欄を追加 (空欄)
- §7 完了チェックリストに 10.J 追加項目分を追加
```

### UMBRELLA_REPORT_STRUCTURE (新規 report のひな形)

```text
SOURCE (PATTERN): .claude/PRPs/reports/phase-10-i-umbrella-report.md

AFTER (NEW): .claude/PRPs/reports/phase-10-j-umbrella-report.md
- §1 PRD Acceptance Criteria 達成度 (table、自動 ✅ / 手動 ⚠ pending)
- §2 Sub-phase deliverable (10.J-1 / J-2 / J-3 / J-4 各々で commit hash + plan link + report link + 主要成果物)
- §3 Phase 内で発見された未解決事項 / 次フェーズへの引き継ぎ
  - 並列 5 workers での setupEditor flaky (Phase 10.J-3 で観察、本 plan で対処せず punch-list に)
  - `HIT_TEST_MARGIN_PX = 8` の実 runtime 消費 (forward-looking、必要時に Arrow / Highlight `hitFunc` 拡張)
  - paired binding ESLint custom rule (Phase 11+ retainer)
- §4 工数 retrospective (commit 数 + LOC + duration、10.J 全体で)
- §5 Decisions Log (PRD の Decisions Log を継承、本 plan で確定した点があれば追記)
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/e2e/fixtures/touch-helpers.ts` | UPDATE | `dispatchTouchEvent` / `touchSequence` 追加 + `tapStage` / `dragOnStage` を内部で touch 経路に書き換え + `setupEditor` を helper に逃がす (現状各 spec で重複している) |
| `apps/web/e2e/touch-paired-binding.spec.ts` | CREATE | 4 Shape × paired binding sanity (4 ケース、各 shape を tap で選択できる) |
| `apps/web/e2e/touch-long-press-menu.spec.ts` | CREATE | 500ms long-press → menu 開閉 + 4 項目動作 (5 ケース、open / short tap / 削除 / 複製 / 前面背面) |
| `docs/qa/phase-10-i-touch-manual-qa.md` | DELETE → CREATE | rename to `phase-10-j-touch-manual-qa.md` + Phase 10.J 項目追記 |
| `docs/qa/phase-10-j-touch-manual-qa.md` | CREATE | 上記 |
| `.claude/PRPs/reports/phase-10-j-umbrella-report.md` | CREATE | Phase 10.J 全体の umbrella report (実機 QA は ⚠ で pending、人間 ceremony) |
| `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` | UPDATE | 10.J-4 行 Status を `pending` → `complete` (auto 部分) / `⚠ 実機 QA pending`、Plan link 追加 |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase テーブルで Phase 10.J 行を complete に (もしあれば) |
| `.claude/PRPs/plans/completed/` | MOVE | 10.J-1 / J-2 / J-3 / J-4 plan を `completed/` へ archive (umbrella report 起票後) |

## NOT Building

- **既存 spec の本文書き換え** — `tapStage` / `dragOnStage` を helper 側で touch 化することで、各 spec は無編集で migration される。spec 本文の grep に `page.mouse` が直接出るのは `touch-acceptance-edit.spec.ts` の endpoint Circle drag 部分のみで、これは別 helper (`endpointDragViewport`) を新設して移行
- **paired binding ESLint custom rule** — Phase 10.J-1 NOT Building 継承
- **`HIT_TEST_MARGIN_PX = 8` の実 runtime 消費 (`hitFunc` 拡張)** — 10.J-3 NOT Building 継承
- **CDPSession `Input.dispatchTouchEvent` 経路** — `dispatchEvent` で十分。CDPSession は Chromium 専用で WebKit/Firefox に展開できない。本 repo は Playwright 内 default 経路 (Chromium) のみを CI 対象
- **multi-touch (pinch zoom) の本物 touch event 化** — `touch-pinch-zoom.spec.ts` は既に Phase 10.I-2 で `Touch` を 2 つ載せた dispatchEvent を使っている。本 plan では再確認のみで再書き換えしない
- **Tailwind `min-w-11 min-h-11` の lint 整合 hook** — Phase 10.J-3 punch-list に継承
- **mobile→PC リアルタイム共同編集 E2E 自動化** — 多 page test は flaky 度が高く、人間レイヤー (manual QA §4) で消費する PRD 設計を維持
- **CWV (LCP / INP / CLS) の自動測定** — Lighthouse 自動化は CI runner の安定性問題が大きい、Phase 10.G の Cloudflare Web Analytics 1 ヶ月観察で代替する PRD 設計を維持
- **実機 QA そのものの assistant による実施** — 人間 ceremony。assistant は `docs/qa/phase-10-j-touch-manual-qa.md` を「埋めれば pass 判定できる状態」に整備するまでが scope

---

## Step-by-Step Tasks

### Task 1: `touch-helpers.ts` に `dispatchTouchEvent` + `touchSequence` を追加

- **ACTION**: `apps/web/e2e/fixtures/touch-helpers.ts` の末尾に 2 関数を追加
- **IMPLEMENT**: `TOUCH_EVENT_DISPATCH` (上記 Patterns to Mirror) のとおり
- **MIRROR**: 既存 `getStageBox` / `dragOnStage` の Page 引数 + JSDoc スタイル
- **IMPORTS**: `Page` (`@playwright/test`、既存)
- **GOTCHA**:
  - `Touch` constructor は `target` 必須、`document.elementFromPoint(x, y)` で取得 (null フォールバック必要)
  - `touchend` / `touchcancel` の `touches` / `targetTouches` は空配列 (MDN 仕様)
  - `Event.isTrusted = false` は本 repo では問題なし (Phase 10.J-1 で grep ゼロ件確認済)
- **VALIDATE**:
  - `grep -n "dispatchTouchEvent\|touchSequence" apps/web/e2e/fixtures/touch-helpers.ts` で 4 件以上 (定義 2 + jsdoc 内引用)
  - `pnpm -F @pitamark/web typecheck` 緑

### Task 2: `tapStage` / `dragOnStage` を内部で touch 経路に書き換え

- **ACTION**: 既存 helper の関数 body を `touchSequence` 呼び出しに置換 (signature 不変)
- **IMPLEMENT**: `TAP_STAGE_REWRITE` / `DRAG_ON_STAGE_REWRITE` (上記 Patterns to Mirror) のとおり
- **MIRROR**: 既存 box.x / box.y 加算ロジックは維持、内部実装のみ touch event に書き換え
- **GOTCHA**:
  - signature を変えない (既存 19 spec の呼び出しが無編集で動くこと)
  - `dragOnStage` の中間 5 点は既存挙動 (`page.mouse.move(..., { steps: 5 })`) と同等の中間描画を再現
- **VALIDATE**:
  - `pnpm -F @pitamark/web exec playwright test --project=mobile-chrome touch-acceptance.spec.ts` 全 12 緑 (helper 書き換えで spec が壊れないこと)
  - `pnpm -F @pitamark/web exec playwright test --project=mobile-chrome touch-acceptance-edit.spec.ts` 全 7 緑

### Task 3: endpoint Circle drag 用 helper 新設 (touch-acceptance-edit.spec.ts 内の `page.mouse` 直接呼びを掃除)

- **ACTION**: `touch-helpers.ts` に `dragViewport(page, startViewport, endViewport)` を追加し、touch-acceptance-edit.spec.ts の endpoint-1 / endpoint-2 / resize-1 / resize-2 spec 内の `page.mouse.move/down/move/up` を helper 呼び出しに置換
- **IMPLEMENT**:
  ```ts
  /** viewport 座標 (= box.x + screen) で touch drag。
   * Transformer anchor / endpoint Circle のように logical → screen → viewport 変換が
   * 既に済んでいる経路で使う。中間 5 点で Konva の draft 描画を正確に再現。 */
  export const dragViewport = async (page: Page, start: { x: number; y: number }, end: { x: number; y: number }) => {
    const mid = (i: number) => ({
      x: start.x + ((end.x - start.x) * i) / 5,
      y: start.y + ((end.y - start.y) * i) / 5,
    });
    await touchSequence(page, [
      { action: 'down', x: start.x, y: start.y },
      { action: 'move', ...mid(1) },
      { action: 'move', ...mid(2) },
      { action: 'move', ...mid(3) },
      { action: 'move', ...mid(4) },
      { action: 'move', x: end.x, y: end.y },
      { action: 'up' },
    ]);
  };
  ```
- **MIRROR**: `dragOnStage` の中間 5 点パターン
- **GOTCHA**:
  - `touch-acceptance-edit.spec.ts` の resize / endpoint 4 spec で 4 ヶ所、ほぼ同一の `page.mouse.move(...); page.mouse.down(); page.mouse.move(..., {steps:5}); page.mouse.up();` パターンが存在。すべて `dragViewport(page, start, end)` に置換
  - `dbltap-text` spec は **double tap** なので `touchSequence` で `down → up → down → up` の 4 ステップ (Konva の `dblTapWindow` = 400ms 以内 + 同位置を満たす)
- **VALIDATE**:
  - `grep -n "page.mouse" apps/web/e2e/touch-acceptance-edit.spec.ts` でゼロ件 (helper に逃がしたため)
  - `pnpm -F @pitamark/web exec playwright test --project=mobile-chrome touch-acceptance-edit.spec.ts` 全 7 緑

### Task 4: `setupEditor` を helper に逃がす (重複削除)

- **ACTION**: `touch-acceptance.spec.ts` / `touch-acceptance-edit.spec.ts` で同一実装の `setupEditor` を `touch-helpers.ts` に export し、両 spec で import に置換
- **IMPLEMENT**: helper に追加し、各 spec の private 定義を削除
- **MIRROR**: なし (リファクタリング)
- **GOTCHA**:
  - 並列負荷の flaky (Phase 10.J-3 で観察) は本 task では対処せず、umbrella report の引き継ぎ事項に記録
- **VALIDATE**:
  - `grep -n "const setupEditor" apps/web/e2e/touch-acceptance*.spec.ts` でゼロ件 (helper に集約)
  - 両 spec が緑

### Task 5: `touch-paired-binding.spec.ts` を新設

- **ACTION**: 4 Shape × paired binding sanity の 4 ケースを新規 spec として実装
- **IMPLEMENT**: `NEW_SPEC_PAIRED_BINDING` (上記 Patterns to Mirror) のとおり、各 shape を tap → 選択 dispatch が走り Transformer / 編集 UI が出ることを assert
- **MIRROR**: `touch-acceptance.spec.ts` の `move:` テストの「shape add → select ツール → tap → 操作」パターン
- **GOTCHA**:
  - 既存 `touch-acceptance.spec.ts` move/delete テストも paired binding を踏んでいる (Task 2 の helper 書き換え後)。重複は許容するが、本 spec は **paired binding を直接 assert** する目的で「Transformer が表示される」までを確認
  - `Transformer` の存在検証は Konva DOM 上では複数 `<canvas>` (背景 + annotation + transformer) が出るため、selection state を `window.__SNAP_SHARE_ANNOTATIONS__` または Konva の内部 stage から確認する
  - text shape は Transformer を持たない (TextShape は `KonvaText` ベース)。text の selection 確認は `TextEditorOverlay` の visibility か、annotation の `isSelected` 派生 state
- **VALIDATE**:
  - `pnpm -F @pitamark/web exec playwright test --project=mobile-chrome touch-paired-binding.spec.ts` 全 4 緑

### Task 6: `touch-long-press-menu.spec.ts` を新設

- **ACTION**: long-press menu の 5 ケース (open / short tap で開かない / 削除 / 複製 / 前面背面) を実装
- **IMPLEMENT**: `NEW_SPEC_LONG_PRESS_MENU` (上記 Patterns to Mirror) のとおり、`touchSequence` の `wait: 600ms` で長押し成立 → `[role="menu"]` 表示 → 各項目を `getByRole('menuitem', { name: ... })` で tap
- **MIRROR**: ContextMenu.tsx の `role="menu"` / `role="menuitem"` 構造、ContextMenu.test.tsx の i18n key 経由 label
- **GOTCHA**:
  - Touch event 経由で menu を開くには `touchstart` の target が shape 内である必要 → `dispatchTouchEvent` 内 `document.elementFromPoint` が `<canvas>` を返すこと前提
  - 「削除」は destructive variant (色違い) だが role / accessible name は同じ
  - 「複製」後の z-order: 案 B (createdAt 流用) で実装済 → annotation 配列の length が +1 になることのみを assert (z-order までは本 spec 範囲外、既存 reducer test が担保)
  - 「前面 / 背面」は createdAt の更新 → 配列内 index の変動を assert
  - 短い tap (< 500ms) は `touchSequence` の `wait: 100ms` で再現
- **VALIDATE**:
  - `pnpm -F @pitamark/web exec playwright test --project=mobile-chrome touch-long-press-menu.spec.ts` 全 5 緑

### Task 7: `docs/qa/phase-10-i-touch-manual-qa.md` を rename + Phase 10.J 拡張

- **ACTION**: `git mv docs/qa/phase-10-i-touch-manual-qa.md docs/qa/phase-10-j-touch-manual-qa.md` した上で、§1 末尾に「Phase 10.J 追加チェック」セクションを追加
- **IMPLEMENT**: `MANUAL_QA_RENAME_AND_EXTEND` (上記 Patterns to Mirror) のとおり、6 項目 + 既知問題欄 + 完了チェックリスト更新
- **MIRROR**: 既存 §1 のテーブル形式 (iPhone Safari / Android Chrome の 2 列)
- **GOTCHA**:
  - rename は `git mv` で履歴を保つ
  - 既存 §1 のチェックボックス `☐` をそのまま継承、新規 6 項目も `☐` 空で起票 (人間が埋める)
  - §6 既知の問題 / 推奨事項に「Phase 10.J 検証で発見した issue」欄を追加 (空欄)
- **VALIDATE**:
  - `git log --follow docs/qa/phase-10-j-touch-manual-qa.md` で過去の commit を辿れる (rename 履歴が保たれる)
  - `grep -n "Phase 10.J 追加チェック" docs/qa/phase-10-j-touch-manual-qa.md` で 1 件以上

### Task 8: `phase-10-j-umbrella-report.md` を新設

- **ACTION**: `.claude/PRPs/reports/phase-10-j-umbrella-report.md` を新規作成し、Phase 10.J 全体の集約 report を起票
- **IMPLEMENT**: `UMBRELLA_REPORT_STRUCTURE` (上記 Patterns to Mirror) のひな形を `phase-10-i-umbrella-report.md` 構造に合わせて埋める
- **MIRROR**: `phase-10-i-umbrella-report.md` の §1-§5 構造
- **GOTCHA**:
  - 実機 QA は assistant では実施できないため §1 Acceptance Criteria 表で `⚠ (手動 docs/qa 待ち)` と明示。manual QA doc を埋めた著者が後追いで report を更新する設計
  - 工数 retrospective は git log から自動算出可: `git log --oneline main..HEAD --shortstat | grep -E "files? changed" | awk ...`
  - sub-phase ごとの report link: 10.J-1 / J-2 / J-3 / J-4 個別 report は Phase 10.I と同様 **作成しない方針** (PRD の workflow conventions セクション「Phase 9 以降から umbrella report 必須」は維持しつつ、sub-phase 個別 report は Phase 10.I で省略済の前例を継承)
- **VALIDATE**:
  - `ls .claude/PRPs/reports/phase-10-j-umbrella-report.md` でファイル存在
  - 内容が `phase-10-i-umbrella-report.md` と同等の depth (1500-2500 LOC 程度)

### Task 9: PRD の 10.J-4 行 + Phase 10.J 全体 status 更新

- **ACTION**: `.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` の 10.J-4 行を更新 + 全 Phase 10.J の status を整理
- **IMPLEMENT**:
  - 10.J-4 Status: `pending` → `complete (CI auto: typecheck/lint/test/biome ci/E2E すべて緑、実機 QA は docs/qa 待ち)`
  - 10.J-4 PRP Plan: `TBD` → `[plan](../plans/phase-10-j-4-e2e-migration-and-manual-qa.plan.md)`
  - PRD 末尾の Status を `DRAFT` → `IMPLEMENTED — 実機 QA pending`
- **MIRROR**: Phase 10.I PRD の最終 Status 行
- **GOTCHA**:
  - PRD は merge 前 (= ブランチ上) でも `IMPLEMENTED` 表記に進める。merge 時には複数 commit を含む
- **VALIDATE**:
  - `grep -n "10.J-4" .claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md` で Status / Plan link 更新確認

### Task 10: `snap-share.prd.md` Phase テーブルを Phase 10.J 完了で更新

- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` の Phase status table で Phase 10.J 行を `complete` に更新 (もし行があれば。なければ追加)
- **IMPLEMENT**: 既存 Phase 10.I 行のフォーマットに合わせる
- **MIRROR**: Phase 10.I 行
- **GOTCHA**:
  - Phase 10.J が PRD merge 後の作業順序として 10.K (= 既存 Phase 10.G analytics) より先に行く位置で table に存在することを確認
- **VALIDATE**:
  - `grep -n "Phase 10.J\|10\\.J" .claude/PRPs/prds/snap-share.prd.md` で 1 件以上

### Task 11: 完成済 plan を `completed/` に archive

- **ACTION**: `git mv .claude/PRPs/plans/phase-10-j-{1,2,3,4}-*.plan.md .claude/PRPs/plans/completed/`
- **IMPLEMENT**: 4 ファイル move
- **MIRROR**: Phase 10.I の plan archive (`.claude/PRPs/plans/completed/phase-10-i-*.plan.md`)
- **GOTCHA**:
  - Phase 10.J-4 plan も完了後 archive 対象 (= 本 plan 自身)
  - umbrella report からの link が壊れないよう、report 内の plan link を `../plans/completed/...` に更新
- **VALIDATE**:
  - `ls .claude/PRPs/plans/phase-10-j-*.plan.md` で 0 件 (全 archive 済)
  - `ls .claude/PRPs/plans/completed/phase-10-j-*.plan.md` で 4 件

### Task 12: 全 spec / unit / typecheck / lint で final 緑確認

- **ACTION**: 全 validation コマンドを sequential 実行
- **IMPLEMENT**:
  ```bash
  pnpm typecheck
  pnpm lint
  pnpm test
  pnpm -F @pitamark/web test:e2e
  pnpm -F @pitamark/web build
  ```
- **GOTCHA**:
  - 並列 5 workers で setupEditor flaky が出る場合は umbrella report の引き継ぎ事項に記録、本 plan で対処せず
  - mobile-chrome project の新規 spec (paired binding 4 + long-press menu 5 = 9 件) が緑
- **VALIDATE**:
  - 各コマンドが exit 0
  - mobile-chrome project の合計 = 22 (既存) + 9 (新規) = 31 件、全緑

### Task 13: Draft PR #22 → Ready for review に切替

- **ACTION**: PR #22 を `gh pr ready 22` で Ready for review に切替
- **IMPLEMENT**: `gh pr ready 22` (実機 QA 完了後の人間 ceremony として、本 plan では準備のみ)
- **GOTCHA**:
  - 実機 QA が `docs/qa/phase-10-j-touch-manual-qa.md` で 100% 通過していない場合は Ready 化しない
  - 実機 QA pending のままで Ready にしたい場合は umbrella report に明記し、reviewer に手動 QA pending を周知する PR description を更新
- **VALIDATE**:
  - 実機 QA 完了確認後、`gh pr view 22 --json isDraft -q .isDraft` が `false`

---

## Testing Strategy

### Unit Tests

本 plan は E2E 中心、unit test の追加はなし (helper の `dispatchTouchEvent` は環境依存の Touch API のため単体 mock しづらい、E2E spec で動作確認すれば十分)。

### E2E (新規)

| Test | Project | Expected | Notes |
|---|---|---|---|
| `touch-paired-binding.spec.ts` × 4 | mobile-chrome | 全緑 | 各 shape を tap で選択 |
| `touch-long-press-menu.spec.ts` × 5 | mobile-chrome | 全緑 | open / short tap / 削除 / 複製 / 前面背面 |

### E2E (既存、非劣化)

| Project | Test count | Expected |
|---|---|---|
| chromium | 78 (10.I 時点) | 全緑、touch event 経路に書き換えても desktop は影響なし |
| mobile-chrome | 22 (10.I 時点) → 31 (10.J-4 後、+9) | 全緑、helper 書き換え後も既存 19 件は無編集で動作 |

### Edge Cases Checklist

- [ ] `touchSequence` の `wait` は内部で `page.waitForTimeout` を使うため Konva の useLongPress timer (500ms) と競合しない
- [ ] `dispatchTouchEvent` の `document.elementFromPoint(x, y)` が canvas を返す (margin / padding / overlay の影響を受けない)
- [ ] `touchend` の `touches` 空配列が Konva の `tap` 検出を正しく triggrer する
- [ ] paired binding spec で text shape の選択は Transformer ではなく `TextEditorOverlay` 非表示 + annotation `isSelected: true` で確認
- [ ] long-press menu spec で 「短い tap (< 500ms)」では menu が開かない (negative case 確認)

---

## Validation Commands

### Static Analysis
```bash
pnpm typecheck
pnpm lint
```
EXPECT: Zero type errors / biome ci errors。

### Unit Tests
```bash
pnpm test
```
EXPECT: 401 件 (10.J-3 時点) 緑のまま。

### E2E (mobile-chrome 中心、回帰 + 新規)
```bash
pnpm -F @pitamark/web exec playwright test --project=mobile-chrome
```
EXPECT: 既存 22 件 + 新規 9 件 = 31 件すべて緑。

### E2E (chromium 非劣化)
```bash
pnpm -F @pitamark/web exec playwright test --project=chromium
```
EXPECT: 78 件全緑 (Phase 10.I 時点と同等)。

### Build
```bash
pnpm -F @pitamark/web build
```
EXPECT: success、bundle size 増加なし (helper 拡張は dev 配下のみ)。

### Manual QA Preparation
- [ ] `docs/qa/phase-10-j-touch-manual-qa.md` が rename + Phase 10.J 項目追加で起票済
- [ ] `phase-10-j-umbrella-report.md` が起票済 (実機 QA は ⚠ pending)
- [ ] PR #22 description に「実機 QA 状況」セクションがあり、人間 ceremony が明示されている

---

## Acceptance Criteria

- [ ] Task 1 (`dispatchTouchEvent` + `touchSequence`) 完了 + helper export 4 件 (既存 5 + 新規 2 + setupEditor 移管 1)
- [ ] Task 2 (`tapStage` / `dragOnStage` 内部書き換え) 完了 + signature 不変
- [ ] Task 3 (`dragViewport` 新設 + `touch-acceptance-edit.spec.ts` 内 page.mouse 一掃) 完了 + grep ゼロ件
- [ ] Task 4 (`setupEditor` helper 化) 完了 + 重複削除
- [ ] Task 5 (`touch-paired-binding.spec.ts` 4 件) 完了 + 全緑
- [ ] Task 6 (`touch-long-press-menu.spec.ts` 5 件) 完了 + 全緑
- [ ] Task 7 (`phase-10-j-touch-manual-qa.md` rename + 拡張) 完了
- [ ] Task 8 (`phase-10-j-umbrella-report.md` 起票) 完了
- [ ] Task 9 (PRD 10.J-4 行 + 全体 status) 完了
- [ ] Task 10 (`snap-share.prd.md` Phase 10.J 行 update) 完了
- [ ] Task 11 (plan archive) 完了 + 4 ファイル `completed/` に
- [ ] Task 12 (typecheck / lint / test / e2e / build) すべて緑
- [ ] Task 13 (PR Ready for review、実機 QA 完了後) 人間 ceremony として準備状態

## Completion Checklist

- [ ] Code follows discovered patterns
- [ ] Error handling matches codebase style
- [ ] Logging follows codebase conventions
- [ ] Tests follow test patterns
- [ ] No hardcoded values
- [ ] Documentation updated (manual QA + umbrella report)
- [ ] No unnecessary scope additions

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `dispatchTouchEvent` で `document.elementFromPoint` が canvas を返さない | Low | High | viewport 座標が正しく canvas 領域内であれば `<canvas>` が返る (overlay や fixed element がない設計)。failed なら Plan の Open Question にエスカレート |
| 既存 19 spec が helper 書き換えで red 化 | Medium | High | Task 2 完了後 sequential validation で即検知。red 化したら touch event 詳細 (`force` / `radiusX` 等) を Konva 内部実装と照合して調整 |
| 並列 5 workers で setupEditor flaky | High (10.J-3 で観察) | Low | umbrella report の引き継ぎ事項に記録、本 plan では対処しない (workers 数調整 / spec serialize は Phase 11+ retainer) |
| `touch-long-press-menu.spec.ts` で z-order assertion が flaky | Medium | Medium | createdAt 更新タイミングは reducer + Y.UndoManager の commit 順序に依存。`expect.poll` で eventual consistency を許容 |
| 実機 QA が著者では時間取れない | Medium | Medium | umbrella report で `⚠ pending` を明記、PR description で reviewer に周知。Ready 化は実機 QA 完了後に人間 ceremony |
| Konva の `tap` 検出が `touchstart` → `touchend` を 1 set として認識しない | Low | High | Konva 公式ドキュメントで `tap` = `touchstart` + (move 距離 < 5px) + `touchend` で発火する仕様。`touchSequence` が忠実に再現する設計 |

## Notes

### `dispatchEvent` 経路と `page.touchscreen.tap` の比較

Playwright には `page.touchscreen.tap(x, y)` という built-in API もある。これは内部で本物の touch event 経路を使うが、**single tap 専用**で long-press / drag / multi-touch には対応しない。本 plan は包括的な touch 制御が必要なため `dispatchEvent` を default にする (ADR-0007 D5 と整合)。

### Phase 10.J が PRD 単位 1 PR の流儀

10.J-1 / J-2 / J-3 / J-4 は同一ブランチ `phase-10-j-touch-ux-standards` (Draft PR #22) で進める。本 plan の 13 タスクで 1-2 コミット程度を想定。実機 QA pending での merge は umbrella report に明記し、reviewer に明示。

### Manual QA を assistant が実施できない理由

`docs/qa/phase-10-j-touch-manual-qa.md` の §2 誤操作率 / §3 handle hit / §4 mobile→PC 同期 / §5 CWV はすべて **物理的な指 tap + 主観的な操作感の評価** が必要。assistant は Plan / spec / docs を準備するまでが scope で、実機 ceremony は著者 + 知人 1 名で消費する設計。
