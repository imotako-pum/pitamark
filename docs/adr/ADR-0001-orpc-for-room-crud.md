# ADR-0001: Room メタデータ CRUD への oRPC 導入と REST/WS 併用

**Date**: 2026-04-30
**Status**: rejected — superseded by [ADR-0002](./ADR-0002-hono-zod-openapi-tanstack-stack.md)
**Deciders**: imotako (PM/Dev)
**Related**: `.claude/PRPs/prds/snap-share.prd.md` (Phase 2 完了時点) / Phase 3 (Yjs + Durable Objects) 着手前

---

## Rejection Note (added 2026-04-30)

このドラフト執筆中に以下の見落としが判明したため棄却:

1. **`hono/client` (`hc`) を Alternatives に入れていなかった** — Hono 同梱・追加依存ゼロ・移行ゼロで E2E 型安全が得られる
2. **`@hono/zod-openapi` を Alternatives に入れていなかった** — REST + OpenAPI 自動生成 + Scalar UI を Hono のままで取れる
3. **アプリ規模 (Phase 5 まで含めて API 10 本程度) に対し oRPC はオーバーエンジニアリング**
4. **画像バイナリ系の REST 据置を理由に「二系統運用」を Negative に挙げていたが、`@hono/zod-openapi` を選べば二系統化自体を回避できる**

ADR-0002 で `@hono/zod-openapi` + `hc` + TanStack Router/Query スタックを採用。

ECC 学習メモ: 「ドラフトを書いてみたら採用案が崩れた」は ADR の正常系。proposed → rejected は失敗ではなく、ADR を書く目的そのもの (頭の中だけで決めずに紙に出すと穴が見える)。

---

## Context

Phase 2 (画像アップロード基盤) が `main` にマージされ (`262b5e3`)、API は以下の REST 3 エンドポイントで稼働中:

| Method | Path | 役割 | 形式 |
|---|---|---|---|
| `POST` | `/rooms` | 画像 1 枚を受け取って Room を作成 | `multipart/form-data` |
| `GET` | `/rooms/:id` | Room メタを返す | JSON |
| `GET` | `/rooms/:id/image` | 画像バイナリを返す | binary + ETag/`content-disposition` |

実装スタック:

- Hono on Cloudflare Workers (PRD §技術スタック L147)
- `@hono/zod-validator` でリクエスト検証
- `packages/shared` の Zod v4 スキーマを SSOT として利用 (PRD L275)
- 画像は R2、メタは R2 の `meta/` プレフィックスに JSON で保存

Phase 3 で Yjs + Durable Objects + Web クライアント本格実装に入る。**ここがクライアント↔サーバ間の通信契約をどう敷くかの分岐点**であり、後で増えてからの転換コストは大きい (現状 2 ファイル, 3 ハンドラ vs Phase 3 以降は Web 側コンシューマが多数生える)。

**問題**: Web クライアントは現状未実装のため、いま手書き `fetch` ラッパー + 手書き型を量産する設計に倒すか、最初から型安全な RPC レイヤを敷くかを選べる。Yjs 同期はこのレイヤと別経路 (WebSocket via DO, PRD L148) なので影響しない。

---

## Decision

**Phase 3 着手前に oRPC を導入する。ただし全エンドポイントを oRPC 化はしない。**

| 経路 | 採用形式 | 理由 |
|---|---|---|
| Room メタ CRUD (`POST /rooms`, `GET /rooms/:id`) | **oRPC** | Web クライアントとサーバが同一モノレポ・同一 TS、Zod SSOT が既にある — oRPC が最も効く構成 |
| 画像配信 (`GET /rooms/:id/image`) | **REST 据置** | バイナリ + `content-type` / `content-disposition` / `ETag` のカスタムヘッダ制御を `Response` で直接書ける、RPC エンベロープに通すと旨味なし |
| 画像アップロード (`POST /rooms`) | **REST 据置** (oRPC 化検討は要再評価) | `multipart/form-data` の `File` ハンドリングは oRPC でも可能だが、現行 `zValidator('form', ...)` で十分機能している。型のうま味が薄い |
| Yjs 同期 | **WebSocket (DO)** | ADR スコープ外。Phase 3 の独立経路 |

実装方針:

1. `@orpc/server` の Hono アダプタで既存 `app.route` 構成を破壊しない形で差し込む
2. `packages/shared` の Zod スキーマを oRPC の入出力定義にそのまま流用 (SSOT 維持)
3. クライアントは `@orpc/client` で型推論を効かせる
4. 画像エンドポイント 2 本は今のまま `apps/api/src/routes/images.ts` / `routes/rooms.ts` (POST 部分) に残す

---

## Alternatives Considered

### A. REST 続行 (現状維持)

- **Pro**: 追加依存ゼロ。Phase 2 までの既存テストが無改変
- **Con**: Web クライアントで手書き `fetch` + 手書き型 (または OpenAPI 生成) が必要。SSOT である Zod 型から導出される TS 型を、クライアント実装側で再度入出力アサートする手間が継続的に発生
- **却下理由**: クライアント実装ボリュームが Phase 3 以降に集中する。今やらないと負債が雪だるま式に増える

### B. oRPC ハイブリッド ★採用

(上記 Decision)

### C. tRPC

- **Pro**: エコシステム成熟、ドキュメント豊富
- **Con**: Cloudflare Workers / Hono との統合が薄く、HTTP セマンティクス (REST 併用) との混在運用に追加レイヤが要る。Workers ランタイムでの本番運用事例が oRPC より少ない
- **却下理由**: Hono アダプタの一級サポートがある oRPC のほうがスタック的に素直

### D. GraphQL

- **Pro**: フィールド単位の取得最適化
- **Con**: スキーマ二重管理 (Zod + GQL SDL)、Workers での実装重量級、現状エンドポイント 3 本に対しオーバースペック
- **却下理由**: 規模に見合わず SSOT 戦略 (Zod 単一) を破壊する

### E. 全面 oRPC 化 (画像配信も RPC エンベロープに通す)

- **Con**: バイナリストリーム + キャッシュヘッダ制御で `Response` を直接いじる現行実装の利点 (`obj.writeHttpMetadata`, `etag`, `nosniff`, SVG 強制ダウンロード) を失う
- **却下理由**: 抽象化のための抽象化になる。YAGNI

---

## Consequences

### Positive

- Web クライアント (Phase 3 以降) で Room メタ操作の型推論が完全に効く
- Zod SSOT の射程が「サーバ境界検証」から「クライアント↔サーバ契約」まで広がる
- バイナリ系は REST のままなので、ブラウザ標準の `<img src>` / 直接 fetch / キャッシュヘッダ挙動が無傷
- Phase 3 の WebSocket (Yjs sync) とは経路が独立しているため衝突しない

### Negative / Trade-offs

- 依存追加 (`@orpc/server`, `@orpc/client`)
- API 経路が **二系統 (RPC + REST)** になる。新規開発者向けのオンボーディング文書で区別を明示する必要あり
- 既存の `apps/api/src/__tests__/rooms.test.ts` は Hono リクエストレベルで書かれているため、oRPC ハンドラ側のテストヘルパーを別途用意 (in-memory R2 ヘルパーは流用可)
- oRPC のバージョニング戦略 (将来の breaking change) を別途決める必要あり — Phase 3 着手後に追加 ADR で決定

### Neutral

- パフォーマンス影響は無視できる (oRPC は HTTP/JSON ベースで素の REST と同等オーダー)

---

## Validation / Acceptance

この ADR を accepted に昇格させる前に確認する事項:

- [ ] oRPC の Hono アダプタで `Bindings` (`c.env.IMAGES` 等) が型を保ったまま透過するかの最小スパイク (1 ハンドラ)
- [ ] `packages/shared/src/room.ts` の `RoomSchema` が oRPC の `input/output` にそのまま使えるかの確認
- [ ] PRD §Implementation Phases に **Phase 2.5: oRPC migration for Room CRUD** を追加し `pending` 状態にする

スパイク結果がネガティブだった場合は本 ADR を `superseded` にして案 A (REST 続行) に倒す。

---

## References

- PRD: `.claude/PRPs/prds/snap-share.prd.md`
- Phase 2 実装: `apps/api/src/routes/rooms.ts`, `apps/api/src/routes/images.ts`, `apps/api/src/index.ts`
- Phase 2 plan: `.claude/PRPs/plans/completed/phase-2-image-upload.plan.md`
- Phase 2 report: `.claude/PRPs/reports/phase-2-image-upload-report.md`
- oRPC: https://orpc.unnoq.com/
