# snap-share

> 画像にハイライト・吹き出し・矢印・テキストをオーバーレイし、URL一発で共同編集できる、日本語ファーストの軽量Webアプリ。

See [PRD](./.claude/PRPs/prds/snap-share.prd.md) for the product context.

## Repository layout

| Path | What |
|---|---|
| `apps/web` | Vite + React 19 + Tailwind v4 frontend (`pnpm dev` → http://localhost:5173) |
| `apps/api` | Hono on Cloudflare Workers (`wrangler dev` → http://localhost:8787/health) |
| `packages/shared` | Zod-driven SSOT for types and pure utilities |
| `spikes/` | Phase 0 reference implementations (kept for reference, not part of the workspace) |
| `docs/spikes/REPORT.md` | Phase 0 spike findings |

## Local development

```sh
pnpm install
pnpm dev          # starts apps/web and apps/api in parallel via turbo
pnpm test         # vitest across packages
pnpm test:e2e     # playwright (Chromium only for now)
pnpm lint         # biome ci
pnpm typecheck    # tsc --noEmit across the repo
```

Node 22+ and pnpm 10 (managed via `packageManager`) required.

## API (Phase 2)

`apps/api` (Hono on Cloudflare Workers) exposes the following endpoints. The R2
binding `IMAGES` (`wrangler.toml`) is in-memory under `wrangler dev` — no real
bucket is required for local development. Bucket creation for production is
deferred to Phase 7.

### `POST /rooms` (multipart/form-data, field `image`)

Creates a room and stores the uploaded image in R2.
Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`.
Max size: 10 MiB.

```sh
curl -F "image=@cat.png" http://localhost:8787/rooms
# → 201
# {
#   "id": "V1StGXR8_Z5jdHi6B-myT",
#   "createdAt": 1714435200000,
#   "ttlMs": 604800000,
#   "image": {
#     "key": "rooms/V1StGXR8_Z5jdHi6B-myT/image.png",
#     "contentType": "image/png",
#     "size": 12345
#   }
# }
```

### `GET /rooms/:id`

Returns the room metadata stored under `rooms/{id}/meta.json` in R2.

```sh
curl http://localhost:8787/rooms/V1StGXR8_Z5jdHi6B-myT
# → 200 (same JSON as above)
```

### `GET /rooms/:id/image`

Streams the original image from R2 with the recorded `Content-Type` and `ETag`.

```sh
curl -o out.png http://localhost:8787/rooms/V1StGXR8_Z5jdHi6B-myT/image
# → 200 image/png
```

### Error envelope

All failures return `{ ok: false, error: { code, message } }` with one of these
codes: `INVALID_REQUEST` (400), `UNSUPPORTED_MEDIA_TYPE` (415),
`PAYLOAD_TOO_LARGE` (413), `NOT_FOUND` (404), `INTERNAL` (500).

```sh
curl -F "image=@README.md" http://localhost:8787/rooms
# → 415
# { "ok": false, "error": { "code": "UNSUPPORTED_MEDIA_TYPE", "message": "..." } }
```

> Phase 2 keeps no rate limiting, password protection, or TTL enforcement —
> those land in Phase 5/7. Real R2 bucket creation and Cloudflare Pages
> deployment land in Phase 7.

## Versioning

Shared dependencies (typescript, vitest, zod, nanoid, @hono/zod-validator,
react, @types/*) are managed via the [pnpm catalog](https://pnpm.io/catalogs)
in `pnpm-workspace.yaml`. Each workspace references them with `"pkg": "catalog:"`.

> Note: spike code under `spikes/` is excluded from the workspace. To run a spike,
> `cd spikes/<name>` and run `pnpm install` individually.
