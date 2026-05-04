# Phase 7.8: 次手予測 UX(矢印→テキスト / 矩形→矢印 + Smart snap + フォントサイズ UI)

## Problem Statement

Phase 7.7 で「業界標準の基本操作(リサイズ/色/ズーム/キーボード完結)」が整い、snap-share は「Figjam 60 点劣化版」から脱した。しかし業界標準を満たしただけでは Shottr / Skitch / CleanShot X / FigJam と並ぶ選択肢の 1 つでしかなく、業務スクショ注釈という具体ユースケースで「これでないと困る」体験には至っていない。具体的には、ビジネスマンが繰り返し行う「**矢印で指したらその先にテキストで補足**」「**枠で囲んだらその枠を矢印で指す**」という連続パターンを毎回手動で(ツール切替 → クリック位置決め → IME 起動)行っており、1 連の指摘あたり 2-3 アクション分の摩擦が残っている。あわせてテキスト注釈のフォントサイズが 18px 固定で変更 UI が存在せず、画像サイズや指摘内容に応じた可読性チューニングができない。

## Evidence

- ユーザー証言(2026-05-03、Phase 7.7/7.8 スコープ分割時): 「Shottr / Slack / Teams を併用しているが操作の連続性や予測がない、多機能すぎる」
- ユーザー証言(同): 「画像注釈に特化した『使いたくなる』プロダクトに引き上げたい。今の UI は 60 点」
- ユーザー証言(2026-05-04、Phase 7.8 PRD レビュー): 「**次の操作候補の予測で一歩進めるだけ**。グループ化したりとかそういうレベルではない」「キャンセルをどうさせるかが肝」
- コードベース確認(2026-05-04):
  - `apps/web/src/components/canvas/CanvasStage.tsx:207-222` で `text` ツールは「クリック → 空 text 作成 → IME 即時起動」の即時編集パターンを既に実装済(=次手予測の手本が部分的に存在)
  - 一方 `arrow` / `rectangle` / `highlight` は `mouseup` 時に `select/set` で選択状態にするだけ(`CanvasStage.tsx:283-308`)
  - スマートスナップ実装 0 件 — `getRelativePointerPosition()` の値をそのまま座標に使っており、既存注釈との関係を考慮した補正は無い
  - フォントサイズ変更 UI **0 件** — `DEFAULT_FONT_SIZE = 18` 固定(`apps/web/src/components/canvas/colors.ts:38`)、reducer action / Toolbar UI / shortcut いずれも未実装

## Proposed Solution

「次にやりたい操作」を **半歩だけ先回りする** 軽量な次手予測 2 系統と、配置精度を上げる Smart snap、そして可読性のためのフォントサイズ UI を導入する。**新規ツールも新規注釈タイプも追加しない**。実装上は「mouseup 直後に次のツール状態を引き継ぎ、起点 / 終点の片方だけを固定値で先回りする」だけで成立し、grouping / 1-undo-chain / presence 共有といった複雑な仕掛けは入れない。

- **次手予測 A: 矢印 → テキスト**: 矢印を引き終わった瞬間、終端(`to`)から数 px 離れた位置に空テキスト注釈を即時作成 + IME 起動。ユーザーは「矢印を引く → そのまま打鍵」だけで指示と補足を一気通貫
- **次手予測 B: 矩形 → 矢印**: 矩形を描き終わった瞬間、矢印ツールに自動切替し、**矢印のヤジリ(終点 `to`)を矩形の右辺中央に固定** した状態で起点ドラッグを待つ。ユーザーは「枠で囲む → そのまま指したい場所からドラッグ」で「ここに注目してこの理由」が完成
- **Smart snap**: 既存注釈の端点/中心、画像端、画像中央線への 8px 弱吸着。Alt 押下で抑制(Figma 流)
- **フォントサイズ UI**: テキスト注釈生成後にフォントサイズを変更できる UI(Toolbar の数値入力 or +/- ボタン or shortcut)。デフォルトは現状の 18px 維持

**新規発明ではなく、既存 text の即時編集パターンに倣った最小拡張**。グループ化 / 全体 chain の演出 / opt-out 設定 / 他クライアントへの可視化 / テレメトリ計測のような周辺機構は入れない。各注釈は独立した `annotation/add` として扱われ、Cmd+Z 連打で各々巻き戻る。

## Key Hypothesis

我々は **矢印の終端で text が即時編集状態になり、矩形の右辺で矢印が即時待機状態になる、という小さな先回り** が、ビジネスマンの **繰り返し指摘コンボに対する 2-3 アクション分の摩擦** を解消すると信じる。検証ポイント:

- ユーザー(オーナー本人)が「画像投入 → 矢印+テキストの組合せを 3 連発 → エクスポート」を **15 秒以内** に完遂できる(Phase 7.7 のキーボード完結 golden path で同等操作は推定 30-40 秒)
- 1 画像あたりの注釈数中央値が dogfood 期間中に Phase 7.7 比で 1.5 倍以上に増える
- 次手予測が「邪魔」と感じる場面が **1 セッション 1 回未満**(=Esc/BS で素直にキャンセルできれば許容できる頻度)

## What We're NOT Building

- **chain のグループ化**(矢印+text を 1 undo step にまとめる、presence で「chain 中」表示など) — ユーザー方針: 「次の操作候補の予測で一歩進めるだけ、グループ化レベルではない」
- **opt-out 設定 UI / 修飾子で発火モード切替** — ユーザー方針: 常時 ON
- **他クライアントへの予測進行状態の可視化** — ユーザー方針: しない
- **AI 駆動の予測**(画像内容を解析して注釈位置/文言を提案) — Phase 9+
- **テンプレート / マクロ / 番号スタンプ** — 需要薄、次手予測で代替可
- **新規注釈タイプ追加**(楕円 / 直線 / フリーハンド / 吹き出し) — Phase 7.7 と同じく既存 4 種に対する操作改善のみ
- **無限キャンバス / Figjam 化** — プロダクト方針外
- **モバイル(タッチ)向けの予測ジェスチャ** — デスクトップ操作のみ

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 矢印 + テキスト 3 連発の所要時間 | **15 秒以内**(Phase 7.7 比 50% 短縮) | オーナー dogfood で時計測定、Playwright 計測も補助 |
| 1 画像あたりの注釈数中央値 | Phase 7.7 比 **1.5 倍** | dogfood 期間ログ、または room 保存時の集計 |
| 次手予測が「邪魔」と感じた頻度 | **1 セッション 1 回未満**(自己申告) | dogfood 自己申告、キャンセル(Esc/BS)発生回数で補助計測 |
| Smart snap が「邪魔」と感じる頻度 | **「ほぼ無い」**(自己申告) | dogfood 自己申告 + Alt 修飾子の使用頻度ログ |
| フォントサイズ変更が必要な場面で実際に変更できる | 100% | dogfood で 1 回以上「サイズ変えたい」場面を踏み、UI で変えられること |
| Yjs 多人数で次手予測が暴発しない | 2 ブラウザで同時に予測モード起動時もデータ崩壊なし | Playwright 多タブ E2E |

## Open Questions

(2026-05-04 ユーザーレビューで全クローズ — Decisions Log に確定事項を集約)

- [x] 次手予測 A(矢印→テキスト)のキャンセル/確定 UX → Decisions Log 参照(Q1 で確定)
- [x] 次手予測 B(矩形→矢印)のキャンセル/確定 UX → Decisions Log 参照(Q2 で確定、Enter 確定 / BS キャンセル / 既定矢印プレビュー方式)
- [x] フォントサイズ変更 UI の形式 → Decisions Log 参照(Toolbar `[A-] [18px] [A+]` + `[` `]` shortcut で確定)
- [x] フォントサイズ 2 ボタン化 → Decisions Log 参照(暗黙切替で確定)

**plan 段階で詰める残論点**:

- [ ] 既定矢印プレビューの長さ/角度の最終値(初期案: 矩形右辺中央から右下 45°、長さ 100px 程度)
- [ ] フォントサイズ shortcut の JIS/US 両配列での動作確認(`[` `]` キーは JIS では `Shift+@` `Shift+[` 等の差異あり)

---

## Users & Context

**Primary User**

- **Who**: Phase 7.7 と同じ — ビジネスマン(IC / マネージャ / プロジェクトリード)
- **Current behavior(Phase 7.7 完了後)**: snap-share でキーボード完結 + リサイズ + 色変更 + ズーム/パンを使い、業界標準操作で注釈を作成できる。ただし「矢印 → テキスト」「枠 → 矢印」のコンボごとにツール切替が必要で 1 指摘あたり 2-3 アクションの摩擦
- **Trigger**: 「これ確認お願いします」を上長に Ping する瞬間。**特に 1 画像で複数箇所(N≥3)を指摘したい時**
- **Success state**: 1 画像 5-10 箇所の指摘を **思考の流れを切らさず** に書き込める

**Job to Be Done**

When **1 画像で複数箇所を上司に指摘したい時**, I want to **「指す → 補足する」を 1 連の動作で完了させる**, so I can **指摘の質と量を犠牲にせず、レビューサイクルを 1 ターンで終わらせる**.

**Non-Users**

Phase 7.7 と同じ — デザイナー / 無限キャンバスでブレストしたい人 / 匿名 viral 系ユーザー / モバイル専用ユーザー

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | A: 矢印→テキスト 次手予測(矢印 mouseup 直後に終端で空 text + IME 即時起動) | 仮説検証の主軸、既存 text 即時編集パターンの再利用 |
| Must | B: 矩形→矢印 次手予測(矩形 mouseup 直後に矢印モード、ヤジリを右辺中央に固定) | 仮説検証の主軸、A だけだと「矢印→テキスト」のみに縮退 |
| Must | キャンセル/確定 UX が直感的(Esc/BS/別ツールキーで素直に抜けられる) | success metric の「邪魔頻度 < 1 回/session」の必須条件 |
| Must | フォントサイズ変更 UI(現在の 18px をデフォルト維持、変更可能化) | 現状不可、矢印→テキスト Auto-next で需要が顕在化 |
| Should | Smart snap: 既存注釈の端点+中心、画像端、画像中央線 への 8px 弱吸着 + Alt 抑制 | 配置精度向上、矢印起点/終点が前の注釈に綺麗に繋がる |
| Could | 次手予測モード中の視覚フィードバック(矢印モード待機中の右辺中央に ◯ マーカー等) | 発見性向上、無くても予測そのものは動く |
| Won't | グループ化 Undo / 1-chain-1-step | ユーザー方針(2026-05-04): しない |
| Won't | opt-out 設定 / 修飾子発火 | ユーザー方針: 常時 ON |
| Won't | 他クライアントへの予測進行可視化 | ユーザー方針: しない |
| Won't | AI 予測 / テンプレート / 番号スタンプ | スコープ外 |
| Won't | 新規注釈タイプ追加 | スコープ外 |

### MVP Scope

「**A + B + キャンセル UX + フォントサイズ UI**」の 4 要素。Smart snap は Should、視覚フィードバックは Could。

### User Flow

**Critical path (次手予測込み golden path)**:

1. ブラウザで snap-share を開く
2. 画像をペースト or D&D 投入(Phase 7.7 で fit-to-viewport)
3. `A` キー(arrow) → 指したい場所まで矢印をドラッグ → mouseup
4. **(A 起動)** 矢印終端から数 px 先で空 text が即時作成 + IME 起動 → 補足を打鍵 → Enter で確定(or 0 文字 Enter で text 自動削除、矢印は残す)
5. `R` キー(rectangle) → 別の指摘箇所を枠で囲む → mouseup
6. **(B 起動)** 矩形の右辺中央から右下 45°・既定長の矢印プレビューが半透明で表示
7. **Enter** で矢印確定 → 即座に **A 連鎖** で矢印終端に空 text + IME 起動 → 補足を打鍵 → Enter
8. (3 → 7 を 5 回繰り返して 1 画像 5 指摘 = success metric 15 秒以内、マウスドラッグ無しで完結)
9. Cmd+S で PNG 出力

各注釈は独立。Cmd+Z 連打で 1 個ずつ巻き戻る。前提:
- **Esc** = 選択解除(全体共通)。次手予測の pending やテキスト編集中は加えてそれもキャンセル
- **BS** = 選択中の注釈や矩形を削除。次手予測 B の pending 中は pending クリア優先、text 編集中は文字削除(既存挙動)
- 既定矢印が方向的に合わなければ **マウスで通常の矢印ツール起動**(mousedown で pending 破棄 → 自前ドラッグ)→ 確定後はそのまま A 連鎖

---

## Technical Approach

**Feasibility**: HIGH(既存パターンの組合わせのみ)

- **次手予測 A 実装方針**:
  - `CanvasStage.handleMouseUp`(L283-308) の `tool === 'arrow'` 確定後分岐に「`tool` を `text` に切替 + 空 text を `terminus + offset` 座標で `annotation/add` + `onStartTextEditing(newId)` 」を追加
  - 既存の text 即時編集フロー(L207-222)を完全再利用、新規メカニズムは不要
  - offset は矢印方向の延長 8-12px(plan で確定)
- **次手予測 B 実装方針(Enter 確定 / BS キャンセル方式)**:
  - `handleMouseUp` で `tool === 'rectangle'` 確定後、`pendingAutoArrow: { from, to }` ref を立てる(`to` = 矩形右辺中央、`from` = `to` から右下 45°方向に 100px の点)
  - `tool` は `select` のまま(切替えない)。プレビューはキー操作で確定する想定
  - 既定矢印プレビュー = Konva `<Arrow opacity={0.4}>` を pending != null の間だけ 1 個レンダー(`AnnotationLayer` か `extraLayers` に追加描画 1 行)
  - `useKeyboardShortcuts` に `onConfirmAutoArrow` / `onCancelAutoArrow` 2 コールバックを追加。pending 中の Enter / BS のみ捕捉
  - Enter 確定: pending を `annotation/add`(矢印) → Phase 1 の Auto-next-A 経路を呼び出し(矢印終端 = 矩形右辺中央 + offset で空 text 即時編集) → pending = null
  - BS / Esc キャンセル: pending = null だけ(矩形は残る)。BS の通常挙動(選択中注釈削除)は pending クリア後に復帰
  - mousedown(任意座標)で pending = null + 通常 mousedown 挙動(stage クリック → 選択解除など) → ユーザーが自前で矢印ドラッグしたければそのまま `A` キー → 通常の矢印ツール
- **Smart snap**:
  - 純関数 `snapToTargets(pos, targets, threshold): Point` を `apps/web/src/lib/snap.ts` に新規実装
  - targets = 全注釈の {端点, 中心} + 画像 bbox の {端, 中央線}。閾値 8px 固定
  - `handleMouseMove` の `pos` を補正してから draft 注釈に渡す。Alt 押下で snap 抑制
  - 視覚フィードバック(snap 中の対象 highlight + ガイドライン描画)は Should 拡張
- **フォントサイズ UI**:
  - `AnnotationSchema` の `TextAnnotation` は既に `fontSize` フィールドを持つため Schema 変更不要
  - reducer に `annotation/set-font-size` action 追加(`{id, fontSize}` で個別 text を更新)
  - state に `activeFontSize` を追加(新規 text 作成時のデフォルト)、Phase 7.7 の `activeColor` パターン踏襲
  - UI は Toolbar に数値入力(or +/- ボタン)、shortcut は plan で決定(候補: `[` `]` / Cmd+Shift++ -)
  - **「新規デフォルトに設定」+「選択中の text に適用」の 2 ボタン式は Phase 7.7 の色 UI と同じ作法**(plan で UX 統合)
- **キャンセル UX**:
  - 既存の `useKeyboardShortcuts` の `onEscape` を拡張、または CanvasStage 内の局所ハンドラ
  - pending state(B 用)が立っている時は Esc で pending 解除のみ、立っていない時は既存の選択解除挙動

**Architecture Notes**

- pending state は Phase 7.7-3 の `panActiveRef` パターン(ref で保持、各イベントで参照)を踏襲
- Auto-next の各 `annotation/add` は **既存の `LOCAL_ORIGIN` で `doc.transact` ラップ規約**(CLAUDE.md cross-cutting design rule #8)を厳守、独立 transact のまま(LWW で問題なし)
- Smart snap は純関数として独立、unit test で全網羅
- `getRelativePointerPosition()`(Phase 7.7-3)を全座標計算で使い、Stage transform 整合

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 次手予測 A の text 即時編集が既存 text ツールの IME 経路と競合 | L | 既存経路を完全再利用、追加コードは「state 遷移」のみ |
| 次手予測 B の pending state が Enter/BS/Esc/別ツール/mousedown で正しく解除されない | M | pending state を ref で保持、Phase 7.7-3 の `panActiveRef` パターンを踏襲、E2E で全経路網羅 |
| Enter キー処理が text 編集中の Enter(text 確定)と競合 | M | text 編集中は `isEditableTarget` でガード、pending 中の Enter は CanvasStage 専用ハンドラで分離 |
| BS キー処理が「選択中注釈削除」「pending クリア」「text 文字削除」の 3 経路で混線 | M | 優先順位を明確化: text 編集中 > pending 中 > 通常 BS。`isEditableTarget` で text 編集中を排他、pending != null で pending 優先 |
| Smart snap が Konva Transformer リサイズと競合 | L | リサイズ時は Transformer 内部処理、Smart snap は draft 描画時の `handleMouseMove` のみ。実装位置が分離 |
| Yjs 多人数で同時に予測モード起動 → 同じ座標に重複注釈 | L | `generateId` で衝突回避、LWW で最終形収束は既存挙動 |
| 0 文字 text が確定して 0px の不可視注釈が残る | L | 既存 text ツールの確定経路で空文字確定時の挙動を確認、plan で「0 文字 → 自動削除」確定 |
| フォントサイズ変更 shortcut(`[` `]` 等)が日本語キーボードで衝突 | L | 候補を plan で 2-3 案出し、JIS/US 両配列で動作確認 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | A: 矢印→テキスト 次手予測 | 矢印 mouseup 直後に終端で空 text + IME 即時起動、Esc/BS キャンセル整合 | complete | - | - | [plan](../plans/completed/phase-7.8-1-auto-next-arrow-text.plan.md) / [report](../reports/phase-7.8-1-auto-next-arrow-text-report.md) |
| 2 | B: 矩形→矢印 次手予測 | 矩形 mouseup 直後に矢印モード、ヤジリを右辺中央に固定、pending state 管理 | complete | - | 1 | [plan](../plans/completed/phase-7.8-2-auto-next-rect-arrow.plan.md) / [report](../reports/phase-7.8-2-auto-next-rect-arrow-report.md) |
| 3 | フォントサイズ変更 UI | activeFontSize state + reducer action + Toolbar UI + shortcut | complete | with 4 | - | [plan](../plans/completed/phase-7.8-3-font-size-ui.plan.md) / [report](../reports/phase-7.8-3-font-size-ui-report.md) |
| 4 | Smart snap | 端点/中心/画像端/中央線への 8px 弱吸着、Alt 抑制、ガイドライン描画 | deferred (2026-05-04) | - | - | (skipped, stash@{0}) |
| 5 | dogfood + チューニング + HelpModal 追記 | success metrics 実測、offset/arrow length/font step の最終調整、HelpModal に Phase 7.8 機能追記 | in-progress | - | 1, 2, 3 | [plan](../plans/phase-7.8-5-dogfood-help.plan.md) |

### Phase Details

**Phase 1: A 矢印→テキスト 次手予測**

- **Goal**: 矢印を引き終わった瞬間、終端から数 px 先で空 text が IME 即時起動状態で作成され、Esc/BS で素直にキャンセルできる
- **Scope**:
  - `CanvasStage.handleMouseUp` の `tool === 'arrow'` 分岐に Auto-next ロジック追加
  - text 注釈の初期座標 = `to + offset`(offset は plan で確定、矢印方向の延長 8-12px 案)
  - `tool` を自動的に `text` に切替
  - **キャンセル UX(text 編集中)**:
    - 1 文字以上で Enter / フォーカス外 → text 確定、tool = `select`、選択 = 確定した text(既存 text 挙動と整合)
    - **0 文字で Enter / フォーカス外** → text 自動削除(空 text を残さない)、矢印は残る、tool = `select`
    - **編集中 Esc** → text 破棄(=0 文字 Enter 相当)+ 既存の選択解除挙動、矢印は残る、tool = `select`
    - **編集中 BS** → 編集中の文字削除のみ(text 注釈自体は残し、編集続行)。**text 入力中の BS は既存挙動どおり文字削除**(2026-05-04 ユーザー確定)
    - 別ツールキー(R/T/H/V/A) → text 編集中は `isEditableTarget` ガードで発火しない。ユーザーは Esc / Enter で抜けてから別ツールへ
  - Undo: 矢印 add → text add の独立 2 step(Cmd+Z 連打で個別に巻き戻る)
- **Success signal**: マウス + キーで「矢印描画 → 補足テキスト確定」が 1 連の動作で完遂、Esc で text のみ消える、Cmd+Z で text → 矢印 の順に巻き戻る、Playwright E2E で網羅

**Phase 2: B 矩形→矢印 次手予測(Enter 確定 / BS キャンセル方式)**

- **Goal**: 矩形を描き終わった瞬間、既定の右下がり矢印プレビューが半透明で表示され、Enter で確定 / BS でキャンセル / マウスドラッグで自前指定の 3 経路で進める
- **Scope**:
  - 矩形 mouseup 直後に `pendingAutoArrow: { from, to }` ref を立てる(`to` = 矩形右辺中央、`from` = 矩形右辺中央 + 右下 45° 方向に既定長 ~100px)
  - **既定矢印プレビュー描画**: pending 中、Konva `<Arrow opacity={0.4}>` を 1 個レンダー(矢印の `from` → `to` を半透明青で描画)
  - `tool` は **`arrow` に切替せず、`select` のまま**(プレビューはキー操作で確定する想定で、mouse がフリーに使えるべき)
  - **確定/キャンセル経路 3 種**:
    - **Enter**: pending を `annotation/add`(矢印) + pending = null + Phase 1 の A 連鎖起動(矢印終端 = 矩形右辺中央 + offset で空 text 即時編集)
    - **BS**: pending = null(プレビュー消失)、矩形は残す、`tool` = `select` のまま(既存 BS の「選択中注釈削除」より pending クリアが優先)
    - **マウス mousedown(任意座標)**: pending = null + 通常挙動(stage クリックで選択解除など)。「右下既定矢印が合わない」時の逃げ道
    - **別ツールキー(R/T/H/V/A)**: pending = null + 該当ツールに切替
    - **Esc**: pending = null + 既存の選択解除挙動(=BS と挙動は同等)
  - **A への連鎖**: Enter 確定時に Phase 1 の Auto-next-A が必ず連鎖起動(矢印終端 = 矩形右辺中央 + offset で空 text)
  - **視覚フィードバック**: pending 中の半透明矢印プレビューがそのままヒント(別途 ◯ マーカー等は不要)
  - 前提整合(2026-05-04 ユーザー確定):
    - Esc は全体共通で「選択解除」(pending 中も pending クリアと選択解除を兼ねる)
    - BS は「注釈/矩形削除」が既存挙動だが、pending 中は「pending クリアが優先」(pending クリア後は通常 BS = 選択中注釈削除に戻る)
    - text 入力中の BS は文字削除(既存挙動、変更なし)
- **Success signal**:
  - 矩形描画 → 既定矢印プレビュー表示 → Enter で矢印確定 + text 編集モード が完全キーボード完結
  - BS / Esc / 別ツールキー / マウスクリックで pending が素直にキャンセル
  - dogfood で「右下既定矢印で 8 割は事足りる」感覚が得られる

**Phase 3: フォントサイズ変更 UI(暗黙切替方式)**

- **Goal**: テキスト注釈のフォントサイズを変更でき、新規 text 作成時のデフォルトも変更できる
- **Scope**:
  - `useAnnotationsStore` に `activeFontSize: number` 追加(default 18、Phase 7.7 の `activeColor` と同じパターン)
  - reducer action 追加: `font-size/set-active`(new default), `annotation/set-font-size`(個別 text 適用)
  - Yjs mutation: `setTextFontSizeY(id, fontSize)` を `apps/web/src/domain/annotation/yjs-mutations.ts` に追加(LOCAL_ORIGIN ラップ)
  - **Toolbar UI**: `[A-]` `[18px]`(現在値表示)`[A+]` の横 3 要素、色パレット隣に配置
  - **Shortcut**: `[` で -2px / `]` で +2px(Photoshop 流)。JIS/US 両配列の動作は plan で確認(plan で代替候補を 2-3 案出して確定)
  - **暗黙切替ルール(Q4 ユーザー承認の推奨案)**:
    - text 注釈が選択中 → サイズ変更は **その選択中 text のみ**(個別適用)
    - text 注釈未選択(他 tool 選択中 or 何も選択無し) → サイズ変更は **`activeFontSize`(新規デフォルト)** に適用
    - これによりボタン 1 操作で文脈に応じた挙動を実現、Phase 7.7 の色 UI のような「2 ボタン」を増やさない
  - min / max: 8 / 200(`MAX_FONT_SIZE = 200` 既存 schema、min は plan で 8 確定案)、step 2px
- **Success signal**: 既存 text のサイズが選択中 +/- ボタン or shortcut で変更可、未選択時は新規デフォルトが変更可、shortcut で素早く調整可、Yjs 経由で同期

**Phase 4: Smart snap (deferred 2026-05-04)**

> **Status**: Phase 7.8-5 着手前にユーザー判断で defer。実装試行版は stash@{0} (`phase-7.8-4 smart-snap WIP`) に保管。Phase 7.8-5 dogfood で本当に必要かを再評価し、必要なら別 phase で再実装する。Phase 5 は Smart snap を依存から外して進める。

- **Goal**: 矢印起点/終点や矩形端が既存注釈/画像構造に弱吸着し、配置精度が上がる
- **Scope**:
  - 純関数 `snapToTargets(pos, targets, threshold): Point` を `apps/web/src/lib/snap.ts` に新規実装
  - targets:
    - 全注釈の {端点, 中心}(矩形 4 コーナー + 4 辺中央 + 中心、矢印 from/to、text bbox 4 コーナー + 中心、highlight 4 コーナー + 中心)
    - 画像 bbox の {4 端, 中央縦線, 中央横線}
  - threshold = 8px(固定)
  - `handleMouseMove` の `pos` を `snapToTargets` で補正、draft に渡す
  - Alt 押下で snap 抑制(Figma 流)
  - 視覚フィードバック: snap 中の対象を highlight、整列ガイドラインを Konva Layer で一時描画
- **Success signal**: 既存矢印の終端から 8px 以内で別の矢印を始めると吸着、画像中央線への吸着でガイドが出る、Alt で抑制可

**Phase 5: dogfood + チューニング + HelpModal 追記**

- **Goal**: success metrics を実測、offset / arrow default 長 / font step を最終調整、HelpModal に Phase 7.8 機能追記
- **Scope**:
  - 1 週間オーナー dogfood、実業務で 30 画像以上に注釈を入れる
  - 計測: 矢印+text 3 連発の所要時間、注釈数中央値、邪魔頻度自己申告、フォントサイズ変更頻度
  - チューニング: `AUTO_NEXT_TEXT_OFFSET_PX`(現 8) / `AUTO_ARROW_DEFAULT_LENGTH_PX`(現 100) / `FONT_SIZE_STEP`(現 2) の据置 or 調整
  - HelpModal: Phase 7.8 機能セクション追記(次手予測 Enter 確定 / Esc 破棄 / ⌫ pending クリア + フォントサイズ shortcut)。**Smart snap (Phase 4) は defer のため Alt 抑制説明は載せない**
- **Success signal**: success metric の Must 行が全て緑、ユーザー(オーナー)が「Shottr に戻りたいと思わない」状態、HelpModal が Phase 7.8-1/-2/-3 機能を網羅

### Parallelism Notes

- **Phase 1 → Phase 2 は直列**: B は A の text Auto-next 経路を連鎖利用するため A 完成が前提
- **Phase 3(フォントサイズ UI)と Phase 4(Smart snap)は Phase 1-2 と並列可**: 触るファイルが分離(Phase 3 は Toolbar / reducer、Phase 4 は lib/snap.ts + handleMouseMove)
- **Phase 4 は defer 確定 (2026-05-04)**: Phase 5 は Phase 1-3 完了後に着手、Phase 4 を待たない
- 個人開発・週 15h 想定 → Phase 1 → 2 → 3 → 5 の **直列** がベース(Phase 4 はスキップ)。並列可能性は将来余地として表記

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 予測 UX の主軸 | **次手予測 A + B(矢印→テキスト、矩形→矢印)** | テンプレート / 番号スタンプ / AI 予測 | ユーザー証言で具体的にこの 2 系統を例示。既存パターン再利用で実装コスト最小 |
| 予測 UX のスコープ感 | **「次の操作候補の予測で半歩進めるだけ」レベル** | 大きな chain として演出(presence 共有 / グループ化) | ユーザー方針(2026-05-04): 「グループ化したりとかそういうレベルではない」 |
| 発火モード | **常時 ON** | 修飾子 hold / 設定切替 | ユーザー確定(2026-05-04): 常時 ON |
| Undo グループ化 | **しない**(各注釈は独立 step、Cmd+Z 連打で個別巻き戻し) | 1 chain = 1 undo step | ユーザー確定(2026-05-04): グループ化不要 |
| 他クライアント可視化 | **しない**(presence で「予測中」表示なし) | presence layer に表示 | ユーザー確定(2026-05-04): しない |
| 矩形→矢印の起点解釈 | **矩形の右辺中央 = 矢印のヤジリ(終点 `to`)に固定、起点(`from`)はユーザーがドラッグで決定。矩形を外側から指す構図** | 矩形端点 = 矢印の起点(矩形から伸びていく逆方向) | ユーザー確定(2026-05-04、画像 [Image #2] で図示確認): ヤジリが矩形右辺中央に刺さる。起点はユーザーが任意位置からドラッグ |
| Smart snap 閾値 | **8px 固定** | 4px / 設定可変 | ユーザー確定(2026-05-04): 8px。Figma 業界標準と整合 |
| Smart snap 対象範囲 | **端点 + 中心 + 画像端 + 中央線(全部)** | 端点のみ / 画像端のみ | ユーザー確定(2026-05-04): 「可能な限り、ある程度で良い」→ 主要 target を全て対象、追加は dogfood で判断 |
| フォントサイズ UI 必要性 | **追加する**(現状 18px 固定で UI 0 件) | スコープ外に倒す | ユーザー確定(2026-05-04): 「変えられないなら、変えられるようにしないとね」 |
| フォントサイズ default | **現在の 18px を維持** | 16 / 20 | ユーザー確定(2026-05-04): 「現在のフォントサイズでいい」 |
| AI 予測 | **Won't(Phase 9+)** | MVP に含める | LLM 課金 / プライバシー / 仕様検討負荷 |
| 番号スタンプ / テンプレート | **Won't** | Should | 次手予測で代替可、需要薄 |
| 新規注釈タイプ追加 | **Won't** | 楕円 / 直線 / 吹き出し | Phase 7.7 と同じ |
| opt-out 設定 / テレメトリ | **不要**(常時 ON 確定 + dogfood 自己申告計測で十分) | localStorage フラグ + 設定 UI | ユーザー方針: シンプルに保つ |
| キャンセル系の前提 | **Esc = 選択解除(全体共通) / BS = 選択中の注釈や矩形を削除 / text 入力中の BS は文字削除** | Esc を BS で代用 / 各 phase 個別ルール | ユーザー確定(2026-05-04): 統一前提として宣言 |
| 次手予測 A のキャンセル/確定 UX | **1 文字以上 Enter or フォーカス外 = 確定 / 0 文字 Enter or フォーカス外 = text 自動削除(矢印残る) / 編集中 Esc = text 破棄 + 選択解除 / 編集中 BS = 文字削除のみ** | text 残す / 矢印も消す | ユーザー確定(2026-05-04): Q1 推奨案でほぼ OK |
| 次手予測 B のキャンセル/確定 UX | **既定矢印プレビュー(右下 45° / ~100px、半透明)を矩形右辺中央から描画 / Enter で確定 + A 連鎖 / BS でプレビュー削除(キャンセル) / Esc で同等(選択解除と兼ねる) / 別ツールキー or マウス mousedown で pending 解除して通常挙動** | mousedown ドラッグで起点指定方式(=従来 PRD 案) | ユーザー確定(2026-05-04): キーボードのみで連続コンボが完結する Enter/BS 方式を採用、画像 [Image #2] 構図と整合 |
| 次手予測 B での tool 状態 | **`select` のまま**(プレビューは tool 切替なしで成立、マウスは通常通り使える) | `arrow` に切替 | キーボード確定経路を主、マウス操作は逃げ道として残す設計 |
| 次手予測 B からの A 連鎖 | **Enter 確定後に必ず連鎖**(ヤジリ位置 = 矩形右辺中央 + offset で空 text 即時編集) | 連鎖オフ / オプション化 | ユーザー確定(2026-05-04): 「矢印が確定されたら、当然 A のテキスト受付にもチェインして欲しい」 |
| フォントサイズ UI 形式 | **`[A-] [現在値] [A+]` の Toolbar 3 要素 + `[` `]` shortcut(Photoshop 流)** | 数値入力 / Cmd+Shift++- / 専用パレット | ユーザー回答(2026-05-04): Q3 推奨で任せる |
| フォントサイズ 適用先切替 | **暗黙切替**(text 選択中なら個別、未選択なら新規デフォルト) | Phase 7.7 色 UI と同じ 2 ボタン式 | ユーザー回答(2026-05-04): Q4 推奨で任せる。色と違って同時編集需要が薄く 1 操作で十分 |
| Smart snap (Phase 4) の defer | **defer 確定 (2026-05-04)、stash@{0} に保管** | 実装続行 / 完全廃止 | Phase 7.8-5 着手前に実装試行 (`phase-7.8-4-smart-snap.plan.md`) を回したが、ユーザー判断で「問題が多そうで今の段階で実装の必要なし」と評価。完全廃止ではなく Phase 5 dogfood の結果次第で必要性を再評価し、必要なら別 phase で再実装。Phase 5 の Scope からも「snap 閾値チューニング」「HelpModal の Alt snap 抑制説明」を除く |

---

## Research Summary

**Market Context**

- 業界の収束点:
  - **連続コンボの完全自動化**は **未収束**。FigJam / Excalidraw が部分的に実装、Skitch / Shottr / CleanShot X は未実装。snap-share が業務文脈で先行する余地あり
  - **Smart snap** は Figma 系の 8px 弱吸着が事実上の業界標準、Excalidraw / draw.io も追従
  - **フォントサイズ shortcut** は `[` `]`(Photoshop)/ Cmd+Shift++/-(ブラウザ流)/ 専用入力欄(Figma) と分散、業界標準は弱い
- 競合との差別化軸:
  - Shottr / Skitch / CleanShot X は「単発操作の最適化」に注力、「次手予測」は手薄 — ここが snap-share の立脚点
  - FigJam / Excalidraw は無限キャンバスで連続 UX を持つが、業務スクショ注釈の 30 秒で終わらせたい用途には重い
- ユーザー証言とのフィット:
  - 「操作の連続性や予測がない、多機能すぎる」(2026-05-03) — 次手予測は「連続性」「予測」を直接解決、新規ツール追加なしで「多機能化」も避ける
  - 「次の操作候補の予測で一歩進めるだけ」(2026-05-04) — 大袈裟な仕掛けは入れず、半歩先回りに留める方針

**Technical Context**

- **既存パターン再利用**:
  - text 即時編集(`CanvasStage.tsx:207-222`)が次手予測 A の手本としてそのまま使える
  - `panActiveRef` パターンが次手予測 B の pending state 管理で再利用可能
  - `getRelativePointerPosition()`(Phase 7.7-3)が Stage transform 整合済の論理座標を返す
  - Phase 7.7-2 の `activeColor` パターンがフォントサイズの `activeFontSize` 設計でそのまま流用可
- **未実装領域**:
  - Smart snap: 0 件 — `lib/snap.ts` 新規作成
  - フォントサイズ UI / shortcut / reducer action: 0 件
- **規約厳守ポイント**(CLAUDE.md cross-cutting design rules):
  - Yjs mutation は `LOCAL_ORIGIN` で `doc.transact` ラップ(rule #8)
  - 注釈の SSOT は `packages/shared/src/annotation.ts`(rule #1)— Schema 変更は 0(`fontSize` フィールドは既存)
  - `<KonvaImage>` の `listening={false}` 維持(rule #5)
  - 色は hex literal(rule #4)
  - reducer は単一 useReducer 内で完結(rule #2)— `activeFontSize` 追加も既存 reducer 内のみ

---

*Generated: 2026-05-04 (initial) / 2026-05-04 (revised after user feedback x2)*
*Status: READY - 主要 Open Questions 全クローズ、残論点 2 件(既定矢印長/角度の最終値、フォントサイズ shortcut の JIS/US 確認)は plan 段階で詰める*
