# Phase 7.7: UX 基盤改善（注釈リサイズ + 色変更 + ズーム/パン + キーボード完結）

## Problem Statement

snap-share は本番リリース後の dogfood 段階(Phase 7.6 完了)で、自身が日常使いした際に「画像注釈の基本操作が成立していない」ことが露見した。具体的には (1) 一度配置した注釈をリサイズできない、(2) 色を選べない(矩形は青、矢印は赤、ハイライトは黄で固定)、(3) 大きい画像を読み込むと等倍で左上寄せになり破綻、(4) 主要操作のたびにマウスでツールバーに戻る必要があり連続作業が止まる。これは "Figjam の 60 点劣化版" 状態で、ユーザー(自分含む)が本気の業務シーンで採用するに値しない。

## Evidence

- ユーザー証言(2026-05-03): 「現状の UI/UX は決して悪いものではないが、なんとなくFigjamっぽいとか、だいたいこんな感じだろうの60点の及第点」「これでは私も使おうとは思えません」
- ユーザー証言(同): 「一度配置した注釈の変形ができない、毎回マウスに持ち替えてツールバーで変更することの煩わしさ」
- 競合代替手段の不満(同): Shottr / Slack / Teams を併用しているが「操作の連続性や予測がない、多機能すぎる」
- コードベース確認(2026-05-03): Konva `Transformer` の使用箇所 0 件 / `color` フィールドが `AnnotationSchema` に未定義 / Stage の `scaleX/scaleY` 未制御 / `?` キー未割り当て・チートシート UI 不在
- Phase 7.6 リリース直後のサンプルとして、本フェーズはユーザー自身のビジネスマン代表 1 名分の dogfood が一次証拠。広域ユーザー調査は未実施(MVP 後に外部 dogfood で検証する)

## Proposed Solution

業界標準パターンに完全準拠した UX 基盤を 4 領域同時に整備する。Konva 標準の `Transformer`(8 ハンドル + Shift 比率固定 + Alt 中心固定が組み込み)を導入してリサイズを開通、`AnnotationSchema` に `color` フィールドを追加して 5-7 色固定パレット UI を提供、Stage に `scale`/`position` 制御を入れて Cmd+0(fit) / Cmd+1(100%) / Space+drag(パン) / ⌘+wheel(ズーム) を実装、最後に `?` キーでチートシートモーダルを起動して全ショートカットを発見可能にする。**新規発明はせず、Figma / FigJam / Photoshop / CleanShot X / Excalidraw が事実上収束させた標準操作に乗ることが最短で「予測可能」を達成する**(独自 UX を捻り出すと逆に学習コストが上がる)。連続操作の予測 UX(矢印→終端からテキスト等)は重要だが仕様検討に工数を要するため Phase 7.8 に分離する。

## Key Hypothesis

我々は **業界標準の注釈操作 + キーボード完結 UI** が、**「上司に成果物を画像込みで見せる」という連続作業の煩わしさ** を **ビジネスマンユーザー** にとって解消すると信じる。検証ポイントは以下:

- ユーザー(まずはオーナー本人)がマウスを 1 度も握らずに「画像投入 → 注釈 4 種配置 → 色変更 → リサイズ → エクスポート」の golden path を完遂できる
- 5000 × 5000 px の画像を投入しても初期表示が viewport にフィットし、即座に注釈作業に移行できる
- Phase 7.7 完了後に Phase 8 の外部 dogfood を解禁できる(現状は基本操作の欠落で外に出せない)

## What We're NOT Building

- **連続操作の予測 UX**(矢印→終端からテキスト、矩形→端点から矢印 など) — Phase 7.8 で扱う(仕様検討に工数を要する)
- **無限キャンバス** — 「画像 + α の余白領域」で十分。Figjam のような無限ホワイトボード化は本プロダクトのスコープ外
- **カラーピッカー(任意 RGB 入力)** — 5-7 色の固定パレットで業務用途は充足。CleanShot X のカスタム色保存も MVP 外
- **ペン/フリーハンド注釈の追加** — 既存 4 種(矩形/楕円/矢印/直線)+ 既存 2 種(テキスト/ハイライト)に対する操作改善のみ。新規注釈タイプ追加はしない
- **モバイル(タッチ)向けのジェスチャ最適化** — ピンチズームは標準ブラウザ挙動を活かす範囲のみ。タッチ用の専用ハンドルサイズ・パレット UI は本フェーズ外

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| マウス無し golden path 完遂 | 100%(オーナー dogfood) | キーボードのみで 「投入→4種配置→色変更→リサイズ→PNG 出力」 を 1 回以上完走 |
| 大画像初期表示の破綻有無 | 5000×5000 / 320×240 / 1920×1080 全て viewport 内に収まる | 手動 QA + Playwright 視覚回帰 |
| リサイズハンドルの応答性 | ドラッグ中の見た目フレームレート 60fps 維持(目視) | dogfood 時に Chrome DevTools Performance タブで確認 |
| Yjs 多人数同時操作の崩壊回避 | 2 ブラウザ同時リサイズで最終形が片方の値に収束(Yjs LWW) | Playwright 多タブ E2E |
| ショートカット発見率 | `?` キー押下でチートシート表示、全ショートカット記載漏れ 0 | コードレビュー + 手動 QA |

## Open Questions

(2026-05-03 オーナーレビューで全クローズ — Decisions Log に確定事項を記録)

- [x] 色変更のスコープ → **両方採用**(「新規作成のデフォルト変更」+「選択中注釈の変更」)。カラーパレットに適用ボタンを 2 種設置
- [x] Yjs マイグレーション → **不要**(未リリースのため、後方互換性は考慮しない)
- [x] ズーム時の座標系 → **Canvas (Stage) ごと倍率を掛ける方針**で吸収。既存 hit-test 座標系は触らない
- [x] チートシート UI → **Modal / Popover / Drawer** のいずれか(plan 段階で決定、UX 観点で選択)
- [x] B1 余白倍率 → **画像サイズの 200%** を初期実装値として採用

---

## Users & Context

**Primary User**

- **Who**: ビジネスマン(IC / マネージャ / プロジェクトリード)。日々の業務で成果物のスクリーンショットを撮り、上司や権限者(承認者・クライアント・ステークホルダー)に「ここを見て確認して欲しい」と注釈を入れて共有する
- **Current behavior**: macOS スクショ → Shottr / Skitch で注釈 → Slack / Teams にドラッグ&ドロップ。あるいは Slack のスクショ機能で直接注釈
- **Trigger**: 「これ確認お願いします」と上長に Ping を打つ瞬間。1 日数回〜十数回発生する高頻度ユースケース
- **Success state**: スクショから注釈完成 → 共有リンク貼付 までを 30 秒以内に、思考を切らさずに完了できる

**Job to Be Done**

- When **成果物 / 画面 / エラー画面のスクリーンショットを上司に確認してもらいたい時**, I want to **画像に矢印・枠・テキストを素早く配置して指し示し、共有可能な状態にする**, so I can **指示の意図を取り違えなく伝え、レビューサイクルを 1 ターンで終わらせる**.

**Non-Users**

- **デザイナー/イラストレーター**: 高度な描画機能を求める層。Figma / Affinity / Procreate を使うべき
- **無限キャンバスでブレストしたい人**: Figjam / Miro を使うべき
- **匿名匿名ユーザー(viral 系の用途)**: snap-share は業務での成果物確認が主。SNS 投稿用画像加工はスコープ外
- **モバイル専用ユーザー**: 本フェーズではデスクトップ操作を最適化対象とする(レスポンシブ崩壊だけは防ぐが、タッチ最適化はしない)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | A1: 矩形/楕円/矢印/直線 のリサイズハンドル(8 ハンドル + Shift 比率固定 + Alt 中心固定) | 致命的不足。基本操作の欠落で「使えない」レベル |
| Must | A2: 色変更 UI + AnnotationSchema 拡張(矩形/矢印/楕円/テキスト/ハイライト 全 5 種、デフォルトは赤 / 矩形・矢印・楕円・テキスト用、黄 / ハイライト用) | 「青矩形 + 赤矢印 + 黒テキスト + 黄ハイライト」固定では業務文脈に合わない |
| Must | A2: カラーパレットに「新規作成のデフォルト変更」と「選択中注釈の変更」の 2 適用ボタン | UX フロー詳細化済み。両方の操作が必要 |
| Must | B1: 画像 fit-to-viewport + ズーム/パン(Cmd+0/1, Space+drag, Cmd+wheel) | 5000px 級画像で初手破綻という致命的不具合 |
| Must | B2: `?` キーでチートシート表示 + キーボード完結網羅 | success metric「マウス無し操作」の必須条件 |
| Should | A1: 楕円注釈の存在自体(現状のスキーマに楕円が無い場合は追加) | TBD: スキーマ確認が必要 |
| Should | A2: 矩形/矢印/楕円/テキストの色を「同期/個別」で切替可能なトグル(ハイライトはもともと別系統で個別) | UX 一貫性のため。最低限「同期で全部変わる」が動けば MVP は成立 |
| Could | B1: ズームインジケーター(現在のズーム%表示) | 視覚的フィードバックのため。無くても MVP 成立 |
| Could | B2: 「最近使ったショートカットをハイライト」(Figma 準拠) | 発見性向上のオーバースペック。Phase 7.8 以降で検討 |
| Won't | カラーピッカー(任意 RGB) | 5-7 色固定パレットで充足 |
| Won't | 連続操作の予測 UX | Phase 7.8 で扱う |
| Won't | 無限キャンバス化 | プロダクト方針外 |
| Won't | ペン/フリーハンド注釈追加 | スコープ外 |

### MVP Scope

「オーナー(自分)が Phase 7.7 完了後、Shottr の代わりに snap-share を日常使いできる」状態。具体的には A1 + A2 + B1 + B2 の Must 行が全て成立し、success metric の 5 項目が緑になっていること。

### User Flow

**Critical path (golden path)**:

1. ブラウザで snap-share を開く(または既存タブを使う)
2. 画像をペースト or D&D 投入 → **B1**: viewport 中央に fit 表示される
3. `R` キー → 矩形を描く → **A1**: 配置直後にリサイズハンドルが出る、Shift+ドラッグで比率固定
4. カラーパレットで色を選択 → **A2**: 「新規デフォルト」ボタンで以降の新規描画に適用、「選択中に適用」ボタンで既配置の注釈の色を即変更(2 ボタン式)
5. `A` キー → 矢印を描く → リサイズ可能
6. `T` キー → テキスト入力
7. Cmd+S で PNG 出力(既存)、または共有リンクコピー(既存)
8. `?` キー → チートシートを呼び出し、忘れたショートカットを確認

全工程をマウスに 1 度も触れずに完遂できることが MVP の成立条件。

---

## Technical Approach

**Feasibility**: HIGH

- A1: Konva 標準 `Transformer` に 8 ハンドル + `shiftBehavior` (比率固定) + `centeredScaling` (Alt 中心固定) が組み込み済み。Yjs mutation (`resizeRectangleY` / `resizeHighlightY` / `setArrowEndpointsY`) は既に実装済(`apps/web/src/domain/annotation/yjs-mutations.ts`)。**UI 接続のみで動く**
- A2: `packages/shared/src/annotation.ts` の判別共用体を拡張(各注釈型に `color` フィールド追加)。**未リリースのためマイグレーション不要、既存 stroke/fill 定数は color フィールドのデフォルト値として再利用**。Toolbar に色パレット UI(2 適用ボタン: 「新規デフォルト」「選択中に適用」)を追加
- B1: Konva Stage の `scaleX/scaleY/x/y` で **Stage(Canvas) 全体に倍率を掛ける方針**。既存の hit-test 座標系・注釈座標系は触らず Stage transform で吸収する(描画ロジックの変更を最小化)。`onWheel` / `onMouseDown` (space) / keyboard ハンドラを `CanvasStage` に追加
- B2: 既存 `useKeyboardShortcuts` の延長 + 新規 `HelpModal` コンポーネント(shadcn `Dialog` 流用可)

**Architecture Notes**

- AnnotationSchema 拡張は SSOT の `packages/shared` で行い、`apps/web` と `apps/api` 双方が `workspace:*` で自動追従
- リサイズ操作も `LOCAL_ORIGIN` シンボルで `doc.transact` ラップする規約厳守(CLAUDE.md cross-cutting design rule #8)
- `<KonvaImage>` の `listening={false}` 維持(rule #5)
- 色定数は `apps/web/src/components/canvas/colors.ts` に集約継続。Konva は CSS 変数を解決しないため hex literal 必須(rule #4)
- ズーム時の Stage 座標系変換が既存の hit-test(annotation 選択 / draft 描画)と整合するか、CanvasStage の `useRef`(`dragStart` / `draft`)パターンを保ったまま実装可能か、plan 段階でスパイク必要

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Konva Transformer と Yjs LWW の競合(2 人同時リサイズ時の挙動) | M | 既存の moveAnnotation でも同じ問題が成立しているはず。E2E で「片方の最終値に収束」を検証 |
| Stage 全体 scale で既存の `getPointerPosition()` 系が論理座標を返さない | M | Konva は `getRelativePointerPosition()` を提供しており Stage transform を吸収する。CanvasStage の draft / dragStart 取得箇所を該当 API に統一する |
| 色パレット UI のキーボード操作(`C` キー連打で循環?)が不自然 | L | plan 段階で具体 UX 検討。最低限「ツールバーの色ボタンに Tab フォーカス可能」で MVP は成立 |
| `?` キーが日本語キーボードで Shift+/ なので衝突しないか | L | macOS US/JIS 両方で動作確認 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | A1: 注釈リサイズ | Konva Transformer 統合(矩形/ハイライト)+ 矢印は端点 Circle ハンドル、Shift/Alt 修飾子、Yjs mutation 接続 | complete | with 2, 3 | - | [plan](../plans/completed/phase-7.7-1-annotation-resize.plan.md) / [report](../reports/phase-7.7-1-annotation-resize-report.md) |
| 2 | A2: 色変更 UI + Schema 拡張 | stroke/fill → color に統一、Toolbar に色パレット 7 色 + 2 適用ボタン、デフォルト赤(sync) / 黄(highlight 独立) | complete | with 1, 3 | - | [plan](../plans/completed/phase-7.7-2-color-palette.plan.md) / [report](../reports/phase-7.7-2-color-palette-report.md) |
| 3 | B1: ズーム/パン + fit-to-viewport | Stage scale/position 制御、Cmd+0/1, Space+drag, Cmd+wheel、初期 fit ロジック、座標変換整合 | complete | with 1, 2 | - | [plan](../plans/completed/phase-7.7-3-zoom-pan-fit.plan.md) / [report](../reports/phase-7.7-3-zoom-pan-fit-report.md) |
| 4 | B2: ショートカット網羅 + チートシート | `?` キーで Help モーダル、Phase 1-3 で追加されたショートカット網羅、キーボード完結検証 | complete | - | 1, 2, 3 | [plan](../plans/completed/phase-7.7-4-shortcut-cheatsheet.plan.md) / [report](../reports/phase-7.7-4-shortcut-cheatsheet-report.md) |

### Phase Details

**Phase 1: A1 注釈リサイズ** (status: complete / plan: `plans/completed/phase-7.7-1-annotation-resize.plan.md` / report: `reports/phase-7.7-1-annotation-resize-report.md`)

- **Goal**: 配置済み注釈をマウスで自然にリサイズでき、Yjs 経由で他クライアントにも同期される
- **Scope**(plan 段階で確定):
  - 既存スキーマの **矩形 / ハイライト**: Konva `Transformer` で 8 ハンドル + Shift 比率固定 + Alt 中心基点(Konva 自動)
  - 既存スキーマの **矢印**: from/to の 2 端点 Circle ハンドル(Transformer は Arrow に不向きのため。Konva 公式 Modify_Curves パターン)
  - **テキスト注釈**: Phase 7.7 スコープ外(fontSize ベースの別 UX)
  - **楕円 / 直線**: 既存スキーマに存在しないため Phase 7.7 スコープ外(新規注釈タイプは追加しない)
  - reducer / Yjs mutation は既実装(`annotation/resize-rect`, `resizeRectangleY` 等)、UI 接続のみ
  - reducer / Yjs mutation のシグネチャを `{x, y, width, height}` 4 フィールドに拡張(Transformer ドラッグで位置も変わるため)
  - E2E: リサイズ → サイズ反映、Shift 比率固定、Alt 中心固定、Undo
- **Success signal**: マウスでリサイズ可能 + 2 ブラウザ同期 + 既存の移動/削除/Undo が壊れていない

**Phase 2: A2 色変更 UI + Schema 拡張**

- **Goal**: 矩形/矢印/楕円/テキスト/ハイライト 全 5 種の色を業務文脈に合わせて変更でき、デフォルトは赤(ハイライトのみ黄)
- **Scope**:
  - `packages/shared/src/annotation.ts` の判別共用体に `color: string` 追加(未リリースのためマイグレーション不要、デフォルト値は型ごとに分岐: 矩形/矢印/楕円/テキスト = 赤、ハイライト = 黄)
  - `apps/web/src/components/canvas/colors.ts` を「デフォルト赤 + パレット 5-7 色」体系に更新
  - Toolbar に色パレット UI を追加(shadcn コンポーネント流用 or 軽量自作)
  - **2 適用ボタン**: 「新規デフォルトに設定」+ 「選択中の注釈に適用」(ユーザー確定仕様)
  - 「同期 vs 個別」: MVP は同期(矩形/矢印/楕円/テキストが一斉に変わる)、ハイライトは別系統(独自に色を持つ)
- **Success signal**: 5 種全ての注釈で色をパレットから変更可、デフォルト色が赤(矩形/矢印/楕円/テキスト)と黄(ハイライト)、両方の適用ボタンが動作

**Phase 3: B1 ズーム/パン + fit-to-viewport**

- **Goal**: 任意サイズの画像を投入しても初期表示が破綻せず、ズーム/パンで詳細部位にアクセスできる
- **Scope**:
  - 画像読込時に viewport サイズと画像サイズから初期 scale を計算(`min(vw/iw, vh/ih, 1)` で fit、小さい画像は等倍維持)
  - **Stage(Canvas) ごと scaleX/scaleY/x/y で倍率を掛ける方針**(ユーザー確定: 既存の論理座標系・hit-test ロジックは触らない)
  - Stage transform を React state で管理(`useStageTransform` フックに分離)
  - `Cmd+0`: fit-to-viewport
  - `Cmd+1`: 100%(= 等倍)
  - `Space + drag`: 一時パン(離すと元のツールに戻る)
  - `Cmd+wheel`: ズーム(マウス位置中心)
  - トラックパッドのピンチズーム: 自然対応(Konva は wheel イベントで pinch も拾える)
  - hit-test: `getPointerPosition()` を `getRelativePointerPosition()` に置換して Stage transform を吸収
  - **「画像 + α」余白: 画像サイズの 200%**(ユーザー確定。パン可能な仮想領域の上限)
- **Success signal**: 5000×5000 / 320×240 / 1920×1080 全てで初期表示が viewport 内、ショートカットでズーム/パン可、既存の注釈描画が壊れない、200% 領域内でパン可

**Phase 4: B2 ショートカット網羅 + チートシート**

- **Goal**: マウスを 1 度も握らずに golden path を完遂でき、ユーザーがショートカットを発見できる
- **Scope**:
  - Phase 1 / 2 / 3 で追加された全ショートカットを `useKeyboardShortcuts` に集約
  - `?` キー(Shift+/)で `HelpModal` を開く(shadcn `Dialog` 流用)
  - Modal 内容: ツール選択 (V/R/A/T/H + 楕円/直線追加分)、色変更 (C 等)、ズーム (Cmd+0/1, Space+drag)、編集 (Undo/Redo/Delete/Esc)、エクスポート (Cmd+S)、ヘルプ (?)
  - 日本語/英語キーボードでの `?` 動作確認
  - golden path E2E: 「投入→4種配置→色変更→リサイズ→PNG 出力」をキーボードのみで完走
- **Success signal**: success metric の「マウス無し golden path」が緑、チートシートに全ショートカット記載

### Parallelism Notes

- **Phase 1 / 2 / 3 は並行可能**: 触るファイル境界が明確に分離している
  - Phase 1: `apps/web/src/components/canvas/AnnotationLayer.tsx`, `shapes/*.tsx`(Transformer 追加)
  - Phase 2: `packages/shared/src/annotation.ts`(Schema), `apps/web/src/components/toolbar/Toolbar.tsx`(UI), `colors.ts`(定数)
  - Phase 3: `apps/web/src/components/canvas/CanvasStage.tsx`(Stage 制御), `hooks/useStageSize.ts`(or 新規 `useStageTransform`)
- **Phase 4 は 1-3 完了後**: 全ショートカットを網羅したチートシートを作る性質上、先行 3 フェーズの完成を待つ必要がある
- 個人開発・週 15h 想定だが、3 並列を回すと文脈切替コストが上がるため、現実的には Phase 1 → Phase 2 → Phase 3 → Phase 4 の **直列** がベース。「並列可能」は将来複数オーナーで実装する場合の余地を残す表記

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| リサイズハンドル数と修飾子 | **8 ハンドル + Shift 比率固定 + Alt 中心固定** | 4 ハンドル / 修飾子なし | Figma / FigJam / Excalidraw / Konva.Transformer デフォルトで業界標準。学習コストゼロ |
| 色 UI 形式 | **5-7 色固定パレット** | カスタム RGB ピッカー / Skitch 風 8 色 | 業務用途は固定パレットで充足、UI シンプル、Phase 7.8 以降でカスタム拡張余地 |
| デフォルト色 | **赤(`#e74c3c` 系)** / 矩形・矢印・楕円・テキスト、**黄(`#f5d142`)** / ハイライト | 全タイプ赤統一 / 黒 / 青 | ユーザー指示明示。業務スクショ注釈の慣例(Skitch / CleanShot のデフォルトも赤系)。ハイライトは蛍光黄がデフォルト |
| ハイライト色の扱い | **デフォルト黄、変更可能(他色も選択可)** | 黄色固定 | ユーザー確定(2026-05-03): 「ハイライト色変更は必要、デフォルトが今の黄色でいいだけ」 |
| 色は注釈タイプ間で同期 or 個別 | **MVP は同期(矩形/矢印/楕円/テキスト)、ハイライトは別系統で個別** | 完全個別 / 完全同期 | ユーザー証言「3つは基本的に同期」を採用。ハイライトはもともと用途が違うので独立 |
| 色適用の UX | **「新規デフォルトに設定」+「選択中の注釈に適用」の 2 ボタン式** | 単一ボタン / モード切替 | ユーザー確定(2026-05-03): 両方のフローが必要。2 ボタンで明示的に分ける |
| Yjs マイグレーション | **不要(未リリースのため後方互換性考慮しない)** | zod default で透過マイグレーション | ユーザー確定(2026-05-03): 「マイグレーション不要、まだ正式リリースしてない」 |
| ズーム実装方針 | **Stage 全体に scaleX/scaleY/x/y を掛ける(座標系は触らない)** | 注釈座標を再計算 / Layer 別にスケール | ユーザー確定(2026-05-03): 「canvas ごと倍率かけちゃえばいい」。実装最小化 + 既存ロジック保護 |
| パン可能領域の余白 | **画像サイズの 200%** | 400% / viewport いっぱい / 無限 | ユーザー確定(2026-05-03)。長文テキスト追加に必要十分、過大領域は迷子防止のため避ける |
| チートシート UI 形式 | **Modal / Popover / Drawer のいずれか(plan で決定)** | 専用ページ | ユーザー確定(2026-05-03): UI ライブラリの一般形に寄せる、plan で UX 観点最終選定 |
| ズーム/パンのキー体系 | **Cmd+0 fit / Cmd+1 100% / Space+drag pan / Cmd+wheel zoom** | FigJam の Shift+1/Shift+2 系 | Photoshop 系規約が最も浸透。FigJam 流派は併設 Could |
| チートシート起動キー | **`?` 単独 (Shift+/)** | `Cmd+Shift+?` (Figma 流) | Excalidraw 流。片手で押せて発見性が高い。軽量ツールに合う |
| Konva Transformer の採用 | **標準 Transformer をそのまま採用** | 自前ハンドル実装 | 業界標準操作が組み込みで提供される、保守コスト最小 |
| AnnotationSchema 拡張 | **`color` フィールドを判別共用体の各メンバに追加 + zod default で透過マイグレーション** | 別 `style` ネスト追加 / 個別 stroke / fill 維持 | 最小変更で後方互換性、SSOT 維持 |
| Phase 1-3 の並列性 | **論理上は並列可、実装は直列ベース** | 強制直列 | 個人開発の文脈切替コストを優先。並列可能性は表記のみ残す |
| 楕円注釈の追加可否 | **現状スキーマに無ければ Phase 1 で追加** | 楕円スコープ除外 | 矩形/矢印/直線だけだと「リサイズ機能」が部分的になる |

---

## Research Summary

**Market Context**

- 業界標準の収束: Konva.Transformer / Figma / Excalidraw とも 8 ハンドル + Shift 比率固定 + Alt 中心固定が事実上の合意
- 色 UI: Skitch 8 色固定 + ピッカー、CleanShot X カスタム色保存、Shottr v1.8 で custom annotation colors 追加。**「注釈タイプ間で同期 vs 個別」の業界コンセンサスは弱く、自社で決め打ちする余地あり**
- ズーム/パン: Photoshop 系(Cmd+0 fit / Cmd+1 100%)が最も浸透、FigJam(Shift+1 fit / Shift+2 selection)併設も標準化進行中、Space+drag は全ツール共通
- ショートカット発見性: Excalidraw は `?` 単独、Figma は `Cmd+Shift+?`。`?` 単独の方が片手で押せて軽量ツールに合う
- ツール頭文字: V/R/A/T/E/L/M/H が CleanShot X と一致しており、snap-share の現行 V/R/A/T/H とも整合
- Shottr の不満点(操作の連続性・予測不足)は、業界標準を完全には満たしていない箇所(Shift/Alt 修飾子の弱さ)に集中していると読み取れる

**Technical Context**

- リサイズの Yjs 基盤は既に完成: `resizeRectangleY` / `resizeHighlightY` / `setArrowEndpointsY` / `LOCAL_ORIGIN` 全て実装済(`apps/web/src/domain/annotation/yjs-mutations.ts`)。**Phase 1 は UI 接続のみ**
- 色は `apps/web/src/components/canvas/colors.ts` に 5 定数ハードコード、`AnnotationSchema` に `color` フィールド未定義。Phase 2 は **Schema 拡張 + Toolbar UI 追加** の中規模変更。**未リリースのためマイグレーション不要**
- ズーム/パンは未実装(`grep` 0 件)、Stage の scale 制御も未着手。Phase 3 は **Stage 全体に倍率を掛ける方針(ユーザー確定)** で、既存の論理座標系・hit-test ロジックには触らない。`getRelativePointerPosition` への置換のみ
- 既存ショートカットは `useKeyboardShortcuts` で 9 種実装済(V/R/A/T/H + Undo/Redo/Delete/Esc/Export)。`?` 未割り当て、チートシート UI 不在。Phase 4 は **Modal 追加 + 既存フック拡張** で軽量
- Konva レイヤー分離(`ImageLayer` の `listening={false}`)、Yjs `LOCAL_ORIGIN` 規約、`packages/shared` SSOT、`noUncheckedIndexedAccess` の TS 設定を全フェーズで順守

---

*Generated: 2026-05-03*
*Status: DRAFT - Open Questions の解消は plan 段階で行う*
