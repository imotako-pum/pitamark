# Phase 10: 方向性確定（Web 継続 / Mac 版 spike / 収益化スタンス / i18n）

> **本 PRD は議論の生記録 + 方向性確定プロセスの設計** であり、実装スコープ自体は本 PRD で確定しない。
> 確定後に Phase 10 実装系 PRD（`phase-10-{確定方向}.prd.md`）に分岐する。

## Problem Statement

Phase 0〜8（MVP 完成 + 統合レビュー + 8.x 修正 PR#15 merge）まで来た時点で、オーナーが Phase 9 dogfood 開始前に **方向性そのものを再確認したい** と申し出た。論点は以下:

1. **コスト現実**: PRD 当初 $30/月想定だが、実体は $5/月以下。重い process（dogfood 2 週間 + closed beta + 厳格 KPI 観測）を課す前提条件としては過剰
2. **収益化現実**: 「C スタンス（本気事業化）」を取りたいが、個人開発・toC SaaS で月数万円超えは厳しいという事実をどう受け止めるか
3. **形態の根本疑問**: snap-share の真の価値が「URL 一発共有」なら Web 正解、「キャプチャ → 即注釈 → ペースト」なら **デスクトップアプリ（Shottr / CleanShot X 路線）の方が圧倒的に優位**。現状 Web 一本だが、Mac 版 spike を踏むべきでは
4. **i18n**: PRD MoSCoW で「英語 UI フォールバック」が Should、現状未着手。C スタンスで TAM 拡大を狙うなら必要、A/B スタンスなら不要
5. **process 軽量化**: 「dogfood は本当に必要なのか」「公開リリース直行で Analytics 観察の方が早いのでは」

これらは **個別の Phase 計画** ではなく **Phase 10 以降のロードマップ全体** に影響する戦略決定であり、誤った前提のまま Phase 9 や Phase 10 に突入すると後戻りコストが大きい。

## Evidence

- ユーザー発言（2026-05-05、本 conversation）:
  - 「正直ランニングコストって $5 だと思うんだけどそこまでしないと製品リリースできないの?」
  - 「やっぱ収益目標にするの無理なのかな」
  - 「本当はデスクトップアプリにしたら価値があるのかなとか」
  - 「dogfood のニュアンスがわかってない。本当に必要?」
  - スタンス選択: **C（本気の事業化）** — 「難しいのはわかるけど、その目標ないと今後のやる気がね」
- コスト実測（snap-share 現状）:
  - Cloudflare Workers / R2 / Pages: dogfood 規模で全部 free tier
  - DO 課金: 同規模で $0
  - カスタムドメインのみ年 2-3k 円 ≒ 月 200 円
  - 実コスト ≦ $5/月（PRD 当初 $30 想定の **17%**）
- 競合分析（Mac native）:
  - **Shottr**: Mac native、キャプチャ + 注釈 + 軽量、フリー / Pro $8 一回払い
  - **CleanShot X**: Mac native、$29 買い切り or サブスク、Shottr の上位互換
  - スポット: 「**共有 URL 発行が一級市民な Mac 注釈アプリ ¥980 買い切り**」が両者の隙間に存在
- 競合分析（Web）:
  - Markup.io ($79/月) / Pastel ($35/月) / Webvizio Free 等、B2B 寄り、英語 UI、日本語ファースト不在
- 既存資産の Mac 版再利用性:
  - **Tauri 2.0** で React + Konva のコードを **70% 流用可能**（webview ベース）
  - 新規実装が必要: グローバルホットキー（~50 LOC）/ ScreenCaptureKit（Rust bridge）/ クリップボード I/O（Tauri 標準）/ 自動 update
  - 工数感: **2-3 ヶ月（週 15h ペース）**
- Phase 8 統合レビュー（PR#15 merge 済）の結論:
  - HIGH 7 + MEDIUM 21 + LOW HF=true 9 = 37 finding 全件 close
  - Phase 9 Conditional Go 達成（CRITICAL 0、security/perf/SSOT 全部解消済）
- PRD MoSCoW の現状:
  - **Should**「英語 UI フォールバック」未着手
  - **Could**「認証・権限管理」「フリーミアム / 広告」「永続ルーム」「コメントスレッド」全て未着手 → C スタンス採用なら全部射程内

## Proposed Solution

Phase 10 を **「方向性確定 + 短期 spike + 公開最低限整備」を 1 〜 2 ヶ月で踏む meta-Phase** として定義し、以下を並走で踏む:

### A. Mac 版 Tauri spike（1-2 週間）

- 既存 React + Konva コードを Tauri 2.0 webview に移植
- グローバルホットキー（Cmd+Shift+4 相当）→ ScreenCaptureKit → 注釈 → クリップボード PNG 戻し までの **golden path のみ** 実装
- 「URL 共有」は既存 Web 側に POST するだけ（共有相手は今の snap-share Web で開く）
- Spike 完了時点で「Mac 版を主軸にする / 並走する / やめる」の判断材料が揃う

### B. 公開リリース最低限整備（dogfood の代用、1 週間）

- TOS / プライバシーポリシー（個人運営、cookieless 方針明記）
- 通報窓口（GitHub Issue label `report-abuse` か個人メアド）
- アプリ名再考 + 公開ドメイン取得（商標 / .com / .app / .jp 空き調査）
- OGP / favicon / meta description
- Cloudflare Web Analytics の "数字が読める" 状態の最終確認
- TTL 仕様変更（hardcoded 7d → デフォルト 24h / max 7d、フリーミアム実装時に無制限）
- CHANGELOG.md 開始（Keep a Changelog 形式、semver タグ運用）

### C. i18n 軽量実装（1 週間、ADR-0004 で確定後）

- 自作 dict + 言語切替 hook（50-100 LOC）
- 日本語 + 英語の 2 言語のみ
- ライブラリ化（i18next 等）は本格 i18n（3 言語以上）が見えてから

### D. Phase 9 dogfood は **「公開リリース + Analytics 観察」に置換**

- 純 dogfood 2 週間は **オプション**（やりたければ A/B 並走中に踏む）
- closed beta は **見送り**（C スタンスでも公開直行の方が早い、5-10 名確保のオーバーヘッドが重い）
- KPI は前回提案 4 件をそのまま採用（PV / TTL 切れ困った回数 / RL ヒット率 / ランディング滞在）+ オーナーの **詰まった瞬間メモ**

## Key Hypothesis

我々は **「Mac 版 spike の体感」+「公開後 1 ヶ月の Analytics データ」** が、以下を同時に判断できる最小コスト経路だと信じる:

1. snap-share の真の価値が **共同編集** か **キャプチャ→注釈ワークフロー** か
2. C スタンス（事業化）が現実的な TAM を持つか、B スタンス（インフラ相殺）に修正すべきか
3. i18n を Phase 11 で実装するか後回しか
4. フリーミアム機能（永続ルーム / 画像サイズ拡張 / RL 緩和）のうち最初に作るべきは何か

検証ポイント:
- Mac spike 完了時に「3 形態（Web 単独 / Mac 単独 / ハイブリッド）」のどれを取るかが ADR-0003 に Accepted で記録されている
- 公開後 1 ヶ月の Analytics で「月間 PV」「リピート率」が**仮説 vs 実測**で比較できる
- C スタンス維持 / B 修正の判断が、Phase 11 PRD 起票時に数字で説明できる

## What We're NOT Building

- **Phase 10 の実装スコープ自体** — 本 PRD は方向性確定のみ。実装は `phase-10-{確定方向}.prd.md` で別途
- **better-auth 導入 / 決済基盤 / フリーミアム機能** — Phase 11 以降（C スタンス維持時のみ）
- **dogfood 2 週間 + closed beta** — process 軽量化方針で見送り（Mac spike + 公開直行で代替）
- **多言語化 3 言語以上** — Phase 10 では日英 2 言語のみ
- **App Store / Mac App Store 配布** — Mac spike は self-distribution（自前 update）まで
- **PRD Open Questions 5 件のうち実装側 3 件**（PNG 解像度 / スパム対策優先度 / Analytics 妥当性）— dogfood/公開後の数字で判断、Phase 10 では決めない
- **収益化実装** — 方針確定のみ、実装は Phase 11 以降

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Mac spike 完了による形態判断 | ADR-0003 が Status: Accepted | `docs/adr/ADR-0003-*.md` の status field |
| i18n 戦略の確定 | ADR-0004 が Status: Accepted | `docs/adr/ADR-0004-*.md` の status field |
| 公開リリース達成 | カスタムドメイン or pages.dev で **公開済み + 通報窓口あり + TOS/プライバシー公開** | 実 URL の踏み確認 |
| Analytics データ取得開始 | 公開から **1 ヶ月後** に PV / リピート率 / TTL 切れ報告数 が表として読める | Cloudflare Analytics dashboard |
| 収益化スタンス再確認 | C 維持 / B 修正のどちらかが **数字根拠付き** で記録される | Phase 11 PRD 起票時の Decisions Log |
| process 軽量化の達成 | Phase 10 完了までの実時間が **2 ヶ月以内** | 着手日と完了日の差分 |
| ランニングコスト維持 | 月額 **$5 以下** | Cloudflare 請求書 |

## Open Questions

> 本 PRD のメイン論点。2026-05-05 conversation で全 9 件 decide 済（Decisions Log 参照）。

- [x] **Mac 版 spike を Phase 10 のスコープに含めるか?** → **NO（Phase 11+ 候補へ後回し、一旦全部 Web で進行）** ★方針大転換
- [x] **公開リリースを spike より先に踏むか同時か?** → **意味消失**（Mac spike 削除のため、Web 単独で公開リリース直行）
- [x] **dogfood を本当に 0 にするか / "気が向いたら" 残すか?** → **"気が向いたら" 残す**（強制 dogfood は廃止、詰まった瞬間メモのみ継続）
- [x] **アプリ名再考 — 候補リストアップとドメイン空き調査の手順** → **`pitamark.app`** (+ `.com` 並行取得) で確定 (2026-05-05)、詳細: [phase-10-naming.md](phase-10-naming.md)、ADR-0005 起票 + ドメイン取得 + リネーム実装は次セッション
- [x] **i18n を Phase 10 でやるか Phase 11 送りか?** → **Phase 10.E で実装確定**（Mac spike 削除で待ち条件解消、Web 単独で独立 track）
- [x] **カスタムドメイン取得タイミング** → **アプリ名確定後 (Phase 10.D 完了後)**、公開リリース (Phase 10.F) は pages.dev でも可
- [x] **CHANGELOG 開始時の version 番号** → **v0.9.0-mvp 経由 → Phase 10 完了で v1.0.0**
- [x] **収益化スタンス C は どこまで 維持するか** → **半年で月 1000 円なし → B 修正**（タイトだが基準として明確、Phase 11 起票時に判断）
- [x] **Mac spike が 3 形態のどれを支持しても進める覚悟があるか** → **意味消失**（Mac spike 自体を後回し）

---

## Users & Context

### Primary User

- **Who**: オーナー（= 主実装者 = 戦略決定者）自身
- **Current behavior**: Phase 8 完了で技術的不安は解消、収益化と形態の根本疑問が表面化。dogfood という process 用語に引っかかっている
- **Trigger**: 「ランニングコスト $5 でこの重い process は釣り合わなくない?」「Mac の方が価値あるのでは?」の同時発生
- **Success state**: 形態 / 収益化 / i18n が ADR で記録され、Phase 11 以降を **数字根拠 + 体感根拠** で起票できる

### Job to Be Done

> **When** MVP 完成 + 統合レビュー完了で技術土台が整った瞬間、
> **I want to** ランニングコスト現実 / 収益化現実 / Web vs Desktop / i18n の 4 軸で方向性を再確認し、
> **so I can** 過剰な process（重 dogfood + closed beta + 厳格 KPI）に縛られず、Mac spike + 公開リリース + Analytics 観察で **本当に作るべきもの** を数字と体感で決められる。

### Non-Users（明示的に対象外）

- 既に「Web 一本で C スタンスで突き進む」と決めているフェーズの people
- dogfood process が必須だと信じている people（本 PRD は逆の立場）
- Mac 版に興味がない people（Mac spike を内包するため）

---

## Solution Detail

### Track 構成（並走可、Q9 反映後）

| Track | Goal | 期間 | 並走可 |
|---|---|---|---|
| ~~A. Mac spike~~ | ~~Tauri で「キャプチャ → 注釈 → 共有 URL」~~ → **Phase 11+ 候補へ後回し** | — | — |
| **B. 公開リリース最低限整備** | TOS / プライバシー / 通報窓口 / OGP / Analytics 確認 / TTL 仕様変更 / CHANGELOG | 1 週間 | with C, D |
| **C. i18n 軽量実装** | 自作 dict + 日英 2 言語 | 1 週間 | with B, D |
| **D. アプリ名 + ドメイン** | ブレスト + 商標調査 + 取得 | 数日（並走） | with B, C |
| **E. 観察期間** | 公開後 1 ヶ月 Analytics 蓄積、オーナーの「詰まった瞬間メモ」 | 1 ヶ月 | F 完了後の判断材料 |

**Q9 反映の影響**: A 削除で Phase 10 全体期間が **1-2 週間短縮**、3 track (B/C/D) すべて並走可で集中度高まる。

### MoSCoW（Phase 10 全体）

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | ADR-0003（Web vs Desktop）の Status: on hold 化 | Q9 で Phase 10 から削除、Phase 11+ 候補に格下げを明記 |
| Must | ADR-0004（i18n 戦略）の Status: Accepted 化 | Phase 10.E で軽量自作 dict 実装 |
| Must | 公開リリース最低限整備（TOS / プライバシー / 通報窓口） | 法的・倫理的に公開する瞬間から要 |
| Must | TTL 仕様変更（hardcoded 7d → デフォルト 24h / max 7d） | オーナー指示 + フリーミアム伏線 |
| Must | CHANGELOG.md 開始（v0.9.0-mvp 起点 → Phase 10 完了で v1.0.0） | オーナー指示 |
| Must | snap-share.prd.md の Decisions Log + Open Questions 更新 | 確定分の織込み |
| Must | **i18n 軽量実装（10.E）** | Q9 で Web 単独確定、TAM 拡大に直結 |
| Must | アプリ名再考 + カスタムドメイン取得 | 公開拡大の前提、Phase 10.D |
| Should | 公開後 Analytics 1 ヶ月観察 | Phase 11 起票判断の根拠、Phase 10 完了条件には含めず |
| Won't | **Mac spike (Tauri)** | Q9 で Phase 11+ 候補へ後回し、一旦全部 Web で進行 |
| Won't | better-auth / 決済 / フリーミアム機能実装 | Phase 11 以降 |
| Won't | dogfood 2 週間 + closed beta | process 軽量化方針 |
| Won't | i18n 3 言語以上 / ライブラリ化 | Phase 11 以降 |
| Won't | App Store 配布 | (Phase 11+ Mac 検討時に判断) |

### MVP Scope（Phase 10 として "踏み終わった" と言える最小単位、Q9 反映後）

1. ADR-0003 が **Status: on hold** で Phase 11+ 候補に明記されている、ADR-0004 が **Status: Accepted** で記録されている
2. 公開リリースされている（カスタムドメイン取得済 or pages.dev でも可）
3. TOS / プライバシー / 通報窓口が公開ページから到達可能
4. TTL 仕様変更がコードに反映されている (default 24h / max 7d)
5. CHANGELOG.md が存在し、Phase 0〜10 までの milestone が記録されている (v0.9.0-mvp → v1.0.0)
6. **i18n 軽量実装が動作し、日本語/英語で UI 切替できる**
7. **アプリ名 + カスタムドメインが取得・適用済（または pages.dev で公開し name は次フェーズ）**
8. snap-share.prd.md の Open Questions / Decisions Log / Phase ladder が現実と一致している

### Decision Flow（クリティカルパス、Q9 反映後）

```
[本 PRD 確定（=Status: DRAFT → Validated）]
   ↓
[ADR-0003 を on hold（Phase 11+ 候補）で記録 / ADR-0004 を Accepted で起票]
   ↓
[Track B (公開準備) + Track C (i18n) + Track D (アプリ名/ドメイン) を並走スタート]
   ↓ B/C/D 完了
[公開リリース (10.F) → Track E (Analytics 観察 1 ヶ月) スタート]
   ↓ E 完了
[Phase 11 PRD 起票（数字 + 体感根拠付き、Mac spike を再検討候補として明示）]
```

---

## Technical Approach

**Feasibility**: **HIGH**

### Architecture Notes

- **Mac spike の構成**: Tauri 2.0 + 既存 `apps/web` をそのまま webview に + Rust 側で OS 連携（ホットキー / ScreenCaptureKit / クリップボード）
- **既存コード再利用率**: React + Konva + Yjs の 70%（共同編集機能は Mac 版で削るか維持か spike 中に判断）
- **共有 URL の実装**: Mac 版から既存 `apps/api` に POST、web 側はそのまま閲覧/編集ビュー
- **i18n 軽量実装**: `apps/web/src/i18n/` に `ja.ts` / `en.ts` の dict + `useTranslation()` hook 自作
- **TTL 仕様変更**: `apps/api/src/services/room-service.ts` の `ROOM_TTL_MS` を `(default: 24h, max: 7d)` の `ttlMs` パラメータに変更、`POST /rooms` body schema に `ttlMs` 追加（optional）

### Technical Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mac spike で「Web 70% 流用」が嘘だった | M | spike 1 週目で踏みポイントを早期発見、2 週目に進むかの go/no-go gate を設ける |
| 公開リリース後にスパム / 悪用が即発生 | M | 既存の Turnstile + RL + SHA-256 blocklist で対応、通報窓口で escalation 経路確保 |
| i18n で日本語ファースト差別化が薄まる | M | デフォルト言語を日本語維持、`<html lang>` で明示、英語は OS 言語自動 fallback のみ |
| カスタムドメイン取得後の Turnstile / OGP 設定漏れ | L | 取得時 checklist 化（`docs/.tmp/cloudflare-runbook.md` に追加） |
| C スタンス維持の覚悟が観察 1 ヶ月で揺らぐ | M | 撤退条件を Open Question で先に明文化（"半年で月千円なし → B 修正" 等） |
| 「公開リリース直行」が dogfood の代替として機能しない（誰も来ない） | M | Track E の観察期間中に「自分で日常使う = 旧 dogfood 機能」も並走、二重保険 |
| Mac spike 完了で「やっぱり Web 一本」と決めた場合の sunk cost | L | spike 自体が学習価値、ADR-0003 に「やらなかった理由」を残せば資産化 |

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
| 10.0 | 本 PRD 確定 + ADR-0003/0004 起票 | 議論結果の文書化、Open Questions 9 件 decide 完了 | complete | - | Phase 8.x | (本 PRD) |
| 10.A | snap-share.prd.md 更新 | 確定分（TTL / CHANGELOG / 通報窓口 / Q9 Mac spike 後回し / 撤退条件）を Decisions Log + Open Questions に織込み | complete | with 10.0 | 10.0 確定後 | (commit b8978a0) |
| 10.B | 公開リリース最低限整備 | TOS / プライバシー / 通報窓口 / OGP / Analytics 確認 / TTL 仕様変更 (CHANGELOG は 10.F 後ろ倒し) | complete (自走範囲: TTL/法務 draft/通報窓口/OGP の 4 件、CHANGELOG は時期尚早につき 10.F 送り。Cloudflare Analytics ダッシュボード確認 + GitHub label 設定の 2 件はオーナー手動作業) | with 10.C/10.D | 10.A | [phase-10-b-launch-prep.plan.md](../plans/phase-10-b-launch-prep.plan.md) |
| ~~10.C~~ | ~~Mac spike (Tauri)~~ | **Q9 で削除、Phase 11+ 候補へ後回し** | removed | — | — | [ADR-0003](../../../docs/adr/ADR-0003-web-vs-desktop-direction.md) (on hold) |
| 10.D | リネーム + 公開準備 (ドメイン非依存) | リネーム実装 (`snap-share` → `pitamark`) + ADR-0005 起票 + OGP/favicon アセット作成 + SEO 雛形 (robots.txt / sitemap.xml / JSON-LD / canonical) + 法務文書英訳 (terms-en / privacy-en draft) + i18n 化漏れ追跡 + CHANGELOG 雛形準備。**2026-05-05 再分割: 旧 10.D「ドメイン取得 + Turnstile 切替 + Pages カスタムドメイン設定」は 10.F に移動** | pending | with 10.B/E | 10.A | TBD |
| 10.E | i18n 軽量実装 | 自作 dict + 日英 2 言語、Q9 で待ち条件解消し独立実行可 | complete (apps/web/src/i18n/ + ~80 keys + LangToggle UI + 305 unit + 4 e2e、英訳 draft はオーナー後続レビュー) | with 10.B/D | 10.A | [phase-10-e-i18n.plan.md](../plans/phase-10-e-i18n.plan.md) |
| 10.F | ドメイン取得 + DNS + Pages 本番 + v1.0.0 タグ | Cloudflare Registrar で `pitamark.app` + `.com` 取得 / Pages カスタムドメイン設定 / Workers `CORS_ALLOWED_ORIGINS` 更新 / Turnstile site key 切替 / Cloudflare Web Analytics token 本番値設定 / 法務運営者連絡先 + 確定ドメイン埋込 / `og:url` + canonical + sitemap.xml URL 確定値置換 / 本番デプロイ + v1.0.0 タグ + GitHub Release / `CHANGELOG.md` 初版起票 (Phase 0〜10 milestone 遡及記録) / HSTS preload 申請判断 | pending | - | 10.B + 10.D + 10.E | TBD |
| 10.G | 観察期間（1 ヶ月） | Analytics 蓄積 + オーナーの「詰まった瞬間メモ」 | pending | - | 10.F | (ad-hoc) |
| 11.0 | Phase 11 PRD 起票 | 観察結果で C スタンス維持 / B 修正 (撤退条件: 半年で月千円なし) を判断、Mac spike 再検討含む実装方向確定 | pending | - | 10.G | TBD |

### Phase Details

**Phase 10.0: 本 PRD 確定 + ADR-0003/0004 起票**
- Goal: 議論内容を文書として残し、Open Questions 9 件のうち答えが出ているものは Decisions Log に移す
- Scope:
  - 本 PRD の Status を DRAFT → Validated に
  - ADR-0003（Web vs Desktop）を Proposed で起票（context + options + recommendation 記載）
  - ADR-0004（i18n 戦略）を Proposed で起票
  - Open Questions のうち決着済を `[x]` 化
- Success signal: 本 PRD + 2 ADR が `feat/phase-10-direction` または直接 main にコミット

**Phase 10.A: snap-share.prd.md 更新**
- Goal: 確定分を main PRD に織込む
- Scope:
  - Decisions Log: TTL 仕様 / CHANGELOG 開始 / 通報窓口暫定 / 収益化スタンス C
  - Open Questions: 公開ドメイン / アプリ名 / i18n / Web vs Desktop / 収益化現実見立て
  - Implementation Phases: Phase 10 行を上記 10.A〜G 構成で追加、Phase 9 を「公開リリース + Analytics 観察」に書き換え or 削除判断
- Success signal: snap-share.prd.md の Phase status table が現実と一致

**Phase 10.B: 公開リリース最低限整備**
- Goal: 公開した瞬間に問われるものをすべて整える
- Scope:
  - TOS / プライバシーポリシー（個人運営、cookieless 方針、画像 TTL 明記）の静的 HTML or MD
  - 通報窓口（GitHub Issue label `report-abuse` 設置 + README に窓口明記）
  - OGP / favicon / meta description
  - Cloudflare Web Analytics の "数字が読める" 状態の最終確認
  - TTL 仕様変更: `apps/api/src/services/room-service.ts` の `ROOM_TTL_MS` を 24h default + 7d max + `ttlMs` optional param 化
  - CHANGELOG.md 新設（Keep a Changelog 形式、Phase 0〜10 の milestone 遡及記録）
- Success signal: 上記すべて完了 + `pnpm build` 緑 + 本番 URL（pages.dev でも可）で踏める

**~~Phase 10.C: Mac spike (Tauri)~~ — Q9 で削除、Phase 11+ 候補へ後回し**
- 元 Goal: 「キャプチャ → 注釈 → 共有 URL」golden path のみ動作させ、形態判断材料を得る
- Q9 反映理由（オーナー発言 2026-05-05）: 「Mac はやっぱ後回しだな。一旦全部 Web で。」
- 後回し方針: ADR-0003 を Status: on hold で記録、Phase 11 起票時 (Phase 10.G 完了後) に再検討候補として挙げる
- Phase 10 期間短縮効果: 1-2 週間
- 既存 spike 設計 (Tauri 2.0 + 70% 流用 + Go/No-Go Gate) は ADR-0003 に保存済み、Phase 11+ で再開時に流用可能

**Phase 10.D: リネーム + 公開準備 (ドメイン非依存)**

> 2026-05-05 再分割: 旧 10.D は「アプリ名再考 (ブレスト) + 商標調査 + ドメイン空き調査 + Cloudflare 取得 + Turnstile/Pages 切替」をバンドルしていた。前段 (アプリ名 + 商標 + 空き調査) は完了 (`pitamark.app` 確定、[phase-10-naming.md](./phase-10-naming.md))。後段 (ドメイン取得 + インフラ切替) は 10.F に切り離し、10.D はオーナーがドメイン取得を急がなくても進められる範囲に縮小する。

- Goal: ドメイン取得を待たず、コードベースを `pitamark` 名義に揃え、公開時の SEO/法務/アセット雛形を整える
- Scope:
  - **リネーム実装**: `snap-share` → `pitamark` (識別子 / コメント / docstring)、パッケージ名 `@snap-share/web` `@snap-share/api` `@snap-share/shared` → `@pitamark/*`、turborepo / pnpm-workspace.yaml / 全 import path、localStorage key (`snap-share-lang` 等) のマイグレーション戦略
  - **ADR-0005 起票**: アプリ名 + ドメイン候補確定の意思決定記録 (`docs/adr/ADR-0005-app-naming-and-domain.md`)、phase-10-naming.md の商標クリアランス結果を固定化
  - **OGP / favicon アセット作成**: `og-image.png` (1200×630)、`favicon.ico` / `apple-touch-icon.png` 系、index.html の `og:image` / `twitter:card=summary_large_image` 切替 (URL 不要)
  - **SEO 雛形整備**: `apps/web/public/robots.txt` (`Allow: /` + `/r/` Disallow + sitemap 参照)、`apps/web/public/sitemap.xml` (`/` のみ最小 sitemap、URL は `%VITE_PUBLIC_URL%` 環境変数で差し込む雛形)、JSON-LD `SoftwareApplication` schema を index.html に inline、`<link rel="canonical">` 追加
  - **法務文書英訳**: `docs/legal/terms-en.md` / `privacy-en.md` draft、LangToggle と連動するか別 routing にするか方針判断
  - **i18n 化漏れ追跡**: 本セッションで `RoomEditor.tsx not-found` を拾った経験を踏まえ、grep ベースで残ハードコード文言を網羅
  - **CHANGELOG 雛形準備**: ファイル新設はせず、起票テンプレ (Keep a Changelog 形式) を別領域に置くか完全保留 (起票は 10.F)
- Success signal: 全パッケージ `@pitamark/*` で `pnpm build` 緑 / robots.txt + sitemap.xml + JSON-LD + canonical が `%VITE_PUBLIC_URL%` テンプレ経由で動く / OGP 画像が staging で正しく表示 / ADR-0005 がコミット / 法務 en draft が PR レビュー待ち

**Phase 10.E: i18n 軽量実装**
- Goal: 日英 2 言語の最小実装
- Scope:
  - ADR-0004 で確定した方針（自作 dict 推奨）に従い実装
  - `apps/web/src/i18n/` に `ja.ts` / `en.ts` + `useTranslation()` hook
  - `<html lang>` を OS 言語 or ユーザー切替に追従
  - 全 UI 文言を dict 化、ハードコード排除
- Success signal: 言語切替で UI が完全に日↔英で切り替わる + テスト追加

**Phase 10.F: ドメイン取得 + DNS + Pages 本番 + v1.0.0 タグ**

> 2026-05-05 再分割: 旧 10.F は「公開リリース実走 (pages.dev or カスタムドメイン)」のみだったが、再分割で旧 10.D 後段「ドメイン取得 + Turnstile 切替 + Pages カスタムドメイン設定」を吸収し、「ドメイン取得後にしか確定できない値の置換 + 本番タグ + CHANGELOG 起票」までを 1 sub-phase に集約する。

- Goal: ドメイン取得して本番運用に乗せ、v1.0.0 を切る
- Scope:
  - **ドメイン取得**: Cloudflare Registrar で `pitamark.app` + `pitamark.com` 取得 (オーナー作業)
  - **インフラ確定**: Pages カスタムドメイン設定 / DNS / TLS、Workers `apps/api/wrangler.toml` の `CORS_ALLOWED_ORIGINS` 更新、Turnstile site key 切替、Cloudflare Web Analytics token 本番値設定
  - **公開 URL 確定値の埋込**: 法務文書 (terms-ja / privacy-ja / en) の運営者連絡先 + 確定ドメイン、`og:url` / canonical / sitemap.xml の URL 確定値置換
  - **本番デプロイ**: Pages production にカスタムドメインで公開、`wrangler deploy` で API 本番化
  - **リリースタグ**: `v1.0.0` タグ + GitHub Release
  - **CHANGELOG.md 初版起票** (Keep a Changelog 形式、Phase 0〜10 milestone 遡及記録)
  - **HSTS preload 申請判断** (運用安定後、サブドメイン全 HTTPS 確認後にオーナーが申請)
- Success signal: `pitamark.app` で踏める / API が `*.pitamark.*` から CORS 許可される / 本番ダッシュボードで数字が動き始める / `v1.0.0` タグが GitHub に存在 / CHANGELOG.md が main にコミット済

**Phase 10.G: 観察期間（1 ヶ月）**
- Goal: Phase 11 起票の判断材料を蓄積
- Scope:
  - Cloudflare Analytics: PV / リピート率 / referer
  - オーナーの「詰まった瞬間メモ」（自分で使った時の friction）
  - 「TTL 7d 切れて困った」報告数（GitHub Issue 経由）
  - RL ヒット率 / Turnstile fail 率 / 画像 SHA 重複率
- Success signal: 1 ヶ月分の数字が表として読める / 仮説 vs 実測の差分が言語化できる

**Phase 11.0: Phase 11 PRD 起票**
- Goal: 観察結果と Mac spike 結論を踏まえ、次の実装方向を確定
- 想定分岐:
  - 「Web 単独 + C スタンス維持」→ Phase 11 = better-auth + 永続ルーム
  - 「Mac 主軸 + C スタンス維持」→ Phase 11 = Mac 版本格実装 + 配布基盤
  - 「ハイブリッド + C スタンス維持」→ Phase 11 = Mac/Web 共有モデル確立
  - 「B スタンス修正」→ Phase 11 = SEO + 品質深掘り、収益化フェーズは無期限延期
- Success signal: Phase 11 PRD が `prp-prd` で起票される

### Parallelism Notes（Q9 反映 + 2026-05-05 再分割反映後）

- **10.B / 10.D / 10.E は完全並走可**: 異なる surface（公開 docs / リネーム + SEO 雛形 / i18n dict）に touch するため独立。新 10.D はドメイン非依存に縮小されたためパッケージ名 + アセット作成 + 法務英訳が並行可能
- **10.E が独立実行可になった**: Q9 で Mac spike 削除、Tauri webview 文字列同期問題が解消
- **10.F は逐次**: 10.B + 10.D + 10.E 全完了が前提。ドメイン取得 + インフラ切替 + 本番タグを 1 sub-phase に集約 (再分割でここに吸収)
- **10.G は逐次**: 10.F の公開後でないと数字が取れない

---

## Decisions Log

> 本 PRD 議論で確定した事項を記録。Open Questions のうち答えが出たものはここに移す。

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 収益化スタンス | **C（本気の事業化）を当面維持** | A（趣味）/ B（インフラ相殺） | 「目標ないと今後のやる気がね」（オーナー発言）。撤退条件は Open Question で別途設定 |
| 公開ドメイン | **最終的にカスタム取得、当面 pages.dev** | 即取得 / pages.dev で永続 | アプリ名再考と同時、Phase 10.D で実施 |
| 通報窓口 | **当面 GitHub Issue label or 個人メアド**、将来 Google Forms 等 | 即フォーム化 / 不要論 | dogfood〜公開初期は spam リスク低、シンプル運用 |
| TTL 仕様 | **デフォルト 24h / max 7d / フリーミアムで無制限** | 現行 hardcoded 7d 維持 | オーナー指示。Phase 10.B で実装変更 |
| CHANGELOG | **開始する**（Keep a Changelog 形式） | 開始しない / 別形式 | オーナー指示 |
| dogfood の取扱 | **2 週間 dogfood + closed beta は廃止**、公開リリース + Analytics 観察に置換 | 純 dogfood 維持 / closed beta 必須 | コスト $5/月で重い process は釣り合わない、公開直行の方が早い |
| Phase 9 の扱い | **「公開リリース + Analytics 観察」として Phase 10 内に内包**、独立 Phase 9 は廃止 | 独立 Phase 9 維持 | process 軽量化方針 |
| 形態判断方法 (初版) | ~~Mac spike 1-2 週間 で 3 形態から選択~~ → **Q9 で Web 単独確定、Mac spike Phase 11+ 後回し** | Web 単独で確定 / 即 Mac 主軸 / spike 必須 | オーナー判断 (2026-05-05): 「Mac はやっぱ後回し」「一旦全部 Web で」「製品化は確実に Web が先」 |
| i18n 戦略 | **Phase 10.E で軽量自作 dict + 日英 2 言語を実装** (ADR-0004 Accepted へ) | 即 i18next / 即不要 / Phase 11 送り | Q9 で Web 単独確定し独立実行可、C スタンス維持の TAM 拡大に直結 |
| 撤退条件 (Q8) | **半年で月 1000 円なし → B 修正検討** | 1 年で月 5 千円なし / Phase 11 起票時に総合判断 / 設定なし | オーナー指示。タイトだが基準として明確、Phase 11 起票時 (Phase 10.G 完了後) に判断 |
| アプリ名再考の手順 (Q4) | **Phase 10.D 実行時にブレスト** | 事前に詰める / オーナー宿題 / 候補 generation 自動 | その場感覚で決めたい、事前準備の効率より判断時の鮮度優先 |
| dogfood 残置度 (Q3) | **「気が向いたら」残す + 詰まった瞬間メモ継続** | 完全 0 / 軽量 1 週間版 / 強制 2 週間維持 | 強制 process は廃止、自然利用は restrict しない |
| version 番号 (Q7) | **v0.9.0-mvp 起点 → Phase 10 完了で v1.0.0** | v0.1.0 / v1.0.0 直接 / なし | Phase 0-8 で MVP 完成 + Phase 10 公開 = v1.0.0 が自然な区切り |
| Phase 10.D 再分割 (2026-05-05) | **旧 10.D「アプリ名 + ドメイン取得 + リネーム実装」を 2 つに切り分け**: 新 10.D = リネーム + 公開準備 (ドメイン非依存) / 新 10.F = ドメイン取得 + DNS + Pages 本番 + v1.0.0 タグ + CHANGELOG 起票 | 旧定義のまま維持 (バンドル) / 10.D を 3 つに分割 | オーナー意向「ドメイン取得を急がない」。バンドル維持だと取得待ちで リネーム + ADR-0005 + OGP/SEO/法務英訳 が全部ブロックする。ドメイン非依存タスクを 10.D で先行実行可、ドメイン取得 + 取得後にしか確定できない値の置換 + v1.0.0 タグ を 10.F に集約することで、各 sub-phase の責務を「ドメインに関係なく進められる」/「ドメイン取得後にしか進められない」で綺麗に分離 |

---

## Research Summary

### 議論の流れ（2026-05-05 conversation）

1. オーナー: 「Phase 8.x 終わって何が残ってる?」
2. アシスタント: 6 グループ提示（公開前整備 / Phase 9 前提 / 品質残 / Open Questions / 運用 / 将来 Could）
3. オーナー: 「AdSense / フリーミアムも」→ Group 6 を 6-A 6-B に分解
4. オーナー: 「今 Q&A で決められるもの」
5. アシスタント: 5 件提示（ドメイン / 収益化スタンス / Open Questions / 通報窓口 / KPI）
6. オーナー: ① 最終ドメイン取得 / ② C スタンス / ③ 後で詳細 / ④ A or B 当面 / ⑤ dogfood ニュアンス不明、TTL 24h/7d、CHANGELOG する
7. オーナー: 「ランニング $5 でこの process 過剰では」「収益目標無理かな」「Mac 版の方が価値?」
8. アシスタント: process 過剰を認める / 収益化現実 / Mac spike 提案
9. オーナー: 「ECC で記録」+「i18n も」
10. アシスタント: 4 アーティファクト構造提案
11. オーナー: B（Phase 10 PRD 先 → ADR / 本 PRD 後日）
12. **本 PRD 生成（このファイル）**

### 既存資産（Phase 10 で再利用）

- **Phase 8 統合レビュー成果物**: 73 finding のうち HIGH 7 + MEDIUM 21 + LOW HF=true 9 は PR#15 で全件 close、LOW HF=false 36 は Phase 10 中に踏んだものから個別対応
- **`docs/adr/ADR-0001`〜`ADR-0002`**: 既存 ADR のフォーマット参照
- **`docs/.tmp/cloudflare-runbook.md`**: 公開リリース時のオペ手順、カスタムドメイン取得時に追記
- **既存 `apps/web` の React + Konva + Yjs**: Tauri spike で 70% 流用見込み

### 競合スナップショット（Phase 10 形態判断の入口）

| プロダクト | 形態 | 価格 | ポジション |
|---|---|---|---|
| Shottr | Mac native | Free / Pro $8 | キャプチャ + 軽量注釈、スターサービス |
| CleanShot X | Mac native | $29 買い切り or サブスク | Shottr 上位互換 |
| Markup.io | Web | $79/月〜 | B2B デザインフィードバック |
| Pastel | Web | $35/月〜 | 同上 |
| Webvizio Free | Web | Free | URL 注釈、英語 |
| **snap-share** | Web | Free | URL 共有 + 共同編集 + 日本語ファースト |
| **想定スポット** | **Mac native + Web 共有ビューア** | **¥980 買い切り** | **Shottr に「URL 共有が一級市民」を足したもの** |

### コスト現実スナップショット

| 項目 | PRD 当初想定 | 実体（Phase 8 完了時点） |
|---|---|---|
| 月額インフラ | $30 | **$5 以下**（dogfood 規模で実質 $0、ドメインのみ） |
| Cloudflare Workers | 課金前提 | free tier 内 |
| R2 | 10GB 無料 + エグレス無料 | 同上 |
| DO | 課金前提 | free tier 内 |
| カスタムドメイン | 想定外 | 年 2-3k 円 ≒ 月 200 円 |

---

*Generated: 2026-05-05*
*Status: DRAFT - needs validation*
*Source conversation*: 2026-05-05 session, post-Phase-8.x-fixes merge
