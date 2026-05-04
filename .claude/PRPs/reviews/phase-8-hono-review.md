# Local Code Review: Phase 8 — Hono ベストプラクティス (#4)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: `apps/api/src/routes/rooms.ts`, `apps/api/src/routes/images.ts`, `apps/api/src/index.ts`, `apps/api/src/yjs.ts`, `apps/api/src/middleware/rate-limit.ts`, `apps/api/src/lib/bindings.ts`, `apps/api/src/lib/error.ts` (envelope 疎通のみ)、`apps/web/src/lib/api-client.ts`
**Decision**: NEEDS_FIX
  - `syncRoute` が Decisions Log 確定ポリシー違反 (`Hono` + `.use()`) で `hc<AppType>` の型推論に latent damage を与えている (MEDIUM)
  - `hc<AppType>` api オブジェクトが production で全く使用されていない (MEDIUM)
  - `idParamSchema` の重複定義 (LOW)
  - `buildRoomService` 名称衝突 (LOW)
  - CRITICAL / HIGH なし → Phase 9 dogfood ブロックではないが、MEDIUM 2 件を Phase 8.x で対処要

## Summary

`@hono/zod-openapi` 経由のルート定義は `rooms.ts` / `images.ts` で **完全に `createRoute`/`openapi` 駆動** されており、素の `app.get(...)` 残存はない（`/health` と `/api/docs` は intentional 例外）。rate-limit middleware は `createRoute({ middleware: [...] as const })` で宣言されており、Decisions Log 確定ポリシー（`.use()` を routes 層で使わない）を正しく遵守している。

ただし `apps/api/src/yjs.ts` の `syncRoute` は `OpenAPIHono` でなく `Hono` を使い、`.use('/:id', ...)` chain で middleware を組んでいる。`syncRoute` は `routed` に組み込まれており `AppType` に露出するため、`hc<AppType>` 型推論への影響がある。WebSocket upgrade は `hc<AppType>` 経由では呼ばれない設計なので runtime 影響はゼロだが、型整合の観点からポリシー違反として記録する。

`hc<AppType>` の `api` オブジェクト（`api-client.ts:18`）は `export` されているにもかかわらず、production コード（`useImageSource.ts`、`RoomGate.tsx`、`RoomEditor.tsx`）は全て生の `fetch()` を呼んでいる。型推論の恩恵（request/response shape の自動補完）が全く活用されていない状態。

Workers binding (`IMAGES`, `Y_ROOM`, `RL_CREATE_ROOM`, `RL_AUTH`, `RL_SYNC`, `IMAGE_BLOCKLIST`) は `wrangler.toml` の binding 定義と `apps/api/src/lib/bindings.ts` が完全一致しており、アンマッチなし。

エラーパスは `rooms.ts` / `images.ts` / `yjs.ts` すべてで `errorEnvelope()` / `AppError` を経由しており、共通 envelope の疎通は確認できた（format の詳細確認は #11 観点に委ねる）。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1: `syncRoute` が `Hono` + `.use()` chain — Decisions Log ポリシー違反**

- **Location**: `apps/api/src/yjs.ts:73-133`
- **Issue**:
  ```typescript
  export const syncRoute = new Hono<{ Bindings: Bindings }>()
    .use('/:id', async (c, next) => { ... })  // ← .use() chain
    .route('/', yRoute<...>(...));
  ```
  Decisions Log（`snap-share.prd.md` line 402）の確定ポリシーは「ルート middleware 配線は `createRoute({ middleware })` フィールドで宣言、`OpenAPIHono.use()` を chain しない」。`syncRoute` はこのポリシーに違反している。

  理由付けとして「`syncRoute` は WebSocket upgrade 専用なので `hc<AppType>` では呼ばれない」があり得る。実際 `useYjsAnnotationsStore.ts:57` は `new WebsocketProvider(...)` で直接 WS 接続しており、`hc` 経由の型推論は不要。

  しかし `syncRoute` は `index.ts:46` で `routed.route('/sync', syncRoute)` として `routed` に組み込まれ、`export type AppType = typeof routed` に含まれる。`Hono` + `.use()` chain は `hc<AppType>` の型推論において `/sync/:id` パスを `any` に潰す可能性がある（型シグネチャが `OpenAPIHono.openapi()` と異なる）。production 実害はゼロだが、将来 `/sync` ルートを `hc` クライアントで型付けしようとするとき、または `syncRoute` に `.use()` chain を追加するとき、ポリシーの分岐点が不明確になる。

- **Suggested Fix**: 対応は 2 択:
  1. **pragmatic 案** — `syncRoute` の `.use()` chain を `createRoute({ middleware })` に移行する。ただし `yRoute` が `OpenAPIHono.openapi()` と共存できるかを確認する必要がある。
  2. **境界明確化案** — `syncRoute` を `AppType` から除外する（`routed` から外し、`app` に直接 mount）。WS upgrade は `hc` 経由でないため `AppType` に露出させる必要がない。既存の smoke test (`api-client.test.ts`) も `api.sync` を検証していないため影響はほぼゼロ。コメントで「`syncRoute` は WebSocket upgrade 専用で hc 非対象」を明示する。

  境界明確化案が最小変更で意図を最も明確に伝える。

**M2: `hc<AppType>` api オブジェクトが production で全く使用されていない**

- **Location**: `apps/web/src/lib/api-client.ts:18` (宣言)、`apps/web/src/hooks/useImageSource.ts`, `apps/web/src/components/room-gate/RoomGate.tsx`, `apps/web/src/pages/RoomEditor.tsx` (全て生 fetch)
- **Issue**:
  ```typescript
  export const api = hc<AppType>(baseUrl || window.location.origin);
  ```
  `api` オブジェクトは `export` されているが、production コード（3 ファイル）は全て生の `fetch()` を使っている。`createRoom`（line 63: `const res = await fetch('${baseUrl}/rooms', ...)`）、`fetchRoom`（line 87）、`authenticateRoom`（line 111）、`fetchProtectedImage`（line 154）すべてが `api` を使わない。

  `hc<AppType>` を維持している理由は smoke test（`api-client.test.ts`）と将来活用の意図と思われるが、現状は「型推論を壊さないように `createRoute` / `AppType` 設計を維持する」というコストだけがあり、その恩恵（型付き RPC）がゼロの状態。

  追加懸念点:
  - `createRoom` は multipart/form-data で `hc` の typed form client を使えない場面が有る（`fetch` を使う正当な理由の可能性あり）
  - `fetchRoom` / `authenticateRoom` / `fetchProtectedImage` は JSON/binary で `hc` 経由が可能なはずだが、生 `fetch` の手書き実装となっている
  - 将来 API エンドポイントのパスや response schema が変わった場合に `hc` を使っていれば型エラーで検出できるが、現状ではコンパイルエラーにならない

- **Suggested Fix**: 以下のいずれかを明示的に選択:
  1. **`hc` 活用案** — `fetchRoom` / `authenticateRoom` / `fetchProtectedImage` を `api.rooms[':id'].$get(...)` 等に段階移行し、型推論の恩恵を得る。`createRoom` は multipart で別扱いでも可。
  2. **`hc` 削除案** — `api` export と `hc` import を削除し、生 fetch の実装を正式な方針として確定。`AppType` import も削除（bundle には `import type` なので影響なし）。smoke test は削除またはルーティング存在確認の別手段に置換。

  どちらかを Phase 8.x で意思決定すべき。「`hc` は宣言してあるが使っていない」状態は将来の実装者に「なぜあるのか」を調べさせる認知コストを生む。

### LOW

**L1: `idParamSchema` が `rooms.ts` と `images.ts` で重複定義**

- **Location**: `apps/api/src/routes/rooms.ts:21-23`、`apps/api/src/routes/images.ts:11-13`
- **Issue**:
  ```typescript
  // rooms.ts:21
  const idParamSchema = z.object({
    id: z.string().regex(ROOM_ID_REGEX),
  });
  // images.ts:11 — 全く同じ定義
  const idParamSchema = z.object({
    id: z.string().regex(ROOM_ID_REGEX),
  });
  ```
  `ROOM_ID_REGEX` が変更されたとき両方を更新する必要があり、片方の更新漏れで validation ルールの乖離が生じる。DRY 違反。
- **Suggested Fix**: `apps/api/src/lib/schemas.ts` など shared module に `idParamSchema` を export し、両ファイルから import する。
- **Human Friction**: true
  - 改修時必読: yes — `rooms.ts` と `images.ts` はルート変更時に必ず触るファイル
  - 再発生コスト: med — `ROOM_ID_REGEX` 変更時に 1 ファイルを更新漏れしやすい
  - 認知負荷増: yes — 同じスキーマが 2 箇所に存在する理由を実装者が確認しなければならない

**L2: `buildRoomService` が `rooms.ts` と `yjs.ts` で名前衝突・意味が異なる**

- **Location**: `apps/api/src/routes/rooms.ts:46-58`（完全版: `turnstile` / `blocklist` 込み）、`apps/api/src/yjs.ts:61-68`（get 専用: `turnstile` / `blocklist` なし）
- **Issue**:
  同じ名前 `buildRoomService` で異なる deps を渡す 2 つのプライベート関数が存在する。`yjs.ts` 版は `get()` しか呼ばないため `turnstile` / `blocklist` は不要だが、将来誰かが `yjs.ts` に `create()` 相当の処理を追加するとき、deps 不足に気付かない可能性がある。名前が同じで中身が違うため「どちらが正」か判断しにくい。
- **Suggested Fix**: `yjs.ts` 内の関数名を `buildRoomReadService` など用途を明示する名前に変更するか、`rooms.ts` と同じ完全版 deps を渡す（`turnstile`/`blocklist` は optional なので `undefined` 渡しでも動作する）。
- **Human Friction**: false
  - 改修時必読: yes — `yjs.ts` の sync middleware は collab 機能に触れる際に読む
  - 再発生コスト: low — 名前変更 1 箇所、影響ファイル 1 件
  - 認知負荷増: no — 2 関数の差異はコメントで補足できる、runtime の誤動作リスクは低い

## Validation Results

| Check | Result |
|---|---|
| Type check (tsc --noEmit) | Pass (turbo cache hit — 変更なし) |
| Lint (biome ci .) | Pass — 189 files, no fixes applied |
| Build (wrangler dry-run) | Pass (turbo cache hit) |
| E2E | 実行なし (observation-only phase) |

## Files Reviewed

| File | Lines | Note |
|---|---|---|
| `apps/api/src/routes/rooms.ts` | 249 | 重点確認 — createRoute/middleware/envelope |
| `apps/api/src/routes/images.ts` | 100 | createRoute/openapi 駆動確認 |
| `apps/api/src/index.ts` | 57 | AppType 分離設計、.use() CORS 配置確認 |
| `apps/api/src/yjs.ts` | 138 | M1 発見 — Hono + .use() chain |
| `apps/api/src/middleware/rate-limit.ts` | 63 | withRateLimit の MiddlewareHandler 型確認 |
| `apps/api/src/lib/bindings.ts` | 79 | wrangler.toml との binding 照合 |
| `apps/api/src/lib/error.ts` | 107 | envelope 疎通確認 (format は #11) |
| `apps/web/src/lib/api-client.ts` | 171 | M2 発見 — hc<AppType> api 未使用 |
| `apps/web/src/lib/__tests__/api-client.test.ts` | 23 | smoke test 範囲確認 |
| `apps/api/wrangler.toml` | 全件 | binding 定義と Bindings 型の照合 |

## Resolution Update

### Phase 8.x branch `fix/phase-8-x-fixes` (theme 4: quality cleanup)

| Finding | Resolution | Files touched |
|---|---|---|
| **L1** `idParamSchema` 重複 | `apps/api/src/lib/schemas.ts` に集約、`rooms.ts` / `images.ts` から import に切替 | `apps/api/src/lib/schemas.ts` (new) / `apps/api/src/routes/rooms.ts` / `apps/api/src/routes/images.ts` |
| **L2** `buildRoomService` 名前衝突 | `yjs.ts` 内を `buildRoomReadService` にリネーム + コメントで read-only 明記 | `apps/api/src/yjs.ts` |
| **M1** syncRoute `Hono` + `.use()` chain | **Resolved (commit 7)**: 案 B 境界明確化案で解消。`apps/api/src/index.ts` で `routed` から `.route('/sync', syncRoute)` を外し、`app.route('/sync', syncRoute)` として直 mount。`AppType = typeof routed` から `/sync` が消え、Decisions Log の "OpenAPIHono.use() 禁止" policy は AppType に乗る経路にのみ適用される構造になった。`syncRoute` 内部は WS upgrade 専用なので `Hono` + `.use()` のままで OK | `apps/api/src/index.ts` / `apps/api/src/yjs.ts` |
| **M2** `hc<AppType>` 未使用 | **Resolved (commit 7)**: 案 Y 段階移行で解消。`fetchRoom` / `authenticateRoom` / `requestWsTicket` / `fetchProtectedImage` を hc 経由に書き換え、API path / response shape の drift をコンパイル時検出可能に。`createRoom` は multipart のため hc typed client が使えず raw fetch のままだが、コメントで意図明示。`fetchProtectedImage` 用に `images.ts` の `getImageRoute` に optional `authorization` header schema 追加 (server 側はコード変更なし)。Zod safeParse は維持 (hc は型推論のみ runtime 検証なし) | `apps/api/src/index.ts` / `apps/api/src/yjs.ts` / `apps/api/src/routes/images.ts` / `apps/web/src/lib/api-client.ts` / `apps/web/src/lib/__tests__/api-client.test.ts` |

(Phase 8.x で修正された後、Phase 8.x 着手側の Plan/Implement で追記)

---
*Generated: 2026-05-04*
*Reviewer: Claude Sonnet 4.6*
