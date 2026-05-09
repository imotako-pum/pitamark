# Handoff: Phase 10.I → Phase 10.J (Touch UX Standards Compliance)

**Date**: 2026-05-09
**Previous session branch**: `phase-10-i-touch-optimization` (9 commits ahead of main)
**Status**: ⚠ **Phase 10.I は機能パリティ達成、UX 標準準拠は未達 — 新 Phase 10.J が必要**

---

## 0. TL;DR (新セッション最初に読むべき要点)

1. Phase 10.I (タッチデバイス操作最適化) を 4 sub-phase で実装したが、**実機 (iPhone Safari + Android Chrome) で UX 業界標準に達していない** ことがユーザー実機検証で発覚
2. 真の root cause:
   - **Konva の event ペアリング規約** (`onClick` + `onTap`, `onDblClick` + `onDblTap` 等) を全 shape で未対応 → 実機 touch で shape を選択できない
   - **長押しコンテキストメニュー** が皆無 (Phase 10.I PRD で意図的に Won't 化したが、業界標準では必須)
   - **E2E が `page.mouse` 経由で emulation 限定**、実機相当の touch event (`page.touchscreen` / CDPSession `Input.dispatchTouchEvent`) を発火していない
3. **ユーザーの不満**: 「PC とタッチデバイスで使い勝手が全く違う、UX 標準ができていない」
4. **次のセッションでの最初の action**: Phase 10.J 起票 (PRD → Plan → Implement の 1 周目)。下記 Section 9 のプロンプトをそのまま貼るのが推奨

---

## 1. 現状の git

- **Branch**: `phase-10-i-touch-optimization` (`main` から 9 commits ahead)
- **Working tree**: clean
- **PR**: 未作成 (本来 PR ready だったが、ユーザー実機検証で UX 不足発覚 → hold)

### 9 commits

| Hash | Type | 内容 |
|---|---|---|
| `c939c43` | feat 10.I-1 | Konva Stage を Pointer Events 一本化してタッチ描画を復旧 |
| `271cdfc` | docs 10.I-2 | 2-finger pinch + ヒットエリア拡大の Plan |
| `e9bb3b7` | feat 10.I-2 | 2-finger pinch zoom + pan + ヒットエリア拡大 |
| `beb2300` | docs 10.I-3 | Toolbar bottom 固定 + safe-area の Plan |
| `52f55fb` | feat 10.I-3 | Toolbar bottom 固定 + safe-area + 44px tap target |
| `29cf140` | docs 10.I-4 | E2E 受入 + 実機検証 + umbrella の Plan |
| `f37a473` | feat 10.I-4 | 12 ケース受入 spec + 手動 QA docs + Phase 10.I umbrella report |
| `bc4d0a0` | chore | code review feedback (Medium 4 件 fix) + review report |
| `052252f` | fix | touch でのリサイズ + テキスト再編集を動作確証 (TextShape `onDblTap` 追加 + 7 ケース E2E) |

### CI 通過状態 (本セッション末時点)

- typecheck / biome ci 219 files: ✅ 緑
- web 346 unit + api 187 unit: ✅ 緑
- chromium 78 e2e: ✅ 緑 (回帰ゼロ)
- mobile-chrome 累積 22 e2e (3 smoke + 12 受入 + 7 post-review): ✅ 緑 (**emulation で動くのみ、実機未検証**)

---

## 2. 真の未解決問題 (Phase 10.J で対応すべき)

### 問題 1: Konva の event ペアリング全面欠落

**業界標準の原則**: Konva の `click / dblclick` は **mouse event 専用**、touch では **`tap / dbltap` が別イベント** として発火 (公式 [Desktop_and_Mobile.mdx](https://konvajs.org/docs/events/Desktop_and_Mobile.html))。

| Shape | 現状 | 必要な追加 |
|---|---|---|
| `RectangleShape.tsx:63` | `onClick` のみ | `onTap` (touch シングルタップ選択) |
| `ArrowShape.tsx:69` | `onClick` のみ | `onTap` |
| `ArrowShape.tsx:81,98` (Circle handle) | `onPointerDown` のみ | `onTouchStart` (cancelBubble 確保) |
| `HighlightShape.tsx:63` | `onClick` のみ | `onTap` |
| `TextShape.tsx:41` | `onClick` のみ | `onTap` |
| `TextShape.tsx:49` (10.I post-review fix で `onDblTap` 追加済) | ✅ 完了 | — |

→ **実機 iOS Safari でシングルタップしても shape が選択されない** ため、Transformer が出ず、リサイズも編集モード進入もできない。

### 問題 2: 長押しコンテキストメニューが皆無

業界標準 (Keynote / Google Slides / Figma / Excalidraw):
- shape を **長押し** → コンテキストメニュー (削除 / 複製 / 色変更 / 前面移動 / 等)

Phase 10.I PRD では「長押しメニューは Excalidraw でも誤発火多発のため Won't」と決めたが、**業界標準なので 10.J では必須に格上げ** する判断が必要。誤発火対策は実装で工夫する (例: 押下時間 500ms 以上 + 移動量 5px 以下、tldraw 風の押下インジケータ表示)。

### 問題 3: E2E の実機適合性

| 現状 | 問題 | 修正方針 |
|---|---|---|
| `apps/web/e2e/touch-acceptance.spec.ts` (12 件) | `page.mouse.move/down/up` 経由 | 実機 touch event を発火しない、emulation 限定 |
| `apps/web/e2e/touch-acceptance-edit.spec.ts` (7 件) | 同上 | 同上 |
| `apps/web/e2e/touch-pinch-zoom.spec.ts` | CDPSession `Input.dispatchTouchEvent` 経由 | ✅ 実機相当 |

→ Phase 10.J で **既存 19 件を `page.touchscreen.tap` / CDPSession 経路に移行**、実機で動くことを CI で lock する。

### 問題 4: 業界標準 touch UX マッピング不在

操作と event mapping を ADR で明文化していない。各実装が場当たり的に `onClick` だけ配線したり、`onPointerDown` だけ配線したりで一貫性がない。**ADR-0007 で全操作を体系化** する必要。

---

## 3. 業界標準 touch UX (調査済の枠組み)

主要図形編集ツールの共通則:

| 操作 | 標準 ジェスチャ | snap-share 現状 | 10.J で達成すべき |
|---|---|:--:|:--:|
| 図形を**選択** | シングルタップ | ❌ (`onTap` 未対応) | ✅ |
| 図形を**移動** | (選択後) ドラッグ | ⚠ (Konva `draggable` で動くが選択不可なので孤立) | ✅ |
| 図形を**リサイズ** | ハンドル (角 / 辺) ドラッグ | ❌ (Transformer 描画はされるが指で掴める保証なし) | ✅ |
| 図形を**削除** | **長押し → メニュー** または ツールバー | ⚠ (ツールバーボタンのみ、長押し皆無) | ✅ |
| **テキスト入力** | ツール選択 → タップ → IME | ✅ (実装済) | ✅ |
| **テキスト変形** | ハンドル (もしくは text の場合は自動リサイズ) | ❌ (Transformer なし、自動リサイズなし) | 要決定 |
| **テキスト編集** | ダブルタップ → 編集モード | ⚠ (post-review fix で `onDblTap` 追加済) | ✅ |
| **ピンチズーム** | 2 本指ピンチ | ✅ (10.I-2) | ✅ (流用) |
| **キャンバス pan** | 2 本指スワイプ | ✅ (10.I-2) | ✅ (流用) |
| **コピー / ペースト** | 長押しメニュー | ❌ (機能ゼロ) | 要 PRD 判断 |

### 調査対象 (Phase 10.J Plan で context7 / web 検索すべき)

- **Apple Keynote (iOS / iPadOS)**: 図形編集の HIG 準拠
- **Google Slides (mobile web + Android)**: web ベースで近い setting
- **Figma (iPad / mobile web)**: プロデザイナー向け、長押しメニュー明確
- **Excalidraw**: web ベース、touch device 対応経緯ある (PR #788 等)
- **Miro / FigJam**: ホワイトボード系
- **tldraw v3**: pen / touch / mouse 分岐の最新パターン

---

## 4. Phase 10.J で必要な作業 (推奨順)

### A. 起票 (PRP の 1 周目)

1. **ADR-0007**: Touch UX Standards (業界標準調査結果 + snap-share の操作 → event mapping 一覧)
2. **PRD**: `phase-10-j-touch-ux-standards.prd.md`
   - Acceptance Criteria は「**実機 (iPhone Safari + Android Chrome) で touch UX 標準準拠の動作**」を明示
   - 受入は「機能パリティ」ではなく「**ユーザーが PC と同じ感覚で使える**」レベル
   - 実機 QA を **Must (= ブロッカー)** に格上げ (10.I は推奨止まりだった)

### B. 実装 (sub-phase 分割は 10.J PRD で確定)

候補 sub-phase:

| sub | 内容 |
|---|---|
| 10.J-1 | 全 shape の `onClick + onTap` ペアリング、shape 選択を実機 touch で動かす |
| 10.J-2 | 長押しコンテキストメニュー (Konva の `tap-and-hold` イベント経由 or 自前 timer)、削除 / 複製 / 色変更 を含む |
| 10.J-3 | E2E を `page.touchscreen` / CDPSession 経路に移行 (既存 19 件 + 新規追加) |
| 10.J-4 | 実機 QA (`docs/qa/phase-10-i-touch-manual-qa.md` を v2 に拡張) + 受入 |

### C. Phase 10.I の扱い (ユーザー判断待ち)

3 案:

- **A. Phase 10.I を merge せず保留** — 9 commits を branch のまま、10.J 完了後に 10.I + 10.J を 1 PR に統合。最も筋が通るが時間かかる
- **B. Phase 10.I を「機能基盤」として merge、10.J で UX 達成を続行** — branch を merge して main に取り込み、10.J を delta として実装。**推奨**
- **C. Phase 10.I の今ある実装は維持し、touch UX の真の達成は v1.0.1 にずらす** — PRD の「PC 同等」を訂正

新セッション開始時にユーザーに **どの案で進めるか確認** する必要あり。

---

## 5. 重要な学び (繰り返してはいけない罠)

### 罠 1: emulation ≠ 実機

Playwright `mobile-chrome` (Pixel 5 emulation) で `page.mouse.move/down/up` を発火しても、**Konva 内部では `mousedown / mouseup / click` event が発火し、実機 iOS Safari の `touchstart / touchend / tap` event とは別経路**。emulation E2E は実機保証にならない。

**対策**: 受入レベルの spec は **必ず `page.touchscreen.tap` または CDPSession `Input.dispatchTouchEvent`** を使う。

### 罠 2: Konva event ペアリング無自覚

Konva は mouse / touch / pointer の 3 系統を **一部正規化するが、`click / dblclick` 系は mouse 専用**。touch 対応時は `tap / dbltap` を必ずペアで bind する。Phase 10.I-1 で `onMouseDown → onPointerDown` の置換はやったが、`onClick` 系の placement は同期して見直さなかった。

**対策**: 新規 / 修正時に shape に touch handler を追加するときは **必ず以下のペアを確認**:
- `onClick` ↔ `onTap`
- `onDblClick` ↔ `onDblTap`
- `onMouseDown` ↔ `onTouchStart` (Pointer Events 一本化していない経路)
- `onMouseUp` ↔ `onTouchEnd`
- `onMouseMove` ↔ `onTouchMove`

### 罠 3: 受入 spec の網羅性不足

Phase 10.I-4 の受入 spec で `add / move / delete` の 3 操作のみ lock し、**resize / re-edit / 長押し / 文脈メニュー / 等の UI 操作を網羅していなかった**。

**対策**: Plan 起票時の Acceptance Criteria セクションで「**この機能の UI 上で実行可能な全操作**」を一度列挙する。リストアップした操作のうち何を CI lock するか / 手動 QA に投げるかを Plan で確定する。

### 罠 4: PRD Acceptance Criteria の文言

10.I PRD は「PC でできることはすべてスマホでも (機能パリティ)」と書いたが、ユーザーが本当に求めていたのは「**PC と同じ感覚で (UX 達成)**」。文言レベルで違いを切り分けないと scope が緩んだまま実装される。

**対策**: 10.J PRD では「**実機で touch UX 業界標準に準拠した操作感**」を Acceptance Criteria に明示する。動作確認は実機 QA を Must (ブロッカー化)。

---

## 6. 主要ファイル参照

### 修正対象 (Phase 10.J で触る)

| File | 必要な変更 |
|---|---|
| `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | `onTap` 追加 (`onClick` ペア) |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | `onTap` 追加 + Circle handle の `onTouchStart` |
| `apps/web/src/components/canvas/shapes/HighlightShape.tsx` | `onTap` 追加 |
| `apps/web/src/components/canvas/shapes/TextShape.tsx` | `onTap` 追加 (`onDblTap` は既に追加済) |
| `apps/web/src/components/canvas/AnnotationLayer.tsx` | (必要に応じて) onTap 経路の prop 配線 |
| 新規: 長押しメニュー UI (`apps/web/src/components/canvas/ContextMenu.tsx`?) | コンテキストメニュー実装 |
| 既存 E2E (19 件) | `page.mouse` → `page.touchscreen` / CDPSession に移行 |

### 既存資産 (流用可能)

- `apps/web/src/hooks/useTouchDevice.ts` (10.I-2 作成)
- `apps/web/src/components/canvas/colors.ts` の `HANDLE_RADIUS_TOUCH` / `ANCHOR_SIZE_TOUCH` / `HIT_STROKE_WIDTH_TOUCH` (10.I-2 追加)
- `apps/web/src/main.tsx` の `Konva.capturePointerEventsEnabled = true` / `Konva.hitOnDragEnabled = true` (10.I-1 / -2 設定)
- `apps/web/src/styles/global.css` の `.konvajs-content { touch-action: none }` (10.I-1)
- `apps/web/index.html` の `viewport-fit=cover` (10.I-3)
- `apps/web/e2e/fixtures/touch-helpers.ts` (10.I-4 共通 helper、`page.touchscreen` 経路を追加して活用)
- ADR-0006 (Pointer Events 一本化、本 Phase の Status Update を追記する形)

### 関連 docs

- PRD: `.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md`
- ADR-0006: `docs/adr/ADR-0006-pointer-events-unification.md`
- umbrella report: `.claude/PRPs/reports/phase-10-i-umbrella-report.md`
- review report: `.claude/PRPs/reviews/phase-10-i-touch-optimization-review.md`
- 手動 QA docs: `docs/qa/phase-10-i-touch-manual-qa.md` (v2 に拡張)
- 親 PRD: `.claude/PRPs/prds/snap-share.prd.md` (Phase 10 行に 10.J 追加が必要)

---

## 7. memory 反映済み事項 (auto memory に保存)

新セッションで自動的に load される:

- **feedback (touch UX)**: emulation E2E は実機保証にならない、実機 QA / `page.touchscreen` 経路必須
- **feedback (Konva event)**: Konva は mouse / touch / pointer を一部正規化するが、`click + tap` / `dblclick + dbltap` のペアリングは shape 単位で必須
- **project (Phase 10.J)**: touch UX 標準準拠、Phase 10.I の延長として起票、長押しメニューの Won't を見直す方針

---

## 8. 推奨される最初の手順 (新セッション)

1. このファイル (`.claude/PRPs/handoff/phase-10-j-touch-ux-handoff.md`) を読む
2. ユーザーに「Phase 10.I をどう扱うか (A/B/C)」を確認
3. 業界標準の実装事例を context7 / web 検索で深掘り (Excalidraw / tldraw / Konva 公式 / iOS HIG)
4. ADR-0007 + Phase 10.J PRD を `/everything-claude-code:prp-prd` で起票
5. PRD 確定後、`/everything-claude-code:prp-plan` で 10.J-1 (shape 選択 onTap fix) から着手
6. 各 sub-phase で **`page.touchscreen` 経路の E2E** を最初に書いて実機症状を再現してから実装する (TDD 寄り、emulation で pass しても信用しない)

---

## 9. 新セッションへの引き継ぎプロンプト (コピペ可能)

```
このリポジトリは snap-share (画像アノテーション共有 Web アプリ)。

前セッションで Phase 10.I (タッチデバイス操作最適化) を 4 sub-phase で実装し
PR ready 状態 (branch: phase-10-i-touch-optimization, 9 commits ahead of main)
まで進めたが、ユーザー実機検証で touch UX 業界標準 (Keynote / Google Slides /
Figma / Excalidraw 等) に達していないことが発覚した。

最初に以下のファイルを必ず読んで context を取り込んでください:
.claude/PRPs/handoff/phase-10-j-touch-ux-handoff.md

要点:
- Phase 10.I は機能パリティ (動く / 動かない) は達成したが UX 達成は未達
- 真の root cause: Konva event ペアリング (onClick + onTap, onDblClick + onDblTap)
  全 shape で未対応 + 長押しコンテキストメニュー皆無 + E2E が page.mouse 経由で
  実機 touch event を擬似していなかった
- Phase 10.J (Touch UX Standards Compliance) を新規 PRD として起票して取り組む

最初の作業:
1. handoff docs を読む
2. ユーザーに「Phase 10.I を merge して 10.J で乗せるか (推奨 B) / 保留して 10.J
   完了後に統合するか (A) / 機能パリティで諦めるか (C)」を確認
3. 業界標準調査 (Excalidraw / tldraw / Konva 公式 / iOS HIG) を context7 / web で
4. ADR-0007 + Phase 10.J PRD 起票

避けるべき罠 (前セッションで踏んだもの):
- Playwright mobile-chrome (Pixel 5 emulation) の page.mouse は実機 touch event
  を発火しない。E2E は必ず page.touchscreen.tap / CDPSession Input.dispatchTouchEvent
  経路で実機相当の event を生成する
- Konva の onClick / onDblClick は mouse event 専用、touch は onTap / onDblTap が別。
  shape に touch handler を追加するときは onClick + onTap / onDblClick + onDblTap
  のペアを必ず両方 bind する (Konva 公式 Desktop_and_Mobile.mdx パターン)
- 受入 spec は「UI 上で実行可能な全操作」を Plan 起票時に列挙する。10.I-4 の受入
  spec は add/move/delete の 3 操作のみで resize / re-edit を網羅していなかった
  盲点が原因

目標:
v1.0.0 (Phase 10.F) 公開前に、PC とタッチデバイスで一般ユーザーが PC と同じ感覚で
使える状態にする (= 業界標準 touch UX 準拠)。
```
