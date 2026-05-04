# Phase 10.D: アプリ名 / ドメイン ブレスト記録

> Phase 10.D「公開リリース最低限整備」のうち **アプリ名再考 + 公開ドメイン取得** の意思決定プロセス。
> 本ファイルはブレスト中間記録 + 候補リスト + 次アクションを保存する作業ファイル。
> 最終確定後に ADR-0005 として正式起票し、PRD の Open Question を close する。

**Date**: 2026-05-05
**Status**: **candidate-confirmed** (`pitamark.app` 確定、クリアランス ◎ → ADR-0005 起票 → ドメイン取得 → リネーム実装計画)
**Final decision**: **`pitamark.app`** (`+ pitamark.com 並行取得`)
**Owner**: imotako (PM/Dev)
**Related**:
- `.claude/PRPs/prds/snap-share.prd.md` (Open Question: 公開ドメイン候補 + アプリ名再考)
- `.claude/PRPs/prds/phase-10-direction.prd.md` (Phase 10.D)
- `docs/adr/ADR-0003-web-vs-desktop-direction.md` (形態方針)
- `docs/adr/ADR-0004-i18n-strategy.md` (i18n 戦略)

---

## ⏯ 次セッション再開時のクイックスタート

**このファイルは Phase 10.D「アプリ名再考 + 公開ドメイン取得」の意思決定記録。`pitamark.app` で確定済。** 次セッションでは以下の順で実行:

1. **ドメイン取得** (user 自身、もしまだなら最優先):
   - `pitamark.app` ($14/年) — Cloudflare Registrar 推奨 (年額据え置き / WHOIS プライバシー無料)
   - `pitamark.com` 並行取得 ($10-15/年) — リダイレクト用 + ブランド検索保護
   - `.io` は予算外 (年 $30-60) で見送り済
2. **ADR-0005「アプリ名 / 公開ドメイン」起票**:
   - パス: `docs/adr/ADR-0005-app-name-and-domain.md`
   - Status: accepted
   - 本ファイルの「議論サマリ」「Decisions Log」「クリアランス調査結果」を ADR フォーマットに圧縮
3. **PRD Open Question close** (ADR-0005 リンクで close):
   - `.claude/PRPs/prds/snap-share.prd.md` の「公開ドメイン候補 + アプリ名再考」 (line 52)
   - `.claude/PRPs/prds/phase-10-direction.prd.md` の「アプリ名再考 — 候補リストアップとドメイン空き調査の手順」 (line 124)
4. **リネーム実装計画作成** (`superpowers:writing-plans` skill 起動):
   - パス: `.claude/PRPs/plans/phase-10-rename.plan.md`
   - スコープ: リポジトリ名 `snap-share` → `pitamark` / workspace package 名 `@snap-share/*` → `@pitamark/*` / PRD / ADR / コード内言及更新
   - 履歴ある旧名 (Phase 0-8 commit message / 完了 PRD) は残す (歴史として)
   - Phase 配置: Phase 10.D の一部として実装するか、Phase 10.D' として別 Phase 化するかは Plan 作成時に判断
5. **リネーム実装** (Plan 通り)

### 文脈サマリ (3 行)

- snap-share という旧名は 「英動詞 + share」構造で、改名の主目的は **ブランド再構築 + 公開ドメイン取得 + 商標独自性確保**
- 英 2 単語連語 (`snapboard` / `snapnote` / `markshot` 等) は WHOIS で全滅、**D 路線 (和+英連語)** に転換して `pitamark` で着地
- クリアランス調査 (WHOIS / 既存サービス / USPTO 系商標 / GitHub) で衝突なしを確認済、希少な好結果

---

## 制約・前提

| 項目 | 値 |
|---|---|
| プロダクト概要 | 画像注釈 + URL 一発共有 + 共同編集 (Yjs CRDT) Web アプリ。形態は ADR-0003 で proposed (Web 主軸 + Mac は後回し方針) |
| スタンス | C (本気の事業化)、OSS MIT、個人開発 (週 ~15h) |
| ターゲット市場 | グローバル意識、特定市場 (日本) への過度な特化はしない。ただし **和名要素はブランドの音として残す** (Pixiv / Gyazo 等の前例あり、海外でも新規ブランド名として機能) |
| 収益化優先度 | **最優先** (流入確保 → 収益、SEO 立ち上がり重視) |
| ブランド命名タイプ | A (機能描写) / C (日本語語感) / D (英日ハイブリッド) を比較検討。**B (純造語 / Figma 路線) は除外**。最終的に **D 路線 (和+英連語)** が取得性 + ブランド独自性の両面で最良と判明 |
| ドメイン構造 | 7-10 文字、ハイフンなし優先 |
| TLD 戦略 | **`.app` メイン + `.com` 並行取得** で確定 (詳細は後述「TLD 比較」) |
| 商標方針 | 個人開発でも将来商標登録できる独自性を確保 |

---

## 議論サマリ

### 探索したアプローチと評価 (時系列)

| 時点 | アプローチ | 説明 | 結論 |
|---|---|---|---|
| 初期 | α (機能描写型) | "share" "note" "annotate" 等を ドメインに含める | SEO 強、ブランド弱め — **要素として採用** |
| 初期 | β (純造語 / Figma 路線) | 意味希薄、響き重視 | ゼロベース個人開発で立ち上げコスト過大 — **除外** |
| 中盤 | γ (日本語語感型: kakomi, pita, koe 等) | 動詞 / 名詞 / オノマトペ | グローバル意識で一旦除外 |
| 中盤 | A (英語連語: snapnote 等) | 英語 2 要素の連語 | **WHOIS 結果で全 9 候補取得済 → 路線断念** |
| 後半 | γ × α 連語 (例: pita-share) | 日本語オノマトペ + 英機能語 | 連語構造が現状名 `snap-share` と同じで改名インパクト弱 — **形を変えて D 路線へ進化** |
| **最終** | **D (和+英連語: pitamark / kakomark 等)** | **和名/オノマトペ + 英機能語** | **🟢 採用**。和名要素は海外でも新規ブランド名として機能、取得性も劇的に高い |

### 路線転換の根拠 (英語連語 → D 路線)

英語 2 単語連語の WHOIS スイープで判明した現実:
- `snapboard.com/.app/.io` 全部取得済 (.io は実運用中の競合 SaaS)
- `snapnote.com/.app/.io` 全部取得済
- `markshot.com/.app/.io` 全部取得済
- → **「2 単語英語連語は希少資源で個人開発で取れる残余はほぼない」** ことが実測で確認された

D 路線 (和+英) のメリット:
- 取得性が劇的に高い (英 2 単語の希少性 vs 和+英の希少性は桁違い)
- 海外でも新規ブランド名として機能 (Pixiv / Gyazo / Mikan 等の前例多数)
- 商標独自性 ◎ (汎用語の組合せでなく独自造語)
- 日本人にとっては音的キャッチー、海外ユーザーには中立な新ブランド

### SEO への効き方の整理

- 名前にキーワードを含める型: 立ち上がり時 (権威ドメイン化前の 6 ヶ月) に効く → **個人開発でゼロから立ち上げる本件には必須**
- ブランド検索 + コンテンツ + 被リンク型: Figma / Notion 路線。立ち上がり時は弱い
- → **両建て**: ドメインに 1-2 要素 + LP の H1 / meta で 3 要素目訴求

### 3 要素 (画像 / 注釈 / 共有) を全部入れる是非

- ドメインに 3 要素詰め込むと 12-14 文字 + ハイフン化、商標性 / 覚えやすさ崩壊
- 成功 SaaS の構造は **ドメインに 1-2 要素 + LP で 3 要素目** が王道 (Markup.io / Evernote / Gyazo 等)
- → **連語 2 要素 + LP H1 で 3 要素目** を方針として確定

### 命名条件 (確定)

- **言語**: 英語ベース機能語 + 和名/オノマトペ要素のハイブリッド (D 路線)
- **構造**: 機能語 2 要素の連語 (3 要素詰め込みは不採用)
- **長さ**: 7-10 文字、ハイフンなし優先
- **TLD**: `.app` メイン + `.com` 並行取得 (詳細は次節「TLD 比較」)
- **要素マッピング**:
  - **前半 (和名/オノマトペ)**: pita (ピタッ), saku (サクッ), pochi (ポチッ), pon (ポンと), kakomi (囲み), kakomu (囲む), maru (丸), haru (貼る), koe (声), chu (注)
  - **後半 (英機能語)**:
    - 画像系: shot, clip, pic
    - 注釈系: mark, note, tag
    - 共有 / 共同編集系: board, room, share, hub
- 3 要素目 (画像 / 注釈 / 共有のうち name に出ないもの) はランディングの H1 / meta description でカバー

### TLD 比較

| TLD | 年額 | 取得性 (D 路線) | クリック率 | SaaS 文脈 | 月 $5 予算適合 | 採否 |
|---|---|---|---|---|---|---|
| `.com` | $10-15 | 中 (D 路線なら取れる余地あり) | **最強** (デファクト) | 万能 | ◎ | **第 2 (並行取得試行)** |
| `.app` | $14-18 | 高 | 中 | SaaS / Google レジストリで HSTS 強制 = セキュリティ訴求 ◎ | ◎ | **第 1 (メイン)** |
| `.io` | $30-60 | 高 | 中 | tech startup | × (年予算の半分超) | **不採用** |
| `.dev` | $12-15 | 高 | 中 | 開発者ツール寄り、非エンジニア向けで違和感 | ◎ | 不採用 |
| `.co` `.so` `.xyz` | 様々 | 取りやすい | 弱 | 信頼感薄い | △ | 不採用 |
| `.jp` | $30+ | 取りやすい | 日本ローカル | 国内ドメスティック | △ | グローバル路線と矛盾、不採用 |

→ **`.app` メイン (公開ドメイン)** + **`.com` 並行取得 (リダイレクト + ブランド検索 / 口頭伝達対策)**

Google の公式見解で TLD は SEO 順位に直接影響しない。ただしクリック率は `.com` が他 TLD より 10-20% 高い (Mozilla 等の研究)。`.app` 単独でも問題ないが、`.com` 取れれば追加 $10-15/年でブランド検索リスク低減できる。

---

## WHOIS / HTTP 調査結果 (2026-05-05 実測)

### 初期 A 路線 (英語 2 単語連語) — 全滅

| 候補 | `.com` | `.app` | `.io` | 結果 |
|---|---|---|---|---|
| `snapboard` | 取得済 (lander) | 取得済 (lander) | **競合 SaaS 実運用中** | ❌ 全滅 |
| `snapnote` | 取得済 (HTTP 200) | 取得済 (HTTP 200) | 取得済 (2026 登録、HTTP 200) | ❌ 全滅 |
| `markshot` | 取得済 (中国系) | 取得済 (HTTP 200) | 取得済 (2025 登録) | ❌ 全滅 |

### D 路線 (和+英連語) — 大量に空き

HTTP 000 = サイトなし = 空きの強候補。WHOIS で念押し確認した Top 4:

| 候補 | `.app` | `.com` | `.io` | 総合 |
|---|---|---|---|---|
| **`pitamark`** | ✅ 空き | ✅ "No match" 確定 | ✅ 空き | **🟢 全 TLD 空き** |
| **`kakomark`** | ✅ 空き | ✅ "No match" 確定 | ✅ 空き | **🟢 全 TLD 空き** |
| `pitanote` | ✅ 空き | ❌ 2024-04-09 登録済 | ✅ 空き | 🟡 `.app/.io` のみ |
| `kakomi` (γ-1 単独) | ✅ 空き | ❌ 2010-07-03 登録済 | ✅ 空き | 🟡 `.app/.io` のみ |

その他 HTTP 000 候補 (要 WHOIS 念押し、暫定で取得性高):
`pochimark` `pochinote` `ponmark` `ponnote` `sakumark` `kakonote` `chunote` `harumark` `koemark` `koenote` `pitaclip` `pitashot.app/io` `chumark.app/io` `marumark.app/io` `sakunote.app/io`

---

## 候補リスト (D 路線)

| # | 候補 | 構成 | 文字数 | SEO ターゲット | 評価 | 取得性 | 備考 |
|---|---|---|---|---|---|---|---|
| 1 | **`pitamark.app`** | ピタッと + マーク | 8 | "image annotation" + ブランド検索 | **★★★** | 🟢 全 TLD 空き | 軽快 + 機能直結、商標独自性 ◎、海外で意味中立 |
| 2 | **`kakomark.app`** | 囲み + マーク | 8 | "image annotation" + ブランド検索 | **★★★** | 🟢 全 TLD 空き | 機能直結度最高 (kakomu = 注釈の動詞)、γ-1 + α 構造 |
| 3 | `pitanote.app` | ピタッと + ノート | 8 | "image note" + ブランド検索 | ★★ | 🟡 .app/.io のみ | Evernote 連想、ただし `.com` 不可 (2024 年新規登録要警戒) |
| 4 | `kakomi.app` | 囲み (単独) | 6 | ブランド検索のみ | ★★ | 🟡 .app/.io のみ | γ-1 単独、短い + 独自、ただし機能想起は注釈のみ |
| 5 | `pochimark.app` | ポチッと + マーク | 9 | クリック感 + 注釈 | ★★ | 暫定空き | 「ポチッと印付け」のクリック UX 訴求 |
| 6 | `ponmark.app` | ポンと + マーク | 7 | 軽快 + 注釈 | ★★ | 暫定空き | 短く打ちやすい |
| 7 | `kakonote.app` | 囲み + ノート | 8 | 注釈 + メモ | ★ | 暫定空き | 響き堅め |
| 8 | `harumark.app` | 貼る + マーク | 8 | クリップボード + 注釈 | ★ | 暫定空き | "貼る" でクリップボード貼付 UX 訴求 |
| 9 | `koemark.app` | 声 + マーク | 7 | コミュニケーション + 注釈 | ★ | 暫定空き | γ-2 + α、相談ツール文脈 |
| 10 | `pitashot.app` | ピタッと + ショット | 8 | screenshot 系 | ★ | `.com` 取得済 | screenshot 文脈 |

---

## 推奨 Top 2 (取得性 + 収益最優先 / SEO 立ち上がり最強)

### 1. `pitamark.app` (+ `pitamark.com` 並行取得) ★★★

- **強み**:
  - **全 TLD (.app/.com/.io) 取得可能** — 個人開発の命名で稀な好結果
  - 8 文字、ハイフンなし、打ちやすい
  - **オノマトペ「ピタッと」 + 機能語「mark」** = 軽快さ + 機能直結
  - 海外で **意味中立** (Pita = 中東のパン or 新規ブランド)、Pixiv / Gyazo 路線で機能
  - SEO: ブランド検索独自性 ◎、汎用検索は LP メタタグで補完
  - 商標独自性 ◎ ("pita" + "mark" の組合せは独自、要 USPTO/JPO 念押し)
  - PRD の「軽量 UX (Shottr 級)」差別化軸に音的整合
- **弱み**:
  - 共有 / 共同編集要素が name に出ない → LP H1 で訴求必須 (`pitamark — Annotate & share images in one URL`)
  - "Pita" 単語自体は中東料理連想が一部ユーザーに発生する可能性 (ただし weak)

### 2. `kakomark.app` (+ `kakomark.com` 並行取得) ★★★

- **強み**:
  - **全 TLD (.app/.com/.io) 取得可能** — 同じく取得性最強
  - 8 文字、ハイフンなし
  - **動詞「囲む」 + 機能語「mark」** = 機能直結度最高 (γ-1 + α の最良結合)
  - 「kakomu = 囲む」は注釈の最頻度動作 (矩形 / ハイライト)
  - 海外で **意味中立** (新規ブランドとして機能)
  - 商標独自性 ◎
- **弱み**:
  - 「kakomi」が日本人以外には発音直感が湧きにくい (ただし読み方は明確)
  - 響きが `pitamark` より堅め (オノマトペ vs 動詞の差)

### Top 2 の比較

| 観点 | `pitamark` | `kakomark` |
|---|---|---|
| 響き | ポップ・軽快 | 堅め・道具感 |
| 機能直結度 | 中 (オノマトペで軽さ訴求) | 高 (囲む = 注釈動詞) |
| 海外発音容易性 | ★★★ (pita 知名度あり) | ★★ (kakomi は読みは明確だが意味知覚なし) |
| PRD 差別化軸との整合 | 軽量 UX (Shottr 級) | 注釈機能の本質 (Yjs 共同編集) |
| 取得性 | 🟢 全 TLD | 🟢 全 TLD |
| SEO 立ち上がり | 同等 (どちらもブランド検索 + LP メタ) | 同等 |
| 商標性 | ◎ | ◎ |
| 成長後の展望 (Mac 版等) | "pita" は短く可愛い、Mac アプリ名としても機能 | "kakomi" は読みが日本語寄りで Mac 英語 UI で違和感の可能性 |

→ **user 選定 (a) で `pitamark.app` 確定**。

---

## クリアランス調査結果 (`pitamark`、2026-05-05 実施)

| 調査軸 | 結果 | 備考 |
|---|---|---|
| WHOIS (`.app` / `.com` / `.io` / `.dev` / `.co`) | ✅ 全 TLD 空き ("No match" 確定) | `whois` コマンド出力で「No matching record」確認、HTTP 000 (HSTS preload TLD で未登録時の典型応答) |
| 既存サービス・ソフトウェア (Web 一般検索) | ✅ "pitamark" 名のサービスは存在せず | 類似名は `Pitram` (MICROMINE 鉱業ソフト) と `PitaSys` (retail SaaS) のみ。業界・機能が完全に異なり衝突なし |
| 商標登録 (USPTO 系検索) | ✅ "pitamark" の登録なし | USPTO 検索結果に該当なし。THE PIT / MONEY PIT 等は別ブランドで無関係 |
| GitHub (ユーザー名 / リポジトリ) | ✅ `pitamark` ハンドルなし | 類似は人名ハンドル (`pitamar` Itamar Schen / `pitamer` Itamar Galili) のみ、衝突なし |

### 注意点 (将来要観察)

- **`Pitram`** (MICROMINE 鉱業ソフトウェア) は表記上の類似度が中。発音は離れる (Pit-RAM vs Pi-ta-MARK)、業界違い (鉱業 vs 画像注釈) で商標衝突の可能性は低いが、要注意観察対象として記録。
- 正式な商標登録 (USPTO TESS / JPO J-PlatPat / EUIPO eSearch plus への直接出願) は **個人開発フェーズではオプション**。Phase 11 以降の事業化判断後 (収益化が見えた時点) で出願を検討する。

## 次のアクション

- [x] user 最終選定 → `pitamark.app` (2026-05-05)
- [x] クリアランス調査 (Web 検索 / GitHub / USPTO 系) → ◎ 衝突なし (2026-05-05)
- [ ] **ドメイン取得** (user タスク):
  - `pitamark.app` メイン取得 (Cloudflare Registrar / Namecheap / Google Domains 等で約 $14/年)
  - `pitamark.com` 並行取得 ($10-15/年)
  - `.io` は予算外で見送り
- [ ] **ADR-0005「アプリ名 / 公開ドメイン」起票**:
  - Status: accepted
  - Context / Decision / Consequences を整理
  - 本ファイルの議論サマリと Decisions Log を ADR フォーマットに圧縮
- [ ] **PRD Open Question close**:
  - `snap-share.prd.md` の「公開ドメイン候補 + アプリ名再考」を close
  - `phase-10-direction.prd.md` の「アプリ名再考 — 候補リストアップとドメイン空き調査の手順」を close
- [ ] **リネーム実装計画** (`writing-plans` skill で別途計画化):
  - リポジトリ名 `snap-share` → `pitamark`
  - workspace package 名 `@snap-share/*` → `@pitamark/*`
  - PRD / ADR / コードコメント / README の言及更新
  - 履歴ある旧名表記 (Phase 0-8 の PRD / commit message) は残す (歴史として)
  - Phase 配置: Phase 10.D の一部として実装するか、別 Phase 化するか要判断
- [ ] 正式商標登録 (USPTO / JPO / EUIPO) は **Phase 11 以降** の事業化判断後に検討 (個人開発フェーズではオプション)

---

## Decisions Log

| 日付 | 決定 | 根拠 |
|---|---|---|
| 2026-05-05 | B (純造語型) を除外 | 個人開発でゼロベース立ち上げ、ブランディングコスト過大 |
| 2026-05-05 | SEO 強化を最優先 | 流入 = 収益の現実、立ち上がり 6 ヶ月の権威ドメイン化前は名前のキーワード性が効く |
| 2026-05-05 | 日本市場特化 (gazo prefix 等) を除外 | グローバル対応、海外展開時 (英語版) の互換性確保 |
| 2026-05-05 | 連語 2 要素 + LP で 3 要素目訴求が現実解 | 3 要素詰め込みドメインは長すぎ + 商標弱まる、成功 SaaS の構造に合わせる |
| 2026-05-05 (撤回) | ~~A 路線 (英語連語) Top 3 確定~~ | ~~snapnote / snapboard / markshot~~ → **WHOIS で全 9 ドメイン取得済が判明、A 路線断念** |
| 2026-05-05 | TLD 戦略確定: `.app` メイン + `.com` 並行 | `.io` は年 $30-60 で予算超過、`.app` は SaaS 慣習 + HSTS 強制でセキュリティ訴求 |
| 2026-05-05 | **D 路線 (和+英連語) を採用** | A 路線断念を受けて、和名要素はブランドの音として復活。海外でも新規ブランド名として機能 (Pixiv / Gyazo 前例)、取得性が劇的に高い |
| 2026-05-05 | **推奨 Top 2 確定: `pitamark.app` / `kakomark.app`** | WHOIS 念押し済、両者とも `.app/.com/.io` 全 TLD 取得可能 |
| 2026-05-05 | **🟢 最終決定: `pitamark.app` (`+ pitamark.com`)** | user 選定 (a)。`kakomark` より海外発音容易性 ★★★、PRD 軽量 UX 差別化軸との音的整合、Mac native 路線でも継続使用可 |
| 2026-05-05 | クリアランス調査 ◎ | WHOIS 全 TLD 空き、既存サービスなし、USPTO 系商標登録なし、GitHub ハンドルなし |

---

## Open Questions (本ファイル内)

- [ ] リネーム実装の Phase 配置 (Phase 10.D 内で実装するか、Phase 10.D' として別 Phase 化するか)
- [ ] `.com` 取得失敗時のフォールバック方針 (typosquat 対策として価格交渉するか、`.app` 単独で行くか)
- [ ] OSS リポジトリのリネーム時、git push --force 不要のリダイレクト (GitHub の自動リダイレクト機能で十分か)
