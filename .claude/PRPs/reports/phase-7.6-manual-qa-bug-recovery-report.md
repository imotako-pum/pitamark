# Implementation Report: Phase 7.6 — 手動 QA + バグ回収 + E2E 強化

> **Status**: in-progress（手動 QA 進行中 / 既知-1 fix 済 / 既知-2,3 未着手）
> **Branch**: `feat/phase-7.6-manual-qa-bug-recovery`
> **Last Updated**: 2026-05-03

## Summary

Phase 7.5 で「コード上は本番投入可能」「runbook 完備」「E2E 5 spec 緑」まで完了したが、本番 smoke を踏み始めた時点でバグが 3 件即座に検出された（既知-1〜3）。Phase 7.6 は (A) Track A 実機オペの完了確認、(B) 網羅的な手動 QA で全バグを GitHub Issue 化、(C) 検出した全バグを `re-produce spec → fix → 緑` の TDD で hotfix、(D) 再発防止のため対応する E2E spec を `apps/web/e2e/` に追加して CI で永続的にロックする。

## Phase A — Track A 実機オペ完了確認

### A1 — 本番 API `/health` 200 確認 ✅

```sh
curl -i https://snap-share-api.imotako13pumpkin.workers.dev/health
# HTTP/2 200
# {"ok":true,"service":"snap-share-api","ts":1777789863164}
```

### A2 — 本番 Web URL の TLS / CSP / HSTS 確認 ✅

| ヘッダ | 値 |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

CORS preflight も `https://snap-share.pages.dev` に対して `204 + Access-Control-Allow-Origin` で正常応答。

### A3 — Pages Build env 確認 ✅

production / preview 両方に 5 変数（`VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` / `VITE_PUBLIC_URL`）投入済。preview 側に誤りがあったため修正してリビルド済。

### A4 — Turnstile Allowed hostnames ✅

`snap-share.pages.dev` がリストに含まれることを確認。

---

## Phase B — 網羅的な手動 QA（手動 QA チェック表）

> 各セルは ✅ / ❌ / `issue #N` を記入。検出バグは下の「検出バグ表」に追記。

### B1 — A7-1（通常ルーム経路）

| # | チェック項目 | Chrome | Safari | Firefox | iOS Safari | Android Chrome |
|---|---|---|---|---|---|---|
| 1 | ランディング描画（見出し / dropzone / toolbar） | | | | | |
| 2 | beacon.min.js が 200 OK | | | | | |
| 3 | response headers に CSP / HSTS が乗る | | | | | |
| 4 | 画像 D&D で表示される | | | | | |
| 5 | URL が `/r/<21文字>` に変わる | | | | | |
| 6 | 矩形ツールで描画できる | | | | | |
| 7 | PNG 保存ボタンでダウンロードできる | | | | | |
| 8 | 別ブラウザで同 URL 開くと画像が見える | | | | | |
| 9 | A 側で矩形描画 → B に 1 秒以内に反映 | | | | | |
| 10 | paste 経由で画像投入 | | | | | |
| 11 | 画像差し替え（**ランディング画面のみの仕様 / ルーム内では新ルーム作成で対応**） | | | | | |
| 12 | 注釈 4 種（矩形 / 矢印 / テキスト / ハイライト） | | | | | |
| 13 | Undo / Redo が想定通り動く | | | | | |
| 14 | 共有 URL のコピーボタン | | | | | |
| 15 | awareness（カーソル / 選択）の出退室 | | | | | |

### B2 — A7-2（パスワード保護経路）

| # | チェック項目 | Chrome | Safari | Firefox | iOS Safari | Android Chrome |
|---|---|---|---|---|---|---|
| 1 | 「パスワードで保護する」チェックが見える | | | | | |
| 2 | チェックを直接 click でき、入力欄が出る | **既知-2** | | | | |
| 3 | パスワード入力できる | | | | | |
| 4 | 画像ドロップで `/r/<id>` 遷移 | | | | | |
| 5 | 別ブラウザでパスワードゲート画面 | | | | | |
| 6 | 誤答で「パスワードが違います」エラー | | | | | |
| 7 | 正答でエディタ入室 / 画像表示 | | | | | |
| 8 | 退室 → 再アクセスでゲート再表示 | | | | | |

### B3 — A7-3（PNG エクスポート 4 組み合わせ）

| 組み合わせ | Chrome | Safari | Firefox | iOS Safari | Android Chrome |
|---|---|---|---|---|---|
| 公開ルーム × 送信側 | | | | | |
| 公開ルーム × 受信側 | **既知-1**（fix 済 / 要再検証） | | | | |
| パスワード保護 × 送信側 | | | | | |
| パスワード保護 × 受信側 | | | | | |

PNG 検証完了条件: 「保存された PNG を開いて元画像 + 注釈の焼き込みまで確認」

### B4 — デバイス × OS マトリクス

| デバイス | OS | ブラウザ | B1 | B2 | B3 | 備考 |
|---|---|---|---|---|---|---|
| デスクトップ | macOS | Chrome | | | | |
| デスクトップ | macOS | Safari | | | | |
| デスクトップ | macOS | Firefox | | | | |
| デスクトップ | Windows | Chrome | | | | (任意) |
| モバイル | iOS | Safari | | | | |
| モバイル | Android | Chrome | | | | |
| タブレット | iPadOS | Safari | | | | (任意) |

物理端末がない場合は Chrome DevTools の Device emulation で代替可（その旨をセルに記入）。

### B5 — 観測項目の確認（A8 / A9）

A7 操作中に別ターミナルで `pnpm wrangler tail snap-share-api --format=pretty` を流して以下が出ることを確認:

- [ ] `[api] room created { id: '...', ... }`
- [ ] パスワード保護ルームで誤答時 `[api] auth failed { id: '...' }`
- [ ] パスワード保護ルームで正答時 `[api] auth success { id: '...' }`
- [ ] Rate Limit を意図的に踏むと `[api] rate limit hit`
- [ ] Turnstile 認証 `[api] turnstile verify success`（`failed` が出る場合は A4 設定漏れ）
- [ ] Web Analytics: 24h 後に PV / Top Referrers / Country / Device が反映

---

## Phase C — 検出バグ表

| # | Severity | 状態 | issue # | 再現経路 | fix commit | 対応 E2E spec |
|---|---|---|---|---|---|---|
| 既知-1 | High | ✅ Fixed (本番未反映) | - | 公開ルーム × 受信側 PNG エクスポートで tainted canvas | `57bcc1a` | `apps/web/e2e/room-export-receiver.spec.ts` |
| 既知-2 | High | ✅ Fixed (本番未反映) | - | password 保護パネルが Toolbar の下に隠れて click できない | (本 commit) | `apps/web/e2e/landing-password-toggle.spec.ts` + `room-protected.spec.ts` 経路復元 |
| 既知-3 | Medium | ✅ Fixed (本番未反映) | - | 「画像をクリア」ボタンが注釈のみ削除（ラベルと挙動が不一致） | (本 commit) | `apps/web/e2e/room-clear-image.spec.ts` |
| 既知-4 | High | ✅ Fixed (本番未反映) | - | password 設定時の画像 D&D が本番/preview で 500 INTERNAL（localhost は通る）。`NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported (requested 210000)` — Workers (workerd) の Web Crypto 実装の上限。ローカル `wrangler dev` (miniflare) は Node Web Crypto なのでこの制限が無く本番でだけ落ちた | (本 commit) | api unit test の assertion を `>= 210k` → `= 100k` に変更してロック。E2E は既存の `room-protected.spec.ts` がカバー（password 経路を真の本番条件で踏むのは Phase E1 後の clean run） |

### Decisions Log

- **既知-3 の挙動方針**: **(a)** ラベルを実挙動に合わせる で確定。`Toolbar.tsx` の label を「画像をクリア」→「注釈をすべて削除」に変更。アイコンは既存の個別削除（`Trash2`）と区別するため `ImageMinus` → `Eraser`（消しゴム）を採用。`ConfirmClearAllDialog.tsx` のタイトル「ルーム内の注釈をすべて削除しますか？」は元から実挙動と一致しているため現状維持。
- **既知-2 の修正方針**: panel の z-index を上げる（案 a）ではなく、配置を `top-4` → `top-16` に下げる（案 b）を採用。Toolbar (`absolute inset-x-0 top-0 z-10`) との z-index 競合を消すためで、両者の重なり自体が無くなる方が visual にもクリーン。
- **room-protected.spec.ts のクリック経路復元**: Phase 7.5 の keyboard 迂回（focus + Space）は既知-2 fix の前提を曖昧にするため、**直接 click に戻し** て pointer-events 通過を実証する形に変更。actionability check を bug シグナルとして扱う運用へ。
- **Firefox / WebKit プロジェクト追加**: TBD（B4 結果次第）

### Follow-ups (Phase 7.6 スコープ外)

- **`room-share.spec.ts` の flakiness**: ローカルで 1 発実行すると Yjs 同期の `waitForFunction` が稀に 5_000ms タイムアウトする（リトライで通る）。CI では `retries: 2` で吸収されているが、根本原因（Yjs DO のリージョンレイテンシ / WebSocket 初期化レース）は Phase 8 dogfood で観測してから判断。

---

## Why existing E2E missed these bugs

| # | バグ | 既存 E2E が拾えなかった理由 | 補強策 |
|---|---|---|---|
| 既知-1 | cross-origin tainted canvas | dev サーバーは web/api 共に `localhost` で **same-origin** のため canvas が tainted せず `toBlob` が成功してしまう。本番の `pages.dev` ↔ `workers.dev` で初めて発覚 | `page.route` で API レスポンスを別 origin に書き換える `room-export-receiver.spec.ts`（commit `57bcc1a`） |
| 既知-2 | password panel が Toolbar に隠れる | Playwright の `intercepted by another element` エラーを **テストの flakiness と誤診断**して `room-protected.spec.ts` で **focus + Space のキーボード経路に迂回** したため、pointer-events 遮断のバグがそのまま本番に流出 | 直接 click する `landing-password-toggle.spec.ts` を新規追加して pointer-events 通過を担保（C7） |
| 既知-3 | 画像クリアのラベル不一致 | そもそも spec が存在しない。仮にあっても「ボタン押下 → 状態変化」を assert する形になるので **ラベルと挙動の UX 整合性は機械的 assertion の対象外**。人間の手動 QA でしか拾えない | C8 で確定する方針に応じた `room-clear-image.spec.ts` を新規追加（C10）。ただしラベル/UX 整合性は引き続き手動 QA で補う |

### 一般化した E2E の死角

1. **same-origin 前提**: localhost:5173 ↔ localhost:8787 では cross-origin 起因のバグが漏れる
2. **機能の有無のみ assert / UX 整合性は対象外**: ラベル不一致や視覚的階層の崩れは人間 QA でしか捕まらない
3. **`intercepted by another element` を flaky と誤診断する誘惑**: ほぼ常に本物の bug。キーボード迂回で隠蔽すると本番で発覚する（既知-2 の root cause）
4. **chromium + mobile-chrome (Pixel 5) のみ**: Safari / Firefox / iOS Safari / Android Chrome 固有の挙動は catch できない（Task D2 で Firefox/WebKit 追加判断する根拠）
5. **本番デプロイ後の smoke 経路が無い**: pages.dev 固有の CSP / CORS / Pages Build env の検証は手動。Phase 7.6 では Phase A (A1〜A4) として明示化
6. **miniflare (wrangler dev) と本番 workerd の runtime divergence**: Web Crypto 上限（PBKDF2 100k）など、本番 workerd 固有の制限はローカル E2E では再現しない（既知-4 の root cause）。Phase 8 follow-up で「**production smoke spec**」(本番 URL を直接叩く E2E) の検討余地あり

---

## Phase D — E2E カバレッジ差分

| Phase | 件数 | spec |
|---|---|---|
| Phase 7.5 完了時点 | 5 | landing / room-create / room-share / room-protected / room-mobile |
| Phase 7.6 既知-1 fix 後 | 9 | + room-export-receiver / annotation-tools / keyboard-shortcuts / dropzone-validation |
| Phase 7.6 既知-2,3 fix 後 | 11 | + landing-password-toggle / room-clear-image |

### room-mobile Linux snapshot 整備

- 状態: TBD（Task D1）

### Firefox / WebKit プロジェクト追加

- 状態: TBD（Task D2 — B4 結果次第）

---

## Phase E — 検収ゲート

- [ ] E1: 本番再デプロイ（既知-2 / 既知-3 fix 後）
- [ ] E2: clean run の手動 QA 再走（B 章 2 周目で全 ✅）
- [ ] E3: CI E2E 緑（chromium + mobile-chrome）
- [ ] E4: 本 report 完成
- [ ] E5: PRD ステータス更新

---

## Phase 8 dogfood Go/No-Go 判断

TBD（E2 完了時点で記載）

判断材料:
- 検出バグが全件 close されているか / Phase 8 送りでも許容できる Severity か
- B4 マトリクスでブロッキングするブラウザ依存バグが無いか
- 観測ログが期待通り流れているか
