# Local Code Review: Phase 8 — ログ・エラー envelope 一貫性 (#11)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: エラー envelope 形式 / エラーコード体系 / API クライアント側 envelope 消費 / ログレベル使い分け / 機密漏洩
**Decision**: APPROVE with notes — CRITICAL/HIGH なし。MEDIUM 1 件(env var 名がクライアントレスポンスに漏洩)は Phase 8.x で修正推奨。

## Summary

`apps/api/src/lib/error.ts` の `errorEnvelope` + `AppError` + `onAppError` 三位一体の設計は堅固で、すべての非 200 レスポンスが `{ ok: false, error: { code, message } }` 形式を通る。エラーコードの HTTP ステータス対応も一貫している。Web 側 `api-client.ts` はエンベロープ本文を読まずに HTTP ステータスで分岐する設計で、XSS リスクがなく合理的。ただし以下の課題がある:

1. **MEDIUM**: `assertValidTtlMs` の `publicMessage` に内部環境変数名 `ROOM_TTL_MS` が含まれ、500 レスポンス本文でクライアントに漏洩する。
2. **LOW**: CLAUDE.md の envelope 契約が Phase 7 追加の 3 コード (`UNAUTHORIZED` / `UNPROCESSABLE_ENTITY` / `RATE_LIMITED`) を記載していない。
3. **LOW**: auth/token 失敗時に explicit `logger.warn` + `AppError(with logContext)` が二重ログを生む。
4. **LOW**: API テスト 3 ファイルが `ErrorEnvelope` を import せず、`error.code` を `string` 型のローカル型で受けるため、コード値の enum 適合を検証していない。

`console.log` の直接使用はすべて `logger.ts` ラッパーに集約されており、`noConsole` policy 違反は production コードに存在しない。スタックトレース・IP・パスワード・認証トークンはすべてサーバーサイドログにのみ残り、クライアントレスポンスに漏れていない。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1: `assertValidTtlMs` の publicMessage が環境変数名 `ROOM_TTL_MS` をクライアントに露出する**

- **Location**: `apps/api/src/services/room-service.ts:81`
- **Issue**: 現在のメッセージ:
  ```typescript
  throw new AppError(500, 'INTERNAL', 'Server is misconfigured: invalid ROOM_TTL_MS', { ttlMs });
  ```
  `AppError` の第三引数 `publicMessage` は `onAppError` で `err.message` として `c.json(errorEnvelope(err.code, err.message), ...)` へそのまま渡される(error.ts:97)。結果、HTTP 500 のレスポンスボディに:
  ```json
  { "ok": false, "error": { "code": "INTERNAL", "message": "Server is misconfigured: invalid ROOM_TTL_MS" } }
  ```
  が返り、内部環境変数名 `ROOM_TTL_MS` がクライアントに漏洩する。設定ミスはサーバー起動時か初回リクエスト時にしか発生しないため攻撃可能性は低いが、インフラ詳細情報の漏洩に当たる。
- **Suggested Fix**: publicMessage をジェネリックにし、詳細を logContext に押し込める:
  ```typescript
  throw new AppError(500, 'INTERNAL', 'Internal server error', { cause: 'invalid ROOM_TTL_MS', ttlMs });
  ```

### LOW

**L1: CLAUDE.md の envelope 契約が Phase 7 追加の 3 エラーコードを未記載**

- **Location**: `CLAUDE.md:92`
- **Issue**: CLAUDE.md の API conventions には:
  > codes `INVALID_REQUEST` (400), `UNSUPPORTED_MEDIA_TYPE` (415), `PAYLOAD_TOO_LARGE` (413), `NOT_FOUND` (404), `INTERNAL` (500)
  と 5 コードのみ記載されている。実際には `error.ts:8-21` に Phase 7 で追加した `UNAUTHORIZED` (401) / `UNPROCESSABLE_ENTITY` (422) / `RATE_LIMITED` (429) の 3 コードが存在し、8 コード体系が正とする。CLAUDE.md の記述は陳腐化している。新規セッションの Claude Code がこのドキュメントを読んで API クライアントを実装すると、3 コードを処理しない実装を生む可能性がある。
- **Suggested Fix**: CLAUDE.md:92 を以下に更新する:
  ```
  codes `INVALID_REQUEST` (400), `UNAUTHORIZED` (401), `PAYLOAD_TOO_LARGE` (413), `NOT_FOUND` (404), `UNSUPPORTED_MEDIA_TYPE` (415), `UNPROCESSABLE_ENTITY` (422), `RATE_LIMITED` (429), `INTERNAL` (500). Defined in `apps/api/src/lib/error.ts`.
  ```
- **Human Friction**: true
  - 改修時必読: yes — CLAUDE.md は Claude Code が新機能を実装する際に必ず読む設定ファイル
  - 再発生コスト: med — 誤ったドキュメントに基づく実装が蓄積するたびにロールバックコストが増える
  - 認知負荷増: yes — コードと CLAUDE.md が矛盾するため、どちらが正しいか読み取るのに時間がかかる

**L2: auth/token 失敗時の二重ログ**

- **Location**: `apps/api/src/routes/rooms.ts:236-237`, `apps/api/src/routes/images.ts:53-54`, `apps/api/src/routes/images.ts:59-64`
- **Issue**: これら 3 箇所は `logger.warn(...)` を明示的に呼んだ直後に `AppError(..., { logContext })` を throw している。`onAppError` は `err.logContext` が存在するとき再度 `logger.warn('app error', { code, status, path, ...logContext })` を出力する(error.ts:89-95)ため、同一イベントが 2 行のログになる。例えば auth 失敗時:
  ```
  [api] auth failed { id: 'abc' }
  [api] app error { code: 'UNAUTHORIZED', status: 401, path: '/rooms/abc/auth', id: 'abc' }
  ```
  冗長だが機能的問題はない。ただし `onAppError` の logContext ログが「いつ出るか」の理解を要求する。一方 `yjs.ts` の同種処理は `c.json(errorEnvelope(...))` で返すため `onAppError` を通らず二重ログは発生しない。パターンが不統一。
- **Suggested Fix**: どちらかに統一する。推奨は AppError の logContext のみに任せて explicit logger.warn を削除(onAppError が必ず出力するため重複が消える):
  ```typescript
  // rooms.ts auth failed の場合
  throw new AppError(401, 'UNAUTHORIZED', 'Invalid password', { id, event: 'auth_failed' });
  // ↑ onAppError が logContext を見て 1 回だけ warn ログを出す
  ```
- **Human Friction**: false
  - 改修時必読: yes — rooms.ts, images.ts はコア hot file
  - 再発生コスト: low — 1 ファイル内の数行削除で解消。既存ログが変わる程度
  - 認知負荷増: no — 二重ログは不快だが原因は明白であり、改修時の理解コストは小さい

**L3: テストファイルの `ErrorBody` ローカル定義が `error.code` を `string` 型で受ける**

- **Location**: `apps/api/src/__tests__/rooms.test.ts:24`, `apps/api/src/__tests__/images.test.ts:26`, `apps/api/src/__tests__/yjs.test.ts:7`
- **Issue**: 3 テストファイルそれぞれが:
  ```typescript
  type ErrorBody = { ok: false; error: { code: string; message: string } };
  ```
  を独自定義し `ErrorEnvelope` / `ErrorCode` を import していない。`code` フィールドが `string` 型なので `expect(body.error.code).toBe('INVALID_REQUEST')` は文字列比較として機能するが、実際に返ってきた code が `ERROR_CODES` の合法コードであることをコンパイラが保証しない。将来コードを rename したとき、テストが偽陽性になる可能性がある。
- **Suggested Fix**: `ErrorEnvelope` を import して型を共有する:
  ```typescript
  import type { ErrorEnvelope } from '../../lib/error';
  const body = (await res.json()) as ErrorEnvelope;
  ```
  これにより `body.error.code` が `ErrorCode` 型になり、typo や廃止コードへの参照をコンパイラが検出できる。
- **Human Friction**: false
  - 改修時必読: no — テストヘルパー型の定義は改修時に必ずしも読む必要はない
  - 再発生コスト: low — 3 ファイルの型定義を import に置き換えるだけ
  - 認知負荷増: no — 動作上の問題はなく、型の弱さは明示的なコメントなしに気づきにくいが改修コストも低い

## Validation Results

| Check | Result |
|---|---|
| 全エラーが envelope 経由か | Pass — すべて `errorEnvelope` / `AppError` → `onAppError` 経路 |
| HTTP status ↔ ErrorCode 対応 | Pass — 400/401/404/413/415/422/429/500 全対応 |
| スタック / パス / IP の client 漏洩 | Pass — server log のみ |
| `console.log` 直接使用 | Pass — production コードは全件 logger モジュール経由 |
| パスワード / トークンの log 出力 | Pass — 明示コメントで排除されている |

## Files Reviewed

| File | Note |
|---|---|
| `apps/api/src/lib/error.ts` | envelope 正本。設計良好。M1 の AppError publicMessage の扱いを確認 |
| `apps/api/src/lib/logger.ts` | noConsole biome-ignore + stale comment (#5 にエスクロー済) |
| `apps/api/src/middleware/rate-limit.ts` | AppError 429 RATE_LIMITED 正常。fail-open ログは error レベルで適切 |
| `apps/api/src/routes/rooms.ts` | L2 の二重ログ確認。全エラーパスが envelope 経由 |
| `apps/api/src/routes/images.ts` | L2 同様。new Response() は 200 のみ |
| `apps/api/src/services/room-service.ts` | M1 の ROOM_TTL_MS 漏洩。metaErr rethrow は AppError なので onAppError で正常処理 |
| `apps/api/src/storage/r2-meta-storage.ts` | R2 エラーを AppError に wrap 済。schema parse エラーも INTERNAL 500 |
| `apps/api/src/yjs.ts` | c.json(errorEnvelope(...)) で直接返す形式。onAppError を経由しないため二重ログなし |
| `apps/api/src/index.ts` | CORS の raw Error throw は onAppError で INTERNAL 500 envelope に変換される |
| `apps/web/src/lib/api-client.ts` | ErrorBody 未使用(HTTP ステータス分岐)。envelope 本文は読まない設計で一貫 |
| `apps/web/src/lib/logger.ts` | noConsole biome-ignore + stale comment (#5 にエスクロー済) |
| `apps/api/src/__tests__/rooms.test.ts` | L3 の local ErrorBody 確認 |
| `apps/api/src/__tests__/images.test.ts` | L3 同 |
| `apps/api/src/__tests__/yjs.test.ts` | L3 同 |
| `CLAUDE.md` | L1: API conventions の envelope 契約が陳腐化 |

## Resolution Update

(Phase 8 は観察のみ。修正は Phase 8.x で別 PR)

---
*Generated: 2026-05-04*
*Reviewer: Claude Sonnet 4.6*
