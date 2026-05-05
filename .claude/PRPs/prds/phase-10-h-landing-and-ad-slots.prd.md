# Phase 10.H: ランディング条件付き拡張 + AdSense slot 予約

> Phase 10.F (公開リリース) 直前に第一印象 + 将来収益化準備を整える 1 PRD。
> ECC PRP ワークフロー (PRD → Plan → Implement → Report → Review → PR) のうち PRD 起票。

**Date**: 2026-05-06
**Status**: DRAFT (plan 作成済 → 実装 pending)
**Owner**: imotako (PM/Dev)
**Related**:
- 親 PRD: [`snap-share.prd.md`](./snap-share.prd.md) (Phase 10.H 行を別 commit で追記予定)
- 上流: [`phase-10-direction.prd.md`](./phase-10-direction.prd.md) (Phase 10 全体方針)
- 隣接: Phase 10.F (ドメイン取得 + 本番 + v1.0.0 タグ) は本 PRD 完了後に着手 / Phase 10.G (Analytics 観察) で本 PRD の成功指標を測る
- ADR: [`ADR-0005`](../../../docs/adr/ADR-0005-app-naming-and-domain.md) (アプリ名 / ドメイン)、[`ADR-0004`](../../../docs/adr/ADR-0004-i18n-strategy.md) (i18n)

---

## Problem Statement

公開リリース直前の pitamark.app は、**Google 検索 / SNS リンクから初訪問した個人ユーザー**に対して**「何のアプリか / 自分の用途に合うか / 安全に試せるか」を 5〜10 秒で伝える面が存在しない**。現状は `LocalEditor` の `<DropZone>` がいきなり露出する構造で、初訪問者は文脈を欠いたまま離脱する蓋然性が高い。同時に、Phase 11 以降で予定する Google AdSense 配信は**後付け実装するとレイアウト破壊 + CLS 悪化 + AdSense ポリシー違反 (誤クリック誘発配置) の三重リスク**を生む。本 PRD は「公開直前にランディング条件付き表示と広告枠予約を同時に整える」ことで、これら 2 つの将来不可避な負債を先払いする。

## Evidence

- **観測データなし** (公開前なので CF Web Analytics に流入実績ゼロ) → **assumption - needs validation through Phase 10.G の 1ヶ月観察**
- 状況証拠:
  - `apps/web/index.html` の OGP / SEO description は既に「画像URL一発で共同注釈」の specific copy を持っている (Phase 10.D で整備済) が、**着地後の本文と乖離** している
  - `apps/web/src/pages/EditorShell.tsx:549-575` で `<DropZone>` ↔ `<CanvasStage>` の条件分岐は既に実装されている — つまり**ランディング拡張の足場は既存**
  - `apps/web/index.html` には `%VITE_*%` placeholder pattern が既に運用されている (Turnstile / CF Analytics) — **`%VITE_ADSENSE_CLIENT_ID%` の同パターンで AdSense script を後日注入できる**設計余地あり
- 業界 reference (Phase 3 grounding):
  - 「Product visual above the fold が text-only より 30〜40% 高 conversion」 ([Digital Applied 2026 study](https://www.digitalapplied.com/blog/landing-page-conversion-study-2000-pages-tested-2026))
  - AdSense 後付けは CLS 0.25+ になる事例が多数 ([Google Publisher Tag - minimize layout shift](https://developers.google.com/publisher-tag/guides/minimize-layout-shift))

## Proposed Solution

**ルート分割せず**、`LocalEditor` 内で `useImageSource.source === null` 判定を **既存の `<DropZone>`-only 表示から「ランディング相当 + `<DropZone>`」表示へ拡張**する。`<DropZone>` 自体は中央に常時可視で残し、その上下に Hero (見出し + 1 行価値訴求 + 実 UI 視覚) / 機能 3 点 / 使い方 1 行例 / FAQ を section として追加する。同時に page shell 側に AdSense 配信用の semantic な `<aside>` 領域を 2 つ追加し、Tailwind v4 のブレークポイントで「**`lg:` 以上 = 左右レール / `lg:` 未満 = 下部静的**」を切替える。MVP では中身は単色プレースホルダ + "Ad" ラベルのみで、後日 `<ins class="adsbygoogle">` を子に差し込むだけで済む構造を作る。実 AdSense 接続・ads.txt・cookie consent banner は **Won't (Phase 11+)**。

代替案として「ルート分割 (`/` ランディング + `/editor` エディタ)」を比較検討したが、`react-router-dom` 依存追加 + ブックマーク URL 互換性 + 共同編集 URL (`/r/:roomId`) との関係整理コストが大きく、条件付きレンダリングで吸収する方が「最小限を最小限に」方針と整合する (Phase 0 〜 10.E で繰り返し採用してきた判断)。

## Key Hypothesis

We believe **ランディング条件付き表示 + 広告枠予約** will **「初訪問者の D&D 実行率向上 + 公開後 AdSense 後付けによる CLS 悪化回避」を実現する** for **Google 検索流入の個人ユーザー and 将来の収益化準備**.
We'll know we're right when **Phase 10.G の 1ヶ月観察で `bounce rate < 60%` / `first-image-upload rate > 30%` / `CLS p75 < 0.1` を達成**し、**Phase 11 で AdSense を貼付した際に追加レイアウト改修なしで slot に流し込める**.

## What We're NOT Building

- **AdSense 実接続** (`<script src="https://pagead2.googlesyndication.com/...">` の注入 + `adsbygoogle.push()`) — Phase 11+ で別 PRD。本 PRD は枠の物理的確保のみ
- **`ads.txt` / `app-ads.txt`** — 実接続時に
- **Cookie 同意バナー / GDPR consent UI** — 実接続時に
- **ルート分割** (`react-router-dom` 導入 / `/landing` `/editor` の path 分離) — 条件付きレンダリングで吸収
- **動画素材** (loop demo) — Could 区分、v1 は静止 WebP のみ
- **Motion library 導入** (framer-motion / GSAP) — CSS + Tailwind transition で必要十分
- **3 言語以上の i18n** — 日英のみ (ADR-0004)
- **A/B テスト基盤**
- **新規 analytics SaaS** (Plausible / GA4 等) — Phase 10.G の CF Web Analytics のみ
- **OG image 改修以外の素材生成** (favicon の再デザイン等) — Phase 10.D で確定済
- **モバイルネイティブアプリ向けの追加対応** — Web 単独 (ADR-0003)

## Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| **CLS p75** (landing 状態) | < 0.1 | Lighthouse CI + Phase 10.G で CrUX/CF Analytics の field data |
| **bounce rate** (`/` 着地後 30 秒以内離脱) | < 60% | CF Web Analytics (Phase 10.G の 1ヶ月観察) |
| **first-image-upload rate** (visitor → D&D 実行) | > 30% | CF Web Analytics の custom event (`landing_dropzone_used`) を Phase 10.H 内で計測仕込み済にする |
| **Lighthouse Performance / Best Practices / SEO** | 各 90+ | `pnpm -F @snap-share/web build` 後に `lhci autorun` (既存 CI に存在しない場合は手動 spot check) |
| **a11y violations** | 0 critical / 0 serious | axe-core (vitest-axe か Playwright @axe-core/playwright) を landing E2E に組み込む |
| **AdSense 後付け時の追加 CSS 改修** | 0 行 | Phase 11 で `<ins>` 注入時に slot CSS を変更不要であることを確認 |

## Open Questions

- [ ] **Q1**: ad slot は **landing 状態のみ表示** か **editor 状態でも表示** か → **暫定**: `lg:` 以上 (画面幅広い) では editor 状態でも左右レールを薄く保持、`lg:` 未満では editor 全画面優先で広告非表示。Phase 11 AdSense 貼付時に再判断
- [ ] **Q2**: hero の実 UI 視覚は **静止 WebP** か **loop 動画** か → v1 は静止 WebP (Must)、loop 動画は Could (見送り可)
- [ ] **Q3**: ランディングコピーの正式版を Phase 10.H 内で確定するか、**「日本語確定 + 英語 draft」体制で 10.F に持ち越す**か → 暫定: Phase 10.E 同様、日本語確定 + 英語 draft で公開し、ネイティブ修正は Phase 11+
- [ ] **Q4**: FAQ で扱う不安項目 → 暫定: 「画像はどこに保存される？ / 何日で消える？ / 無料？ / 編集の権限は？」の 4 件 + 「AdSense は出る？」(将来) を含めるか
- [ ] **Q5**: AdSense ポリシー詳細は実接続時 (Phase 11+) に再確認するが、**本 PRD で違反になる placeholder 配置はないか** を実装前に確認 (例: pop-up 風 / 全面被覆 / クリック誘導 copy 隣接禁止)

---

## Users & Context

### Primary User

- **Who**: 個人開発者 / カスタマーサポート担当 / 社内ツール案内をする中間管理職 / Twitter で技術的な不具合を共有したいエンジニア。30 代前後、Web リテラシ高、SaaS 評価に慣れている
- **Current behavior**: Slack/Discord で PNG スクショ + コメントを送る。相手が編集して返事する手段がなく会話が流れる。Notion / Imgur / Figma / Photopea を「重い・登録要・用途違い」と感じている
- **Trigger**: 「画像 注釈 共有 URL」等のキーワード、または知人共有の `pitamark.app/...` URL からの被リンク経由で着地
- **Success state**: ランディングを 5〜10 秒読んで「何ができるか」「無料か」「安全か」を理解 → D&D で画像投入 → エディタへ自然に遷移

### Job to Be Done

When **チャットで画像に「ここ」と注釈を付けて共有したいとき**, I want to **会員登録なしに URL 一発でやり取りできる軽量ツールを試したい**, so I can **5 秒で要点を伝え、相手も同じ URL に書き戻せる**.

### Non-Users (明示的に対象外)

- **エンタープライズデザインレビュー用途** (Figma / Miro / Lucidchart 競合) — SSO/SAML/audit 求める層
- **画像編集 / レタッチ用途** (Photoshop / Photopea 領域) — 色補正・レイヤー・フィルタは作らない
- **永続ナレッジベース用途** (Notion / Confluence 領域) — pitamark は揮発的共有 (TTL あり) に振る (ADR `phase-10-direction.prd.md` 参照)
- **モバイルネイティブアプリ志向** — Web 単独 (ADR-0003)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|---|---|---|
| **Must** | M1: 画像未投入時の **ランディング条件付き表示** (Hero + 機能 3 点 + 使い方 1 行例) | 第一印象 = bounce / first-upload 改善の主因 |
| **Must** | M2: **ad slot 領域確保** (lg+ 左右レール / lg 未満 下部静的、`min-height` 固定で CLS < 0.1) | 後付けによる CLS 悪化 + ポリシー違反 + 改修コストの三重リスクを先払い |
| **Must** | M3: **i18n (`landing.*` / `ad.*` keys) + a11y AA + landing E2E 2 ケース** | Phase 10.E の延長線、軽量自作 dict + axe-core で必要十分 |
| **Should** | S1: ヒーロー視覚に **エディタ実 UI のスクショ (WebP / 適切な width/height 属性)** | 30〜40% conversion 改善の最大要素 (Digital Applied 2026 study) |
| **Should** | S2: **JSON-LD `WebApplication` + `FAQPage` schema** 拡張 | SEO + AI 検索エンジンへのディスカバラビリティ |
| **Could** | C1: **2-3 秒 loop 動画** (D&D → 注釈 → URL コピー) | 静止 WebP より説得力高いが制作コスト要 |
| **Could** | C2: **shadcn アコーディオン FAQ** 3-5 件 | クリック誘発 + AdSense ポリシー的に隣接配置に注意 |
| **Could** | C3: **subtle motion** (prefers-reduced-motion 配慮) | CSS transition で組む |
| **Won't** | W1: AdSense 実接続 / `<ins>` 注入 / `adsbygoogle.push` | Phase 11+ で別 PRD |
| **Won't** | W2: ads.txt / cookie 同意バナー | 実接続時 |
| **Won't** | W3: ルート分割 / motion library / A/B テスト基盤 | 「最小限を最小限に」方針 |

### MVP Scope

「**Hero (見出し + 価値 1 行 + 実 UI 視覚 + D&D)** + **機能 3 点** + **使い方 1 行例** + **ad slot 2 種 (左右レール / 下部静的)** + **i18n 日英 + landing E2E 2 ケース**」を最小束として 1 ブランチ 1 PR で merge。動画 / FAQ / motion は Could で見送り可。

### User Flow

**初訪問者の critical path (短縮側)**:

1. Google 検索 → `pitamark.app` 着地
2. ランディング Hero を一目で把握 (見出し + 価値 1 行 + UI スクショ + 中央 D&D)
3. ad slot は「将来広告が出る場所」と認識できる程度の薄い placeholder で違和感なく目に入る
4. D&D で画像投入 → 既存の `useImageSource.loadFromFile` flow に合流
5. エディタ画面に切替 (既存の Phase 4 / 7.7 機能群)

リピーターは段階 2 をスキップ (画像をすぐ持っている前提) して直接段階 4 へ。

---

## Technical Approach

**Feasibility**: **HIGH**

### Architecture Notes

- **条件分岐の足場は既存**: `apps/web/src/pages/EditorShell.tsx:549-575` で `<DropZone>` ↔ `<CanvasStage>` の判定が既に書かれている。ランディング section を `<DropZone>` の周辺に追加するだけで済む
- **AdSense placeholder は CSS のみで完結**: `<aside>` を page shell に追加 → Tailwind v4 の `lg:` breakpoint で `display: none` ↔ `display: block` を切替、`min-height` で領域確保
- **i18n 拡張は確立パターン**: `apps/web/src/i18n/{keys,en,ja}.ts` に `landing.*` / `ad.*` の key を足すだけ。`useTranslation()` hook で消費
- **環境変数 placeholder pattern を踏襲**: 将来の AdSense client ID は `index.html` に `%VITE_ADSENSE_CLIENT_ID%` を仕込んでおく (script 自体は Phase 11+ で追加、本 PRD では placeholder のみ)
- **landing E2E は既存 `apps/web/e2e/landing.spec.ts` を拡張** (Phase 10.D で導入済)
- **画像アセット**: `og-image.png` の WebP 化 + landing hero 用 UI スクショの WebP 生成 (実エディタを Playwright でキャプチャ → cwebp 変換が現実的)

### Dependencies / Integration Points

- 既存 stack 維持: Vite + React 19 + Tailwind v4 + shadcn (新規依存なし)
- `vite.config.ts` の `htmlEnvPlugin` (Line 11-20) を AdSense placeholder で再利用
- a11y 検証: axe-core (vitest-axe か `@axe-core/playwright`) を 1 つ追加検討。catalog 経由で導入

### Technical Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| ad slot の `min-height` が viewport / フォントサイズ変動で意図せずズレ → CLS 悪化 | M | `clamp()` ではなく**固定 px** で min-height 指定。Lighthouse CLS スコアを Phase 10.H 内で必ず測る |
| landing 追加で初期 bundle 増加 → LCP 悪化 | M | landing section は `LocalEditor` 内のため lazy 不要だが、UI スクショ画像は `loading="eager"` + `fetchpriority="high"` で hero のみ、それ以外は `loading="lazy"` |
| 条件分岐の表示切替で flicker (画像 D&D 直後) | L | 既存の `<DropZone>` ↔ `<CanvasStage>` 切替で flicker 報告がない (Phase 7.7 / 7.8 で安定) ので踏襲 |
| AdSense ポリシー違反になる placeholder 配置 (pop-up 風 / 誘導 copy 隣接) | L | placeholder は静的レイアウト固定、誘導 copy 不在、`<aside>` ロールで content と分離 → 構造的に違反しにくい設計 |
| `og-image.png` を WebP に差し替えると外部リンクの cache 問題 | L | 旧 PNG を `og-image-v1.png` 等に rename して残す + 新 WebP は `og-image.webp` で別パス |
| i18n 追加 key の翻訳遅れで日英差発生 | L | Phase 10.E で確立した「日本語確定 + 英語 draft」体制を踏襲、Open Question Q3 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|---|---|---|---|---|---|
| 1 | Ad slot 予約 | `<aside>` 2 つ追加 (lg+ 左右 / lg 未満 下部)、CSS で `min-height` 固定、placeholder 中身 + `ad.*` i18n key、CLS 計測 | in-progress (plan 作成済) | with 2 | - | [plan](../plans/phase-10-h-landing-and-ad-slots.plan.md) (Task 2,3,6,8 が該当) |
| 2 | Landing 条件付き拡張 | Hero / 機能 3 点 / 使い方 1 行例 を `LocalEditor` の `<DropZone>` 周辺に追加、`landing.*` i18n key、UI スクショ WebP 生成 | in-progress (plan 作成済) | with 1 | - | [plan](../plans/phase-10-h-landing-and-ad-slots.plan.md) (Task 1,4,5,7 が該当) |
| 3 | a11y + E2E + Lighthouse | axe-core 組込 + `landing.spec.ts` 拡張 (Hero 表示 + ad slot 表示) + Lighthouse CI または手動 spot check | in-progress (plan 作成済) | - | 1, 2 | [plan](../plans/phase-10-h-landing-and-ad-slots.plan.md) (Task 9,10,12 が該当) |
| 4 | Should 範囲対応 | UI スクショ最終差し替え + JSON-LD schema 拡張 (`WebApplication` + `FAQPage`) | in-progress (plan 作成済) | with 5 | 1, 2 | [plan](../plans/phase-10-h-landing-and-ad-slots.plan.md) (Task 8,11 が該当) |
| 5 | Could 範囲判断 | FAQ アコーディオン (S2 と関連) / subtle motion / loop 動画 のうち時間内に入るもの | pending (plan 上 Could 区分) | with 4 | 1, 2 | [plan](../plans/phase-10-h-landing-and-ad-slots.plan.md) |

### Phase Details

**Phase 1: Ad slot 予約**
- **Goal**: 公開後 AdSense を後付けしてもレイアウトと CLS が壊れない構造を先に作る
- **Scope**:
  - `apps/web/src/pages/EditorShell.tsx` に `<aside>` 2 つ追加 (左右レール、下部 bar)
  - Tailwind v4 breakpoint (`lg:` を境に切替)
  - `min-height` 固定で CLS 0 を担保 (固定 px 推奨、`clamp()` 不可)
  - placeholder 中身: 単色 + `t('ad.placeholder.label')` (例: "Sponsored placeholder")
  - i18n key 追加: `ad.placeholder.label`, `ad.placeholder.aria` 等
  - `index.html` に `%VITE_ADSENSE_CLIENT_ID%` placeholder を仕込む (script 自体は注入しない)
- **Success signal**: Lighthouse CLS = 0、ad slot が正しく lg+ 左右 / lg 未満 下部に出る、placeholder ラベルが日英両言語で表示

**Phase 2: Landing 条件付き拡張**
- **Goal**: 初訪問者が 5〜10 秒で「何ができるか」を把握し、D&D に手を伸ばせるランディングを `useImageSource.source === null` 状態で提供
- **Scope**:
  - `apps/web/src/components/landing/` 配下に Hero / Features / HowTo / FAQ (Could) を分割実装 (1 ファイル < 200 行)
  - `<DropZone>` を Hero 中央に常時可視で配置 (既存コンポーネントを流用、props のみ調整)
  - `landing.*` i18n key 群を `keys.ts` / `ja.ts` / `en.ts` に追加
  - hero UI スクショ WebP 生成 (Playwright で `apps/web/e2e/snapshots/` 経由 or 手動)
  - `<picture>` で WebP + PNG fallback、`width` / `height` 属性付与
- **Success signal**: 画像未投入時にランディングが見え、画像投入後は既存エディタに切替、デザインは「ポップ・簡潔・分かりやすい」、Lighthouse Performance > 90、bundle size 増加 < 30 KB gz

**Phase 3: a11y + E2E + Lighthouse**
- **Goal**: 公開可能な品質ライン (a11y AA / Lighthouse 90+ / E2E 緑) を満たす
- **Scope**:
  - axe-core 組込 (`@axe-core/playwright` 推奨、catalog 追加判断は plan 時)
  - `apps/web/e2e/landing.spec.ts` 拡張: (a) ランディング表示 → D&D 後にエディタ表示、(b) ad slot が viewport 別に正しい位置に出る (resize → snapshot)
  - Lighthouse CI または `npx lhci` 単発実行で Performance / Best Practices / SEO / Accessibility = 90+ 確認
- **Success signal**: 全 E2E green、axe critical/serious = 0、Lighthouse 4 軸 90+

**Phase 4 (Should): UI スクショ最終 + JSON-LD schema 拡張**
- **Goal**: SEO + 検索体験の質を 1 段階上げる
- **Scope**:
  - hero UI スクショ最終差し替え (lo-fi → 高品質)
  - `apps/web/index.html` の JSON-LD に `FAQPage` schema (Could C2 と組合せ) と `WebApplication` 拡張属性 (offers / aggregateRating ダミー値は無し)
- **Success signal**: Google Rich Results Test で Valid

**Phase 5 (Could): 余裕枠**
- **Goal**: 時間が許す範囲で UX を磨く
- **Scope**: FAQ アコーディオン (shadcn) / subtle motion / 2-3 秒 loop 動画 のうち 1〜2 件
- **Success signal**: prefers-reduced-motion で停止、a11y 維持、Lighthouse 90+ 維持

### Parallelism Notes

- Phase 1 と 2 は **ファイルが独立** (Phase 1 = `EditorShell.tsx` の page shell、Phase 2 = `LocalEditor` の本文 section + 新規 `landing/` ディレクトリ) のため**同時並行可**
- Phase 3 は 1 + 2 完了後でないと E2E が書けない → 直列
- Phase 4 と 5 は Should/Could 範囲、3 と並行 / 後ろ倒し可

### Plan 構成

memory rule (1 PRD = 1 ブランチ = 1 PR) に従い、**umbrella plan 1 本** を採用。理由:
- Phase 1 と 2 は密結合 (page shell と本文の整合チェックが必要、layout grid を共有)
- 単独で価値が出ず、Phase 1 だけ merge しても初訪問者には価値がない、Phase 2 だけ merge しても ad slot が無いまま公開されると後付け CLS 悪化
- Phase 8 / Phase 7.6 と同じ「umbrella plan」基準 ([CLAUDE.md の umbrella plan vs sub-plan 選択基準](../../../CLAUDE.md) 参照)

Plan ファイル: `.claude/PRPs/plans/phase-10-h-landing-and-ad-slots.plan.md` (PRD 確定後に `/everything-claude-code:prp-plan` で生成)

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| ルート分割 vs 条件付き | **条件付きレンダリング** | `react-router-dom` 導入 + `/landing` `/editor` | 既存 `<DropZone>` ↔ `<CanvasStage>` 分岐の延長で実装、依存追加なし、`/r/:roomId` URL との整合 |
| ad slot レイアウト | **lg+ 左右レール / lg 未満 下部静的** | sticky bottom / 全 viewport 同一 | sticky は content 被覆 + 誤タップ誘発 (将来 AdSense ポリシーリスク)、両 viewport 同一は narrow で workspace 狭小化 |
| ad MVP のスコープ | **placeholder 確保のみ** | AdSense script 注入まで含める | 実接続は Phase 11+ で別 PRD、ads.txt / consent banner / ポリシー精査が必要 |
| hero 視覚 | **静止 WebP (v1) → 動画は Could** | v1 から動画必須 | 制作コスト + LCP リスク、静止 WebP で 30〜40% conversion 改善は実証 |
| Plan 構成 | **umbrella plan 1 本** | sub-plan 分割 (10.H-1 / 10.H-2) | Phase 1 / 2 が密結合、単独 merge で価値出ず |
| i18n 戦略 | **日本語確定 + 英語 draft** (Phase 10.E と同じ) | 両言語ネイティブ完成 | ネイティブ翻訳は時間バッファに入れない、ADR-0004 で確定済方針 |
| デザイン方向 | **ポップ・わかりやすく・簡潔** (CSS + Tailwind) | editorial / brutalism / glass / minimal | オーナー指定。motion library 不要 |
| AdSense placeholder の文言 | **"Sponsored placeholder" (en) / "広告枠 (将来配信)" (ja)** 案 | 完全空白 / "Coming soon" | 空白だと bug に見える、"Coming soon" は誤誘導の懸念 |

---

## Research Summary

### Market Context

- **Product visual above the fold が text-only より 30〜40% 高 conversion** ([Digital Applied 2026 study](https://www.digitalapplied.com/blog/landing-page-conversion-study-2000-pages-tested-2026))
- **Specificity beats vagueness**: 具体的な claim / CTA が effective ([uforocks 2026 best practices](https://www.uforocks.com/blog/landing-page-design-best-practices/))
- **Trust through transparency**: 実 UI スクショ / loop 動画が最大の説得材料 ([memorable.design SaaS guide](https://memorable.design/saas-landing-page-design/))
- **Hero 画像は WebP/AVIF 推奨**: LCP 維持

### Technical Context (AdSense / CLS)

- **fixed/min-height container 必須**: ad slot は CSS で先に高さ確保しないと CLS 0.25+ になる事例多数 ([Patchwork of Tips](https://www.patchworkoftips.com/cls-core-web-vitals-adsense/10418/))
- **75th percentile CLS < 0.1** が "good" 基準 ([web.dev CWV impact ad revenue](https://web.dev/articles/cwv-impact-ad-revenue))
- **Fluid ad slot は CLS 発生源** → 固定サイズ (300×250 / 728×90 / 320×100) が安全
- **Content の上に後挿入 NG** ([Google Publisher Tag - minimize layout shift](https://developers.google.com/publisher-tag/guides/minimize-layout-shift))
- **field data (CrUX)** で確認すべき (lab だけでは見落とす) → Phase 10.G の Analytics 観察と接続できる

### Codebase Context

- 条件分岐の足場: `apps/web/src/pages/EditorShell.tsx:549-575`
- 画像未投入判定: `apps/web/src/hooks/useImageSource.ts:20-34` の `source === null`
- i18n 構成: `apps/web/src/i18n/{index,keys,en,ja}.ts` (Phase 10.E)
- design tokens: `apps/web/src/styles/tokens.css` + `global.css` の `@theme inline`
- 環境変数 placeholder pattern: `apps/web/index.html` の `%VITE_*%` (Turnstile / CF Analytics 既出)
- E2E 雛形: `apps/web/e2e/landing.spec.ts` (Phase 10.D で導入済)
- AdSense 痕跡: 一切無し → 新規導入扱い

---

*Generated: 2026-05-06 00:42*
*Status: DRAFT — needs validation through Phase 10.G observation*
