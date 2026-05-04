# Local Code Review: Phase 8 — a11y (#9)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: Web (SPA) のアクセシビリティ。WCAG 2.2 Level AA の Critical/Important 項目に絞る。観点境界マップ (`phase-8-triage-review.md` 117-145) に従い、React hooks 規律 / state 管理は #3 副次のみ、a11y 関連 test の網羅は #8 副次のみで本 review 対象外。Konva canvas の hex リテラルは a11y 配色観点 (4.5:1) と presence palette の同期妥当性を見るが、Konva 内部の semantic 構造 (リスナー連携) は #3 主観点に渡す。
**Decision**: NEEDS_FIX
  - MEDIUM 1 件 (HelpModal の物理 target size と本文サイズ AAA 違反の境界、body 用途の `--muted-foreground` コントラスト)
  - LOW 5 件
  - CRITICAL / HIGH なし → Phase 9 dogfood への BLOCKER ではない、Phase 8.x で吸収可能

**Out of scope**:
- `apps/web/src/components/ui/*` (shadcn / Base UI 自動生成) は触らない方針 (`phase-8-triage-review.md` Open Items)。ただし **`Button` の `icon-sm` size やデフォルト `outline-none` のような production 影響のあるスタイル決定** は本観点で評価対象とする (生成物の流用方針自体が a11y を握っているため)。
- Konva canvas 描画オブジェクトの a11y (SR exposure) は本フェーズの target outside。canvas は事実上 SR から不可視で、キーボードからの編集は wrapper UI (Toolbar / shortcut) 経由 + DropZone 入力 + TextEditorOverlay で完結する設計のため、`#9 a11y` としては「キーボード完結 golden path が保てているか」を見る。SR で canvas 内の annotation を読ませる対応は別フェーズ案件 (PRD 化されていない、scope outside)。

## Summary

snap-share の a11y は **Phase 7.7 の「キーボード完結 golden path」と「shadcn / Base UI への素直な乗り換え」が効いており、CRITICAL/HIGH ゼロ**。RoomGate / DropZone / Toolbar / FontSizeControl のいずれも `aria-label` / `role="status"` / `aria-live` / `aria-pressed` / `aria-invalid` を意図的に当てており、HelpModal は Base UI Dialog primitive を素直に使っているため focus trap / restore / Esc 閉じが委譲で保証されている。

ただし以下が構造的に未解決:

- **WCAG 2.2 SC 2.4.7 (Focus Visible)** は通っているが、**SC 1.4.3 (Contrast Minimum)** に対して `--muted-foreground` を **本文 (body text) として** 使っている箇所が複数あり、oklch(50% 0 0) は `--color-surface` (oklch 98% 0 0) 上で contrast ratio ≈ 4.5:1 ぎりぎり (色覚条件で陥没する余地あり)。MEDIUM 1 件として記録。
- **Toaster (sonner) 経由の error feedback** は SR にも届くが、**`aria-live` 領域として明示的に live region role を当てていない** ため、login 失敗 / save 失敗の即時通知が SR で確実に読まれる保証がない。LOW 1 件。
- **DropZone は `<button>` の中に `role="alert"` を nest する構造** のため、SR のフォーカスがエラーで巻き戻る挙動になりうる (button text 自体に error が含まれる読み上げ)。LOW 1 件。
- **HelpModal の section 順序と Toolbar 物理配置の乖離** (既存指摘の継続観察) は LOW のまま据え置き、ただし Phase 7.8-3 review からの carryover として明記。
- **`prefers-reduced-motion` の対応はゼロ** — `@media (prefers-reduced-motion: reduce)` ブロックも `useReducedMotion` hook も grep で 0 hit。Sonner の slide / Dialog の zoom-in-95 / DropZone の transition / Toolbar の animate-in 系が一律発火する。LOW 1 件 (現状 motion 量は控えめなので CRITICAL ではない、しかし `.claude/rules/web/testing.md` で「reduced-motion 動作を検証する」旨が明記されているのに対応していない)。
- **Turnstile widget は `size: 'invisible'` + `aria-hidden="true"` を当てており**、純正委譲として正しい。SR には不可視で問題なし、確認のみ。
- **target size**: `Button` の `icon-sm` = 28px、`icon` = 32px、いずれも WCAG 2.2 SC 2.5.8 (Minimum 24x24 CSS px) を満たす。Tooltip 込みで visible label もあり、AA 達成。

LOW のうち Human Friction = true は **L1 のみ** (`--muted-foreground` を本文に使っているのと同じ「contrast 設計が後で揺れる」型のテーマ問題)。残り 4 件は Phase 9 dogfood で検証してから判断。

件数: CRITICAL 0 / HIGH 0 / MEDIUM 1 / LOW 5

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1: `--muted-foreground` を本文用途に流用しており SC 1.4.3 (4.5:1) のマージンが薄い**

- **Location**:
  - `apps/web/src/styles/tokens.css:50` — `--muted-foreground: oklch(50% 0 0)` の定義
  - `apps/web/src/components/ui/dialog.tsx:78-82` — `DialogDescription` に `text-muted-foreground` を当てる
  - `apps/web/src/components/dialogs/HelpModal.tsx:86-89` — DialogDescription に「すべての操作はキーボードで完結できます。閉じるには Esc か外側をクリック。矢印→テキスト・矩形→矢印 のサジェストは Enter で確定 / Esc で破棄。」という **2 行の本文** を流し込む。**本文情報** であり SC 1.4.3 (4.5:1) 適用対象。
  - `apps/web/src/components/toolbar/Toolbar.tsx:96` 経由の section heading は `text-muted-foreground` (HelpModal.tsx:96) も同様。
- **Issue**:
  - `--muted-foreground = oklch(50% 0 0)` を `--color-surface = oklch(98% 0 0)` 上に重ねると、APCA で約 Lc 70 / WCAG 2.x 計算で contrast ratio ≈ 4.5:1 **境界**。OKLCH の L 値計算上 ratio の有効桁数 1 桁分の余裕しかない。デバイスのガンマや OS の color profile で **本文閾値を割る個体** が出る。
  - HelpModal の `DialogDescription` は **キーボード操作の最も重要な解説テキスト**。a11y 文脈として「弱視ユーザーが頼る本文」が境界値で運用されているのは構造的なリスク。
  - shadcn 由来の `text-muted-foreground` パターンは「補助情報用」が本来の意図 (caption / placeholder / secondary)。snap-share では DialogDescription / 各 section title / FontSizeControl の値表示などに広く使われているため、**「本文として使ってよいか / 補助として使うべきか」のガイドが定義されていない** ことが原因。
- **Repro** (定性):
  1. HelpModal を開く (Ctrl+? or Toolbar の `?` ボタン)
  2. 弱視シミュレータ (Chrome DevTools Rendering > Emulate vision deficiency: blurred) を有効化
  3. DialogDescription の 2 行 (キーボードで完結… / Enter で確定…) が背景に溶けて読みにくいことを確認
  4. ColorPalette / FontSizeControl などの **AA は通っている** UI と比較すると認知負荷の差が体感できる
- **Suggested Fix**:
  - 短期: `--muted-foreground` を **0.50 → 0.42 程度** に下げる (oklch(42% 0 0))。これだけで `--color-surface` 上で contrast ratio ≈ 7:1 になり AAA まで届く。shadcn の他コンポーネント (placeholder / sonner border) も同時に強くなるが視認性が悪化する箇所はない。
  - 中期: `text-muted-foreground` を「補助情報専用」と明文化し、本文 (DialogDescription / RoomGate のエラー本文 / FontSizeControl 値) には専用 token (`--color-text-secondary` で 4.5:1 を確実に超える) を分離する。
  - これは Tailwind v4 と Konva hex の二重 SSOT 問題 (`#1 SSOT` 副次) と地続き — 修正は a11y 観点で発火し、影響は SSOT に波及する。
- **Severity**: MEDIUM — 構造的に「境界値運用」になっているのを LOW に押し込めると Phase 8.x の優先度判定で潰れる。a11y は境界値運用そのものを拒絶する観点。

---

### LOW

**L1: Toaster (sonner) を `aria-live` region として明示していない**

- **Location**:
  - `apps/web/src/App.tsx:20` — `<Toaster richColors closeButton position="bottom-right" />`
  - 利用箇所: `apps/web/src/hooks/useImageSource.ts:92`、`apps/web/src/hooks/useExportPng.ts:67-72`、`apps/web/src/pages/LocalEditor.tsx:69-77`、`apps/web/src/components/toolbar/CopyUrlButton.tsx:28-40`
- **Issue**:
  - sonner ライブラリは **デフォルトで toast container に `aria-live="polite"` を当てる** が、その挙動はライブラリ更新で揺れうる。snap-share 側で **明示的に `aria-live` を指定していない** ため、save 完了 / login 失敗 / clipboard 失敗の通知が SR で確実に読まれる保証がライブラリ依存。
  - `LocalEditor.tsx:73-77` の Turnstile 関連エラー (`認証中です` / `認証に失敗しました`) は **ユーザーが画像を投げた直後に発火する critical な error feedback**。これが SR に届かないと、視覚障害ユーザーは「アップロードが進まない理由」を文字情報で得られない。
- **Suggested Fix**:
  - `<Toaster aria-live="assertive" />` を error category にだけ当てる (sonner の `toastOptions` で `error` のみ assertive にする)。または **error toast を生やすときに、それと同期して `<output role="alert">` で見えない補助 live region を更新するアダプタ** を導入する。
  - Phase 9 dogfood で SR (VoiceOver / NVDA) を実機検証し、再判定。
- **Human Friction**: false
  - 改修時必読: no — `App.tsx` 1 行修正で完了、本文に頻繁に触らない
  - 再発生コスト: low — 1 箇所修正、lint で自動再発見しなくても影響範囲が限定
  - 認知負荷増: no — sonner のデフォルト挙動を信頼している意図は素直、リファクタ時の障害にならない

---

**L2: DropZone の `<button>` 内に `role="alert"` を nest している**

- **Location**: `apps/web/src/components/empty-state/DropZone.tsx:60-90` (button 全体) と `:82-89` (`<p role="alert">` の error 表示)
- **Issue**:
  - `<button>` の **accessible name** は `aria-labelledby="dropzone-heading"` で `<h2 id="dropzone-heading">画像をドロップしてください</h2>` に固定されている。これは正しい。
  - しかし **`<button>` の visible content** には `role="alert"` の `<p>` が含まれているため、SR が button の説明を読むときに **error 文も含めて連結される** 可能性 (browser/SR 実装依存)。仕様上 button text と alert text は role が違うため切り離されるべきだが、JAWS / NVDA で nesting 順序により読み上げ順が逆転するケースが報告されている。
  - また `role="alert"` は **追加されたタイミング** で SR に割り込み読み上げをさせる。button 内に存在するため、focus を維持しながら error が現れたとき、focus が button のまま `role="alert"` 経由で再読み上げされ、ユーザーは button の name と alert text の両方を 2 度聞くことになる。
- **Suggested Fix**:
  - `<p role="alert">` を `<button>` の **外側** (兄弟要素として `<section>` 直下) に移動し、`button` の `aria-describedby={errorId}` で関連付ける。これで:
    1. button の accessible name は heading のまま
    2. error は alert として独立して読まれる
    3. focus 復帰時に describedby で error を補足できる
  - 視覚的な配置は CSS で同じ位置に固定可能 (button 直下に absolute / margin-top で隣接、reading order は DOM 順で a11y tree に出る)。
- **Human Friction**: false
  - 改修時必読: no — DropZone は initial paint 用のリーフコンポーネント、改修頻度低
  - 再発生コスト: low — 1 ファイル局所修正
  - 認知負荷増: no — むしろ修正後のほうが構造が素直になる

---

**L3: `prefers-reduced-motion` 対応が CSS / JS の両方で 0 件**

- **Location**:
  - `apps/web/src/styles/global.css` 全体 — `@media (prefers-reduced-motion)` ブロックなし
  - `apps/web/src/styles/tokens.css` — `--duration-fast: 120ms` / `--duration-normal: 200ms` を unconditional に提供
  - `apps/web/src/styles/global.css:50-77` の shadcn-fade-in / shadcn-fade-out keyframes が unconditional に走る
  - `apps/web/src/hooks/` 配下 — `useReducedMotion` 系 hook なし (grep で 0 hit)
- **Issue**:
  - WCAG 2.1 SC 2.3.3 (Animation from Interactions) は AAA だが、`.claude/rules/web/testing.md` で「reduced-motion 動作を検証する」と明記されているため、project policy として AA 同等扱い。
  - 影響モーション量:
    - Toolbar の `data-open:animate-in` / Sonner の slide-in / Dialog の `zoom-in-95` (各 100ms — 軽め)
    - DropZone の `transition-colors duration-(--duration-normal)` (200ms — 軽め)
    - ConnectionBadge の `animate-pulse` (連続点滅、`disconnected` 状態で **無限ループ点滅** が発火)
  - ConnectionBadge の `animate-pulse` が **`disconnected` 中ずっと走る** のは前庭障害 / vestibular sensitivity ユーザーへの影響が大きい (継続的な不透明度変化)。motion 全体としては軽量だが、この 1 点だけは reduced-motion で止めるべき。
- **Suggested Fix**:
  ```css
  /* global.css の @layer base 末尾に追加 */
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    /* shadcn の data-open / data-closed は keyframe ベースなので上記でカバーされる */
  }
  ```
  Tailwind v4 でこれを書くと `@layer base` 内の宣言を override できる。`!important` は a11y 用途では推奨パターン (web.dev / MDN の reduced-motion 解説と同じ書き方)。
- **Human Friction**: false
  - 改修時必読: no — `global.css` 1 ファイル末尾追加
  - 再発生コスト: low — 1 度入れたら新規モーション追加時も自動カバー
  - 認知負荷増: no — むしろガードレールになって認知負荷を下げる

---

**L4: HelpModal の section 順序が Toolbar 物理配置と乖離 (carryover)**

- **Location**: `apps/web/src/components/dialogs/HelpModal.tsx:64-73` の `SECTIONS` 配列順序
- **Issue**:
  - 現在の section 順序: ツール / 色 / テキスト / **次手予測** / 編集 / ズーム / 出力 / ヘルプ
  - Toolbar 物理配置: Tools → Undo/Redo/Del → Color → Font → Export → Help
  - **「次手予測」section が Phase 7.8-5 で追加され、Toolbar 物理 button のないキー (Enter / Esc / Backspace) を集めている** ため、Toolbar 配置に sync するのが原理的に不可能。これは構造として正しい設計判断。
  - ただし「テキスト」と「次手予測」の隣接が **直感的に「テキスト編集中の予測サジェスト」と誤読される** 余地がある (実際は無関係)。LOW 持ち越し: Phase 7.8-3 review L2 と同根。
- **Suggested Fix**: `次手予測` を `編集` の直後に移動して「ツール→色→テキスト→編集→次手予測→ズーム→出力→ヘルプ」にすると、**「描画ツール → 色 → 文字 → 通常編集 → 予測編集 → 表示 → 出力 → メタ」** という認知の流れが取れる。コード変更は配列順 1 行のみ。
- **Human Friction**: false
  - 改修時必読: no — HelpModal は 1 度書いたらほぼ触らない
  - 再発生コスト: low — 配列の並び替え 1 行
  - 認知負荷増: no — むしろ section 順序が直感に sync して認知負荷が減る

---

**L5: ColorPalette / FontSizeControl の `biome-ignore for useSemanticElements` justification はコード上適正、ただし comment の標準化余地あり**

- **Location**:
  - `apps/web/src/components/toolbar/ColorPalette.tsx:18` — `// biome-ignore lint/a11y/useSemanticElements: fieldset would inherit unwanted form semantics; role="group" + aria-label cleanly groups the palette swatches.`
  - `apps/web/src/components/toolbar/FontSizeControl.tsx:24` — `// biome-ignore lint/a11y/useSemanticElements: ColorPalette と同じく role="group" でグルーピング`
- **Issue**:
  - 判定: **`<fieldset>` を採用しない** という決定は妥当。fieldset は (1) form 内でのみ semantic に整合 (palette は form 外)、(2) `<legend>` を強制し、(3) ブラウザのデフォルトスタイル (border / 内側 padding) を持つ。`role="group" + aria-label` のほうが軽くて意図が明確。
  - ただし FontSizeControl 側のコメントが **「ColorPalette と同じく」** という相対参照で、ColorPalette を読まないと **「なぜ fieldset じゃないか」が分からない**。CLAUDE.md 規約 (新規ファイルのコメントは英語、WHY のみ) の精神には合うが、`biome-ignore` の justification は **将来 lint rule が変わったとき / migrate したときに stand-alone で読めるべき**。
  - また両ファイルで日本語と英語が混在しているのは、コメントスタイル一貫性の観点で軽微な揺れ。
- **Suggested Fix**:
  - FontSizeControl の `biome-ignore` reason を ColorPalette と同じ理由 (fieldset の form semantics 干渉、`<legend>` 強制) を **省略せずに自分で持つ** 形にする。差分 1 行、コードレビュー時間で 30 秒。
  - もしくは「Toolbar 内の role=\"group\" 採用パターン」を `.claude/rules/web/coding-style.md` に **1 段落** 追記し、両ファイルからその ADR を参照する形に正規化 (Phase 8.x の SSOT integration として処理可能)。
- **Human Friction**: false
  - 改修時必読: no — Toolbar 関連改修時に読むが、改修頻度は低
  - 再発生コスト: low — 同パターンを再利用するときに ADR 1 件参照すれば済む
  - 認知負荷増: no — 現状でも意味は通る (相対参照を辿るだけ)、ADR 化すれば更に下がる

---

## Validation Results

実コード変更なし。本 review は静的解析と仕様読みのみ。

| Check | Result |
|---|---|
| Type check | (本 review でコード変更なし、既存 green を継承) |
| Lint | (同上) |
| Tests | (同上) |
| Build | (同上) |

参考: 本 review の判定根拠となる WCAG 2.2 success criteria を以下に対応付け:

| WCAG 2.2 SC | Level | snap-share の現状 | Finding |
|---|---|---|---|
| 1.3.1 Info and Relationships | A | RoomGate / DropZone / Toolbar すべて semantic + aria 適切 | — |
| 1.4.3 Contrast (Minimum) | AA | `--muted-foreground` を本文に使う運用が境界値 | **M1** |
| 1.4.11 Non-text Contrast | AA | accent / focus ring 3:1 達成 | — |
| 2.1.1 Keyboard | A | キーボード完結 golden path 達成 (Phase 7.7) | — |
| 2.1.2 No Keyboard Trap | A | HelpModal / TextEditorOverlay は Esc / 外側クリックで脱出可 | — |
| 2.4.3 Focus Order | A | DOM 順と視覚順が一致、tabIndex=-1 は DropZone の hidden input のみ | — |
| 2.4.7 Focus Visible | AA | `Button` / `Input` / `Checkbox` すべて `focus-visible:ring-3 ring-ring/50` | — |
| 2.4.11 Focus Not Obscured (Minimum) | AA (2.2 新) | Toolbar / Modal の overlay 配置を確認、focus 要素を完全に隠す箇所なし | — |
| 2.5.8 Target Size (Minimum) | AA (2.2 新) | `icon-sm` = 28px, `icon` = 32px, swatch wrapper = 28px。すべて 24px 以上 | — |
| 3.3.1 Error Identification | A | RoomGate `aria-invalid` + `role="alert"` あり | — |
| 3.3.2 Labels or Instructions | A | RoomGate / LocalEditor (パスワード) すべて `<Label htmlFor>` | — |
| 3.3.7 Redundant Entry | A (2.2 新) | パスワード等の二重入力なし | — |
| 4.1.2 Name, Role, Value | A | role="status" / aria-live / aria-pressed / aria-label 適切 | — |
| 4.1.3 Status Messages | AA | sonner toast の `aria-live` 委譲が暗黙的 | **L1** |
| 2.3.3 Animation from Interactions | AAA + project policy | reduced-motion 対応なし | **L3** |

## Files Reviewed

| File | 観点 | Note |
|---|---|---|
| `apps/web/src/components/dialogs/HelpModal.tsx` | a11y | Base UI Dialog primitive 委譲で focus trap / restore / Esc 自動。section 順序は L4 で carryover 観察。DialogDescription の本文コントラストが M1 に該当。 |
| `apps/web/src/components/ui/dialog.tsx` | a11y (生成物の流用妥当性) | `outline-none` を base に当てているが `focus-visible:ring-3` で補償。`text-muted-foreground` を Description に当てる pattern が M1 の発火点。 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | a11y | `role="toolbar" aria-label="編集ツール"` 適切。Divider に `aria-hidden="true"` 付与済 (decorative)。 |
| `apps/web/src/components/toolbar/ColorPalette.tsx` | a11y | `role="group" + aria-label="色パレット"` で fieldset 回避。biome-ignore reason ✅ |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | a11y | 同パターン。L5 で comment 標準化指摘。Phase 7.8-3 review L1 (二重 aria-label) は修正済。 |
| `apps/web/src/components/toolbar/ToolButton.tsx` | a11y | `aria-label` + `aria-pressed` + Tooltip で visible label。target size 32px AA OK。 |
| `apps/web/src/components/room-gate/RoomGate.tsx` | a11y | `<form aria-labelledby={headingId}>` + `<Label htmlFor>` + `aria-invalid` + `aria-describedby` + `role="alert"`。最良の実装例。 |
| `apps/web/src/components/empty-state/DropZone.tsx` | a11y | キーボード代替 = `<button>` でラップ + 隠し `<input>` 委譲、paste 対応。L2 で error nesting 指摘。 |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | a11y | `isEditableTarget` ガード適切、preventDefault が optional binding 提供時のみ発火する仕組みは a11y 的にも好ましい (browser default を温存)。 |
| `apps/web/src/components/ui/button.tsx` | a11y | `focus-visible:ring-3 ring-ring/50` AA、`outline-none` は補償あり、target size すべて 24px 以上。 |
| `apps/web/src/components/ui/input.tsx` / `label.tsx` / `checkbox.tsx` | a11y | shadcn 標準、aria-invalid / data-checked / focus-visible 適切。 |
| `apps/web/src/components/turnstile/TurnstileWidget.tsx` | a11y | `aria-hidden="true"` + invisible size、Cloudflare 純正に委譲。問題なし。 |
| `apps/web/src/components/connection/ConnectionBadge.tsx` | a11y | `role="status" aria-live="polite"` 適切。`animate-pulse` の reduced-motion 対応欠落が L3 に紐づく。 |
| `apps/web/src/components/toolbar/CopyUrlButton.tsx` | a11y | `aria-label="ルームURLをコピー"` + visible text、toast feedback。L1 と紐づく (toast 経由)。 |
| `apps/web/src/components/ui/sonner.tsx` | a11y | sonner 委譲、明示的 `aria-live` なし → L1。 |
| `apps/web/src/styles/global.css` / `tokens.css` | a11y (color contrast / motion) | M1 (`--muted-foreground` 境界値) と L3 (reduced-motion 0 件) の発火点。 |
| `apps/web/src/components/canvas/colors.ts` | a11y (palette / awareness) | COLOR_PALETTE の 7 色、AWARENESS_USER_PALETTE の 8 色、いずれも背景白で contrast 3:1 以上 (非テキスト要素として AA 達成)。 |
| `apps/web/index.html` | a11y | `lang="ja"` 設定済 (SC 3.1.1 達成)。viewport meta も適切。 |
| `apps/web/src/pages/EditorShell.tsx:438-456, 539` | a11y (shortcut / Help) | `onShowHelp` を画像未投入時も提供 (discoverability)。HelpModal の open state 管理は最小限。 |
| `apps/web/src/pages/LocalEditor.tsx` | a11y (Turnstile + 任意パスワード) | Turnstile 関連 toast が L1、`aria-invalid` / `aria-describedby` 適切配線。 |

## Recommended Next Steps

1. **M1 を Phase 8.x の最初の PR で吸収**: `--muted-foreground` の oklch 値を 0.50 → 0.42 に下げる (1 行)。または new token `--color-text-secondary` を分離。design quality (`#5 band-aids` の隣接観点) と地続きなので、SSOT 観点の整理と同 PR で扱うと効率的。
2. **L3 (reduced-motion)** は `global.css` 末尾 5 行追加だけで完了するため、M1 と同 PR で済ませると 1 PR で a11y を集中整地できる。
3. **L1 (Toaster aria-live)** と **L2 (DropZone error nesting)** は Phase 9 dogfood で SR 実機検証してから判断。dogfood で誰も困らなければ backlog に格下げ可。
4. **L4 (HelpModal section order)** と **L5 (biome-ignore comment 標準化)** は backlog。Phase 9 後の review iteration で再判定。
5. Phase 9 dogfood で SR (macOS VoiceOver / Windows NVDA) を 1 周通すこと。canvas 内 annotation 自体の SR 露出は別フェーズ案件として PRD 化すべき (現状未着手 = scope outside)。

## Decision Rationale

- **CRITICAL/HIGH なし** → Phase 9 dogfood への BLOCKER ではない、Decision = NEEDS_FIX (BLOCK ではなく)
- **M1 が production の本文コントラスト境界値** → Phase 8.x で吸収必須、ただし 1 行修正
- **LOW 5 件のうち Human Friction = true は M1 を除き 0 件** → 残り 4 件は backlog 候補で OK
- **キーボード完結 golden path / focus management / target size / Name-Role-Value はすべて AA 達成** → snap-share の a11y 基礎体力は既に十分高い

---
*Generated: 2026-05-04*
*Reviewer: Claude Opus 4.7 (Senior Accessibility Architect role)*
