# Local Code Review: Phase 8 — テスト網羅 (#8)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: `apps/web/e2e/*.spec.ts` (20 ファイル / 2,373 行) + `apps/web/src/**/__tests__/` (32 ファイル / 277 tests) + `apps/api/src/**/__tests__/` (17 ファイル / 157 tests) + `packages/shared/src/__tests__/` (3 ファイル / 68 tests) + `playwright.config.ts` / vitest 設定
**Decision**: NEEDS_FIX
  - MEDIUM 3 件（カバレッジ計測不能 / state identity テスト未追加 / `waitForTimeout` 使用）を Phase 8.x で対応

## Summary

スイート全体 (web 277 + api 157 + shared 68 = **502 tests**) は全緑、E2E は 20 spec / 2,373 行が存在する。Golden path の 4 軸はいずれも 1 件以上の E2E spec でカバーされており、Phase 7.6 hotfix の回帰防止 E2E も適切に設置されている。discriminated union 全パターンの unit test は `packages/shared/src/__tests__/annotation.test.ts` および `operations.test.ts` / `yjs-mutations.test.ts` / `yjs-annotations-context.test.ts` で網羅されており、LOCAL_ORIGIN UndoManager の origin tracking も unit テストが存在する。

一方、3 点の MEDIUM 問題がある。(1) `@vitest/coverage-v8` が未インストールで `--coverage` コマンドが実行不可能であり、80% カバレッジ目標の**達成/未達成が数値として確認できない**。目視では `useAnnotationsStore` / `useYjsAnnotationsStore` / `useImageSource` / `useExportPng` / `TextShape` / `AnnotationLayer` / `CanvasStage` / `TextEditorOverlay` を含む 20 ファイル以上に unit test が存在せず、実測では 80% 未達の可能性が高い。(2) Phase 7.8-3 M1 修正後に推奨された「`annotation/set-font-size` が non-text を対象にしたとき state 全体が同一参照を返す」テストが未追加であり、handler 側の gate が regression した場合に検出できない。(3) `annotation-tools.spec.ts` で Y.UndoManager の captureTimeout 分離を目的とした `waitForTimeout(700)` が 2 件あり、ルールで禁じている timeout-based assertion に相当する。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1: `@vitest/coverage-v8` 未インストールで 80% カバレッジ目標が計測不能**

- **Location**: `apps/web/vite.config.ts:test` ブロック (coverage プロバイダー未設定) + `pnpm-workspace.yaml` (`catalog:` に `@vitest/coverage-v8` 未収録)
- **Issue**: `pnpm -F @snap-share/web test -- --coverage` を実行すると `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'` で即時失敗する。`common/testing.md` が定める 80% カバレッジ目標は計測不可能な状態が継続している。目視調査では以下の **未テストファイル** が確認されており、実測カバレッジが 80% を大きく下回る可能性が高い:
  - `src/hooks/useAnnotationsStore.ts` — reducer + history を組み合わせた中核 hook。
  - `src/hooks/useYjsAnnotationsStore.ts` (200 LOC) — Yjs path の複合 hook。
  - `src/hooks/useImageSource.ts` — D&D / paste → ObjectURL 変換の実装。
  - `src/hooks/useExportPng.ts` — PNG 書き出しの実装。
  - `src/components/canvas/CanvasStage.tsx` (537 LOC) — 中核キャンバス。
  - `src/components/canvas/shapes/TextShape.tsx` — 4 種 shape のうち unit test のみ存在しない。
  - `src/components/canvas/TextEditorOverlay.tsx` — テキスト編集の DOM 実装。
  - `src/components/canvas/AnnotationLayer.tsx` — shape dispatcher。
  - `src/pages/EditorShell.tsx` (542 LOC) / `LocalEditor.tsx` / `RoomEditor.tsx`。

- **Suggested Fix**:
  1. `pnpm-workspace.yaml` の `catalog:` に `@vitest/coverage-v8: catalog:` を追加し、`apps/web/package.json` から参照する。
  2. `apps/web/vite.config.ts` の `test:` ブロックに `coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['src/**/*.{ts,tsx}'], exclude: [...] }` を追加。
  3. `pnpm test:coverage` スクリプトを `package.json` に追加し CI で計測する。
  4. 80% 未達の場合は主要 hook (`useAnnotationsStore` / `useImageSource` / `useExportPng`) を対象に unit test を追加する。

**M2: `annotation/set-font-size` non-text state identity テストが未追加**

- **Location**: `apps/web/src/hooks/__tests__/annotationsReducer.test.ts`（`annotationsReducer.annotation/set-font-size` describe の "is a no-op for non-text annotations" テスト）
- **Issue**: Phase 7.8-3 M1 修正で `annotationsReducer` は `setFontSize` が non-text を no-op（同一参照を返す）実装を持つが、`annotationsReducer` 側は `{ ...state, annotations: setFontSize(...) }` で**常に新しい state object を生成**する。現状のテストは `next.annotations[0]).toBe(rect)` のみ確認しており、`next !== seeded`（state identity が保たれない）を検知できない。Phase 7.8-3 review の Suggested Fix が明示した以下のテストが未追加:
  ```typescript
  it('returns same state when annotation/set-font-size targets non-text id', () => {
    const seeded = seedWith([rect]);
    const next = annotationsReducer(seeded, {
      type: 'annotation/set-font-size',
      id: 'r1',
      fontSize: 24,
    });
    // state identity チェック — handler 側 gate のない経路で空 undo step が生じないか
    // reducer 自体が防いでいることを担保する（現状は handler gate に依存）
    // 注: 現 reducer 実装は防がないので、このテストは今は RED になる。
    // 修正方針: operations.setFontSize が同一参照を返す場合は reducer でも
    // early-return してもよい（handler gate と二重防御になるが、安全側）。
    expect(next.annotations).toBe(seeded.annotations);
  });
  ```
  現実装では `annotations` 参照は同一（`setFontSize` が non-text で同一参照を返す）なので `next.annotations === seeded.annotations` だが、`next !== seeded` である（state object は新規生成）。将来 reducer 実装が変更されたとき、この gap が空 undo step 再発の検出漏れになる。

- **Suggested Fix**: 上記テストを `annotationsReducer.test.ts` に追加。同時に `operations.setFontSize` が non-text で **annotations 配列も同一参照を返すか** を `operations.test.ts` で検証済みなことを確認（現在 `expect(next[0]).toBe(rect)` のみで配列 identity を確認していない）。

**M3: `annotation-tools.spec.ts` の `waitForTimeout(700)` が brittle**

- **Location**: `apps/web/e2e/annotation-tools.spec.ts:163, :173`
- **Issue**: Y.UndoManager の `captureTimeout: 500ms` を超えるために `await page.waitForTimeout(700)` を 2 箇所で使用している。`web/testing.md` が「Avoid flaky timeout-based assertions; prefer deterministic waits」を定めているにもかかわらず、絶対時間 sleep に依存している。低スペック CI 環境や負荷の高い並列実行時に 700ms が不足してテストが flaky になるリスクがある。
- **Repro**: 低速 CI 環境で E2E を並列実行すると、captureTimeout が 700ms 内に収まらず 1 回の Undo で 2 件分が巻き戻る可能性がある（flaky）。
- **Suggested Fix**:
  ```typescript
  // 案 1: captureTimeout をテスト専用に 0ms に設定して確定的に分離
  // (yjs-annotations-context.ts の UndoManager 初期化に環境変数 or test-only
  //  export で captureTimeout を渡せるようにする)
  
  // 案 2: window.__SNAP_SHARE_ANNOTATIONS__ の length が 1 に安定した後、
  //  undo stack サイズを window hatch 経由で観測して分離完了を確認する
  
  // 案 3: 許容範囲を広げて waitForTimeout(1500) にするだけでも flaky rate は下がるが
  //  根本解決ではない。最小コストは案 3、長期的推奨は案 1 (captureTimeout=0 を
  //  テスト環境でのみ適用)。
  ```

### LOW

**L1: `useAnnotationsStore` / `useYjsAnnotationsStore` の direct unit test が存在しない**

- **Location**: `apps/web/src/hooks/useAnnotationsStore.ts` / `useYjsAnnotationsStore.ts`（テストファイル無し）
- **Issue**: これら 2 hook は `annotationsReducer` + `historyReducer` / Yjs context を橋渡しする central glue であり、`annotationsReducer.test.ts` や `yjs-annotations-context.test.ts` が各ピースを独立に検証しているが、統合した際の「dispatch → reducer → history → storeRef 更新」の連鎖は E2E のみがカバーしている。hook 自体の unit test が存在しないため、フック内のバグが E2E に依存したコストの高いサイクルでしか発見できない。
- **Suggested Fix**: `@testing-library/react` を使った renderHook ベースの smoke test を追加する。最低限「dispatch(add) → state.annotations に 1 件増える」「dispatch(undo) → past が 1 件減る」の 2 件で dispatch → state の連鎖を確認する。
- **Human Friction**: true
  - 改修時必読: yes — `useAnnotationsStore` は EditorShell / LocalEditor など中核 page から必ず読まれる
  - 再発生コスト: med — hook 仕様変更時に E2E の失敗でしか検知できず修正コストが高い
  - 認知負荷増: yes — glue hook に test がないと「どこまでがテスト済みか」が読者に不明確

**L2: `TextShape` の unit test が存在しない（4 shape 中唯一）**

- **Location**: `apps/web/src/components/canvas/shapes/TextShape.tsx`（テストファイル無し; 他 3 shape は `ArrowShape.test.tsx` / `RectangleShape.test.tsx` / `HighlightShape.test.tsx` が存在）
- **Issue**: `TextShape` はフォントサイズ / テキスト編集 / 選択状態の Konva Text ノードへの反映を行う。Phase 7.8-3 でフォントサイズ UI が追加されたが、`TextShape` に対する unit test がない状態が継続している。他 3 shape に対する test が存在するため、意図的な省略ではなく取り残しと判断。
- **Suggested Fix**: `ArrowShape.test.tsx` のパターン（`vi.mock('react-konva')` + prop capture）に従って `TextShape.test.tsx` を追加する。検証項目: fontSize prop が Konva Text に渡ること / 選択時 Transformer が現れること / onDragEnd が呼ばれること。
- **Human Friction**: true
  - 改修時必読: yes — テキスト機能は頻繁な改修対象 (fontSize 追加の例あり)
  - 再発生コスト: med — 他 3 shape に test がある中で TextShape だけ空白のため、次の text 機能追加時に同じ gap が再発する
  - 認知負荷増: yes — なぜ TextShape だけ test がないのか読者が疑問を持つ（意図的か見落としか不明）

**L3: Firefox / WebKit の E2E カバレッジがゼロ**

- **Location**: `apps/web/playwright.config.ts:14` (「Firefox / WebKit は Phase 7.5 では追加しない」コメント)
- **Issue**: `playwright.config.ts` は `chromium` + `mobile-chrome` の 2 project のみ。20 スペック中 19 本が `skipNonChromium` で mobile-chrome もスキップしており、実質 chromium 専用 E2E になっている。`web/testing.md` の cross-browser 要件「Minimum: Chrome, Firefox, Safari」に対して Firefox / WebKit が未設定の状態が Phase 7.5 から継続している。コメントは「Phase 8 dogfood 後に拡張判断」と書かれているが Phase 8 に至っても設定されていない。
- **Suggested Fix**: 即急な追加は不要だが、Phase 9 dogfood 後の判断として Firefox (`'Desktop Firefox'`) と WebKit (`'Desktop Safari'`) を `playwright.config.ts` の `projects` に追加する。`skipNonChromium` の多用は Yjs / Konva の cross-browser 挙動差への警戒を反映しているため、最初は `landing.spec.ts` / `room-create.spec.ts` の基本フローのみを cross-browser 対象にし、Konva ヘビーな spec は引き続き chromium-only にする段階的戦略が現実的。
- **Human Friction**: false
  - 改修時必読: no — playwright.config.ts は設定ファイルで実装時に読まない
  - 再発生コスト: low — project 追加は 2〜3 行の追記
  - 認知負荷増: no — コメントで意図的な先送りと明示されている

**L4: `room-mobile.spec.ts` の Linux CI 用 screenshot snapshot が未生成**

- **Location**: `apps/web/e2e/room-mobile.spec.ts:14-17`
- **Issue**: `process.platform !== 'darwin'` の場合はテストをスキップする guard があり、CI (Linux) では実質このテストが常にスキップされる。darwin 用 snapshot (`landing-mobile-mobile-chrome-darwin.png`) のみコミット済みで、コメントには「Phase 8 follow-up で別途生成予定」とある。Phase 8 時点でも未解消。
- **Suggested Fix**: CI 環境 (Linux) で `UPDATE_SNAPSHOTS=1 pnpm test:e2e --update-snapshots` を実行し、`landing-mobile-mobile-chrome-linux.png` を生成してコミットする。または platform skip を廃止して CI 上で snap を生成する workflow step を追加する。
- **Human Friction**: false
  - 改修時必読: no — mobile layout の回帰テストで実装変更時には確認が必要だが、snapshot 生成は 1 回限りの作業
  - 再発生コスト: low — snapshot 生成コマンド 1 回で解消
  - 認知負荷増: no — コメントで先送りと明示

## Validation Results

| Check | Result |
|---|---|
| Web unit tests (vitest run) | Pass — 277 / 277 |
| API unit tests (vitest run) | Pass — 157 / 157 |
| Shared unit tests (vitest run) | Pass — 68 / 68 |
| Coverage 実測 (`--coverage`) | **FAIL** — `@vitest/coverage-v8` 未インストール (M1) |
| E2E (実行確認) | 前回パス (73 passed 記録 / phase-7.8-3-font-size-ui-review より) |

## Golden Path カバレッジ確認

| Golden Path | カバーしている spec |
|---|---|
| 画像 D&D → 注釈 → PNG エクスポート | `golden-path.spec.ts` (キーボード全操作) + `room-create.spec.ts` (PNG download) |
| room 共有 → 別ブラウザ参加 → 同期 | `room-share.spec.ts` (矩形作成が page2 に伝播) |
| password 保護 → ゲート通過 | `room-protected.spec.ts` (誤答 toast + 正答 → エディタ) |
| auto-next 予測 (矢印→テキスト) | `auto-next-arrow-text.spec.ts` (5 ケース) |
| auto-next 予測 (矩形→矢印) | `auto-next-rect-arrow.spec.ts` (9 ケース) |

全 5 Golden Path が 1 件以上の E2E spec でカバー済み。

## Phase 7.6 Hotfix 回帰防止確認

| Hotfix | カバーしている spec |
|---|---|
| 既知-1: ImageLayer crossOrigin=anonymous | `room-export-receiver.spec.ts` (受信側 PNG 保存成功) + `ImageLayer.test.tsx` (useImage 第 2 引数確認) |
| 既知-2: password UI 可視性 (pointer-events) | `landing-password-toggle.spec.ts` (直接 click が通る) |
| 既知-3: clear 挙動 (注釈のみ削除、画像は残る) | `room-clear-image.spec.ts` (toolbar enabled 継続確認) |
| 既知-4: Turnstile 時 validation エラーが消える | `dropzone-validation.spec.ts` (4 ケース) |
| 既知-5: uploader は RoomGate をスキップ | `room-uploader-gate-skip.spec.ts` / `room-protected.spec.ts` 内 page1 assert |

全 5 hotfix が E2E でカバー済み。

## Files Reviewed

| File | Type | Note |
|---|---|---|
| `apps/web/e2e/*.spec.ts` (20 ファイル) | E2E | golden-path / auto-next / validation / room 系 |
| `apps/web/src/**/__tests__/` (32 ファイル) | Unit | hooks / domain / components |
| `apps/api/src/**/__tests__/` (17 ファイル) | Unit | routes / services / lib |
| `packages/shared/src/__tests__/` (3 ファイル) | Unit | annotation / presence / room schema |
| `apps/web/playwright.config.ts` | Config | projects / webServer 定義 |
| `apps/web/vite.config.ts` (test セクション) | Config | vitest 設定 / coverage 未設定 |

## Resolution Update

### Phase 8.x branch `fix/phase-8-x-fixes` (theme 4: quality cleanup)

| Finding | Resolution | Files touched |
|---|---|---|
| **M1** `@vitest/coverage-v8` 未インストール | catalog に追加、`apps/web` / `apps/api` の `package.json` に `catalog:` 参照、`vite.config.ts` / `vitest.config.ts` の `test.coverage` block + `test:coverage` script を追加。`pnpm test:coverage` でレポート生成可能 | `pnpm-workspace.yaml` / `apps/web/package.json` / `apps/api/package.json` / `apps/web/vite.config.ts` / `apps/api/vitest.config.ts` |
| **M2** `annotation/set-font-size` non-text identity test | `annotationsReducer.test.ts` に identity 検証 2 件追加 (non-text id / unknown id)。reducer + `setFontSize` operation 双方を short-circuit 化して green | `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` / `apps/web/src/hooks/annotationsReducer.ts` / `apps/web/src/domain/annotation/operations.ts` |
| **M3** `waitForTimeout(700)` E2E flaky | **Resolved (commit 6)**: `useYjsAnnotationsStore.ts` で `__SNAP_SHARE_STOP_UNDO_CAPTURE__` を DEV ガード window hatch に expose、E2E 2 箇所を `page.evaluate(() => window.__SNAP_SHARE_STOP_UNDO_CAPTURE__?.())` に置換。captureTimeout option 追加より侵襲が小さく、production ビルドで完全に tree-shake される | `apps/web/src/hooks/useYjsAnnotationsStore.ts` / `apps/web/e2e/annotation-tools.spec.ts` |
| L1 / L2 / L3 / L4 (HF=false) | Backlog | — |

(Phase 8.x で修正された後、Phase 8.x 着手側の Plan/Implement で追記)

---
*Generated: 2026-05-04*
*Reviewer: Claude Sonnet 4.6*
