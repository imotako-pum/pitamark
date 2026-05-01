# Implementation Report: Phase 5 — パスワード保護 + DO Alarms による TTL

## Summary

`packages/shared` に `RoomAuth` / `RoomStored` / `RoomPublic` の三段スキーマと `toPublicRoom` 変換ヘルパを追加。`apps/api` で Web Crypto PBKDF2-SHA256 (210k iterations) によるパスワードハッシュと Hono `hono/jwt` ベースの HS256 JWT (24h, room-bound) を新設し、`POST /rooms/:id/auth` エンドポイントを追加。`GET /rooms/:id/image` と `GET /sync/:id` (WebSocket) は保護ルームのみ Bearer / `?token=` 必須化。`YDurableObjects` を継承した `SnapShareYDO` を導入し `state.storage.setAlarm(createdAt + ttlMs)` で R2 image+meta + DO storage を自動破棄。`apps/web` 側に `RoomGate` コンポーネントを実装、`RoomEditor` を 4-state machine (`loading | gate | ready | not-found`) に拡張、`LocalEditor` にパスワード保護のオプション UI を追加。secret は `wrangler secret put ROOM_TOKEN_SECRET` (production) / `apps/api/.dev.vars` (local; gitignore 既存対応) で管理。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 7/10 | 7/10 (一致) |
| Files Created | 約 11 | 13 (合致範囲、テスト+plan ドキュメントで +2) |
| Files Updated | 約 9 | 約 22 (lint/format 対象 + 既存テスト群の adapter 拡張で上振れ) |
| Estimated LOC | 1300–1700 | 約 3026 (テスト + plan ドキュメント含むため上振れ; 実装本体は plan 想定範囲内) |
| New tests | 約 35–45 | **74** (api 52 + web 17 + shared 5) |

LOC 上振れの内訳: phase-5 plan ドキュメント自体 (約 870 行)、新規 test ファイル群 (password.test, password-service.test, token.test, auth-storage.test, RoomGate.test) が ~600 行、既存テスト拡張が ~300 行。実装コード本体 (lib/services/routes/yjs/web pages) のみで見ると plan 推定 1300–1700 行に収まっている。

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1–2 | shared schema (RoomAuth/Stored/Public + tests) | ✅ | `RoomSchema = RoomStoredSchema` alias で後方互換維持 |
| 3–5 | api password lib + service + tests | ✅ | PBKDF2 / base64url / constantTimeEqual を pure 関数で分離 |
| 6 | AppError UNAUTHORIZED 拡張 | ✅ | `ErrorCode` union と `AppErrorStatus` の両方拡張、rooms/images route の Zod enum も同期 |
| 7–8 | api token lib + service + tests | ✅ | `hono/utils/jwt/jwt` の `sign`/`verify` をラップ。`extractBearerToken` 補助関数も同モジュールに同梱 |
| 9–10 | bindings + buildEnv 拡張 | ✅ | `ROOM_TOKEN_SECRET: string` 追加。test 用 default は 36 byte のリテラル |
| 11 | room-service password 対応 | ✅ | password が空文字列のときは auth フィールドを付けないシンプルな分岐 |
| 12–13 | rooms route password + auth エンドポイント | ✅ | `POST /rooms/:id/auth` を新規追加。`POST /rooms` の応答を `RoomPublicSchema` に変更 (`toPublicRoom` 変換) |
| 14 | images route Bearer middleware | ✅ | `extractBearerToken` で Authorization: Bearer をパース、保護ルームのみ token verify |
| 15–17 | SnapShareYDO + sync auth + wrangler.toml + index.ts | ✅ | `super.onStart()` を必ず先頭で await、alarm idempotent (R2 missing OK)、migration v2 で `renamed_classes` |
| 16 | r2-meta-storage deleteMeta 追加 | ✅ | alarm cleanup 用。失敗時は warn して `false` 返却 |
| 18–20 | api テスト拡張 (yjs/rooms/images) | ✅ | rooms 12件、images 5件、yjs 4件 (計 21 件) を追加 |
| 21–23 | web api-client + auth-storage + yjs-config 拡張 | ✅ | `authenticateRoom`, `fetchProtectedImage`, sessionStorage ラッパ、`buildSyncUrl` の token 引数 |
| 24 | RoomGate コンポーネント + テスト | ✅ | react-dom/client + happy-dom で軽量レンダリングテスト (testing-library 不採用) |
| 25–28 | web pages/hooks 拡張 | ✅ | RoomEditor 4-state machine、useYjsAnnotationsStore に token 引数、useImageSource に password 引数、LocalEditor のパスワード入力 UI |
| 29 | .gitignore + .dev.vars.example + README | ✅ | `.dev.vars` 既に gitignore 済、`.dev.vars.example` を新規作成 |
| 30 | 全 validation green | ✅ | typecheck / lint (biome ci) / test (247件) / build (vite + wrangler dry-run で `SnapShareYDO` 認識) |
| 31 | PRD ステータス更新 + report 雛形 | ✅ | 本ドキュメント |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ | turbo 4 tasks; tsc --noEmit zero errors |
| Linting (biome ci) | ✅ | 0 errors |
| Unit Tests | ✅ | api 93 / web 140 / shared 14 = **247 件全 pass** (新規 74) |
| Build | ✅ | vite: 702 KB / gzip 214 KB. wrangler dry-run: `env.Y_ROOM (SnapShareYDO)` 認識、migration v2 advertise |
| Integration | ⏭ | DO 実機 alarm は手動 smoke (Plan 通り。`ROOM_TTL_MS=10000` での cleanup 確認は次回 dogfood 時) |
| E2E | ⏭ | 既存 5 件 + RoomGate happy path 1 件は Phase 7 で CI 統合予定 |

## Files Changed

### Created (13)

| File | Purpose |
|---|---|
| `.claude/PRPs/plans/phase-5-password-protection-ttl.plan.md` | Phase 5 implementation plan (本セッションで `completed/` へ archive) |
| `.claude/PRPs/reports/phase-5-password-protection-ttl-report.md` | 本ドキュメント |
| `apps/api/src/lib/password.ts` | PBKDF2 / salt / base64url / constantTimeEqual |
| `apps/api/src/lib/__tests__/password.test.ts` | 14 件 |
| `apps/api/src/lib/token.ts` | HS256 JWT issue/verify + extractBearerToken |
| `apps/api/src/lib/__tests__/token.test.ts` | 7 件 |
| `apps/api/src/services/password-service.ts` | createPasswordService factory |
| `apps/api/src/services/__tests__/password-service.test.ts` | 9 件 |
| `apps/api/src/services/token-service.ts` | createTokenService factory |
| `apps/api/.dev.vars.example` | Local dev secret テンプレ |
| `apps/web/src/lib/auth-storage.ts` | sessionStorage ラッパ |
| `apps/web/src/lib/__tests__/auth-storage.test.ts` | 8 件 |
| `apps/web/src/components/room-gate/RoomGate.tsx` | パスワード入力 UI |
| `apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx` | 5 件 |

### Updated (主要のみ)

| File | Purpose |
|---|---|
| `.claude/PRPs/prds/snap-share.prd.md` | Phase 4 → complete、Phase 5 → in-progress (本セッションで → complete) |
| `packages/shared/src/room.ts` | RoomAuth/Stored/Public スキーマ + toPublicRoom |
| `packages/shared/src/__tests__/room.test.ts` | 5 件追加 |
| `apps/api/src/lib/bindings.ts` | ROOM_TOKEN_SECRET binding |
| `apps/api/src/lib/error.ts` | UNAUTHORIZED / 401 拡張 |
| `apps/api/src/__tests__/helpers/build-env.ts` | DEFAULT_ROOM_TOKEN_SECRET |
| `apps/api/src/storage/r2-meta-storage.ts` | deleteMeta 追加 |
| `apps/api/src/services/room-service.ts` | password 引数対応 |
| `apps/api/src/__tests__/services/room-service.test.ts` | password Deps 注入 |
| `apps/api/src/routes/rooms.ts` | POST password / RoomPublic / POST :id/auth |
| `apps/api/src/routes/images.ts` | Bearer middleware |
| `apps/api/src/yjs.ts` | SnapShareYDO + sync query token |
| `apps/api/src/index.ts` | SnapShareYDO export |
| `apps/api/wrangler.toml` | migration v2 + secret コメント |
| `apps/api/src/__tests__/{rooms,images,yjs}.test.ts` | 21 件追加 |
| `apps/web/src/lib/api-client.ts` | createRoom password / authenticateRoom / fetchProtectedImage |
| `apps/web/src/lib/yjs-config.ts` | buildSyncUrl token 引数 |
| `apps/web/src/lib/__tests__/yjs-config.test.ts` | 3 件追加 |
| `apps/web/src/hooks/useImageSource.ts` | password 引数 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | token 引数 + y-websocket params |
| `apps/web/src/pages/RoomEditor.tsx` | 4-state machine |
| `apps/web/src/pages/LocalEditor.tsx` | password checkbox + input UI |

## Deviations from Plan

| # | Deviation | Why |
|---|---|---|
| 1 | `useYjsAnnotationsStore` は WS URL を `buildSyncUrl(roomId, ..., token)` で組むのではなく、`y-websocket` 標準の `params: { token }` option を使う形に着地 | 当初は手書きで `?token=` を URL に append する経路を試したが、y-websocket は `serverUrl + '/' + roomName` をライブラリ側で結合する仕様で、空 roomName を渡すと trailing slash 問題が発生。`params` option はライブラリが正規の query 形式で encode してくれるため、こちらが安全 |
| 2 | `RoomGate` のテストで `@testing-library/react` を採用せず `react-dom/client` + happy-dom 直叩きで実装 | 既存 web workspace に testing-library が未導入。Phase 5 でデプ追加すると lint/build cache invalidation の波及が大きく、5 件のシンプルなテストには過剰。将来 Phase 6 (UI 仕上げ) で複数コンポーネントテストが必要になったタイミングで再検討 |
| 3 | `images.ts` route の middleware は plan 想定では別 `use(...)` ハンドラだったが、`OpenAPIHono` の chained `.openapi()` が単一ハンドラ前提だったため auth ロジックを handler 本体に統合 | 既存 phase-2 のスタイルと整合。R2 read が 2 回走る最適化余地は Phase 7 へ繰り延べ |
| 4 | `RoomEditor` の `imageState` を `loading | gate | ready | not-found` の 4-state にした上で `ownsObjectUrl` boolean を `ready` 状態にぶら下げた | plan では state 構造を細かく規定していなかった。protected ルーム経由の `URL.createObjectURL` リソースリークを防ぐためクリーンアップ責務を state に持たせる方が安全 |

## Issues Encountered

| # | Issue | Resolution |
|---|---|---|
| 1 | `apps/api/src/lib/password.ts` の `noUncheckedIndexedAccess` 型エラー (ALPHA[a >> 2] が `string | undefined` 推論) | `ALPHA.charAt(idx)` に置換。`charAt` は範囲外でも空文字列を返すため型は常に string |
| 2 | `routes/rooms.ts` と `routes/images.ts` の `ErrorResponseSchema` Zod enum が `lib/error.ts` の ErrorCode と同期されておらず TypeScript narrowing が `'UNAUTHORIZED'` を弾く | 両ファイルの enum に `'UNAUTHORIZED'` を手動同期。長期的には共通スキーマを `lib/error.ts` 側に集約する余地あり (refactor の Phase 7 候補) |
| 3 | `room-service` test stubs が `MetaStorage` interface 拡張 (`deleteMeta`) と `RoomServiceDeps` 拡張 (`password`) の両方で型エラー | 4 callsite に `password: createPasswordService()` を、2 stub に `async deleteMeta() { return true; }` を追加 |
| 4 | biome v2 の `useImportSorter` で RoomGate.tsx の lucide / react / api-client の import 順がエラー | `pnpm exec biome check --write` で auto-fix |
| 5 | Fact-Forcing Gate (gateguard-fact-force.js standard,strict) が全 Write/Edit に発火し、4 項目の Facts 提示を強制 | ECC のお作法として尊重。前セッションでユーザと方針確認済 (バックエンド/フロントエンドで分割コミット) |

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `packages/shared/src/__tests__/room.test.ts` (拡張) | +5 | RoomStoredSchema / RoomPublicSchema / toPublicRoom 変換 |
| `apps/api/src/lib/__tests__/password.test.ts` (新規) | 14 | PBKDF2 deterministic / salt 違い / constantTimeEqual / base64url round-trip |
| `apps/api/src/services/__tests__/password-service.test.ts` (新規) | 9 | hash/verify round-trip / 空 password 拒否 / 256 byte 上限 / unknown algo / corrupt salt |
| `apps/api/src/lib/__tests__/token.test.ts` (新規) | 7 | issue→verify / sub_mismatch / invalid / expired / extractBearerToken |
| `apps/api/src/__tests__/rooms.test.ts` (拡張) | +12 | password 付き作成 / public shape / POST :id/auth (200/401/400/404) |
| `apps/api/src/__tests__/images.test.ts` (拡張) | +5 | 保護ルームの 200/401/wrong roomId-token |
| `apps/api/src/__tests__/yjs.test.ts` (拡張) | +4 | sync の query token 検証 |
| `apps/web/src/lib/__tests__/auth-storage.test.ts` (新規) | 8 | sessionStorage round-trip + 例外耐性 |
| `apps/web/src/lib/__tests__/yjs-config.test.ts` (拡張) | +3 | buildSyncUrl の token 引数 |
| `apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx` (新規) | 5 | render / disabled / 200 success / 401 / network error |

合計 **74 件追加**。既存テスト 173 件と合わせて 247 件全 pass。

## Manual Verification (Pending)

PRD Success Signals に対する手動 smoke は次の dogfood セッションで実施予定:

- [ ] **「パスワード付きルームに正答以外で入れない」**: `pnpm dev` で保護ルーム作成 → 別ブラウザで誤パスワード → RoomGate が「パスワードが違います」を表示 → 正パスワード → 入室 → Awareness 同期動作
- [ ] **「7 日経過後アクセスでルーム消滅確認」**: `apps/api/.dev.vars` で `ROOM_TTL_MS=10000` (10 秒) に一時設定 → 10 秒経過後 `GET /rooms/:id` が 404 / R2 から image+meta 消失を確認 → `wrangler dev` のログに `alarm fired, cleaning up room` 出力を確認

両方とも実装は完了しており、unit test + middleware integration test レベルでは検証済み。実 DO の alarm 発火タイミング検証のみ次セッションに繰り延べ。

## Next Steps

- [ ] 手動 smoke (`ROOM_TTL_MS=10000` での cleanup 確認、保護ルームの 2 タブ挙動)
- [ ] `/code-review` または `/everything-claude-code:code-review` で Phase 5 全体をレビュー
- [ ] `/everything-claude-code:prp-pr` で PR 作成 (本ブランチ `feat/phase-5-password-ttl` → `main`)
- [ ] PR merge 後、Phase 6 (PNG export + UI 仕上げ) の plan 作成 → `/everything-claude-code:prp-plan`

## Notes

### Decisions Log (実装で確定したもの)

| Decision | Choice | Notes |
|---|---|---|
| パスワードハッシュ algo | **PBKDF2-SHA256 / 210k iterations / Web Crypto** | plan 通り。Argon2 WASM の Workers 互換コストを避けて PBKDF2 を採用 |
| Token 形式 | **HS256 JWT (`hono/utils/jwt/jwt`)** | plan の方針通り。`hono/jwt` 直接 import ではなく内部 utils を使うことで型解決が安定 |
| Token TTL | **24h 固定** | ルーム TTL (7 日) より短く、漏洩時影響を制限 |
| WS auth 配送 | **`?token=` query (y-websocket `params` option 経由)** | 自前で URL を組むより library 標準を使う方が encode 安全 |
| Room shape 分離 | **`RoomStored` (auth optional) / `RoomPublic` (protected boolean + 条件付き image)** | plan 通り。`RoomSchema = RoomStoredSchema` alias で既存呼び出し全互換 |
| `MetaStorage.deleteMeta` 戻り値 | **`Promise<boolean>`** (failure は warn して false) | `r2-image-storage.deleteImage` と同形 |
| RoomGate スタイリング | **Tailwind v4 + CSS variables 直接** | shadcn 適用は Phase 6 で再調整 |
| Test rendering for RoomGate | **react-dom/client + happy-dom (no testing-library)** | デプ追加コスト回避、5 件規模なら十分 |

### Implementation Notes

- `hono/utils/jwt/jwt` の `verify` は `JwtTokenExpired` instance で expired を分岐できるため `instanceof` ガードで `expired` reason を切り出している
- `SnapShareYDO.onStart()` は `super.onStart()` を必ず先頭で await。`getAlarm()` で既存 alarm 有無を確認し、未設定時のみ `setAlarm` する idempotent 設計
- `alarm()` は R2 image / meta が既に消えていても安全 (R2 delete は missing OK、`storage.deleteAll` も冪等)。`state.id.name` が undefined のケースは `'<unknown>'` でログだけ残し DO storage wipe を実行
- `apps/web/src/pages/RoomEditor.tsx` の `URL.createObjectURL` は `useEffect` cleanup で `revokeObjectURL` する。トークン更新時の競合状態 (cancelled flag) も対応済み
- Hash / token / password は **どこにもログ出力しない** (`logger.warn('auth failed', { id })` のように boolean / id のみ)

### Future Work (Phase 5 後の検討項目)

- IP-based rate limit + Cloudflare Turnstile (Phase 7 公開準備で本格対応)
- `auth.algo` の bump (Argon2id 切替時の dual-decode 期間)
- TTL 値を Open Question 通り「24h / 7d / オーナー指定」から選ばせる UX (Could スコープ)
- `routes/rooms.ts` と `routes/images.ts` で重複している `ErrorResponseSchema` の集約 (Phase 7 refactor 候補)
- shadcn 適用後の RoomGate / LocalEditor パスワード UI の再調整 (Phase 6)

---

*Generated: 2026-05-01 (resumed session)*
