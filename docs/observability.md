# Observability — snap-share

> Phase 7.5 で確定した dogfood 用観測設計。Phase 8（dogfood & 計測）の合否を
> 後付けにしないために、KPI / SLO / 撤退ライン / `wrangler tail` クエリ集 /
> Cloudflare Web Analytics ダッシュボード設定 / Phase 7 review LOW フォロー
> アップを 1 ファイルに集約する。

## Background

snap-share は個人 OSS / 月額 $0〜$30 で運用する MVP。dogfood は
**「2 週間使って感想を述べる」期間ではなく「事前定義 KPI が実数として
観測されたかを判定する」フェーズ** として走らせる。

外部 APM（Sentry / Datadog / Grafana Cloud）は導入しない。観測手段は
**Cloudflare Web Analytics（cookieless）+ `wrangler tail`** の 2 軸のみ。
Workers Logpush / WAE は dogfood 期間の検証コストに対して過大なので採らない。

## KPIs

dogfood 中（および以降）に追跡する 7 指標。各 KPI は「測定方法」「目標値」
「悪化時の最初に疑う原因」を組にして記録する。

| KPI | 測定方法 | 目標 | 悪化時に疑う |
|---|---|---|---|
| rooms 作成成功率 | `[api] room created` ÷ (`[api] room created` + `[api] app error code=*` 中の `INVALID_REQUEST` / `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` / `UNPROCESSABLE_ENTITY` / `RATE_LIMITED` / `INTERNAL`) | ≥ 99% | バリデーション過剰 / 画像形式想定外 / RL 過剰絞り |
| 画像アップロード成功率 | 上の `INTERNAL` 発生数 | ≥ 99.9% | R2 reachability、`R2 putImage failed` ログ確認 |
| p95 WebSocket RTT | dogfood 中は手動。E2E `room-share.spec.ts` の peer 反映遅延を計測フックとして利用 | ≤ 200ms (同一リージョン) / ≤ 500ms (global) | DO Hibernation 復帰コスト / Yjs ペイロード肥大 |
| Rate Limit ヒット率 | `wrangler tail --search "rate limit hit"` を 24h 集計 | < 1% (オーガニック) | 想定 RL 上限が低すぎる / 攻撃検知 |
| Turnstile fail 率 | `wrangler tail --search "turnstile verify"` の `failed` / `network error` 件数 | < 5% | widget Allowed hostnames 設定漏れ / dev key 混入 |
| 画像 SHA-256 重複率 | `[api] app error code=UNPROCESSABLE_ENTITY` 発生比率（KV ブロックリストヒット） | 0% (dogfood) | 共有素材 / 同一 PR スクショ運用 — 増えれば閾値再評価 |
| 24h 後の room 残存率 | `[api] alarm fired, cleaning up room` ログの発火状況 / TTL 設定値 | TTL = 7d で正常発火 | DO Alarm 動作 / TTL 計算ロジック |

> **計測の前提**: `wrangler tail` は **24h リアルタイムストリーム** で過去ログを
> 遡れない。dogfood 期間中に手動で叩くか、Workers Logpush に積む（後者は有料、
> 本フェーズは前者で運用）。

## SLO and Error Budget

KPI と概念を分離する。**SLO** = 達成すべき水準、**Error Budget** = 許容劣化、
**撤退ライン** = それを割ったら snap-share の継続を再評価する閾値。

### SLO（30 日 rolling）

- rooms 作成成功率 **≥ 99%** — エラーバジェット 1%（30 日で約 7.2 時間連続失敗 = 1% 強）
- p95 WS RTT **≤ 500ms** (global)
- 月額 Cloudflare コスト **≤ $30**

### 撤退ライン（dogfood 終了時の Go / No-Go）

- rooms 作成成功率 **< 95%**（明らかにバグ）
- p95 WS RTT **> 1000ms**（DO Hibernation コストが想定外）
- オーナー自身の自発利用回数 **< 1 回 / 月**（PRD の Success Metric 逸脱、3 ヶ月時点で評価）

> **SLO 違反 = 改修着手** であり、**撤退ライン超過 = 撤退検討**。両者を混同しない。

## Operational Queries

dogfood 期間中に「いま何が起きているか」を 30 秒で判断するためのコマンド集。
prefix `[api]` と `apps/api/src/lib/logger.ts` の structured meta を grep する。

```sh
# 全エラー（[api] prefix で雑に）
wrangler tail snap-share-api --format=pretty

# Rate Limit ヒット (apps/api/src/middleware/rate-limit.ts:39 / yjs.ts:116)
wrangler tail snap-share-api --search "rate limit hit"

# Turnstile siteverify 失敗（apps/api/src/services/turnstile-service.ts:66, 69）
wrangler tail snap-share-api --search "turnstile verify"

# パスワード認証失敗（apps/api/src/routes/rooms.ts:223）
wrangler tail snap-share-api --search "auth failed"

# DO Alarm 発火 = TTL クリーンアップ（apps/api/src/yjs.ts:43）
wrangler tail snap-share-api --search "alarm fired"

# R2 put / get / delete 失敗（apps/api/src/storage/r2-image-storage.ts）
wrangler tail snap-share-api --search "R2 "

# WebSocket upgrade 拒否（apps/api/src/yjs.ts:84-120）
wrangler tail snap-share-api --search "sync ws denied"

# 画像ブロックリスト fail-open（apps/api/src/services/image-blocklist-service.ts:25）
wrangler tail snap-share-api --search "blocklist KV"

# room created 単体（成功率の分子）
wrangler tail snap-share-api --search "room created"

# JSON モードで jq 解析
wrangler tail snap-share-api --format=json | jq 'select(.outcome == "ok") | .logs[]'
```

> `--search` は plain text grep（正規表現は不可）。複合条件は `--format=json`
> で受けて `jq` するのが速い。

### ログの structured meta

| ログ | meta | 出所 |
|---|---|---|
| `[api] rate limit hit` | `route`, `ip` (redactIp 済み) | middleware/rate-limit.ts:39 |
| `[api] app error` | `code`, `path`, `status` | lib/error.ts:90 |
| `[api] room created` | `id`, `key`, `protected`, `bytes` | services/room-service.ts:174 |
| `[api] auth failed` | `id` | routes/rooms.ts:223 |
| `[api] alarm fired, cleaning up room` | `id` | yjs.ts:43 |
| `[api] turnstile verify failed` | `codes` (siteverify error-codes) | services/turnstile-service.ts:66 |
| `[api] R2 putImage failed` | `key`, `contentType`, `err` | storage/r2-image-storage.ts:25 |

## Web Analytics Dashboard

Cloudflare ダッシュボード → Analytics → Web Analytics → 対象サイト で確認する。
SPA な dogfood 規模では **標準ダッシュボードの 4 ビュー** に絞り、カスタム
イベントは追加しない。

| ビュー | 用途 | dogfood で見る理由 |
|---|---|---|
| **Page Views per day** | 月間 PV / 利用頻度 | PRD Success Metric「月間 UU 100」の素朴な代理指標 |
| **Top Referrers** | 共有 URL を踏まれた経路 | snap-share の URL がどこから踏まれているか（1 次配信元） |
| **Device split** | デスクトップ / タブレット / モバイル | PRD「タブレット閲覧」の Should 要件検証 |
| **Country** | 日本以外からのアクセス比率 | スパムの 1 次インジケータ。海外アクセスが急増したら Turnstile / RL を疑う |

> **cookieless beacon の精度限界**: 同一人物の 2 デバイスを別 UU として数える。
> 「UU 100」を機械的に判定基準にせず、相対変化のシグナルとして扱う。

### 設定手順（記録目的）

1. dashboard.cloudflare.com → Analytics → Web Analytics → "Add a site"
2. Hostname: `snap-share.pages.dev`（カスタムドメインを使うなら両方）
3. 発行された token (`d3cf...` 形式) を控える
4. Cloudflare Pages の build env に `VITE_CF_ANALYTICS_TOKEN=<token>` を投入
5. `apps/web/index.html` の inline script が beacon を `static.cloudflareinsights.com/beacon.min.js` から非同期ロード（Phase 7.5 D1 で sanitize 化済み）

## Follow-ups

dogfood 中に観測して判断する項目。本フェーズ（7.5）ではコード変更しない。

### LOW-3: Turnstile widget の poll 5s 上限

- **発見元**: Phase 7 review LOW-3
- **対象**: `apps/web/src/components/turnstile/TurnstileWidget.tsx:52` の `attempts > 50`（100ms × 50 = 5s で諦めて `error-callback`）
- **観測クエリ**: `wrangler tail --search "turnstile verify network error"` を週次集計
- **トリガー**: 週 5 件以上 `network error` が観測された場合
- **対応案**: `attempts > 100`（10s）に拡張、または `<script onload>` でロード完了を待ってから render
- **理由**: dogfood で `script async defer` の 5s 内ロードが本当に達成されているかを実環境で計測してから判断する

### LOW-4: WS upgrade の token query string が `wrangler tail` ログに残る

- **発見元**: Phase 7 review LOW-4
- **対象**: `apps/web/src/hooks/useYjsAnnotationsStore.ts:55-59` の `params: { token }` → `apps/api/src/yjs.ts:90` で `c.req.query('token')` で受ける WS upgrade 経路
- **観測手順**: dogfood 開始時に `wrangler tail snap-share-api --format=pretty` を 1 セッション流し、`/sync/:id?token=...` のクエリ文字列が tail に出るかを目視確認
- **トリガー**: tail で token が露出していた場合
- **対応案**: `Sec-WebSocket-Protocol` ヘッダ経由に切り替え。`apps/api/src/yjs.ts` で `c.req.header('sec-websocket-protocol')` から token を抽出する変更と、`apps/web/src/hooks/useYjsAnnotationsStore.ts` の WebsocketProvider 設定で `protocols: [token]` を渡す変更が必要
- **理由**: 即時切替するか dogfood で実害（token の半永久ログ残存）を観測してから判断するかは、Cloudflare ログのリテンションと監査要件次第

### Phase 8 follow-up リスト（GitHub Issue 起票候補）

dogfood 中に必要が顕在化したら `phase-8-followup` ラベルで Issue 化する候補：

- LOW-3 / LOW-4 の対応
- カスタム Web Analytics イベント（`/r/:id` 遷移時の room creation event 等）
- Workers Logpush の検討（30 日リテンションが必要になった場合）
- `[api]` ログから「クリティカルメトリクス」を抽出してダッシュボード化する自動化
- 月額コスト超過時のアラート（CF Billing API 経由）
- `apps/web/e2e/room-mobile.spec.ts` の Linux snapshot 生成（Phase 7.5 では darwin 用のみ commit。CI Linux 上で `UPDATE_SNAPSHOTS=1 pnpm exec playwright test --update-snapshots` を一度走らせ `landing-mobile-mobile-chrome-linux.png` を生成して commit する）

## See also

- PRD Phase 7.5: [.claude/PRPs/prds/snap-share.prd.md](../.claude/PRPs/prds/snap-share.prd.md)
- Phase 7 review (LOW-1〜4 の発見元): [.claude/PRPs/reviews/phase-7-public-launch-review.md](../.claude/PRPs/reviews/phase-7-public-launch-review.md)
- README デプロイ章: [../README.md#production-deploy](../README.md#production-deploy)
- ログ実装: [apps/api/src/lib/logger.ts](../apps/api/src/lib/logger.ts)
