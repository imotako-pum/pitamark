# ADR-0002: API 通信レイヤとフロントエンドスタックの選定 (2026 モダン構成)

**Date**: 2026-04-30
**Status**: accepted
**Deciders**: imotako (PM/Dev)
**Supersedes**: [ADR-0001](./ADR-0001-orpc-for-room-crud.md)
**Related**: `.claude/PRPs/prds/snap-share.prd.md` / Phase 3 (Yjs + DO) 着手前

---

## Context

Phase 2 (`262b5e3`) で API 側の REST 基盤 (Hono + `@hono/zod-validator` + R2) が完成。Phase 3 で Web クライアント本格実装に入る前に、**クライアント↔サーバ間の通信契約と、それを支えるフロントエンドスタック全体**を確定する必要がある。

ADR-0001 は oRPC 採用を提案したが棄却 (詳細は ADR-0001 の Rejection Note)。本 ADR で 2026 モダン構成として再決定する。

### 制約と前提

| 項目 | 状態 |
|---|---|
| ランタイム (サーバ) | Cloudflare Workers (確定, PRD L147) |
| サーバフレームワーク | Hono v4 (確定, Phase 2 で稼働中) |
| 検証スキーマ | Zod v4 (確定, `packages/shared` が SSOT, PRD L274-275) |
| キャンバスライブラリ | Konva (確定, PRD §技術スタック) |
| リアルタイム同期 | Yjs + Durable Objects (確定, PRD L148) |
| 画像配信 | R2 + バイナリ Response (Phase 2 で稼働中) |
| 想定 API 規模 | Phase 5 まで含めて ~10 エンドポイント |
| 想定クライアント | Web (React SPA) のみ。モバイル/外部 API は将来オプション |

---

## Decision

以下のスタックを採用する:

### サーバサイド

| レイヤ | 採用 | 役割 |
|---|---|---|
| Web フレームワーク | **Hono v4** (継続) | ルーティング・ミドルウェア |
| ルート定義 | **`@hono/zod-openapi`** | Zod スキーマから OpenAPI 3.1 仕様を自動生成、型安全な `c.req.valid()` |
| API ドキュメント UI | **`@scalar/hono-api-reference`** | `/api/docs` に開発者向けドキュメント UI を mount |
| 既存 `@hono/zod-validator` | **共存** | binary/multipart など OpenAPI 化に向かないルートで継続使用可 |
| Yjs 同期 | **Durable Objects + WebSocket** (Phase 3 で実装) | 本 ADR スコープ外 |

### クライアントサイド

| レイヤ | 採用 | 役割 |
|---|---|---|
| UI | **React 19** | RSC は SPA 構成なので未使用。`useOptimistic` / `useTransition` 活用 |
| ビルド | **Vite 6** | dev/build |
| ルーティング | **TanStack Router** | file-based route, 型安全な search params, loader |
| サーバ状態 | **TanStack Query v5** | キャッシュ・prefetch・optimistic update |
| API クライアント | **`hc<typeof app>` from `hono/client`** | サーバの Hono app 型から E2E 型推論 |
| フォーム | **TanStack Form** または React Hook Form | Phase 5 のパスワードフォーム等 |
| 検証 | **Zod v4** (`packages/shared` SSOT) | クライアント側でも parse |
| UI コンポーネント | **shadcn/ui + Tailwind v4** | PRD 確定 |
| キャンバス | **Konva (`react-konva`)** | PRD 確定 |
| CRDT | **Yjs + y-konva** | Phase 3 / 4 |

### データフロー (代表例: Room 取得)

```ts
// shared/api-client.ts
import { hc } from 'hono/client';
import type { AppType } from '@snap-share/api';
export const api = hc<AppType>(import.meta.env.VITE_API_URL);

// queries/rooms.ts
export const roomQuery = (id: string) => queryOptions({
  queryKey: ['room', id],
  queryFn: async () => {
    const res = await api.rooms[':id'].$get({ param: { id } });
    if (!res.ok) throw new Error('failed');
    return res.json();  // 型推論: Room
  },
});

// routes/rooms.$id.tsx (TanStack Router)
export const Route = createFileRoute('/rooms/$id')({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(roomQuery(params.id)),
  component: RoomView,
});
```

---

## Alternatives Considered

### A. 純 `hc` のみ (OpenAPI なし)

- **Pro**: 最小構成、追加依存 0
- **Con**: 外部 API 公開時に OpenAPI を後付けで書く羽目になる。AI エージェント / MCP 連携・モバイル展開の選択肢を狭める
- **却下理由**: 「OpenAPI を無料で得る」効用を放棄するメリットがない。`@hono/zod-openapi` の追加コストは約 1 依存

### B. oRPC

- **Pro**: TS 型安全 + RPC + REST 両対応
- **Con**: ハンドラを Hono ルートから oRPC procedure に書き換える必要、二系統運用 (バイナリは別経路)、学習コストが Yjs+DO 学習を圧迫
- **却下理由**: ADR-0001 で詳細。snap-share の規模・経路で優位性が発動しない

### C. tRPC

- **Pro**: エコシステム成熟
- **Con**: Workers/Hono との統合が二級、TS 限定で OpenAPI 不在 (`trpc-openapi` は別物・メンテ不安定)
- **却下理由**: Workers + Hono 構成では `@hono/zod-openapi` のほうが直球

### D. GraphQL (Apollo / urql / Relay)

- **却下理由**: Workers での実装重量、Zod SSOT を破壊、規模に見合わず

### E. Next.js + Server Actions (フルスタック移行)

- **Pro**: 2026 もモダン、フォーム周りが最強
- **Con**: Cloudflare Workers (PRD 確定) と Next.js Edge ランタイムの相性は改善したが、Hono + R2 + DO のシンプルさを失う。SPA + Workers の構成を捨てる動機が弱い
- **却下理由**: Phase 0/1/2 の技術選定 (PRD 確定事項) を覆す動機がない

### F. Remix / TanStack Start

- **却下理由**: 上記 E と同様。SPA + Workers を維持する判断は PRD 段階で済んでいる

---

## Consequences

### Positive

- **既存 Phase 2 コードの破壊的変更が最小**: `@hono/zod-validator` のルートを `@hono/zod-openapi` 形式に書き換えるだけで Zod スキーマ・サービス層・ストレージ層は無改変
- **OpenAPI が無料で手に入る**: 将来のモバイル / Webhook / 公開 API / AI エージェント連携が低コスト
- **Scalar UI で開発者体験が一段上がる**: PR レビュー時に API の挙動を UI で叩ける
- **TanStack Router/Query との噛み合わせが綺麗**: loader + queryFn + `hc` で型推論が末端まで通る
- **Zod SSOT が更に強化**: サーバ境界検証 → クライアント↔サーバ契約 → 外部公開仕様 (OpenAPI) の 3 層を 1 つのスキーマで賄う
- **二系統運用なし**: 全エンドポイントが Hono のまま統一

### Negative / Trade-offs

- **依存追加 2 つ**: `@hono/zod-openapi`, `@scalar/hono-api-reference`
- **ルート定義の書き方が変わる**: `app.get('/x', ...)` → `app.openapi(createRoute({...}), handler)`。慣れが必要 (1 ルートあたり ~10 行増)
- **画像バイナリ系の OpenAPI 記述は限定的**: `responses: { 200: { content: { 'image/*': {} } } }` 形式で書くが、レスポンスボディの厳密な型表現はできない (実害なし)
- **`hc` の再エクスポート**: `apps/api` から `AppType` を `apps/web` へ型として export する仕組みが必要 (TS Project References もしくは `package.json` の `types` 経由)

### Neutral

- パフォーマンス影響なし (`@hono/zod-openapi` は実行時オーバーヘッド微小、Scalar UI は dev/staging 限定で mount 可能)

---

## Implementation Plan (概略)

Phase 2.5 として PRD に追加する想定。Phase 3 と並行可。

1. **依存追加**: `@hono/zod-openapi`, `@scalar/hono-api-reference`
2. **既存ルート移行** (3 本):
   - `POST /rooms` (multipart) — `@hono/zod-validator` のまま据置 OR zod-openapi の `multipart/form-data` requestBody で書き直す
   - `GET /rooms/:id` (JSON) — zod-openapi へ移行
   - `GET /rooms/:id/image` (binary) — zod-openapi の `responses` で `image/*` を宣言、handler は `Response` 直返し
3. **OpenAPI 仕様 + Scalar UI を `/api/docs` に mount** (本番環境ではフラグ制御)
4. **`apps/api/src/index.ts` から `AppType` を export**
5. **`apps/web` 側で `hc<AppType>` を使う API クライアントを `packages/shared` か `apps/web/src/lib` に配置**
6. **テスト**: 既存 `apps/api/src/__tests__/` は無改変で通る想定 (HTTP リクエストレベルのテストなので)
7. **CI**: OpenAPI 仕様を build 時に書き出して `docs/api/openapi.json` にコミット (将来の差分レビュー用)

---

## Validation / Acceptance

この ADR を accepted に昇格させる前に確認する事項:

- [ ] `@hono/zod-openapi` の最新版が Cloudflare Workers ランタイムで動作することの最小スパイク (1 ルート移行)
- [ ] `hc<typeof app>` がモノレポの workspace 経由で `apps/web` に型を流せることの確認
- [ ] PRD §Implementation Phases に **Phase 2.5: API モダン化 (`@hono/zod-openapi` + `hc` 配線)** を追加し pending 状態にする
- [ ] スパイク中に重大な障害が出た場合は本 ADR を superseded に倒し、純 `hc` (Alternative A) にフォールバック

---

## References

- ADR-0001 (棄却): `./ADR-0001-orpc-for-room-crud.md`
- PRD: `.claude/PRPs/prds/snap-share.prd.md`
- Phase 2 実装: `apps/api/src/routes/rooms.ts`, `apps/api/src/routes/images.ts`, `apps/api/src/index.ts`
- `@hono/zod-openapi`: https://hono.dev/examples/zod-openapi
- TanStack Router: https://tanstack.com/router/latest
- TanStack Query: https://tanstack.com/query/latest
- Scalar API Reference: https://github.com/scalar/scalar
