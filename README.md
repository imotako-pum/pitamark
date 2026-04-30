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

## Versioning

Shared dependencies (typescript, vitest, zod, react, @types/*) are managed via the
[pnpm catalog](https://pnpm.io/catalogs) in `pnpm-workspace.yaml`. Each workspace
references them with `"pkg": "catalog:"`.

> Note: spike code under `spikes/` is excluded from the workspace. To run a spike,
> `cd spikes/<name>` and run `pnpm install` individually.
