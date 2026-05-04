# Local Code Review: Phase 8 — security (#13)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: CSP / HSTS / セキュリティヘッダー / Turnstile / Rate Limiting 三層 / 入力検証 / パスワードハッシュ / JWT トークン / R2-KV-DO 権限境界 / CORS / 機密情報管理 / OWASP Top 10 web 該当項目
**Decision**: APPROVE with notes — CRITICAL なし。HIGH 2 件（WS token が URL query param 経由で露出 / HSTS に `preload` ディレクティブ欠如）。MEDIUM 1 件（#11 M1 の ROOM_TTL_MS 内部名クライアント漏洩、#11 と cross-reference）。LOW 3 件。Phase 8.x で HIGH 2 件から着手推奨。

## Summary

Phase 7 で実装された三層スパム対策（Workers Rate Limiting + Cloudflare Turnstile + SHA-256 blocklist）、PBKDF2-SHA256 によるパスワードハッシュ、HS256 JWT ルームトークン、CORS allowlist、CSP ヘッダーを横断的に確認した。

防御の厚みは個人開発の MVP として水準以上であり、以下は良好:
- R2 バケット (`IMAGES`) は image 系と meta 系を同一バケット内に収めつつ、key prefix (`rooms/{id}/image.*` / `rooms/{id}/meta.json`) でデータ種別を論理分離している。バケット自体はパブリックではなく Workers バインディング経由のみでアクセスされ、最小権限の原則に対応している。
- CORS allowlist は `wrangler.toml [vars]` 駆動で prod / dev を分離、suffix ワイルドカード（`*.snap-share.pages.dev`）は `https://` 限定でダウングレード攻撃を防いでいる。
- Turnstile の secret は `wrangler secret put` / `.dev.vars` 経由で管理、`BYPASS_TURNSTILE=false` がデフォルト設定として `wrangler.toml` に明示されている。
- Rate Limit は IP キー（rooms-create / sync）と `roomId:IP` 複合キー（rooms-auth）で適切に設計されており、fail-open は意図的でログ可視。
- `constantTimeEqual` による PBKDF2 比較でタイミング攻撃を防止している。
- SVG の `Content-Disposition: attachment` でインライン script 実行を防止している。
- パスワード・トークン・ハッシュ全文はログに出ない（`protected: !!auth` boolean フラグ、`sha256Prefix` 8 文字のみ）。

一方で以下の懸念が残る:

1. **HIGH**: WebSocket 接続時の JWT ルームトークンが URL query param (`?token=JWT`) 経由で渡され、Cloudflare Workers のアクセスログ・ブラウザ履歴・Referer ヘッダーに平文で残る。コードコメント「Never log the token; only tokenPresent」でロガー側の配慮はあるが、URL 自体がログに残るリスクを防ぎ切れていない。
2. **HIGH**: `Strict-Transport-Security` に `preload` ディレクティブが欠如している。HSTS Preload List への登録は任意だが、組み込むことで中間者攻撃のウィンドウを消せる。
3. **MEDIUM** (cross-ref #11 M1): `assertValidTtlMs` の publicMessage に環境変数名 `ROOM_TTL_MS` がそのまま含まれ、HTTP 500 レスポンスボディでクライアントに漏洩する。#11 review で M1 として既に記録済み。本軸でも情報漏洩観点から re-flag する。
4. **LOW**: `script-src` / `style-src` に `'unsafe-inline'` が常時許可されており、nonce ベース CSP に将来移行する際の障壁になる（Phase 8 follow-up として _headers コメントに記載済み）。
5. **LOW**: `connect-src` が `https:` と `wss:` と過度に広く、CF API origin 以外への XHR/WS 接続も許可してしまう。
6. **LOW**: `ROOM_TOKEN_SECRET` に対するランタイムの最小長チェック（Min 32 bytes）が実装されておらず、ドキュメント (`bindings.ts` JSDoc) でのみ言及される。

PBKDF2 の反復回数 (100,000) は OWASP 2023 推奨 (600,000) を大幅に下回るが、Cloudflare Workers の Web Crypto API 上限が 100,000 であり、Argon2 は Web Crypto 未実装のため現時点で Workers 上での改善余地がない。Decisions Log に「Workers 上限制約」として明記することを LOW finding で推奨する。

## Findings

### CRITICAL
None.

### HIGH

**H1: WebSocket JWT ルームトークンが URL query param 経由で露出する**

- **Location**: `apps/api/src/yjs.ts:88-90`
- **Issue**: 保護ルームへの WebSocket 接続時、JWT ルームトークンを URL query param `?token=<JWT>` として送信している:
  ```typescript
  // WebSocket cannot send Authorization headers — token rides as a query
  // param. Never log the token; only `tokenPresent`.
  const token = c.req.query('token');
  ```
  コード側では明示的に token をロガーに渡していないが、Cloudflare Workers のリクエストログ（`wrangler tail`）には URL フルパスが自動的に記録される。また、ブラウザのアドレスバーには WebSocket 接続 URL が表示されず、JavaScript コードが直接接続しているが、ブラウザのネットワークタブ・プロキシログ・Referer ヘッダー（TLS 内で保護されるが forward proxy 環境では露出）に JWT が平文で残る。`apps/web` 側のどこかで URL に `?token=<JWT>` を組み立てているが、その接続を知っている第三者にとってトークン奪取の攻撃面になる。
  JWT の TTL は 24 時間（`TOKEN_TTL_SEC = 86400`）のため、奪取された場合の影響期間は長い。
- **Suggested Fix**: WebSocket は升格（HTTP → WS upgrade）の際に HTTP ヘッダーを含めて送信できない（多くのブラウザで `Authorization` ヘッダーを WS upgrade に付与できない）という制限はあるが、以下の代替案を検討する:
  1. **Ticket パターン（推奨）**: 専用エンドポイント `POST /rooms/:id/ws-ticket` で短命（30 秒有効）の使い捨てワンタイムトークンを発行し、それを `?ticket=<short-lived>` で送信する。サーバー側で DO or KV に ticket を保存し、使用後削除。JWT のような長命 token を URL に乗せるよりリスクが低い。
  2. **First-message サブプロトコル**: WS upgrade 後の最初のメッセージで認証情報を送る（`Sec-WebSocket-Protocol` 利用または独自のハンドシェイク）。`y-durableobjects` ライブラリとの整合が必要。
  3. **短命 JWT**: `TOKEN_TTL_SEC` を現在の 24h から 5〜15 分に短縮し、定期的に REST 経由で更新する。URL 露出の影響期間を最小化できるが、根本的な解決ではない。

**H2: HSTS に `preload` ディレクティブが欠如している**

- **Location**: `apps/web/public/_headers:19`
- **Issue**: 現在の設定:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```
  `preload` ディレクティブが欠如している。`.claude/rules/web/security.md` の推奨値:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  ```
  `preload` がないと HSTS Preload List（Chrome / Firefox / Safari がバンドルするブラウザ組み込みの HTTPS 強制リスト）に登録できず、ユーザーが初めてサイトにアクセスするとき（または HSTS キャッシュが切れたとき）に HTTP で接続され、HTTPS にリダイレクトされる前の短いウィンドウで中間者攻撃（SSL stripping）が可能になる。`snap-share.pages.dev` は Cloudflare Pages のため HTTPS 運用は保証されており、`preload` の追加は運用コスト少で有効。
- **Suggested Fix**: `_headers` の HSTS 行に `; preload` を追加し、[hstspreload.org](https://hstspreload.org) でドメインを登録申請する:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  ```
  なお、`preload` の登録は取り消しに数ヶ月かかるため、サブドメイン全体を HTTPS で運用できる確信がある場合のみ実施する。`snap-share.pages.dev` は Pages のため基本的に問題ない。

### MEDIUM

**M1: `assertValidTtlMs` の publicMessage が環境変数名 `ROOM_TTL_MS` をクライアントに露出する（#11 M1 cross-reference）**

- **Location**: `apps/api/src/services/room-service.ts:81`
- **Cross-reference**: #11 error envelope review の M1 と同一 finding。当軸では「内部インフラ情報の漏洩」観点で re-flag する。
- **Issue**: `AppError(500, 'INTERNAL', 'Server is misconfigured: invalid ROOM_TTL_MS', { ttlMs })` の第三引数（publicMessage）がそのままレスポンスボディに含まれ、攻撃者が Cloudflare Workers の環境変数名 `ROOM_TTL_MS` を知ることができる。設定ミスはサーバー起動時か初回リクエスト時にしか発生しないため即時悪用リスクは低いが、インフラ詳細の漏洩に当たる。
- **Suggested Fix**: publicMessage をジェネリックにし、詳細を logContext のみに収める:
  ```typescript
  throw new AppError(500, 'INTERNAL', 'Internal server error', {
    cause: 'invalid ROOM_TTL_MS',
    ttlMs,
  });
  ```

### LOW

**L1: `script-src` / `style-src` の `'unsafe-inline'` が常時有効で nonce 移行の障壁になる**

- **Location**: `apps/web/public/_headers:18`
- **Issue**: 現在の CSP:
  ```
  script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com;
  style-src 'self' 'unsafe-inline';
  ```
  `'unsafe-inline'` は XSS 攻撃で注入されたインライン script / style を実行してしまう。`index.html` にある CF Web Analytics の bootstrap script（inline `<script>` block）が `unsafe-inline` を要求している点は _headers コメントに記載済み。Tailwind v4 が class layer ordering のために inline `<style>` を emit する点も記載済み。将来 nonce ベース CSP に移行するには Vite ビルドプラグインとの連携が必要で、Phase 8 follow-up 扱いとなっている。
  本 finding は「認識済みの技術的負債」として記録するものであり、Phase 8 comment の引き継ぎ確認。
- **Suggested Fix**: Phase 8.x で以下を検討する:
  1. CF Web Analytics の bootstrap script をモジュールスクリプトへ移行 (`type="module"` + 動的 import により CSP nonce が不要になる場合がある)
  2. Vite の `vite-plugin-html-inject-csp` 等で nonce を自動注入し `'unsafe-inline'` を削除する
  3. Tailwind v4 の `inline-styles` 出力を制御して `style-src` の `'unsafe-inline'` を `'nonce-...'` に切り替える
- **Human Friction**: true
  - 改修時必読: yes — `_headers` はセキュリティポリシーの中心で、CSP 変更時に必ず読む
  - 再発生コスト: high — Vite ビルドパイプラインと Tailwind の両方を変更する設計変更
  - 認知負荷増: yes — コメントで「Phase 8 follow-up」と書かれているが、実際のアクションアイテムが不明確で次のエンジニアが再調査するコストがある

**L2: `connect-src` の `https:` / `wss:` が過度に広く、任意の外部 origin への接続を許可している**

- **Location**: `apps/web/public/_headers:18`
- **Issue**: 現在の CSP:
  ```
  connect-src 'self' https: wss:;
  ```
  `https:` はすべての HTTPS オリジンへの XHR/fetch を許可する。本来、接続先は `VITE_API_URL`（API サーバー）と `wss://VITE_API_WS_URL`（WebSocket）の 2 origin のみで十分のはず。`https:` の過広許可により、XSS が発生した場合に攻撃者が任意の外部サーバーへデータを exfiltrate する際の CSP バイパスが容易になる。Cloudflare Pages の静的サイトでは `VITE_*` 変数はビルド時に確定するため、特定 origin を allowlist することができる。
- **Suggested Fix**: production ビルド時に実際の API origin を connect-src に明記する:
  ```
  connect-src 'self' https://snap-share-api.example.workers.dev wss://snap-share-api.example.workers.dev;
  ```
  Cloudflare Pages の build env 変数と Vite のビルド時置換を組み合わせて `_headers` を動的生成する、または手動で production origin を固定する。`wss:` も同様に `wss://snap-share-api.example.workers.dev` に絞る。
- **Human Friction**: false
  - 改修時必読: yes — セキュリティポリシーファイル
  - 再発生コスト: med — origin が変わるたびに更新が必要だが、変更箇所は 1 行
  - 認知負荷増: no — `https:` が広いことは明らかで、改修時に迷わない

**L3: `ROOM_TOKEN_SECRET` の最小長チェック (Min 32 bytes) がランタイムで未実施**

- **Location**: `apps/api/src/lib/bindings.ts:14` (JSDoc のみ), `apps/api/src/services/token-service.ts`
- **Issue**: `ROOM_TOKEN_SECRET` が 32 bytes 未満でも HS256 署名は成功するが、短いシークレットは brute-force 攻撃に脆弱になる。現在は `bindings.ts` の JSDoc に「Min 32 bytes」と明記されているのみで、ランタイムでの長さ検証はない。運用ミスでシークレットが短く設定されても、起動時エラーが発生せず見逃されるリスクがある（ただしテスト helper の `DEFAULT_ROOM_TOKEN_SECRET` は意図的に 37 chars で設定されており、テスト側の配慮は見られる）。
- **Suggested Fix**: `createTokenService` または `issueRoomToken` の先頭でランタイム検証を追加する:
  ```typescript
  export const createTokenService = (deps: TokenServiceDeps): TokenService => {
    if (deps.secret.length < 32) {
      throw new Error('ROOM_TOKEN_SECRET must be at least 32 bytes');
    }
    // ...
  };
  ```
  これにより、本番デプロイで短いシークレットが設定されていた場合に最初のリクエスト時点で確実に fail-closed になる。
- **Human Friction**: false
  - 改修時必読: no — token-service.ts は token 系機能変更時のみ読む。セキュリティ設定変更で必ず通る箇所ではない
  - 再発生コスト: low — 3-5 行の追加で解消、既存テストへの影響も最小
  - 認知負荷増: no — JSDoc の「Min 32 bytes」と実装の gap は存在するが、文脈から理由は明白

---

## Supplementary Observations (副次的観察)

以下は本軸の主観点ではないが、セキュリティ横断で観察した事項を記録する。修正は主観点 review で扱う。

### PBKDF2 反復回数と OWASP 水準

`PBKDF2_ITERATIONS = 100_000` は OWASP 2023 推奨の 600,000 を大幅に下回る。ただし、Cloudflare Workers の Web Crypto API 上限が 100,000 であり（`password.ts:14` にコメント済）、Argon2 は Web Crypto に未実装であるため Workers 上では改善余地がない。この制約は `password.ts` コメントに詳細記載済みで認識されている。Decisions Log に「PBKDF2 100k は Workers 制約上の上限値、2026 年時点の OWASP 水準に対する既知のギャップ」として明記しておくと Phase 8 以降で再評価しやすい。

### WS token URL 露出への対処コメント

`yjs.ts:88-89` に「Never log the token; only tokenPresent」と適切なコメントがある。アプリケーションレベルのロガー配慮は正しいが、Cloudflare Workers のプラットフォームレベルのアクセスログ（`wrangler tail` に表示される HTTP method + URL + status + latency）には URL が記録されることへの言及がない。H1 の修正時にこの側面もコメントに追記すると良い。

### R2 バケット分割の権限境界

Image と Meta を同一 R2 バケット (`IMAGES`) で管理しているが、key prefix で論理分離されており、コード上でクロスアクセス（image key に meta prefix が使われるなど）は確認されない。バケットを分離すれば binding レベルでの最小権限が実現できるが、個人開発 MVP 規模では過剰分離であり、現状は許容範囲内。

### `.env.development` の git 追跡

`apps/web/.env.development` は git 追跡されており、`VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA`（Cloudflare 公式の dev test key、always-passes、機密性なし）のみが含まれる。コメントに「safe to commit」と明記されており、実際のシークレットは含まれていない。Decisions Log にも同方針が記載されている（`apps/web/.env.production` を commit しない選択）。これは false positive として除外する。

### SVG XSS ベクトルへの対処

`GET /rooms/:id/image` で `image/svg+xml` の場合に `Content-Disposition: attachment` を設定している（`images.ts:89-90`）。これにより SVG をブラウザで直接開いたときの inline script 実行が防止されており、設計は正しい。また CSP の `img-src 'self' blob: data: https:` により `<img>` タグ経由での SVG 表示は許可されるが、SVG の script タグは `img` 要素内では実行されないため安全。

---

## Validation Results

| Check | Result | Notes |
|---|---|---|
| CSP ディレクティブ一覧（default/script/style/img/font/connect/frame/object/base-uri） | Pass — 全 9 種類設定済 | script-src/style-src の `unsafe-inline` は L1 で記録 |
| HSTS `max-age=31536000; includeSubDomains` | Pass | `preload` 欠如は H2 で記録 |
| X-Content-Type-Options: nosniff | Pass | |
| X-Frame-Options: DENY | Pass | |
| Referrer-Policy: strict-origin-when-cross-origin | Pass | |
| Permissions-Policy: camera=(), microphone=(), geolocation=() | Pass | |
| Turnstile widget config（sitekey / callback / error-callback） | Pass | |
| Turnstile server-side verify（5s timeout / error-codes to log のみ） | Pass | |
| BYPASS_TURNSTILE 本番 default false | Pass | wrangler.toml:78 で明示 |
| Rate Limit 三層（RL_CREATE_ROOM / RL_AUTH / RL_SYNC） | Pass | fail-open の意図は明示 |
| BYPASS_RATE_LIMIT 本番 default false | Pass | wrangler.toml:84 で明示 |
| Zod 入力検証（全 endpoint） | Pass | uploadFormSchema / authBodySchema / idParamSchema |
| パスワード定数時間比較（constantTimeEqual） | Pass | |
| パスワードのログ出力防止 | Pass | `protected: !!auth` boolean のみ |
| JWT HS256 / expiration / sub_mismatch 検証 | Pass | |
| JWT replay 対策（jti/nonce） | N/A — stateless JWT 設計、ルームは 7 日 TTL + revocation なし | 許容範囲内（room TTL で自然消滅）|
| CORS allowlist（prod / dev 分離、https 限定 suffix） | Pass | |
| R2 bucket 最小権限（Workers binding のみ、パブリックアクセスなし） | Pass | |
| KV IMAGE_BLOCKLIST 書き込み from Workers | Pass — 読み込み専用、書き込みは wrangler CLI のみ | |
| `.env.production` を git commit していないか | Pass — gitignored、Decisions Log に記載 |
| `.dev.vars` を git commit していないか | Pass — gitignored（E2E 自動生成で disk に存在するが追跡外） |
| `TURNSTILE_SECRET_KEY` / `ROOM_TOKEN_SECRET` を logs に出力していないか | Pass — コード検索で確認 |
| SVG XSS 対策（Content-Disposition: attachment） | Pass | |
| 保護ルーム画像の Cache-Control（private, no-store） | Pass | |

## Files Reviewed

| File | 確認内容 |
|---|---|
| `apps/web/public/_headers` | CSP / HSTS / X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy |
| `apps/web/index.html` | inline script の `unsafe-inline` 要因確認 |
| `apps/api/src/middleware/rate-limit.ts` | 三層 RL の実装 / fail-open の設計 / BYPASS_RATE_LIMIT 処理 |
| `apps/api/wrangler.toml` | RL binding 定義 / KV / R2 / DO の binding 権限境界 / secrets コメント / BYPASS フラグのデフォルト |
| `apps/api/src/lib/bindings.ts` | 全 binding の型定義と JSDoc 確認 |
| `apps/api/src/services/room-service.ts` | Turnstile check / blocklist check / M1 漏洩確認 |
| `apps/api/src/lib/password.ts` | PBKDF2 iterations / 定数時間比較 / biome-ignore 合法性 |
| `apps/api/src/services/password-service.ts` | hash / verify の入力バリデーション |
| `apps/api/src/services/turnstile-service.ts` | bypass / secret 空チェック / SiteverifyResponse 処理 / error-codes ログのみ |
| `apps/api/src/services/token-service.ts` | secret 長チェック有無 |
| `apps/api/src/lib/token.ts` | JWT HS256 / TTL / sub 検証 / extractBearerToken |
| `apps/api/src/lib/cors.ts` | parseAllowedOrigins / matchOrigin / https 限定 suffix |
| `apps/api/src/lib/ip.ts` | cf-connecting-ip 優先 / redactIp（GDPR 配慮） |
| `apps/api/src/lib/error.ts` | sanitizePath（ログインジェクション対策）/ M1 cross-ref |
| `apps/api/src/routes/rooms.ts` | Zod 入力検証 / IDOR 対策 / RL middleware 適用 |
| `apps/api/src/routes/images.ts` | JWT 認証ゲート / Cache-Control: private / SVG Content-Disposition |
| `apps/api/src/yjs.ts` | WebSocket token in URL query param（H1）/ RL_SYNC 適用 |
| `apps/api/src/storage/r2-image-storage.ts` | R2 操作の AppError wrap / deleteImage 非 throw 設計 |
| `apps/api/src/storage/r2-meta-storage.ts` | RoomSchema.safeParse による schema 検証 / AppError wrap |
| `apps/api/src/services/image-blocklist-service.ts` | KV read-only / fail-open ログ |
| `apps/api/src/index.ts` | CORS middleware 設定 / fail-closed（空 origin list で例外） |
| `apps/web/src/components/turnstile/TurnstileWidget.tsx` | widget config / invisible mode / error-callback / cleanup |
| `apps/web/.env.development` | git 追跡の確認（公開 dev test key のみで機密情報なし） |
| `apps/api/.dev.vars` | gitignored の確認（E2E 自動生成、機密情報は dummy 値） |

## Resolution Update

(Phase 8 は観察のみ。修正は Phase 8.x で別ブランチ・別 PR に切り出す)

---
*Generated: 2026-05-04*
*Reviewer: Claude Sonnet 4.6*
