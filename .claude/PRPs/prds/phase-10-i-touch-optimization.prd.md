# Phase 10.I: タッチデバイス操作最適化 (iOS Safari + Android Chrome)

> Phase 10.F (公開リリース + v1.0.0) の **必須 blocker** として「スマホでアノテーションが書けない」破綻を解消する 1 PRD。
> ECC PRP ワークフロー (PRD → Plan → Implement → Report → Review → PR) のうち PRD 起票。

**Date**: 2026-05-09
**Status**: DRAFT (実装 pending)
**Owner**: imotako (PM/Dev)
**Related**:
- 親 PRD: [`snap-share.prd.md`](./snap-share.prd.md) (Phase 10.I 行を別 commit で追記する)
- 上流: [`phase-10-direction.prd.md`](./phase-10-direction.prd.md) (Phase 10 全体方針)
- 隣接: 本 PRD は **Phase 10.H (ランディング条件付き拡張) の前** に配置し、**Phase 10.F (ドメイン取得 + v1.0.0)** を `blockedBy` する
- 訂正: [`phase-7.7-ux-foundation.prd.md`](./phase-7.7-ux-foundation.prd.md) と [`phase-7.8-predictive-ux.prd.md`](./phase-7.8-predictive-ux.prd.md) の Won't 「タッチ最適化はしない」は **本 PRD で方針転換** (注記を追記する)
- ADR: ADR-0003 (Web 単独 — 維持)、本 PRD 着工時に **ADR-0006「Pointer Events 一本化と touch ジェスチャ仕様」** を新設

---

## Problem Statement

snap-share は実機 (iPhone Safari / Android Chrome) で **テキスト以外のアノテーション (矩形 / 矢印 / ハイライト) が描画できない** 破綻状態にある。原因は `apps/web/src/components/canvas/CanvasStage.tsx:488-501` で Konva `Stage` に `onMouseDown/Move/Up` のみが配線され、`onPointerDown/Move/Up` も `onTouchStart/Move/End` も配線されていないため、touch では mousemove が発火せず drag 系描画 (= 矩形/矢印/ハイライトの全て) が成立しないことにある。テキストが動くのは `Group draggable` 属性が click 1 回で確定するため例外的に通っているに過ぎない。これを未解決のまま v1.0.0 を公開すると、PC を開かない場面 (通勤 / カフェ / リビング) を主用途とする想定ユーザーが共有 URL を踏んだ瞬間に「見れるけど書けない」状態に直面し、snap-share の核価値 (URL 一発で双方向に注釈) が成立しない。

## Evidence

- **直接観測 (確定)**: 著者 (imotako) が iPhone Safari / Android Chrome で実機検証し、「図形が書けない、長押し&ドラッグで書けない、テキストエリアの配置はできるけど、それ以外できないかも」を確認 (2026-05-09 セッション)
- **コード根拠 (確定)**:
  - `apps/web/src/components/canvas/CanvasStage.tsx:488-501` — `<Stage>` に touch / pointer 系 prop が一切配線されていない
  - `apps/web/src/components/canvas/shapes/TextShape.tsx:40` — `Group draggable` で click 確定 (drag 不要のため例外的に動く)
  - `apps/web/src/components/canvas/shapes/RectangleShape.tsx` 他 — drag による領域確定が必要だが mousemove 経路のみ
  - `apps/web/src/hooks/useStageTransform.ts` — wheel / Cmd+wheel 経路のみ。pinch zoom は未実装
- **方針転換の意思決定 (確定)**:
  - PRD `phase-7.7-ux-foundation.prd.md:33,75` で意図的に「タッチ最適化はしない」と Won't 化していた仮説 (= デスクトップ優先で十分) が、実機検証で破綻していたことが判明
  - 公開直前 (Phase 10.F = v1.0.0) を控え、初訪問の半数前後がモバイルになる蓋然性
- **競合・公式根拠 (Phase 3 grounding)**:
  - Excalidraw [PR #788](https://github.com/excalidraw/excalidraw/pull/788) (2020-02): Pointer Events 一本化 + 2-finger pinch
  - tldraw [`useCanvasEvents.ts`](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useCanvasEvents.ts): `pointerType` で `mouse / pen / touch` 分岐
  - Konva 公式: [Multi-touch Scale Stage](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html), [Mobile Events](https://konvajs.org/docs/events/Mobile_Events.html), [hitStrokeWidth #524](https://github.com/konvajs/konva/issues/524)
  - 仕様: [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action), [Material touch-target 48dp](https://m2.material.io/develop/web/supporting/touch-target), iOS HIG = 44pt

## Proposed Solution

`onMouseDown/Move/Up` を **`onPointerDown/Move/Up` + `pointerType` 分岐に一本化**し、`touch-action: none` をキャンバス親 div に付与して native scroll/zoom を抑止する。これにより `pointer event` がデバイス種別を問わず単一経路を流れる構造に変え、矩形/矢印/ハイライト/テキストの drag 描画と既存図形の移動が touch でも自然に動く状態を取り戻す。同時に **2 本指 = pinch + pan**、**selection handle 視覚 24 px / hit 44 px** (`hitStrokeWidth` 利用)、**ツールバー bottom 固定 + `safe-area-inset-bottom`** を導入し、親指リーチと細い線への指タッチを救済する。デスクトップ UX は **adaptive sizing** (= `pointerType !== 'touch'` の場合は従来 8 px ハンドル維持) で犠牲にしない方針を採る。

代替案として「useEffect で imperative に native `touchstart/move/end` listener を Stage container に追加して既存 mouse handler に橋渡しする」を比較検討した。これは差分が小さく短期復旧には魅力的だが、(a) 2 本指 pinch を別経路で書く必要が残る、(b) `pointerType` での pen 分岐が将来できない、(c) Excalidraw / tldraw が辿った成熟経路 (Pointer Events 一本化) と乖離する、の 3 点で長期負債が大きい。本 PRD では Pointer Events 一本化を採用する。

## Key Hypothesis

We believe **Pointer Events 一本化 + 2-finger pinch + 44 px hit area + bottom toolbar** will **「PC を開かない場面のユーザーがスマホ単体で snap-share の全機能 (描画 / 移動 / 削除 / リアルタイム共同編集) を完遂できる」を実現する** for **iPhone Safari / Android Chrome を主デバイスとする個人ユーザー and 共有 URL を踏むモバイル受信者**.
We'll know we're right when **iPhone (Safari) + Pixel (Chrome) で 4 種すべての annotation を「追加 / 移動 / 削除」する一連タスクが Playwright mobile project + 手動チェックリストの両方で 100% 通過し、誤操作率 (意図しない描画 / ジェスチャ衝突) が 5 タスク中 1 回未満に収まる**.

## What We're NOT Building

- **palm rejection / ペンモード** — tldraw でも完全には未解決 ([Issue #4086](https://github.com/tldraw/tldraw/issues/4086))。実装コスト >> v1 価値。Phase 11+ で必要なら別 PRD
- **長押しコンテキストメニュー** — Excalidraw でも誤発火が多い ([Issue #9705](https://github.com/excalidraw/excalidraw/issues/9705))。snap-share の選択操作はタップ + 既存インスペクタで代替
- **3 本指ジェスチャ (undo / redo / pan 等)** — iOS Safari にブラウザ側で奪われる。キーボード SC + bottom toolbar の undo ボタンで足りる
- **ダブルタップでズーム切替** — iOS native double-tap zoom と競合
- **モバイル専用レイアウト分岐** — Excalidraw 程度の responsive CSS で十分。`react-router` 分割や別エディタ実装はしない
- **PWA インストール対応 / Service Worker** — Phase 10 全体で Web のみ (ADR-0003)
- **ネイティブアプリ化 (iOS / Android / Mac)** — 本 PRD のスコープ外
- **モバイルでの新規機能追加** — 本 PRD は「PC でできることがスマホでもできる」パリティ復旧のみ。新規機能 (例: モバイル特化 UI / 短縮ジェスチャ) は対象外
- **3 言語以上の i18n** — 日英のみ (ADR-0004)、本 PRD で追加文言が出る場合も同方針

## Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| **基本機能パリティ** | iPhone (Safari) + Pixel (Chrome) で矩形/矢印/ハイライト/テキストの「追加 / 移動 / 削除」が 100% 通過 | Playwright `mobile-chrome` project に新規 spec 追加 + 手動チェックリスト (実機 2 台) |
| **誤操作率** | 5 つの annotation 追加タスクで「意図しない描画 / ジェスチャ衝突」が 1 タスク当たり 1 回未満 (= 5 試行で 5 件未満) | 手動チェックリストで著者 + 知人 1〜2 名による dogfood ログ |
| **selection handle ヒット成功率** | タッチでハンドルを 1 回で掴める率が 90% 以上 | 手動 5 試行 × 4 形状 × 2 デバイス |
| **CWV 維持** (mobile) | LCP < 2.5s / INP < 200ms / CLS < 0.1 (既存基準を割らない) | Lighthouse mobile profile (`pnpm -F @snap-share/web build` 後の手動 spot check) |
| **デスクトップ非劣化** | 既存 unit / E2E (chromium) が **すべて緑** で、selection handle / toolbar の見た目変更が 0 行の visual regression を起こさない | `pnpm test` + `pnpm test:e2e` + 手動 PC 確認 |
| **リアルタイム共同編集 mobile→PC** | スマホで描いた annotation が PC ピアに 1 秒以内に反映 / 逆方向も同じ | 手動 2 デバイス連携テスト (Playwright で連携も spec 化できれば Should) |

## Open Questions

- [ ] **Q1**: Pointer Events 移行のため `onMouseDown/Move/Up` を `onPointerDown/Move/Up` に書き換える際、**既存 unit test の test ID とイベント発火方法** (`fireEvent.mouseDown` 系) も同時改修するか、もしくは React 19 の合成イベント側で互換維持できるか → **暫定**: テストは fireEvent.pointerDown 系に書き換える (実装と乖離させない)
- [ ] **Q2**: 2-finger pinch の zoom factor を既存 `useStageTransform` の wheel zoom と同じ範囲 (0.1x〜10x 等) に揃えるか、touch では別範囲にするか → **暫定**: 同範囲で揃え、Phase 10.G で field data 観察後に判断
- [ ] **Q3**: `touch-action: none` を Stage container にだけ付けるか、global `body` も含めるか → **暫定**: Stage container のみ。body 全体だと landing / 法務 page のスクロールを殺す
- [ ] **Q4**: VisualViewport API での IME 対策は **本 PRD の Should** にしているが、**MVP 検証 (実機ドッグフード) で「テキスト入力時の入力位置ズレ」が 致命的** だった場合は Must に格上げするか → **暫定**: MVP 後に再判断 (PRD は Should のまま)
- [ ] **Q5**: `pointerType === 'pen'` のときの挙動 → v1 では `mouse` と同等扱い (専用最適化なし)。palm rejection は Won't と同じ理由で v1 対象外。明示するか黙示にするか → 暫定: ADR-0006 で明示
- [ ] **Q6**: モバイル専用 ADR-0006 を本 PRD 着工時に新設するか、Plan に組み込むか → 暫定: PRD merge 後の Plan 起票時に新設 (Phase 10.I-1 内に含める)

---

## Users & Context

### Primary User

- **Who**: 通勤中・カフェ・リビング等 **PC を開かない場面で** スクショに注釈を当てて共有したい個人。デバイスは iPhone (Safari) または Android (Chrome)。30 代前後、Web リテラシ中〜高
- **Current behavior**: スマホで撮ったスクショを Slack / Discord / LINE / Twitter DM で送り、コメント文だけで指示している。「ここをこうして」が言葉だけでは伝わらず、再送信や追加チャットが発生
- **Trigger**:
  - 知人から `pitamark.app/r/...` を共有された瞬間 (受信側ユーザー)
  - スクショを取った直後にすぐ注釈を付けたい瞬間 (発信側ユーザー)
- **Success state**: スマホ単体で 4 種 annotation を当て、PC ピアともリアルタイムに同期できた状態で URL を返す

### Job to Be Done

When **スマホでスクショを取った直後、相手に「ここをこうしてほしい」を視覚的に伝えたい / または共有 URL を踏んだ受信側として書き戻したい とき**, I want to **PC を開かずに矩形・矢印・ハイライト・テキストを当てて共有を完結したい**, so I can **「見れるけど書けない」のフラストレーションなしに、PC ユーザーと同じ生産性で会話を進められる**.

### Non-Users (明示的に対象外)

- **ペン入力で丁寧にスケッチしたい人** — palm rejection / pressure / tilt 未対応
- **PC で大量の細かい注釈を入れる作業者** — デスクトップ優先方針は維持 (本 PRD はパリティ復旧であり、デスクトップ UX を犠牲にしない)
- **モバイルネイティブアプリ志向** — Web 単独 (ADR-0003)
- **既存 ADR-0003 で対象外と明示した SSO / 永続ナレッジベース層** (継承)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | **Pointer Events 一本化 (`onPointerDown/Move/Up`) + `pointerType` 分岐** | 矩形/矢印/ハイライト描画の復旧の核。Excalidraw / tldraw 成熟パターン |
| Must | **`touch-action: none`** をキャンバス親 div に付与 | iOS Safari でのタッチイベント競合解消 |
| Must | **2-finger pinch zoom + 2-finger pan** | スマホ標準ジェスチャ。Konva 公式 Multi-touch Scale Stage パターン |
| Must | **selection handle 視覚 24 px / hit 44 px (adaptive)** | iOS HIG 44pt / Material 48dp。`pointerType !== 'touch'` のときは 8 px 維持でデスクトップ非劣化 |
| Must | **線/矢印への `hitStrokeWidth: 20` 適用** | Konva Issue #524。細線が指で掴めない問題の救済 |
| Must | **ツールバー bottom 固定 + `safe-area-inset-bottom`** | 親指リーチ。Tailwind v4 で responsive 切替 (`md:` 以下のみ bottom) |
| Must | **mobile-chrome Playwright project への新規 spec 追加** | 受入基準達成の自動化 |
| Should | **VisualViewport API による IME 出現吸収** | テキスト入力位置ズレ問題。MVP 後ドッグフードで Must 昇格判断 |
| Should | **awareness layer (他人カーソル) の touch device 判定** | リアルタイム共同編集で touch ユーザーは「カーソル位置」概念がないため、最後タップ位置で代替表示 |
| Should | **Wheel pan の touch 等価実装** (1 本指 pan は描画と衝突するので 2 本指のみ) | Konva 公式パターン |
| Could | **タップ済みハンドルの highlight (touch-only feedback)** | フィードバック改善 |
| Won't | palm rejection / ペンモード | tldraw でも未解決、コスト過大 |
| Won't | 長押しコンテキストメニュー | 誤発火 (Excalidraw 前例) |
| Won't | 3 本指ジェスチャ | iOS Safari がブラウザ側で奪う |
| Won't | ダブルタップ zoom 切替 | native double-tap zoom と衝突 |
| Won't | モバイル専用 UI 分岐 / `react-router` 分離 | responsive CSS で吸収 |
| Won't | PWA / Service Worker / install banner | ADR-0003 (Web 単独) |
| Won't | モバイル新規機能 (ジェスチャショートカット等) | 本 PRD はパリティ復旧のみ |

### MVP Scope

**「iPhone Safari + Pixel Chrome で 4 種 annotation の追加 / 移動 / 削除が動き、デスクトップが非劣化」**を MVP とする。

最小達成セット:
1. `CanvasStage.tsx` の Pointer Events 化 + `touch-action: none` 適用
2. `RectangleShape / ArrowShape / HighlightShape / TextShape` の touch 描画動作確認
3. selection handle adaptive 化 (touch 時 44 px hit) と `hitStrokeWidth` 適用
4. Toolbar の bottom 移動 (`md:` 未満)
5. `useStageTransform` への 2-finger pinch + pan 追加
6. Playwright `mobile-chrome` project に 4 形状 × 3 操作 (追加/移動/削除) の spec
7. 実機チェックリスト (iPhone + Pixel) で 100% 通過

VisualViewport / awareness layer 修正 / wheel pan 等価は **Should** で MVP 外。MVP 完了後にドッグフードして必要なら Must 昇格。

### User Flow

**スマホ受信者ケース (最も頻出):**
1. ユーザー A (PC) が画像をアップして注釈を入れ、URL を共有
2. ユーザー B (スマホ) が URL を踏む → エディタ画面が表示
3. B は画面下部のツールバーから矩形を選択 → 画面を指でドラッグ → 矩形が描画される
4. B が selection ツールに切り替え → 既存のテキストを指でドラッグ → 移動できる
5. B が 2 本指で pinch → ズーム / 2 本指 swipe → pan
6. B のテキスト編集時に IME が出る (Should: VisualViewport で位置自動調整)
7. A の PC に B の編集が 1 秒以内に反映

---

## Technical Approach

**Feasibility**: **HIGH**

- 既存 `useReducer` ベースの annotations store は touch 経路でも変更不要
- Konva v9 + react-konva は Pointer Events を内部サポート (`onPointerDown` 等を Stage の prop として受ける) — react-konva の Stage 実装で確認済み
- Y.js / WebSocket 同期層は touch event とは独立 (annotation の add/move/delete dispatch を経由するため)
- 既存 Playwright の `mobile-chrome` project (Pixel 5 emulation) が `snap-share.prd.md:413` 既述で稼働中 — spec 追加だけで E2E 拡張可能

**Architecture Notes**

- `CanvasStage.tsx` で `onMouseDown/Move/Up` を **削除** し、`onPointerDown/Move/Up` に置換 + `e.evt.pointerType` で分岐
- `useStageTransform.ts` で `pointerType === 'touch'` の場合の 2-finger pinch を新規実装。Konva 公式 Multi-touch Scale Stage を参考に、`stage.getPointerPosition()` の代わりに 2 pointer の中点を計算
- adaptive selection handle: `useReducer` で touch 状態を保持するか、CSS variable + `@media (pointer: coarse)` で切替か → **後者を採用** (実装単純、SSR 互換、`navigator.maxTouchPoints` の判定不要)
- ツールバー bottom 化: `Toolbar.tsx` を Tailwind の `md:top-0 bottom-0 md:bottom-auto` 形式で responsive。`pb-[env(safe-area-inset-bottom)]` で iPhone notch 対応
- `touch-action: none` は Konva Stage の **直下 div** に付与 (body 全体だと landing / 法務 page のスクロール阻害)

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pointer Events 移行で既存 unit test が大規模に red 化 | High | testing-library の `fireEvent.pointerDown` 系に書き換え。Plan で 1 sub-step として切り出す |
| iOS Safari の Pointer Events 実装に既知バグ (例: pointercancel が出ない) がある | Medium | tldraw `useCanvasEvents.ts` の iOS 例外コードを参考に対応。`tlenv.isIos` 同等の env 判定を `apps/web/src/lib/env.ts` 等に集約 |
| 2-finger pinch と 1-finger 描画が競合 (例: 2 本目の指が触れた瞬間に矩形が確定してしまう) | High | pointer count >=2 で描画キャンセル + pinch モード突入。pointercancel をきちんと拾う |
| デスクトップで selection handle が 24 px に拡大して不格好 | Medium | `@media (pointer: coarse)` で touch device のみ拡大。CI の Playwright chromium で 8 px 維持を視覚確認 |
| Y.js の origin 判定 (`LOCAL_ORIGIN`) が touch 経路でも保たれるか | Low | annotation mutator は dispatch 経路を共有するため影響なし。CLAUDE.md の "8. Yjs mutators" 規約に touch 経路でも準拠 |
| Toolbar bottom 化でランディング (Phase 10.H) のレイアウトと衝突 | Medium | Phase 10.I が 10.H より前に着工することで、10.H 側でモバイル bottom toolbar 前提のレイアウトを設計可能 |
| Playwright `mobile-chrome` project の flake | Medium | snap-share.prd.md:327 に既存の Linux snapshot 持ち越しがあり、本 PRD と並列改善可能 |

---

## Implementation Phases

> ECC PRP 規約: 本 PRD は **umbrella plan** ではなく **PRD 単位 1 ブランチ 1 PR** (memory: feedback_branch_per_phase)。sub-step は 1 ブランチ内で順次コミットで区切る。

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 10.I-1 | Pointer Events 一本化 + 描画系復旧 | `CanvasStage` を `onPointerDown/Move/Up/Cancel` 化、`touch-action: none`、4 形状の touch drag 復旧、ArrowShape handle pointer 化、ADR-0006 起票 (※ unit test は jsdom 制限のため fireEvent.mouseDown 維持) | complete (typecheck/lint/test/build/E2E mobile-chrome smoke + chromium 78 件回帰すべて緑、ADR-0006 Accepted) | - | - | [plan](../plans/completed/phase-10-i-1-pointer-events-migration.plan.md) / [report](../reports/phase-10-i-1-pointer-events-migration-report.md) |
| 10.I-2 | 2-finger pinch / pan + ヒットエリア拡大 | Konva 公式 multi-touch 経路 (`onTouchMove` + `e.evt.touches`) で 2-finger pinch + pan、`Konva.hitOnDragEnabled = true`、`useTouchDevice` hook で adaptive handle / anchor / `hitStrokeWidth` (※ Pointer Events 一本化は single-pointer に限定して維持、multi-touch のみ Konva 公式パターンに準拠、ADR-0006 Status Update 追記済) | complete (typecheck/lint/test 342 件/build/E2E pinch smoke + chromium 78 件回帰すべて緑) | with 10.I-3 | 10.I-1 | [plan](../plans/completed/phase-10-i-2-multitouch-and-hit-areas.plan.md) / [report](../reports/phase-10-i-2-multitouch-and-hit-areas-report.md) |
| 10.I-3 | Toolbar bottom 固定 + safe-area | `useTouchDevice` で touch 時のみ Toolbar を AdSlot bottom (100px) の真上に `fixed bottom-[100px]` 配置、`viewport-fit=cover` + `paddingBottom: env(safe-area-inset-bottom)` で iPhone notch 対応、全 Button (ToolButton/ColorPalette/FontSizeControl) に `min-w-11 min-h-11` (44px tap zone) を touch 時のみ適用 (visual 32px/28px は維持で desktop 非劣化)、Toolbar 高さ ResizeObserver で stage inset 動的追従 | complete (typecheck/lint/test 346 件/build/E2E touch-toolbar-bottom smoke + chromium 78 件回帰すべて緑) | with 10.I-2 | 10.I-1 | [plan](../plans/completed/phase-10-i-3-toolbar-bottom-and-safe-area.plan.md) / [report](../reports/phase-10-i-3-toolbar-bottom-and-safe-area-report.md) |
| 10.I-4 | E2E + 実機検証 + 受入 | Playwright `mobile-chrome` で 4 形状 × 3 操作 = 12 ケース受入 spec (`touch-acceptance.spec.ts`)、`fixtures/touch-helpers.ts` 共通化、`docs/qa/phase-10-i-touch-manual-qa.md` 実機チェックリスト (誤操作率 / handle hit / 同期 / CWV)、Phase 10.I 全体の umbrella report (10.I-4 個別 report は umbrella で代替) | complete (typecheck/lint/test 346 件/build/E2E mobile-chrome 12 受入 + 3 smoke 累積 15 件 + chromium 78 件回帰すべて緑、umbrella report 起票済) | - | 10.I-2, 10.I-3 | [plan](../plans/completed/phase-10-i-4-acceptance-and-manual-qa.plan.md) / [umbrella report](../reports/phase-10-i-umbrella-report.md) |

### Phase Details

**Phase 10.I-1: Pointer Events 一本化 + 描画系復旧 (Must の中核)**
- **Goal**: 矩形/矢印/ハイライト/テキストの 4 形状すべてが iPhone Safari + Pixel Chrome で「追加 / 移動」できる状態に戻す
- **Scope**:
  - `apps/web/src/components/canvas/CanvasStage.tsx` を `onMouseDown/Move/Up/Leave` から `onPointerDown/Move/Up/Cancel` に置換 + `e.evt.pointerType` で分岐
  - `apps/web/src/styles/globals.css` (該当ファイル) に Stage container 用 `touch-action: none` 追加
  - 既存 unit test (`apps/web/src/hooks/__tests__/`) を `fireEvent.pointerDown` 系に移行
  - ADR-0006「Pointer Events 一本化と touch ジェスチャ仕様」を `docs/adr/` に起票
- **Success signal**: iPhone Safari で矩形描画が動作 + 既存 PC unit test / E2E がすべて緑

**Phase 10.I-2: 2-finger pinch / pan + ヒットエリア拡大 (10.I-3 と並走可)**
- **Goal**: 2 本指ジェスチャで pinch zoom + pan、selection handle / 線が指で掴める状態
- **Scope**:
  - `apps/web/src/hooks/useStageTransform.ts` に `pointerType === 'touch'` 判定下の 2-pointer 中点計算 + 距離変化による zoom factor。既存 wheel 経路は維持
  - `apps/web/src/components/canvas/shapes/ArrowShape.tsx` 他に `hitStrokeWidth: 20` 追加
  - selection handle の adaptive 化: `@media (pointer: coarse)` で 8 px → 24 px (視覚) / 44 px (hit)
  - 1 本指 pan は描画ツール選択時に競合するため **2 本指のみ pan 許可**
- **Success signal**: 2 本指 pinch でズーム動作、細い矢印を指で掴んで移動可能、PC で handle が 8 px 維持

**Phase 10.I-3: Toolbar bottom 固定 + safe-area (10.I-2 と並走可)**
- **Goal**: スマホで親指がツールバー全ボタンに届く
- **Scope**:
  - `apps/web/src/components/toolbar/Toolbar.tsx` を Tailwind responsive で `md:top-0 bottom-0 md:bottom-auto` 形式に変更
  - 各ツールボタンの hit area を 44 px 確保 (視覚アイコンは 24 px 維持)
  - `pb-[env(safe-area-inset-bottom)]` で iPhone notch 対応
  - `apps/web/src/components/connection/ConnectionBadge.tsx` 等の固定要素が bottom toolbar と重ならないか確認
- **Success signal**: iPhone (notch) と Pixel で全ボタンに親指が届き、PC は従来通り上部固定

**Phase 10.I-4: E2E + 実機検証 + 受入**
- **Goal**: Acceptance Criteria を自動 + 手動の両方で達成証明
- **Scope**:
  - Playwright `mobile-chrome` project に新規 spec: 4 形状 × 3 操作 (add/move/delete) = 12 ケース
  - 実機チェックリスト (iPhone Safari + Pixel Chrome) を `.claude/PRPs/reports/phase-10-i-manual-qa.md` に記録
  - 誤操作率測定 (5 タスク試行 × 2 デバイス × 2 名)
  - 共同編集 mobile→PC の手動 2 デバイステスト
  - Lighthouse mobile profile で CWV 維持確認
- **Success signal**: Playwright 全緑 + 手動チェックリスト 100% + 誤操作率 < 1/5 + CWV 非劣化

### Parallelism Notes

- **10.I-1 が gating**: Pointer Events 化 + ADR-0006 が完了しないと 10.I-2 / 10.I-3 / 10.I-4 のいずれも着手不能
- **10.I-2 ↔ 10.I-3 は並列可**: surface が完全に異なる (canvas internals vs Toolbar layout)。同 PR 内で別コミットとして並行作業可能
- **10.I-4 は最後**: 実装が一通り揃ってからでないと受入測定の意味がない

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Touch event 統合方式 | Pointer Events 一本化 | (a) `useEffect` で imperative に native touch listener (b) `onTouchStart` props を Stage に追加して mouse と並存 | Excalidraw / tldraw が辿った成熟経路。pen 分岐の将来余地。1 経路に統一することで race condition の温床を減らす |
| selection handle サイズ | adaptive (`@media (pointer: coarse)` で 24/44 px) | (a) 全デバイス 44 px に統一 (b) JS で `navigator.maxTouchPoints` 判定 | デスクトップ非劣化が前提条件 (Phase 1 確定)。CSS で済むので SSR / hydration 問題が出ない |
| ツールバー位置 | mobile bottom + desktop top (responsive) | (a) 全デバイス bottom に統一 (b) FAB 風に集約 | デスクトップは既存 muscle memory を維持。bottom 統一は Tailwind の `md:` ブレークポイントで簡潔 |
| 1 本指 pan | 描画ツール選択時は禁止 (2 本指のみ) | (a) スペースキー相当のモードトグル (b) 長押しでパンモード | 1 本指 = 描画 という Excalidraw / tldraw の支配的パターンに合わせる。長押しは誤発火 |
| 長押し | 使わない | (a) コンテキストメニュー (b) モード切替 | Excalidraw でも誤発火多発。snap-share の選択操作はタップ + インスペクタで足りる |
| Phase 配置 | Phase 10.I 新設 (10.H の前) | (a) 10.H 並走 (b) 7.9 として遡及挿入 | 10.H ランディングがモバイル bottom toolbar 前提でレイアウト設計できるため、10.I を先行させる方が手戻りなし。7.9 遡及は履歴がねじれる |
| v1.0.0 との関係 | Phase 10.F を blockedBy | (a) v1.0.0 後に高速 follow up | Phase 1 で「v1.0.0 必須条件」確定 |
| IME 対策 | Should (MVP 後にドッグフードで Must 昇格判断) | (a) 最初から Must (b) Phase 10.G に持ち越し | VisualViewport の Safari/Chrome 挙動差で MVP が膨張するリスクが高い。実機検証で重要度を見極める |
| リアルタイム共同編集 | mobile も対象 (PC と同等) | (a) mobile は受信のみ | Phase 1 で確定。awareness layer の touch 対応は Should |
| ADR 起票 | ADR-0006 を 10.I-1 内で新設 | (a) 別 commit で先行 (b) PRD merge 後 | 実装と意思決定を同期させる。Plan で「10.I-1 1 コミット目 = ADR」順序を明示 |

---

## Research Summary

**Market Context** (Phase 3 grounding 結果)
- **Excalidraw**: PR #788 で Pointer Events に統合。`{ pointers: Map, lastCenter, initialDistance, initialScale }` を gesture state として保持し pointer ID で multi-touch 管理。長押しは誤発火が多く既知 issue ([#9705](https://github.com/excalidraw/excalidraw/issues/9705))
- **tldraw**: `pointerType` で `mouse / pen / touch` 明示分岐。`canHover = pointerType in ('mouse','pen')` で touch ではホバー状態無効化。`tlenv.isIos` で iOS Safari 例外パッチ
- **Konva 公式**: [Multi-touch Scale Stage](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html) のサンプルが本 PRD の 2-finger pinch 実装の直接の参考。`hitStrokeWidth` ([Issue #524](https://github.com/konvajs/konva/issues/524)) で線/矢印のヒット拡大
- **Miro / FigJam**: モバイル Web 対応は希薄 (FigJam はネイティブアプリ前提)。snap-share の参考価値は低いと判断

**Technical Context** (codebase 探索結果)
- 破綻原因: `CanvasStage.tsx:488-501` で touch / pointer 系 prop が一切未配線 (確度 95%)
- テキストだけ動く理由: `Group draggable` で click 1 発確定 → mousedown 経由で発火
- 改修コスト: M (中規模)。改修対象は CanvasStage / useStageTransform / Toolbar / globals.css / 各 Shape の `hitStrokeWidth`
- Y.js 同期層は touch 経路と独立 (annotation の dispatch を経由)、本 PRD で同期コードに触れる必要なし
- 既存 Playwright `mobile-chrome` project (Pixel 5 emulation) が稼働中で、spec 追加だけで E2E 拡張可能

---

*Generated: 2026-05-09*
*Status: DRAFT - Plan 起票待ち / snap-share.prd.md Phase テーブル更新待ち*
