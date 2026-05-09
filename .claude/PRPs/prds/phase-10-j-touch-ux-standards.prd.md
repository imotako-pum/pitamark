# Phase 10.J: Touch UX Standards Compliance — 実機準拠の操作感達成

> Phase 10.I (タッチデバイス操作最適化) で機能パリティを達成したが、実機 (iPhone Safari + Android Chrome) で touch UX 業界標準 (Keynote / Google Slides / Figma / Excalidraw / tldraw) に達していない問題を解消する 1 PRD。
> Phase 10.F (公開リリース + v1.0.0) の **必須 blocker** として 10.I に続いて配置。
> ECC PRP ワークフロー (PRD → Plan → Implement → Report → Review → PR) のうち PRD 起票。

**Date**: 2026-05-09
**Status**: DRAFT (実装 pending)
**Owner**: imotako (PM/Dev)
**Related**:
- 親 PRD: [`snap-share.prd.md`](./snap-share.prd.md) (Phase 10.J 行を本 PR で追記)
- 上流: [`phase-10-direction.prd.md`](./phase-10-direction.prd.md) (Phase 10 全体方針)
- 直接の前段: [`phase-10-i-touch-optimization.prd.md`](./phase-10-i-touch-optimization.prd.md) (機能パリティを達成、本 PRD は UX 達成を担当)
- 隣接: 本 PRD は **Phase 10.H (ランディング条件付き拡張) の前** に配置し、**Phase 10.F (ドメイン取得 + v1.0.0)** を `blockedBy` する
- ADR: [`ADR-0006`](../../../docs/adr/ADR-0006-pointer-events-unification.md) (Pointer Events 一本化、本 PRD の前提) を継承、本 PRD と同一 PR で [`ADR-0007`](../../../docs/adr/ADR-0007-touch-ux-standards.md) (Touch UX Standards) を起票
- 引き継ぎ docs: [`phase-10-j-touch-ux-handoff.md`](../handoff/phase-10-j-touch-ux-handoff.md) (前セッション末で起票)

---

## Problem Statement

snap-share は Phase 10.I で **touch デバイスでの機能パリティ** (描画 / 移動 / リサイズ / テキスト編集 / pinch zoom / pan) を達成し、emulation E2E (Playwright `mobile-chrome` Pixel 5) は 22 件全緑になった。しかし 2026-05-09 のユーザー実機検証で **iPhone Safari / Android Chrome の実機では touch UX 業界標準に達していない** ことが判明した。具体的には (a) シングルタップで shape を選択できない (Konva の `onClick` は mouse 専用、touch では `onTap` が別発火する規約に未対応)、(b) 長押しコンテキストメニューが皆無で削除 / 複製 / 順序変更がツールバー往復必須、(c) emulation E2E では `page.mouse` 経由で発火しており実機 `touchstart/touchend/tap` 経路は触れていないため CI 緑が実機保証になっていない。これを未解決のまま v1.0.0 を公開すると、PC を開かない場面 (通勤 / カフェ / リビング) を主用途とする想定ユーザーが「描けるけど PC 同等の操作感がない」状態に直面し、snap-share の核価値 (URL 一発で双方向に注釈を当てる) が PC 比で半分以下の生産性に留まる。

## Evidence

- **直接観測 (確定)**: 著者 (imotako) が iPhone Safari で実機検証し、「四角形を一度書いた後、シングルタップしても選択状態にならず Transformer が出ない、リサイズもテキスト変更もできない」を確認 (2026-05-09 セッション末)
- **コード根拠 (確定)**:
  - `apps/web/src/components/canvas/shapes/RectangleShape.tsx:63` — `onClick` のみ、`onTap` 未配線
  - `apps/web/src/components/canvas/shapes/ArrowShape.tsx:69` — `onClick` のみ、`onTap` 未配線
  - `apps/web/src/components/canvas/shapes/ArrowShape.tsx:81,98` (Circle handle) — `onPointerDown` のみ、`onTouchStart` 未配線 (`cancelBubble` 確保のため touch 対が必要)
  - `apps/web/src/components/canvas/shapes/HighlightShape.tsx:63` — `onClick` のみ、`onTap` 未配線
  - `apps/web/src/components/canvas/shapes/TextShape.tsx:41` — `onClick` のみ、`onTap` 未配線 (`onDblTap` は post-review fix で line 49 に追加済)
  - `apps/web/e2e/touch-acceptance.spec.ts` 12 件 / `apps/web/e2e/touch-acceptance-edit.spec.ts` 7 件 — `page.mouse.move/down/up` 経由で発火、実機 touch event 経路を通らない
- **業界調査根拠** (Phase 10.J Plan 起票時に context7 / GitHub / 一次資料で再確認):
  - Konva 公式 [Desktop_and_Mobile.mdx](https://konvajs.org/docs/events/Desktop_and_Mobile.html): `click + tap` / `dblclick + dbltap` の paired binding が canonical
  - Excalidraw [`packages/common/src/constants.ts`](https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts): `TOUCH_CTX_MENU_TIMEOUT = 500` / `TAP_TWICE_TIMEOUT = 300` / `DOUBLE_TAP_POSITION_THRESHOLD = 35` で長押しコンテキストメニュー実装
  - tldraw v3 [`packages/editor/src/lib/options.ts`](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/options.ts): `longPressDurationMs: 500` / `coarseDragDistanceSquared: 36` / `coarseHandleRadius: 20`
  - Apple HIG / Android `ViewConfiguration`: long-press 500ms、touch slop 6-10px、最小 tap target 44pt / 48dp で OS 標準値が一致
  - Playwright [Touchscreen API](https://playwright.dev/docs/api/class-touchscreen) / [Touch events](https://playwright.dev/docs/touch-events): `dispatchEvent('touchstart')` 経路が `page.mouse` の数倍の精度で実機 touch を再現
- **方針転換の意思決定 (確定)**:
  - Phase 10.I PRD で「長押しメニューは Excalidraw でも誤発火多発のため Won't」と決めた仮説が、実機 UX 検証で「業界標準では事実上必須」と判明し、Should に格上げ (誤発火対策は実装で工夫)
  - Phase 10.I PRD で「emulation E2E 緑 = Acceptance Criteria 達成」と扱った仮説が、実機検証で「emulation ≠ 実機」と判明し、Phase 10.J では実機 QA を Must (ブロッカー) に格上げ

## Proposed Solution

ADR-0007 で **Konva の paired event binding 規約 (`click + tap` / `dblclick + dbltap`)** をリポジトリの canonical として明文化し、全 Shape (`Rectangle / Arrow / Highlight / Text`) の event handler を一斉に paired 化する。同時に **タイミング定数の SSOT** (`apps/web/src/lib/touch-thresholds.ts`) を新設し、`LONG_PRESS_DURATION_MS = 500` / `DOUBLE_TAP_INTERVAL_MS = 300` / `DRAG_SLOP_PX_COARSE = 6` などの数値を業界標準値で統一する。**長押しコンテキストメニュー** を `useLongPress` hook + `ContextMenu.tsx` で新規実装し、**500ms 押下 + 6px 以下の移動 + 250ms opacity fade の visual feedback** で誤発火を抑える業界標準パターンに準拠する。**Transformer の coarse anchor を 20px** (tldraw `coarseHandleRadius`) に再調整し、Phase 10.I-2 で採った 24px から業界標準値に揃える。**E2E 経路は `dispatchEvent('touchstart')` を default 化** し、`page.mouse` を desktop-only に分離。`apps/web/e2e/fixtures/touch-helpers.ts` (Phase 10.I-4 既存) に `touchSequence(page, [...])` wrapper を追加し、19 件の既存 spec を移行する。最後に **実機 QA を Acceptance Criteria の Must (ブロッカー)** に格上げし、`docs/qa/phase-10-j-touch-manual-qa.md` (10.I の v2 拡張) のチェックリスト 100% 通過を merge 条件にする。

代替案として「Konva の `pointerType` 単一経路に全 shape 統一」も比較検討した。これは shape 単位の `onClick + onTap` ペア配線を不要にできるが、Konva 公式は **shape 単位の paired binding を canonical** として明示しており、`<Stage>` 経路に集約すると Konva 内部の hit test 最適化と `dbltap` の 450ms 検出を捨てるトレードオフが大きい。本 PRD では paired binding を採用する (詳細は ADR-0007 Alternatives Considered 節)。

## Key Hypothesis

We believe **paired event binding (`click + tap`) + 長押しコンテキストメニュー (500ms / 6px slop) + Transformer coarse anchor 20px + dispatchEvent E2E 経路 + 実機 QA Must 化** will **「実機 iPhone Safari / Android Chrome で snap-share の全操作 (選択 / 移動 / リサイズ / テキスト編集 / 削除 / 複製) が PC と同じ感覚で完遂できる」を実現する** for **iPhone Safari / Android Chrome を主デバイスとする個人ユーザー and 共有 URL を踏むモバイル受信者**.
We'll know we're right when **実機 (iPhone Safari + Android Chrome 各 1 台) で `docs/qa/phase-10-j-touch-manual-qa.md` のチェックリスト 100% 通過 + 著者 + 知人 1 名以上による「PC 比で操作感に違和感がない」定性評価が得られる**。

## What We're NOT Building

- **palm rejection / ペンモード** — tldraw でも完全には未解決 ([Issue #4086](https://github.com/tldraw/tldraw/issues/4086))。Phase 10.I PRD と同方針で v1.0.0 対象外。Phase 11+ で必要なら別 PRD
- **Material ripple / iOS haptic level の押下インジケータ** — `opacity 1 → 0.85` の 250ms fade で十分。`navigator.vibrate(15)` (Android only) のみ採用
- **3 本指ジェスチャ (undo / redo / pan 等)** — iOS Safari にブラウザ側で奪われる。Phase 10.I PRD と同方針
- **ダブルタップでズーム切替** — iOS native double-tap zoom と競合。Phase 10.I PRD と同方針
- **モバイル専用エディタレイアウト分岐** — Phase 10.I PRD と同方針、responsive CSS で吸収
- **コピー / ペースト** — annotation の clipboard 連携は Phase 10.K 以降
- **複数選択 (Shift-tap / Drag select on touch)** — touch では実装複雑度が高く、業界 (Excalidraw / tldraw) でも難物。Phase 11+ で必要なら別 PRD
- **shape 回転 (Rotate handle on touch)** — Konva Transformer の `rotateAnchorOffset` を coarse 時に拡大する程度に留め、専用 UI は提供しない
- **長押しメニューでの色変更 / フォントサイズ変更** — 削除 / 複製 / 前面 / 背面の 4 項目のみ Phase 10.J-2 で実装。プロパティ編集は Phase 10.K 以降
- **PWA / Service Worker / install banner** — ADR-0003 (Web 単独) を継承
- **モバイルでの新規機能追加** — 本 PRD は「PC 同等の操作感 (UX 達成)」のみ。新規機能 (例: モバイル特化短縮ジェスチャ) は対象外

## Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| **paired binding 完成度** | 全 4 Shape (`Rectangle / Arrow / Highlight / Text`) で `onClick + onTap` / `onDblClick + onDblTap` が両方 bind されている | unit test で hardcode assertion (paired binding lint 等価) |
| **実機 touch UX 受入** | iPhone Safari + Android Chrome 各 1 台で `docs/qa/phase-10-j-touch-manual-qa.md` のチェックリスト 100% 通過 (= **Must / merge ブロッカー**) | 著者 + 知人 1 名以上による手動 QA |
| **長押し context menu 動作** | shape 上で 500ms 押下 → context menu が pop、移動量 6px 超でキャンセル、削除 / 複製 / 前面 / 背面の 4 項目が動作 | 手動 QA + Playwright touch E2E (dispatchEvent 経路) |
| **誤発火率** | 5 連続 long-press 試行で 1 回未満の誤発火 (移動意図でのメニュー誤発火 / shape 移動意図での long-press 成立) | 手動 QA で著者 + 知人による dogfood |
| **dispatchEvent E2E 緑** | Phase 10.I 時の 19 件 + Phase 10.J 新規 (paired binding + long-press menu) を `dispatchEvent` 経路で書き直して全緑 | CI (`pnpm test:e2e -- --project=mobile-chrome`) |
| **デスクトップ非劣化** | 既存 unit / chromium E2E (Phase 10.I 時の 78 件) が **すべて緑**、PC で `onClick + onTap` 両方 bind してもイベント二重発火しない | `pnpm test` + `pnpm test:e2e -- --project=chromium` + 手動 PC 確認 |
| **CWV 維持** (mobile) | LCP < 2.5s / INP < 200ms / CLS < 0.1 (Phase 10.I 基準を割らない) | Lighthouse mobile profile (build 後の手動 spot check) |
| **共同編集 mobile→PC** | 長押し削除 / 複製も含む全操作が 1 秒以内に PC ピアに反映 / 逆方向も同じ | 手動 2 デバイス連携テスト |

## Open Questions

- [ ] **Q1**: paired binding の強制方法を「unit test での assertion」「ESLint custom rule」「runtime warning」のどれにするか → **暫定**: unit test で hardcode assertion (実装最軽量、CI で検出)。ESLint custom rule は Phase 11+ に retainer
- [ ] **Q2**: 長押し context menu の項目順 (削除 / 複製 / 前面 / 背面) を Material / iOS どちらの慣習に合わせるか → **暫定**: Material 寄り (削除を最後に置く誤タップ回避)。iPhone QA で違和感あれば iOS 慣習に変更
- [ ] **Q3**: `useLongPress` hook を共通化するか shape ごとに inline 実装するか → **暫定**: 共通 hook (`apps/web/src/hooks/useLongPress.ts`)。Phase 11+ で長押し用途が増えても拡張容易
- [ ] **Q4**: Transformer coarse anchor を Phase 10.I-2 で採った 24px から 20px に下げる際、ヒットエリアは現状の `HIT_STROKE_WIDTH_TOUCH` (= 拡大値) を維持するか → **暫定**: 維持 (視覚 20px / hit 44px)。実機 QA で操作感が劣化したら 22px に妥協
- [ ] **Q5**: `dispatchEvent` 経路の `Event.isTrusted = false` を本リポジトリのコードが参照していないことを Phase 10.J-1 で grep 確認するか → **暫定**: Plan 起票時に grep 1 発で確認 (確認だけなら 1 分)
- [ ] **Q6**: 実機 QA で「PC 比で操作感に違和感がない」を測る定性指標を SUS (System Usability Scale) のような形式に落とすか → **暫定**: 落とさない。チェックリスト形式 (Phase 10.I の v2 拡張) で十分
- [ ] **Q7**: Phase 10.J 完了後、`docs/qa/phase-10-i-touch-manual-qa.md` を `docs/qa/phase-10-j-touch-manual-qa.md` に renaming するか並存させるか → **暫定**: 10.J が 10.I の上位互換のため renaming で良い (10.I 時点の checklist は git history で参照可能)
- [ ] **Q8**: Phase 10.J 完了後の Phase 10.K (= 色変更 / フォントサイズ変更などのプロパティ編集メニュー) を別 PRD で起票するか、Phase 11 に送るか → **暫定**: Phase 11 候補 (公開後の field data で重要度判断)

---

## Users & Context

### Primary User

- **Who**: 通勤中・カフェ・リビング等 **PC を開かない場面で** スクショに注釈を当てて共有したい個人。デバイスは iPhone (Safari) または Android (Chrome)。Phase 10.I PRD と同一 user persona
- **Current behavior (Phase 10.I 完了後の現状)**: スマホで描画 / 移動 / pinch zoom はできるようになったが、shape を選択するために **「もう一度同じツールを選んで描き直す」** か **「PC を開いて修正」** という回避策を取らざるを得ない。長押しでメニューが出ることを想定したが何も起こらず、削除はツールバーボタンから (= shape 選択 → ツールバーまで親指移動 → 削除アイコン) の 3 ホップ
- **Trigger** (Phase 10.I PRD と同一): 知人から共有 URL を受信、またはスクショ取得直後の即時編集
- **Success state (Phase 10.J 達成時)**: スマホ単体で 4 種 annotation を当て、間違えたら長押しで即削除 / 複製、PC ピアともリアルタイムに同期できた状態で URL を返す。**「PC で操作するのと同じ感覚」と感じる**

### Job to Be Done

When **スマホで snap-share エディタを操作中、(a) 既存 shape を選択してリサイズしたい、(b) 描いた shape を削除 / 複製したい、(c) テキストを再編集したいとき**, I want to **PC と同じ感覚で「タップで選択」「長押しでメニュー」「ダブルタップで編集」が直感的に動く**, so I can **PC を開かずスマホ単体で snap-share の全操作を完遂し、共有 URL を返せる**.

### Non-Users (明示的に対象外)

- Phase 10.I PRD と同一 (palm rejection / pen 入力 / モバイルネイティブ志向 / 永続ナレッジ層 などは対象外)
- 追加で、**長押しでプロパティ編集 (色 / フォントサイズ等) を期待するユーザー** は Phase 11+ で対応 (本 PRD では削除 / 複製 / 順序変更のみ)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | **Konva paired event binding 規約の全 Shape 適用** (`onClick + onTap` / `onDblClick + onDblTap` / `onMouseDown + onTouchStart` 必要箇所) | Konva 公式 canonical、実機 touch で shape 選択を可能にする最小要件 |
| Must | **タイミング定数 SSOT** (`apps/web/src/lib/touch-thresholds.ts`) | 業界標準値の根拠を ADR-0007 + コードに集約、Phase 10.J-2 以降の実装の前提 |
| Must | **長押しコンテキストメニュー** (`useLongPress` hook + `ContextMenu.tsx`) | 業界標準必須、ツールバー往復を解消 |
| Must | **`useLongPress` の誤発火対策** (500ms + 6px slop + 250ms opacity fade) | 業界標準パターン、Excalidraw の前例失敗を回避 |
| Must | **Context menu の 4 項目** (削除 / 複製 / 前面へ / 背面へ) | 最小限の必要操作、shape 編集の核 |
| Must | **Transformer coarse anchor 20px に再調整** | tldraw `coarseHandleRadius` 業界標準値に合わせる、Phase 10.I-2 の 24px から下げる |
| Must | **E2E `dispatchEvent` 経路 default 化 + `touchSequence` helper 拡張** | 実機 touch 検証の信頼性、`page.mouse` は desktop-only に分離 |
| Must | **実機 QA Acceptance Criteria への組み込み** (`docs/qa/phase-10-j-touch-manual-qa.md`) | merge ブロッカー化、emulation E2E 緑 ≠ 受入を明文化 |
| Must | **paired binding の unit test assertion** | CI で配線漏れを検出、Phase 10.I-2 の `useTouchDevice` test と同じスタイル |
| Should | **`navigator.vibrate(15)`** (Android のみ) | 低リスク高 UX、iOS Safari は無視 |
| Should | **画面端での context menu フリップ** | 画面端 shape の長押し時の使い勝手 |
| Should | **Phase 10.I 既存 19 spec の dispatchEvent 経路 migration** | 既存 spec の実機保証化、Phase 10.J-4 で完了 |
| Could | **iPhone 14 emulation の `chromium-mobile-ios` project 追加** | iOS 寄り coarse pointer 検証 |
| Won't | palm rejection / ペンモード | Phase 10.I と同方針 |
| Won't | 色変更 / フォントサイズ変更 in context menu | Phase 11+ 候補 |
| Won't | 複数選択 / Shift-tap / Drag select on touch | 実装複雑度過大 |
| Won't | コピー / ペースト | Phase 10.K 以降 |
| Won't | shape 回転専用 UI | Konva Transformer の `rotateAnchorOffset` 拡大で十分 |
| Won't | Material ripple / iOS haptic | opacity fade + Android vibrate で十分 |
| Won't | 3 本指ジェスチャ / ダブルタップ zoom | Phase 10.I と同方針 |
| Won't | モバイル専用 UI 分岐 / `react-router` 分離 | Phase 10.I と同方針 |
| Won't | PWA / Service Worker | ADR-0003 |

### MVP Scope

**「実機 iPhone Safari + Android Chrome で 4 種 shape の選択 / 移動 / リサイズ / 削除 / 複製 / テキスト編集が PC と同じ感覚で動き、デスクトップが非劣化」** を MVP とする。

最小達成セット:
1. ADR-0007 起票 + 全 Shape の paired binding 適用 (Phase 10.J-1)
2. `touch-thresholds.ts` SSOT + `useLongPress` hook + `ContextMenu.tsx` 実装 + 4 項目メニュー (Phase 10.J-2)
3. Transformer coarse anchor 20px 再調整 + サイズ定数整合 (Phase 10.J-3)
4. E2E `dispatchEvent` 経路 migration + 既存 19 spec 書き直し + 新規 paired binding spec / long-press menu spec (Phase 10.J-4)
5. `docs/qa/phase-10-j-touch-manual-qa.md` 拡張 + iPhone Safari + Android Chrome 実機 QA 100% 通過 (Phase 10.J-4)
6. Phase 10.J 全体の umbrella report (10.J-4 個別 report は umbrella で代替)

`navigator.vibrate(15)` / 画面端フリップ / iPhone 14 emulation project は **Should / Could** で MVP 外。MVP 完了後に実機 QA 結果で必要なら個別追加。

### User Flow

**スマホ受信者ケース (Phase 10.J 達成時の理想動線):**
1. ユーザー A (PC) が画像をアップして注釈を入れ、URL を共有
2. ユーザー B (スマホ) が URL を踏む → エディタ画面が表示
3. B は画面下部のツールバーから矩形を選択 → 画面を指でドラッグ → 矩形が描画される (Phase 10.I で達成済)
4. B は selection ツールに切り替え → **既存矩形をシングルタップ → 選択状態 (Transformer 表示)** ← **Phase 10.J-1 の成果**
5. B が **Transformer 角ハンドルをドラッグ → リサイズ** ← **Phase 10.J-3 の Transformer coarse anchor で実機で掴める**
6. B が **テキストを描いた後、シングルタップで選択 → ダブルタップで編集モード進入** ← **Phase 10.J-1 の `onDblTap` 配線**
7. B が **間違えた矩形を 500ms 長押し → context menu 表示 → 「削除」タップ** ← **Phase 10.J-2 の成果**
8. B が **完成した矢印を長押し → 「複製」 → 同じ矢印が 1 つ追加される** ← Phase 10.J-2 の成果
9. B のテキスト編集時に IME が出る (Phase 10.I-2 / Phase 10.G で対応済 or 検討中)
10. A の PC に B の編集が 1 秒以内に反映 (Phase 4 既達成)

---

## Technical Approach

**Feasibility**: **HIGH**

- Phase 10.I で確立した Pointer Events 一本化 (ADR-0006) と TouchEvent 併用 (Status Update) は本 PRD でも維持され、Shape 単位の paired binding は **追加 props 配線のみ** で達成可能 (既存 logic はそのまま)
- `useLongPress` hook の実装は Excalidraw / tldraw の OSS 実装 (`useEffect` で `setTimeout` 管理 + `pointermove` で slop 監視) を pattern として転用可能。300-500 LOC 程度で完了見込み
- `ContextMenu.tsx` は Phase 7.7 で導入した shadcn/ui の `Popover` コンポーネント (要確認、なければ自前実装) を流用、Tailwind v4 で responsive 化
- Konva Transformer は `anchorSize` prop で動的サイズ切替が可能で、`useTouchDevice` (Phase 10.I-2) で coarse / fine 分岐
- `dispatchEvent('touchstart')` 経路は Playwright 公式 [Touch events docs](https://playwright.dev/docs/touch-events) に書き方サンプルあり、`apps/web/e2e/fixtures/touch-helpers.ts` 拡張で wrapper 化

**Architecture Notes**

- **新規ファイル**:
  - `apps/web/src/lib/touch-thresholds.ts` — タイミング定数 SSOT (D2)
  - `apps/web/src/hooks/useLongPress.ts` — 長押し timer 管理 hook
  - `apps/web/src/hooks/__tests__/useLongPress.test.tsx` — hook unit test (timer / slop / cancel パス)
  - `apps/web/src/components/canvas/ContextMenu.tsx` — 長押し経由 context menu UI
  - `apps/web/src/components/canvas/__tests__/ContextMenu.test.tsx` — UI unit test
  - `docs/qa/phase-10-j-touch-manual-qa.md` — 実機 QA チェックリスト (10.I の v2 拡張)
- **修正対象**:
  - `apps/web/src/components/canvas/shapes/RectangleShape.tsx` — `onTap` 追加
  - `apps/web/src/components/canvas/shapes/ArrowShape.tsx` — `onTap` 追加 + Circle handle の `onTouchStart`
  - `apps/web/src/components/canvas/shapes/HighlightShape.tsx` — `onTap` 追加
  - `apps/web/src/components/canvas/shapes/TextShape.tsx` — `onTap` 追加 (`onDblTap` は既追加)
  - `apps/web/src/components/canvas/shapes/__tests__/*.test.tsx` — paired binding assertion 追加
  - `apps/web/src/components/canvas/colors.ts` — `ANCHOR_SIZE_TOUCH 24 → 20`、必要に応じて `MIN_TAP_TARGET_PX` / `HIT_TEST_MARGIN_PX` 定数化
  - `apps/web/src/components/canvas/AnnotationLayer.tsx` — context menu state を holding する想定 (詳細は Plan で確定)
  - `apps/web/e2e/fixtures/touch-helpers.ts` — `touchSequence` wrapper 追加
  - `apps/web/e2e/touch-acceptance.spec.ts` 12 件 / `apps/web/e2e/touch-acceptance-edit.spec.ts` 7 件 — `page.mouse` → `dispatchEvent` 経路に migration
  - `apps/web/playwright.config.ts` — (任意) `chromium-mobile-ios` project 追加検討

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| paired binding 配線で onClick / onTap 両方発火し dispatch が二重起動 | High | Phase 10.J-1 で React 19 の合成イベント挙動を grep + 1 spec で検証。Konva は内部で重複発火を抑止する設計のため理論上問題ないが念のため確認 |
| `useLongPress` が iOS Safari の `pointercancel` 挙動 (system gesture 介入) で誤キャンセル | Medium | tldraw の iOS 例外コードを参考に、`pointercancel` を long-press 成立後にも受けつつ menu 表示は維持する分岐 |
| `dispatchEvent('touchstart')` 経路で `Event.isTrusted = false` が React event handler で fallthrough する | Low | Phase 10.J-1 で grep 確認 (`isTrusted` 参照箇所がないことの sanity check) |
| 既存 19 件 E2E migration が回帰の温床になる | High | Phase 10.J-4 で 1 spec ずつ書き直し、各 spec で旧テストの assertion を維持。CI で `mobile-chrome` 緑を keep |
| `navigator.vibrate(15)` が一部 Android Chrome version でクラッシュ / 警告 | Low | try/catch で safety net。MDN で API 仕様確認、サポート 96%+ |
| Transformer 24→20px 変更で実機ハンドルが指で掴みにくくなる | Medium | 実機 QA で確認、不具合あれば 22px に妥協 (D3 の escape hatch) |
| Phase 10.K 以降 (色変更等の context menu 拡張) でメニュー UI を作り直す手戻り | Low | Phase 10.J 段階で `ContextMenu.tsx` の API を「項目配列 + onSelect callback」の汎用 props にしておく (Plan で確定) |
| 実機 QA を Must 化したことで PR cycle time が増加 | Medium | チェックリスト形式で時間制限 (各デバイス 30 分以内 / 全体 1 時間以内) を設定 |

---

## Implementation Phases

> ECC PRP 規約: 本 PRD は **umbrella plan** ではなく **PRD 単位 1 ブランチ 1 PR** (memory: feedback_branch_per_phase)。sub-step は 1 ブランチ内で順次コミットで区切る。

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 10.J-1 | paired binding 規約適用 + タイミング定数 SSOT | ADR-0007 起票、`apps/web/src/lib/touch-thresholds.ts` 新設、全 4 Shape の `onClick + onTap` / `onDblClick + onDblTap` 配線 + Circle handle の `onTouchStart`、unit test で paired binding assertion 追加、`Event.isTrusted` の grep 確認 | pending | - | - | TBD |
| 10.J-2 | 長押しコンテキストメニュー実装 | `useLongPress` hook + `ContextMenu.tsx` + 4 項目メニュー (削除 / 複製 / 前面 / 背面)、誤発火対策 (500ms + 6px slop + 250ms opacity fade)、`navigator.vibrate(15)` Android only | pending | with 10.J-3 | 10.J-1 | TBD |
| 10.J-3 | Transformer coarse anchor 再調整 + サイズ定数整合 | `colors.ts` の `ANCHOR_SIZE_TOUCH 24 → 20`、`MIN_TAP_TARGET_PX` / `HIT_TEST_MARGIN_PX` の定数化、touch device での visual 検証 | pending | with 10.J-2 | 10.J-1 | TBD |
| 10.J-4 | E2E migration + 実機 QA + umbrella report | `touchSequence` helper 拡張、既存 19 spec を `dispatchEvent` 経路に migration、新規 spec (paired binding + long-press menu) 追加、`docs/qa/phase-10-j-touch-manual-qa.md` 拡張、iPhone Safari + Android Chrome 実機 QA 100% 通過、Phase 10.J 全体の umbrella report | pending | - | 10.J-2, 10.J-3 | TBD |

### Phase Details

**Phase 10.J-1: paired binding 規約適用 + タイミング定数 SSOT (Must の中核)**
- **Goal**: 全 Shape で `onClick + onTap` / `onDblClick + onDblTap` 配線完了 + タイミング定数を SSOT 化
- **Scope**:
  - ADR-0007 (`docs/adr/ADR-0007-touch-ux-standards.md`) 起票 (本 PRD と同一 PR)
  - `apps/web/src/lib/touch-thresholds.ts` 新設 (5 定数: `LONG_PRESS_DURATION_MS / DOUBLE_TAP_INTERVAL_MS / DOUBLE_TAP_POSITION_THRESHOLD_PX / DRAG_SLOP_PX_FINE / DRAG_SLOP_PX_COARSE`)
  - `RectangleShape.tsx` / `ArrowShape.tsx` / `HighlightShape.tsx` / `TextShape.tsx` の `onTap` 追加
  - `ArrowShape.tsx` Circle handle の `onTouchStart` 追加 (`cancelBubble` 確保)
  - 各 Shape の unit test で paired binding assertion 追加 (`getByRole` ではなく Konva Group の prop 配線を直接検証)
  - `Event.isTrusted` の grep 確認 (参照箇所ゼロを確認)
- **Success signal**: 全 Shape で paired binding unit test 緑 + Phase 10.I 既存 test 全緑 + chromium / mobile-chrome E2E 全緑

**Phase 10.J-2: 長押しコンテキストメニュー実装 (Must の中核、10.J-3 と並走可)**
- **Goal**: 全 Shape で 500ms 長押し → context menu 表示 → 4 項目 (削除 / 複製 / 前面 / 背面) 動作
- **Scope**:
  - `apps/web/src/hooks/useLongPress.ts` 実装 (500ms timer + 6px slop + cancel 条件 + visual feedback callback)
  - `apps/web/src/hooks/__tests__/useLongPress.test.tsx` (timer fake / slop / cancel パス)
  - `apps/web/src/components/canvas/ContextMenu.tsx` 実装 (項目配列 + onSelect callback の汎用 props、画面端 flip は Should)
  - `apps/web/src/components/canvas/__tests__/ContextMenu.test.tsx`
  - 全 Shape で `useLongPress` を hook 経由で配線
  - `AnnotationLayer.tsx` で context menu の state 管理 (open / position / target shape ID)
  - 削除 / 複製 / 前面 / 背面の dispatch を annotations store に追加 (既存 reducer に action 追加)
  - `navigator.vibrate(15)` を long-press 成立時に呼ぶ (try/catch safety net)
- **Success signal**: 4 項目すべて動作 + 誤発火率 1/5 未満 (手動 dogfood)

**Phase 10.J-3: Transformer coarse anchor 再調整 + サイズ定数整合 (10.J-2 と並走可)**
- **Goal**: tldraw 業界標準値 (20px) に揃え、サイズ定数を SSOT 化
- **Scope**:
  - `colors.ts` の `ANCHOR_SIZE_TOUCH 24 → 20`
  - `MIN_TAP_TARGET_PX = 44` / `HIT_TEST_MARGIN_PX = 8` を定数化 (どこに置くかは Plan で確定、`colors.ts` か `touch-thresholds.ts` か)
  - 必要なら Phase 10.I-3 で導入した Tailwind の `min-w-11 min-h-11` を定数経由に refactor
  - 実機での visual 検証 (Phase 10.J-4 の QA で確認)
- **Success signal**: chromium / mobile-chrome E2E 全緑 + 視覚回帰なし (手動 PC 確認)

**Phase 10.J-4: E2E migration + 実機 QA + umbrella report (Must、最終工程)**
- **Goal**: Acceptance Criteria を自動 + 実機の両方で達成証明
- **Scope**:
  - `apps/web/e2e/fixtures/touch-helpers.ts` に `touchSequence(page, [{action: 'down', x, y}, {action: 'wait', ms: 600}, {action: 'up'}])` wrapper 追加
  - 既存 19 件 (`touch-acceptance.spec.ts` 12 件 + `touch-acceptance-edit.spec.ts` 7 件) を `dispatchEvent` 経路に書き直し (1 spec ずつ migration)
  - 新規 spec: 全 Shape の paired binding (`onTap` 経路で shape 選択が動く) + long-press menu (4 項目動作) + Transformer touch resize
  - `docs/qa/phase-10-i-touch-manual-qa.md` を `docs/qa/phase-10-j-touch-manual-qa.md` に renaming + Phase 10.J の項目を追加 (paired binding / long-press menu / Transformer 20px)
  - iPhone Safari + Android Chrome 実機 QA 100% 通過 (著者 + 知人 1 名)
  - Phase 10.J 全体の umbrella report (`reports/phase-10-j-umbrella-report.md`)
- **Success signal**: Playwright 全緑 + 手動チェックリスト 100% + 誤操作率 < 1/5 + CWV 非劣化

### Parallelism Notes

- **10.J-1 が gating**: paired binding と タイミング定数 SSOT が完了しないと 10.J-2 / 10.J-3 のいずれも着手不能
- **10.J-2 ↔ 10.J-3 は並列可**: surface が完全に異なる (long-press hook + context menu UI vs Transformer 設定)。同 PR 内で別コミットとして並行作業可能
- **10.J-4 は最後**: 実装が一通り揃ってからでないと E2E migration / 実機 QA の意味がない

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Konva event 配線方式 | shape 単位での paired binding (`onClick + onTap`) | (a) `pointerType` 単一経路に集約 (b) `<Stage>` の hit test で全 shape 選択を中央処理 | Konva 公式 (Desktop_and_Mobile.mdx) が canonical として明示。Konva 内部の hit test 最適化と `dbltap` 検出を捨てたくない |
| 長押し閾値 | **500ms** | tldraw 500 / Excalidraw 500 / iOS / Android 全社一致のため固定 | 業界標準収束値。短くする (300ms) と誤発火増、長くする (700ms) と反応が遅く感じる |
| drag slop (touch) | **6px** | tldraw `coarseDragDistanceSquared = 36` (= 6²) を採用 | tldraw 業界標準。Excalidraw `DRAGGING_THRESHOLD = 10` よりタイトだが、誤発火減で正解 |
| Transformer coarse anchor | **20px** に再調整 (Phase 10.I-2 の 24px から下げる) | (a) 24px 維持 (b) 22px 妥協 | tldraw `coarseHandleRadius = 20` 業界標準値に揃える。実機 QA で操作感劣化があれば 22px に escape (D3) |
| context menu 項目 | 削除 / 複製 / 前面 / 背面 の 4 項目 | (a) + 色変更 / フォントサイズ (b) + コピー / ペースト (c) 削除のみ | プロパティ編集は Phase 11+ 候補、削除のみだと Phase 10.J の価値が薄い |
| 誤発火対策 | 500ms + 6px slop + 250ms opacity fade + Android `vibrate(15)` | (a) Material ripple (b) iOS haptic (c) 視覚 feedback なし | 業界標準パターン (Excalidraw / tldraw) と一致、実装コスト最軽量 |
| E2E 経路 | `dispatchEvent('touchstart')` を default、CDPSession を限定使用 | (a) `page.touchscreen.tap` を default (single tap 専用) (b) CDPSession のみで全部書く | `dispatchEvent` は表現力高 + Chromium 以外でも動作。`isTrusted=false` の制約は本リポジトリに無害 |
| 実機 QA | Acceptance Criteria の Must (merge ブロッカー) | (a) Should (推奨止まり、Phase 10.I と同方針) (b) Phase 10.K まで送る | Phase 10.I で「emulation 緑 = 受入」と扱った仮説が破綻。本 PRD では emulation E2E + 実機 QA の two-tier を明文化 |
| Phase 配置 | Phase 10.J 新設 (10.I の後、10.H の前) | (a) Phase 10.I-5 として sub-phase に追加 (b) Phase 10.K として後送 | Phase 10.I の Acceptance Criteria は機能パリティで達成済 (PR #21 merge 済)。本 PRD は UX 達成という別 PRD レベルの問題範囲のため、新 PRD として独立 |
| 長押しメニューの Won't 撤回 | Phase 10.I PRD の Won't「長押しメニュー」を Should/Must に格上げ | (a) Won't 維持、Phase 11+ で対応 (b) Won't 維持、ツールバーのみで代替 | 業界標準 (Keynote / Slides / Figma / Excalidraw / tldraw 全社) で touch 削除 = long-press menu が事実上必須。Phase 10.I PRD の判断は実機検証で覆った |
| ADR 起票 | ADR-0007 を本 PRD と同一 PR で起票 | (a) Plan 起票時に ADR-0007 を別 commit (b) Phase 10.J-1 着工時に起票 | Phase 10.I で「ADR-0006 を Plan 内」とした方針と一致、PRD merge 時に ADR も Accepted 化する |

---

## Research Summary

**Market Context** (Phase 3 grounding 結果)

- **Konva 公式**: [Desktop_and_Mobile.mdx](https://konvajs.org/docs/events/Desktop_and_Mobile.html) で `click + tap` / `dblclick + dbltap` の paired binding を canonical として明示。`Multi-touch_Scale_Stage.mdx` の touch event 経路は Phase 10.I-2 で採用済 (ADR-0006 Status Update)
- **Excalidraw**: `packages/common/src/constants.ts` で `TOUCH_CTX_MENU_TIMEOUT = 500` / `TAP_TWICE_TIMEOUT = 300` / `DRAGGING_THRESHOLD = 10` / `DOUBLE_TAP_POSITION_THRESHOLD = 35` を定数化。touch context menu は数年運用で誤発火問題は閾値と visual feedback で解消済
- **tldraw v3**: `packages/editor/src/lib/options.ts` で `longPressDurationMs: 500` / `coarseDragDistanceSquared: 36` (= 6²) / `coarseHandleRadius: 20` / `coarsePointerWidth: 12` / `hitTestMargin: 8`。fine / coarse pointer の adaptive sizing が業界 SOTA
- **Apple HIG / Material Design 3**: long-press 500ms / double-tap 300ms / touch slop 6-10px / 最小 tap target 44pt (iOS) / 48dp (Android) で OS 標準値が一致
- **Playwright 公式**: `dispatchEvent('touchstart')` 経路は `Event.isTrusted = false` の制約のみで、本リポジトリのコードが `isTrusted` 参照していなければ問題なし。`page.touchscreen.tap` は single tap 専用で long-press / pinch 不可、CDPSession `Input.dispatchTouchEvent` は本物 touch だが Chromium 専用

**Technical Context** (codebase 探索結果)

- 破綻原因: 全 Shape で `onClick` のみ配線、`onTap` 未配線 (確度 100%、コード grep 確認済)
- TextShape の `onDblTap` のみ Phase 10.I post-review fix で追加済 (commit 052252f)
- `useTouchDevice` (Phase 10.I-2) / `Konva.hitOnDragEnabled = true` (Phase 10.I-2) は本 PRD の前提条件として整備済
- 改修コスト: M (中規模)。`useLongPress` hook + `ContextMenu.tsx` の新規実装が最大の作業量、推定 800-1200 LOC
- 既存 19 件 E2E の `dispatchEvent` 経路 migration はメカニカルな書き換えで、各 spec 30-60 分の見積もり

---

*Generated: 2026-05-09*
*Status: DRAFT - Plan 起票待ち / snap-share.prd.md Phase テーブル更新待ち / ADR-0007 起票済*
