# ADR-0003: snap-share の形態方針 — Web 単独 / Mac native / ハイブリッド

**Date**: 2026-05-05
**Status**: proposed
**Deciders**: imotako (PM/Dev)
**Related**: `.claude/PRPs/prds/snap-share.prd.md` / `.claude/PRPs/prds/phase-10-direction.prd.md` / Phase 10.C (Mac spike)

---

## Context

Phase 0〜8 で Web 版 snap-share の MVP を完成させ、Phase 8 統合レビュー + Phase 8.x 修正（PR#15）まで完了した。Phase 9 dogfood 開始前にオーナーが **「本当はデスクトップアプリにしたら価値があるのかな」** と申し出たため、形態の根本的な再評価が必要になった。

### 制約と前提

| 項目 | 状態 |
|---|---|
| 既存実装 | `apps/web` (Vite + React 19 + Konva) / `apps/api` (Hono on CF Workers) すべて稼働中 |
| 既存コード規模 | TS/TSX 209 ファイル ~21k LOC（テスト含む） |
| ランニングコスト | 月額 $5 以下（Cloudflare free tier 内 + ドメインのみ） |
| オーナー収益化スタンス | C（本気の事業化）— Phase 10 PRD で確定 |
| 開発リソース | 個人開発、週 ~15h |
| OSS ライセンス | MIT 確定 |
| ターゲット | 日本語ファースト、リモートワーク中心の日本企業の平社員 |

### 競合スナップショット

| プロダクト | 形態 | 価格 | 強み | 弱み |
|---|---|---|---|---|
| **Shottr** | Mac native | Free / Pro $8 | 軽量・高速・キャプチャワークフロー | URL 共有が二級市民、英語 UI |
| **CleanShot X** | Mac native | $29 買い切り or サブスク | Shottr 上位互換、機能リッチ | 同上、価格高め |
| **Markup.io** | Web | $79/月〜 | B2B デザインフィードバック | 高価、英語 UI、日本語不在 |
| **Pastel** | Web | $35/月〜 | 同上 | 同上 |
| **Webvizio Free** | Web | Free | URL 注釈、Web ベース | 英語、日本語不在、共同編集弱 |
| **snap-share (現状)** | Web | Free | URL 一発共有 + 共同編集 + 日本語ファースト | キャプチャワークフロー欠如、IME 暴れリスク |

**スポット仮説**: 「**共有 URL 発行が一級市民な Mac 注釈アプリ ¥980 買い切り**」は Shottr (URL 共有弱) と CleanShot X (高価) の隙間に存在する。

---

## Decision

**現時点では Decision を確定しない**（Status: proposed）。

Phase 10.C で **Tauri 2.0 を使った Mac spike を 1-2 週間** 踏み、その体感結果に基づいて以下 3 形態のいずれかを Status: accepted で確定する:

### Option 1. Web 単独継続

- 既存 `apps/web` をそのまま伸ばす
- Mac 版は作らない
- 共同編集 + URL 一発共有を最大の差別化軸として強化

### Option 2. Mac native 主軸 + Web 共有ビューア

- Tauri ベースで Mac 版を本格実装
- 既存 `apps/web` は **共有相手の閲覧/編集ビュー** に格下げ
- グローバルホットキー → スクショ → 注釈 → 共有 URL のワークフローを最優先

### Option 3. ハイブリッド（並走 / 等価）

- Web 版と Mac 版を等価のプロダクトとして両方維持
- 共通基盤 = `apps/web` の React + Konva + Yjs コード（70% 流用）
- Mac は「キャプチャ + ローカル編集」の優位性、Web は「共有相手の即時アクセス」の優位性

---

## Alternatives Considered

### A. 即 Web 一本で確定（spike を踏まない）

- **Pro**: 既存資産フル活用、判断コストゼロ、Phase 10 が短くなる
- **Con**: 「Mac 版の方が価値がある」可能性を未検証のまま放置、後で気付いた時の機会損失大
- **却下理由**: オーナー自身が疑問を持っており、未検証で進むと dogfood/公開後に「やっぱり Mac だった」と判明した時の sunk cost が大きい

### B. 即 Mac 主軸切替（spike を全速力で本実装に）

- **Pro**: 競合スポット（Shottr 隙間）に直球
- **Con**: 既存 Web 版を捨てるリスク、配布/署名/update infra の習得コスト未知数、共同編集差別化を失う可能性
- **却下理由**: spike なしで方向転換すると 70% 流用が嘘だった時の被害が大きい

### C. Electron で Mac 版

- **Pro**: Web 技術で完結、再利用率最大、クロスプラットフォーム対応容易
- **Con**: バンドルサイズ 100MB+、起動遅、メモリ大、Mac native の "軽量感" を損なう（Shottr / CleanShot X 競合の最大の差別化要素を捨てる）
- **却下理由**: Mac native 路線を取る動機の核（軽量・高速）と Electron が真逆

### D. Native Swift / SwiftUI で Mac 版

- **Pro**: 究極の native パフォーマンス、Apple エコシステム純度最高
- **Con**: 既存 React + Konva コードがゼロ流用、Konva 相当のキャンバス実装を Swift で書き直し、開発工数 10x
- **却下理由**: 個人開発で週 15h では非現実的、Tauri なら 70% 流用で済む

### E. Wails (Go + Web)

- **Pro**: Tauri 同等の軽量性、Go バックエンド
- **Con**: Tauri より日本語 / OS 連携情報が少ない、Rust エコシステムの方が ScreenCaptureKit bridge の事例多い
- **却下理由**: Tauri に対する優位性が薄い、後述

### F. PWA (Progressive Web App) として Mac 化

- **Pro**: 配布インフラ不要、1 コードベース、Add to Dock 対応
- **Con**: グローバルホットキーが OS 経由で取れない（最大の Mac 化メリット欠如）、ScreenCaptureKit アクセス不可、クリップボード API 制限
- **却下理由**: 「キャプチャ → 即注釈ワークフロー」の根幹を実現できない

### G. Mac App Store 経由で Tauri 配布

- **Pro**: 配布プラットフォーム標準
- **Con**: Apple の sandbox 制約で ScreenCaptureKit 等の権限取得が複雑化、審査による更新遅延、収益 30% 取られる
- **却下理由**: spike 段階では self-distribution（自前 update server + 公証）の方が早い。本格商用化時に再検討

---

## Spike 設計（Phase 10.C）

### 期間

1-2 週間（週 15h × 2 = 30h 目安）

### Goal

「キャプチャ → 注釈 → 共有 URL」の **golden path のみ** を Tauri で動作させ、3 形態判断の根拠を得る。

### Scope

1. **Tauri 2.0 プロジェクト初期化**（`apps/desktop/` 新設）
2. **既存 `apps/web` を webview に統合**（Tauri が build 時に読み込む）
3. **グローバルホットキー登録**（Cmd+Shift+4 相当、Tauri Plugin GlobalShortcut）
4. **スクリーンキャプチャ**（macOS の ScreenCaptureKit を Rust 経由で叩く）
5. **キャプチャ画像を webview の Konva canvas にロード**
6. **注釈完了後、クリップボードに PNG として書き戻し**（Tauri 標準 API）
7. **「URL 共有」ボタン**: 既存 `apps/api` に POST → URL 取得 → クリップボードに URL コピー

### Non-Scope（spike では作らない）

- 共同編集（Yjs / WebSocket 経由）— Mac 単体で完結する場合は不要
- 自動 update インフラ
- 公証（Notarization）/ 配布
- Windows / Linux 対応
- Mac App Store 審査対応
- 課金・ライセンス管理

### Go/No-Go Gate（1 週目終了時）

以下のうち 2 つ以上が NG の場合、spike を中断して Web 単独継続（Option 1）を確定:

- [ ] 既存 React + Konva コードが Tauri webview で大きな改修なく動く
- [ ] グローバルホットキー登録が Tauri Plugin で完結する
- [ ] ScreenCaptureKit の Rust bridge が 1 日以内に動く
- [ ] webview ↔ Rust 間の IPC が現実的なパフォーマンス（注釈中の遅延体感ゼロ）

### Success Signal（2 週目終了時）

- macOS 上で **Cmd+Shift+4 → 範囲選択 → 注釈 5 種配置 → クリップボード PNG → 別アプリ（Slack 等）に貼付** の golden path が動作
- オーナー自身が **「これを毎日使いたいか」** を体感ベースで判断できる
- 上記体感に基づき本 ADR を Status: accepted に書き換え（Option 1/2/3 のいずれか）

---

## Consequences（各 Option の影響）

### Option 1（Web 単独）採用時

**Positive**:
- 既存資産 100% 活用、追加開発ゼロ
- 共同編集差別化が維持される
- Phase 11 = better-auth + 永続ルーム に直行可能

**Negative**:
- 競合 Shottr 隙間スポットを取らない判断、TAM 上限が見えやすい
- IME 暴れ問題が継続（Konva textarea overlay の宿痾）
- グローバルホットキー欠如で「キャプチャワークフロー」差別化を諦める

### Option 2（Mac 主軸）採用時

**Positive**:
- 競合スポット直球、ARPU 高い market（Mac 有料アプリ）
- IME 問題消滅（OS native 入力）
- グローバルホットキー = 強力な daily use trigger

**Negative**:
- 既存 Web 版が **共有ビューア** に格下げ、共同編集差別化が薄まる
- Mac 環境がないユーザー（Windows / Linux）を切り捨て
- 配布 / 署名 / 公証 / 自動 update インフラ習得コスト
- Phase 11 が「Mac 本格実装 + 配布基盤」になり工数増

### Option 3（ハイブリッド）採用時

**Positive**:
- 両 platform で価値提供、TAM 最大
- Mac で取得 → Web で共有相手が即アクセス、シナジー

**Negative**:
- 開発工数が Web 単独の 1.5x（共通基盤あっても OS 連携部分は別）
- バグサーフェス 2x、テスト工数 2x
- フリーミアム機能を 2 platform で実装する必要

---

## Validation / Acceptance（Status: accepted へ昇格させる前に確認する事項）

- [ ] Phase 10.C の Mac spike 完了
- [ ] Go/No-Go Gate（1 週目）の 4 項目のうち 3 項目以上 OK
- [ ] Success Signal（2 週目）の golden path 動作
- [ ] オーナーの体感ベース判断（「Mac 版を毎日使いたいか」）が記録されている
- [ ] 選んだ Option（1 / 2 / 3）の Phase 11 起票への影響が `phase-10-direction.prd.md` の Decisions Log に追記されている

---

## References

- Phase 10 PRD: `.claude/PRPs/prds/phase-10-direction.prd.md`
- snap-share PRD: `.claude/PRPs/prds/snap-share.prd.md`
- Phase 8 統合レビュー Report: `.claude/PRPs/reports/phase-8-integration-review-report.md`
- Tauri 2.0: https://v2.tauri.app/
- Shottr: https://shottr.cc/
- CleanShot X: https://cleanshot.com/
- ScreenCaptureKit (Apple): https://developer.apple.com/documentation/screencapturekit
