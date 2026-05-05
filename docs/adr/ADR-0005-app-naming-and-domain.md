# ADR-0005: アプリ名 + ドメイン — `pitamark.app` (+ `pitamark.com`)

**Date**: 2026-05-05
**Status**: accepted (選定意思決定は確定。ドメイン取得 + DNS / Pages カスタムドメイン設定 + Turnstile / CORS 切替 + 本番 deploy + v1.0.0 タグは Phase 10.F で後追い)
**Deciders**: imotako (PM/Dev)
**Related**: `.claude/PRPs/prds/snap-share.prd.md` / `.claude/PRPs/prds/phase-10-direction.prd.md` (Phase 10.D / 10.F) / `.claude/PRPs/prds/phase-10-naming.md` (議論記録) / [ADR-0003](./ADR-0003-web-vs-desktop-direction.md) (形態方針 = on hold) / [ADR-0004](./ADR-0004-i18n-strategy.md) (i18n 戦略 = accepted)

---

## Context

旧名 `snap-share` は Phase 0 spike 時に "とりあえず" 付けた仮名であり、以下の問題を抱えていた:

| 観点 | 旧名の課題 |
|---|---|
| 構造 | 英語動詞 (`snap`) + 機能語 (`share`) のハイフン連結。動詞 + share は SaaS 命名で陳腐化が進行 (ScreenShare / FileShare / NoteShare 等) |
| ドメイン | `.com` `.app` `.io` すべて取得済 (大半が SaaS 競合の所有)、`snap-share.pages.dev` という Pages 仮設 URL のまま運用 |
| 商標独自性 | 汎用語 2 つの組合せで独自性が低い、将来商標登録の障害になる可能性 |
| ブランド検索 | "snap share" で検索すると無関係な機能・サービスが上位、ブランド独自トラフィックが取りにくい |
| 海外展開 | 英語ネイティブには発音は通じるが特徴がなく印象に残りにくい (PRD MoSCoW で TAM 10x 狙いの C スタンス採用 → 改名動機が立つ) |

Phase 10 で **C スタンス (本気の事業化)** を採用 (PRD Decisions Log)、Phase 10.B 完了で公開リリース最低限整備が揃ったタイミングで、改名 + 公開ドメイン取得を Phase 10.D で実施することを PRD で確定。

### 制約と前提

| 項目 | 値 |
|---|---|
| プロダクト概要 | 画像注釈 + URL 一発共有 + 共同編集 (Yjs CRDT) Web アプリ。形態は ADR-0003 で on hold (Web 主軸 + Mac は Phase 11+ 後回し) |
| スタンス | C (本気の事業化)、OSS MIT License、個人開発 (週 ~15h) |
| ターゲット市場 | グローバル意識、特定市場 (日本) への過度な特化は避ける。ただし **和名要素はブランドの音として残す** (Pixiv / Gyazo / Mikan の前例) |
| 収益化優先度 | **最優先** (流入 → 収益、SEO 立ち上がり 6 ヶ月の名前依存度が大きい) |
| ドメイン構造 | 7-10 文字、ハイフンなし優先、商標独自性確保 |
| ランニング予算 | 月 $5 以下 (Cloudflare 全 free tier、ドメインのみ年 $14 + $10-15 = 月 $2 程度) |

---

## Decision

**`pitamark.app`** をメインドメインとして採用 (+ `pitamark.com` を並行取得しブランド検索保護 + リダイレクト用途)。アプリ名 = `pitamark`。

### 構造

| 要素 | 値 | 由来 |
|---|---|---|
| 前半 | `pita` | 日本語オノマトペ「ピタッと」(画面にすばやく注釈を貼る軽快さ) |
| 後半 | `mark` | 英語機能語 (注釈 / マークアップの中核動作) |
| TLD | `.app` | Google レジストリで HSTS preload 強制 = セキュリティ訴求、SaaS 慣習で違和感ない |
| 並行取得 | `.com` | デファクト TLD のクリック率優位 (10-20% 高) + ブランド検索保護 + 口頭伝達時のフォールバック |

### Status: accepted の根拠

選定意思決定 (`pitamark` を採用) は **2026-05-05 確定**。WHOIS / 既存サービス / USPTO / GitHub の 4 軸クリアランス調査も同日 ◎ で完了。ドメイン取得自体 (Cloudflare Registrar での購入手続き) は Phase 10.F で実施するが、ADR としては「選定の意思決定が固まった」状態を accepted で記録する。

---

## Alternatives Considered

### A. 機能描写型 (英語連語、例: `snapboard` / `snapnote` / `markshot`)

- **Pro**: SEO ターゲットキーワード (image annotation / share / mark) を name に含められる、立ち上がり 6 ヶ月の検索流入に効く
- **Con**: WHOIS スイープで全 9 候補 (`.com` `.app` `.io`) すべて取得済が判明:
  - `snapboard.com/.app` lander、`snapboard.io` は競合 SaaS 実運用中
  - `snapnote.com/.app/.io` 全部取得済 (`.io` は 2026 年新規登録)
  - `markshot.com/.app/.io` 全部取得済 (`.io` は 2025 登録)
- **Con**: 英語 2 単語連語は希少資源、個人開発で取れる残余ほぼなし
- **Verdict**: 取得不可、断念

### B. 純造語型 (Figma 路線、例: `Tixly` / `Verza`)

- **Pro**: ブランド独自性最強、商標登録ほぼ衝突しない
- **Con**: 個人開発でゼロベース立ち上げると、意味希薄な造語のブランディングコストが過大 (Figma レベルのマーケティング予算が必要)
- **Con**: SEO 立ち上がり時にキーワード性ゼロ、流入 = 収益の C スタンスと噛み合わない
- **Verdict**: 除外

### C. 日本語語感型 (γ路線、例: `kakomi` / `pita` / `koe` 単独)

- **Pro**: 日本人にとって音的キャッチー、`.app` で取れる残余あり
- **Con**: 単独では機能想起が弱い (`kakomi` は「囲み」だけ、画像 / 注釈 / 共有のどれが主なのか不明)
- **Con**: 海外ユーザーには発音直感が湧きにくい
- **Verdict**: 単独では弱い、和+英 連語 (D 路線) に進化

### D. 和+英連語型 (採用、例: `pitamark` / `kakomark` / `pochimark`)

- **Pro**: 和名要素 + 英機能語 のハイブリッドで取得性が劇的に高い (英 2 単語の希少性 vs 和+英の希少性は桁違い)
- **Pro**: Pixiv / Gyazo / Mikan の前例で、海外でも新規ブランド名として機能することが実証済
- **Pro**: 日本人には音的キャッチー、海外ユーザーには中立な新ブランド (Pita = 中東料理連想は弱、Mac は Apple 連想 / Mikan は新ブランドとして受容と同パターン)
- **Pro**: 商標独自性 ◎ (汎用語の組合せでなく独自造語)
- **Con**: 機能描写度が A 路線より低い、LP H1 / meta description で 3 要素目訴求が必要
- **Verdict**: 採用

### D 路線内 Top 2 比較 (`pitamark` vs `kakomark`)

| 観点 | `pitamark` (採用) | `kakomark` |
|---|---|---|
| 響き | ポップ・軽快 (オノマトペ「ピタッと」) | 堅め・道具感 (動詞「囲む」) |
| 機能直結度 | 中 (オノマトペで軽さ訴求) | 高 (kakomu = 囲む = 注釈動詞そのもの) |
| 海外発音容易性 | ★★★ (Pita は中東パン由来で知名度あり) | ★★ (kakomi は読みは明確だが意味知覚なし) |
| PRD 差別化軸との整合 | 軽量 UX (Shottr 級) | 注釈機能の本質 (Yjs 共同編集) |
| 取得性 | 🟢 全 TLD (.app/.com/.io) | 🟢 全 TLD |
| SEO 立ち上がり | 同等 (どちらもブランド検索 + LP メタ) | 同等 |
| 商標性 | ◎ | ◎ |
| 成長後の展望 (Mac 版等) | "pita" は短く可愛い、Mac アプリ名としても機能 | "kakomi" は読みが日本語寄りで Mac 英語 UI で違和感 |

→ **オーナー判断 (2026-05-05)**: 軽量 UX 訴求 + 海外発音容易性で `pitamark` 採用。

---

## Clearance Investigation Results (2026-05-05 実測)

| 調査軸 | 結果 | 備考 |
|---|---|---|
| WHOIS (`.app` / `.com` / `.io` / `.dev` / `.co`) | ✅ 全 TLD 空き ("No match" 確定) | `whois` コマンド出力で「No matching record」確認、HTTP 000 (HSTS preload TLD で未登録時の典型応答) |
| 既存サービス・ソフトウェア (Web 一般検索) | ✅ "pitamark" 名のサービスは存在せず | 類似名は `Pitram` (MICROMINE 鉱業ソフト) と `PitaSys` (retail SaaS) のみ。業界・機能が完全に異なり衝突なし |
| 商標登録 (USPTO 系検索) | ✅ "pitamark" の登録なし | USPTO 検索結果に該当なし。THE PIT / MONEY PIT 等は別ブランドで無関係 |
| GitHub (ユーザー名 / リポジトリ) | ✅ `pitamark` ハンドルなし | 類似は人名ハンドル (`pitamar` Itamar Schen / `pitamer` Itamar Galili) のみ、衝突なし |

### 注意点 (将来要観察)

- **`Pitram`** (MICROMINE 鉱業ソフトウェア) は表記上の類似度が中。発音は離れる (Pit-RAM vs Pi-ta-MARK)、業界違い (鉱業 vs 画像注釈) で商標衝突の可能性は低いが、要注意観察対象として記録。

### TLD 戦略の根拠

| TLD | 年額 | クリック率 | 採否 | 根拠 |
|---|---|---|---|---|
| `.app` | $14-18 | 中 | **第 1 (メイン)** | Google レジストリで HSTS preload 強制 = セキュリティ訴求 ◎、SaaS 慣習 |
| `.com` | $10-15 | 最強 (デファクト) | **第 2 (並行取得)** | クリック率優位 + ブランド検索保護 + 口頭伝達フォールバック |
| `.io` | $30-60 | 中 | 不採用 | 月 $5 予算に対し年 $30-60 は半分超、コスト不適合 |
| `.dev` | $12-15 | 中 | 不採用 | 開発者ツール寄り、非エンジニア向けで違和感 |
| `.jp` | $30+ | 日本ローカル | 不採用 | グローバル路線と矛盾 |

Google 公式見解で TLD は SEO 順位に直接影響しないが、`.com` のクリック率は他 TLD より 10-20% 高い (Mozilla 等の研究)。`.app` 単独でも機能するが、`.com` 取れれば追加 $10-15/年でブランド検索リスク低減できる。

---

## Consequences

### Positive

- **取得可能性 ◎**: WHOIS スイープで全 TLD 空き、即取得可能 (Phase 10.F で Cloudflare Registrar 購入)
- **商標独自性 ◎**: 既存登録なし、Phase 11+ で事業化判断が出れば USPTO/JPO 出願可能
- **ブランド検索独自性 ◎**: "pitamark" でググると関連サービス上位を独占可能 (現状ヒット 0)
- **SEO 立ち上がり最適**: 名前にキーワード `mark` を含み、立ち上がり 6 ヶ月の検索流入に効く + LP H1 で「画像 / 共有」3 要素目を補完
- **ADR-0004 (i18n) との整合**: 海外で意味中立 (pita = 中東料理連想は弱)、日英 2 言語展開で違和感なし
- **形態進化への耐性**: ADR-0003 で Mac 版が Phase 11+ 候補として残されているが、`pitamark` は Mac アプリ名としても短くポップで機能する
- **PRD 差別化軸との音的整合**: 「軽量 UX (Shottr 級)」の差別化軸とオノマトペ「ピタッと」の音感が合致

### Negative

- **改名移行コスト**: Phase 10.D で workspace package / UI / 法務 / GitHub templates / ADR / PRD の rename + Phase 10.F で Cloudflare リソース recreate (Worker / R2 / Pages / CORS / Turnstile site key) が必要
- **既存リンク互換性**: `snap-share.pages.dev` で踏まれた既存共有 URL は Phase 10.F の本番デプロイ後に redirect 設定が必要 (ただし dogfood 規模で実害は限定的)
- **localStorage migration**: 既存ユーザーが `snap-share-lang` / `snap-share/user-v1` を持つ場合、新キー (`pitamark-lang` / `pitamark/user-v1`) への one-shot migration が必要 (Phase 10.D で実装)
- **3 要素目の訴求負担**: 名前 (`pitamark` = ピタッと + マーク) に画像 / 共有が出ない → LP H1 / meta description で「画像 URL 一発で共同注釈」を必須訴求 (既存 tagline で対応済)
- **`Pitram`との表記類似性**: 鉱業ソフト Pitram と表記類似度が中。業界違いで商標衝突可能性は低いが、Phase 11+ 商標登録時に異議申立リスクを再評価
- **オノマトペの文化依存**: 「ピタッと」は日本語ネイティブにしか伝わらない、海外ユーザーには新ブランドとしてのみ機能 (機能想起ゼロ)

### Neutral

- **ドメイン取得タイミング**: Phase 10.D 再分割により取得を急がない方針が確定 (`phase-10-naming.md` 2026-05-05)。ADR-0005 起票時点ではドメイン未取得、Phase 10.F で取得 + DNS + Pages カスタムドメイン設定を実施
- **GitHub repo rename**: `imotako-pum/snap-share` → `imotako-pum/pitamark` への repo rename はオーナー手動操作 (GitHub Settings)、Phase 10.D の rename 実装と独立して任意タイミングで実行可能。GitHub の自動 redirect が 1 年以上保つため URL 互換性影響は限定的

---

## Implementation Approach

### Phase 10.D (本 ADR 確定後、ドメイン取得を待たない)

- workspace package 名 `@snap-share/*` → `@pitamark/*`
- 可視 UI (h1 / index.html title / og 系) を `pitamark` に
- localStorage key の one-shot migration (`snap-share-lang` → `pitamark-lang` / `snap-share/user-v1` → `pitamark/user-v1`)
- Export PNG ファイル名 prefix を `pitamark-{roomId}-{ts}.png` に
- 法務文書 (`terms-ja.md` / `privacy-ja.md`) のサービス名置換 + 英訳 draft 起票
- OGP / favicon / SEO 雛形 (robots.txt / sitemap.xml / JSON-LD / canonical) 整備
- GitHub Issue Templates / README / ADR-0005 (本 ADR) 起票

### Phase 10.F (ドメイン取得後)

- Cloudflare Registrar で `pitamark.app` + `pitamark.com` 取得
- Cloudflare Pages カスタムドメイン設定 / DNS / TLS
- Workers `wrangler.toml` の `name = "snap-share-api"` → `pitamark-api`、R2 binding `bucket_name` 切替 (recreate)、`CORS_ALLOWED_ORIGINS` 更新
- Turnstile site key 切替
- Cloudflare Web Analytics token 本番値設定
- 法務 ja/en の運営者連絡先 + 確定ドメイン埋込
- `og:url` / canonical / sitemap.xml の URL 確定値置換
- 本番 deploy + v1.0.0 タグ + GitHub Release + CHANGELOG.md 初版起票

### Phase 11+ (オプション、事業化判断後)

- USPTO / JPO / EUIPO 商標登録 (収益化が見えた時点)
- HSTS preload 申請 (運用安定後、サブドメイン全 HTTPS 確認後)
- `Pitram` との商標衝突リスク再評価

---

## References

- Phase 10 PRD: `.claude/PRPs/prds/phase-10-direction.prd.md`
- 議論記録 (ブレスト + クリアランス調査): `.claude/PRPs/prds/phase-10-naming.md`
- ADR-0003 (Web vs Desktop = on hold): `./ADR-0003-web-vs-desktop-direction.md`
- ADR-0004 (i18n 戦略 = accepted): `./ADR-0004-i18n-strategy.md`
- WHOIS lookup 結果: `phase-10-naming.md` §WHOIS / HTTP 調査結果
- USPTO TESS: https://tmsearch.uspto.gov/
- Cloudflare Registrar: https://developers.cloudflare.com/registrar/
- Google `.app` registry: https://www.registry.google/

---

## Open Questions (本 ADR 内、Phase 11+ で再評価)

- [ ] `.com` 取得失敗時のフォールバック方針 (typosquat 対策として価格交渉するか、`.app` 単独で行くか) — Phase 10.F 取得試行時に判断
- [ ] `Pitram` (MICROMINE 鉱業ソフト) との表記類似性が将来商標登録時に異議申立リスクとなるか — Phase 11+ 商標出願準備時に弁理士レビュー
- [ ] OSS リポジトリ rename `imotako-pum/snap-share` → `imotako-pum/pitamark` のタイミング — Phase 10.D PR merge 前後の任意タイミングでオーナー実行 (GitHub Settings 操作)
