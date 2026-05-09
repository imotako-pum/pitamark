# ADR-0007: Touch UX Standards Compliance — タイミング定数 / event ペアリング規約 / E2E 戦略

**Date**: 2026-05-09
**Status**: Proposed
**Deciders**: imotako (PM/Dev)
**Related**:
- PRD: [`phase-10-j-touch-ux-standards.prd.md`](../../.claude/PRPs/prds/phase-10-j-touch-ux-standards.prd.md)
- 上流: [ADR-0006](./ADR-0006-pointer-events-unification.md) (Pointer Events 一本化、本 ADR の前提) を継承
- 引き継ぎ docs: [`phase-10-j-touch-ux-handoff.md`](../../.claude/PRPs/handoff/phase-10-j-touch-ux-handoff.md)

---

## Context

ADR-0006 で Konva Stage の Pointer Events 一本化 + `touch-action: none` + 2-finger pinch (TouchEvent 経路) を採択し、Phase 10.I で実装。typecheck / unit / E2E (Playwright `mobile-chrome` emulation) は全緑になったが、**実機 (iPhone Safari + Pixel Chrome) で touch UX 業界標準に達していない** ことが 2026-05-09 のユーザー実機検証で判明した。

具体的不足:

1. **Konva の `click` / `dblclick` は mouse 専用イベント** であり、touch では `tap` / `dbltap` が別経路で発火する。Phase 10.I では `<Stage>` の handler (`onMouseDown` → `onPointerDown`) は移行したが、各 Shape (`RectangleShape` / `ArrowShape` / `HighlightShape` / `TextShape`) の `onClick` / `onDblClick` には touch 対の `onTap` / `onDblTap` が bind されていない。結果、実機 iOS Safari で shape を**シングルタップで選択できず**、Transformer が出ず、リサイズも編集モード進入もできない (TextShape `onDblTap` のみ post-review fix で追加済)。
2. **長押しコンテキストメニューが皆無**。ADR-0006 / Phase 10.I PRD では「Excalidraw も誤発火多発のため Won't」と決めたが、業界標準 (Keynote / Google Slides / Figma / Excalidraw / tldraw) では shape の削除 / 複製 / プロパティ変更を long-press → context menu で行うのが既定であり、ツールバーのみでの代替は touch ユーザーの操作効率を著しく落とす。誤発火対策は実装で工夫可能 (押下時間 + 移動量 + visual feedback)。
3. **E2E が emulation 限定**。Phase 10.I-4 で 19 件 (12 受入 + 7 post-review) を Playwright で書いたが、`page.mouse.move/down/up` 経由で発火しており、Chromium 内部では `mousedown/mouseup/click` が出るのみ。実機 iOS Safari の `touchstart/touchend/tap` 経路は触れていない。Phase 10.I-2 の pinch zoom spec のみ CDPSession `Input.dispatchTouchEvent` 経由で実機相当。
4. **タイミング定数 / サイズ定数が散在**。Phase 10.I-2 で `HANDLE_RADIUS_TOUCH` / `ANCHOR_SIZE_TOUCH` / `HIT_STROKE_WIDTH_TOUCH` を `colors.ts` に追加したが、long-press 閾値 / drag slop / double-tap 間隔は未定義。Phase 10.J で context menu を実装する際、各定数の根拠なき決定はバグを誘発する。

業界標準調査 (Konva 公式 / Excalidraw / tldraw v3 / iOS HIG / Material Design 3) は `phase-10-j-touch-ux-handoff.md` の研究結果に集約してあり、本 ADR はその数値根拠の上に立つ。

---

## Decision

以下を採用する。Phase 10.J 各 sub-phase の実装はこの規約に拘束される。

### D1. Konva event ペアリング規約 (canonical)

新規 / 既存 shape の Konva event handler は以下のペアを **両方 bind 必須**:

| 用途 | mouse 系 | touch 系 | 備考 |
|---|---|---|---|
| シングルアクション | `onClick` | `onTap` | shape 選択 / button tap 等 |
| ダブルアクション | `onDblClick` | `onDblTap` | テキスト編集進入 / 図形プロパティモーダル等 |
| 押下開始 (Pointer 一本化外の Shape) | `onMouseDown` | `onTouchStart` | `<Stage>` は ADR-0006 で `onPointerDown` に統一済、Shape 内部は本規約で paired |
| 押下終了 | `onMouseUp` | `onTouchEnd` | 同上 |
| 押下中 | `onMouseMove` | `onTouchMove` | Konva multi-touch (Phase 10.I-2 の `<Stage onTouchMove>`) を除く |

例外: ADR-0006 で確立した `<Stage>` の event handler は **`onPointerDown/Move/Up/Cancel/Leave` 一本化** を維持する (本規約は Shape / 個別 Group / Transformer など Stage 配下の handler に適用)。

実装上の補強として:

- Phase 10.J-1 で **paired binding を強制する仕組み** を導入する。最も軽量な選択肢として、各 Shape の handler 配線を確認する unit test を追加し、CI で `onClick + onTap` / `onDblClick + onDblTap` の両方が bind されていることを assertion する (具体実装は Plan で確定)。
- 将来的に shape 種類が増えた際の漏れ防止として、`apps/web/src/components/canvas/shapes/` 直下に `useShapeEventPair` のような custom hook を導入する選択肢も残す (Phase 11+ 候補)。

### D2. タイミング定数の SSOT

`apps/web/src/lib/touch-thresholds.ts` を新設し、以下を export 定数として一元管理:

```ts
// 概念コード (Phase 10.J-1 で実装)
export const LONG_PRESS_DURATION_MS = 500
export const DOUBLE_TAP_INTERVAL_MS = 300
export const DOUBLE_TAP_POSITION_THRESHOLD_PX = 35
export const DRAG_SLOP_PX_FINE = 4
export const DRAG_SLOP_PX_COARSE = 6
```

根拠 (業界調査結果):

| 定数 | 値 | 根拠 |
|---|---|---|
| `LONG_PRESS_DURATION_MS` | **500** | Excalidraw `TOUCH_CTX_MENU_TIMEOUT` / tldraw `longPressDurationMs` / iOS UIKit `minimumPressDuration` (default 0.5s) / Android `ViewConfiguration.getLongPressTimeout()` 全社一致 |
| `DOUBLE_TAP_INTERVAL_MS` | **300** | Excalidraw `TAP_TWICE_TIMEOUT` / Android `getDoubleTapTimeout()` |
| `DOUBLE_TAP_POSITION_THRESHOLD_PX` | **35** | Excalidraw `DOUBLE_TAP_POSITION_THRESHOLD` |
| `DRAG_SLOP_PX_FINE` | **4** | tldraw `dragDistanceSquared = 16` (= 4²) |
| `DRAG_SLOP_PX_COARSE` | **6** | tldraw `coarseDragDistanceSquared = 36` (= 6²) |

`useTouchDevice()` (Phase 10.I-2 で実装) を経由して fine / coarse を runtime 切替する想定。

### D3. サイズ定数の SSOT

`apps/web/src/components/canvas/colors.ts` の Phase 10.I-2 既追加分を見直し、必要に応じて以下を追加:

| 定数 | 値 | 根拠 |
|---|---|---|
| `MIN_TAP_TARGET_PX` (グローバル) | **44** | iOS HIG (44pt) / Android Material (48dp) の小さい方 + Phase 10.I-3 で導入済の `min-w-11 min-h-11` Tailwind クラスと整合 |
| `TRANSFORMER_ANCHOR_SIZE_FINE` | 既存 anchor 8px (Konva default) | tldraw `handleRadius = 12` よりやや小、デスクトップ非劣化のため変更しない |
| `TRANSFORMER_ANCHOR_SIZE_COARSE` | **20** | tldraw `coarseHandleRadius = 20` (本リポジトリは Phase 10.I-2 で 24px を採用したが、20px に揃え直す = D3 で意思決定) |
| `HIT_TEST_MARGIN_PX` | **8** | tldraw `hitTestMargin` |

注: Phase 10.I-2 で採用済の `ANCHOR_SIZE_TOUCH = 24` はデスクトップ非劣化を優先した spike 値。本 ADR で **20 に再調整** することで業界標準値に揃える (Phase 10.J-3 で実機検証して問題があれば 24 に戻す escape hatch を残す)。

### D4. 長押しコンテキストメニューの仕様

Phase 10.I PRD の Won't「長押しメニュー」を見直し、**Should** に格上げして実装する。仕様:

- **発火条件**: `pointerdown` から **500ms (`LONG_PRESS_DURATION_MS`) 経過** + その間の移動量が **6px 以下 (`DRAG_SLOP_PX_COARSE`)** で、pointer が同じ shape 上にとどまっている
- **キャンセル条件** (ANY one): (a) 移動量 > 6px、(b) `pointerup` が 500ms 以内、(c) 別の touch (multi-touch) が発生、(d) browser system gesture (`pointercancel`) 発火
- **Visual feedback**: 押下中の shape を **250ms かけて opacity 1 → 0.85** に fade。500ms 到達時に context menu が pop。Material Design ripple / iOS haptic は採用しない (実装コスト > 効果)
- **Haptic feedback**: long-press 成立時に `navigator.vibrate(15)` を呼ぶ。Android Chrome のみ反応、iOS Safari は無視されるが害なし
- **メニュー項目** (Phase 10.J-2 の最小スコープ): **削除** / **複製** / **前面へ移動** / **背面へ移動**。色変更 / プロパティ編集は Phase 10.K 以降
- **トリガ対象**: shape (Rectangle / Arrow / Highlight / Text) の長押しのみ。Stage 空白部分の長押しは何もしない (誤発火回避)
- **位置**: 長押し成立座標を anchor に、shape 境界を避けて画面内に表示。画面端では反対方向にフリップ

実装は `apps/web/src/components/canvas/ContextMenu.tsx` を新設し、各 Shape 内で長押し timer を管理する custom hook (例: `useLongPress(onTrigger, { duration, slop })`) で配線する。

### D5. E2E 戦略

`page.mouse` 経路を **desktop-only に分離** し、touch 検証は以下の経路に統一する:

| 経路 | 用途 | 制約 |
|---|---|---|
| **`locator.dispatchEvent('touchstart' / 'touchmove' / 'touchend')`** (default) | 大半の touch UX 検証 | `Event.isTrusted = false` (本リポジトリのコードは `isTrusted` 不参照のため問題なし) |
| **CDPSession `Input.dispatchTouchEvent`** | `pointerType === 'touch'` 分岐の検証 / pinch / 真の本物 touch | Chromium 専用、Phase 10.I-2 の pinch spec で実績あり |
| `page.touchscreen.tap(x, y)` | 単発 tap の sanity check | single tap 専用、long-press / pinch 不可 |
| `page.mouse.*` | **desktop-only**、touch 検証では使わない | Phase 10.I-4 までの 19 spec を Phase 10.J-4 で `chromium-mobile` project から外す |

`apps/web/e2e/fixtures/touch-helpers.ts` (Phase 10.I-4 既存) を拡張し、`touchSequence(page, [{action, x, y, ms}, ...])` の薄い wrapper を提供する。各 spec はこの helper を経由するルールにし、生 `page.mouse` を使わない。

Playwright config 側では既存 `mobile-chrome` project (`devices['Pixel 5']`) を維持し、`hasTouch: true` / `isMobile: true` / `pointer: 'coarse'` を確認する。iPhone 14 emulation の追加は Phase 10.J-4 で実機 QA を Must (ブロッカー) 化するため必須ではないが、CI 上で iOS Safari に近い coarse pointer 検証ができるなら追加する (Plan で確定)。

### D6. 実機 QA の必須化

Phase 10.I では実機 QA を docs (`docs/qa/phase-10-i-touch-manual-qa.md`) に記載するのみで、Acceptance Criteria は emulation E2E 緑で達成扱いだった。Phase 10.J では:

- **実機 QA を Acceptance Criteria の Must (ブロッカー)** に格上げ
- **iPhone Safari + Android Chrome の 2 デバイス** で `docs/qa/phase-10-j-touch-manual-qa.md` (Phase 10.I の v2 拡張) のチェックリスト 100% 通過を merge 条件にする
- emulation E2E は引き続き CI で回るが、**emulation 緑 = 受入達成 ではない** ことを Phase 10.J PRD と本 ADR で明示する

---

## Alternatives Considered

| 案 | 採否 | 理由 |
|---|---|---|
| **A. Konva の `pointerType` 単一経路に全 shape 統一** (`onClick + onTap` 配線せず、`<Stage>` の `onPointerDown` で hit test して shape 選択) | rejected | Konva 公式 docs (Desktop_and_Mobile.mdx) は **shape 単位での `click` / `tap` ペアリングを canonical** として明示している。Stage 経路に集約すると Konva 内部の hit test 最適化を捨てる + dblclick / dbltap の 450ms 検出を自前実装する必要が出る。コスト >> 利益 |
| **B. 長押しコンテキストメニューを Won't 維持、削除はツールバー / キーボード SC のみ** | rejected | Phase 10.I PRD で採った判断だが、**業界標準 (Keynote / Slides / Figma / Excalidraw / tldraw 全社) では touch 削除 = long-press menu が事実上必須**。ツールバーのみだと shape 選択 → ツールバー往復が増え、操作効率が PC の半分以下になる。誤発火対策は 500ms + 6px slop + visual feedback で標準パターンに乗れる |
| **C. Pointer Events 一本化を撤回し全 event を Konva の native handler (`onClick + onTap` 等) に戻す** | rejected | ADR-0006 の意思決定 (`<Stage>` Pointer Events 一本化) を覆すコストが高く、multi-touch pinch (Phase 10.I-2) の TouchEvent 経路と整合しなくなる。本 ADR は ADR-0006 の **Stage 一本化を維持しつつ Shape 単位は paired binding** と明確に切り分ける |
| **D. タイミング定数を tldraw / Excalidraw のいずれかに完全準拠** | rejected | 両者で `longPressDurationMs` (tldraw 500) と `TOUCH_CTX_MENU_TIMEOUT` (Excalidraw 500) は一致するが、`dragDistanceSquared` (tldraw 16) と `DRAGGING_THRESHOLD` (Excalidraw 10) は乖離。**iOS / Android の OS 標準値が両者の範囲内** なので、OS 標準を上位ルールとして採用 |
| **E. E2E を全廃して実機 QA のみで担保** | rejected | 実機 QA は scaling しない (デバイス管理 / 工数 / 再現性)。**emulation E2E + 実機 QA の two-tier** が業界標準 (tldraw / Excalidraw / Figma の OSS リポジトリでも同パターン) |
| **F. `page.touchscreen.tap` を default に採用** | rejected | single tap 専用で long-press / pinch / drag が書けない。`dispatchEvent` 経路の方が表現力が高く、`isTrusted = false` の制約は本リポジトリでは無害 |

---

## Consequences

### 期待される効果

- 実機 iOS Safari / Android Chrome で shape 選択 / リサイズ / 編集 / 削除 が PC と同じ感覚で動作する (Acceptance Criteria 達成)
- タイミング定数 / サイズ定数の根拠が ADR + コード (`touch-thresholds.ts`) に集約され、将来の調整 (例: ユーザーフィードバックで long-press を 600ms に伸ばす) が一点修正で済む
- E2E 経路の規約化により、将来の touch 関連 spec 追加時に「実機保証」が default になる
- Phase 10.J 完了後、touch UX 観点での tldraw / Excalidraw 同等品質に到達 (palm rejection / pen 最適化を除く)

### 受容するコスト / 制約

- 全 Shape (`RectangleShape` / `ArrowShape` / `HighlightShape` / `TextShape`) の event 配線書き換え (Phase 10.J-1 で実施)
- 長押しコンテキストメニュー UI の新規実装 (`ContextMenu.tsx` + `useLongPress` hook、Phase 10.J-2 で 500-700 LOC 程度を見込む)
- 既存 19 件の E2E spec を `page.mouse` から `dispatchEvent` 経路に書き換え (Phase 10.J-4 で実施)
- 実機 QA を Acceptance Criteria に組み込むことで、PR merge までの所要時間が増える (= 1 PR あたり 30-60 分の手動検証)
- Phase 10.J を Phase 10.F (v1.0.0) の前段に挟むため、公開リリースが Phase 10.J 分 (推定 5-7 日) 後ろ倒し

### 影響を受けるファイル (Phase 10.J で触る予定、参照のため)

- `apps/web/src/components/canvas/shapes/RectangleShape.tsx` — `onTap` 追加
- `apps/web/src/components/canvas/shapes/ArrowShape.tsx` — `onTap` 追加 + Circle handle の `onTouchStart`
- `apps/web/src/components/canvas/shapes/HighlightShape.tsx` — `onTap` 追加
- `apps/web/src/components/canvas/shapes/TextShape.tsx` — `onTap` 追加 (`onDblTap` は既追加)
- 新規: `apps/web/src/lib/touch-thresholds.ts` — タイミング定数 SSOT
- 新規: `apps/web/src/hooks/useLongPress.ts` — long-press timer 管理
- 新規: `apps/web/src/components/canvas/ContextMenu.tsx` — long-press 経由の context menu UI
- `apps/web/src/components/canvas/colors.ts` — `ANCHOR_SIZE_TOUCH` 24→20 再調整 (D3)
- `apps/web/e2e/fixtures/touch-helpers.ts` — `touchSequence` wrapper 追加
- 既存 `apps/web/e2e/touch-acceptance.spec.ts` 他 19 件 — `page.mouse` → `dispatchEvent` 経路に migration

詳細スコープは `phase-10-j-touch-ux-standards.prd.md` の sub-phase 分割で確定する。

### 後続 Phase との関係

- **10.J-1**: D1 (paired binding) + D2 (タイミング定数 SSOT) を実装
- **10.J-2**: D4 (長押し context menu) を実装
- **10.J-3**: D3 (Transformer coarse anchor 20px 再調整) を実装
- **10.J-4**: D5 (E2E 経路 migration) + D6 (実機 QA Must 化) を実装
- **10.J-5** (任意): Phase 10.J 全体の umbrella report 起票、retrospective

---

## References

- [Konva — Desktop and Mobile Events](https://konvajs.org/docs/events/Desktop_and_Mobile.html)
- [Konva — Mobile Events](https://konvajs.org/docs/events/Mobile_Events.html)
- [Konva — Multi-touch Scale Stage tutorial](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html)
- [Excalidraw — `packages/common/src/constants.ts`](https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts) (`TOUCH_CTX_MENU_TIMEOUT = 500`, `TAP_TWICE_TIMEOUT = 300`, `DRAGGING_THRESHOLD = 10`, `DOUBLE_TAP_POSITION_THRESHOLD = 35`)
- [tldraw — `packages/editor/src/lib/options.ts`](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/options.ts) (`longPressDurationMs: 500`, `doubleClickDurationMs: 450`, `coarseDragDistanceSquared: 36`, `dragDistanceSquared: 16`, `coarseHandleRadius: 20`, `handleRadius: 12`, `coarsePointerWidth: 12`, `hitTestMargin: 8`)
- [Apple HIG — Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)
- [Apple — UILongPressGestureRecognizer](https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer) (`minimumPressDuration` default = 0.5s)
- [Android — ViewConfiguration](https://developer.android.com/reference/android/view/ViewConfiguration) (`getLongPressTimeout()` = 500ms, `getDoubleTapTimeout()` = 300ms, `getTapTimeout()` = 100ms)
- [Material Design 3 — Gestures](https://m3.material.io/foundations/interaction/gestures)
- [Playwright — Touch events](https://playwright.dev/docs/touch-events)
- [Playwright — Touchscreen API](https://playwright.dev/docs/api/class-touchscreen)
- [Playwright — Emulation (`hasTouch`, `isMobile`)](https://playwright.dev/docs/emulation)
- 引き継ぎ docs: [`phase-10-j-touch-ux-handoff.md`](../../.claude/PRPs/handoff/phase-10-j-touch-ux-handoff.md)
