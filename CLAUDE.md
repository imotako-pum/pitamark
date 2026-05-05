# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication language

このリポジトリでは **日本語ファースト** で書くことを原則とする。

| 対象 | 言語 |
|---|---|
| ユーザー (Claude Code) との対話 | 日本語 |
| コミットメッセージ | Conventional Commits の `type(scope):` プレフィックスは英語、本文・件名の説明部分は日本語 (例: `refactor(phase-5): code-review の MED-2 を解消`) |
| PR タイトル / 本文 | 日本語 (チェックリストの `- [ ]` などの記号は維持) |
| 生成ドキュメント (`.claude/PRPs/` 配下の prd / plan / report / review) | 日本語 |
| コードコメント | **日本語**。`biome-ignore` の reason / JSDoc の説明文も日本語。識別子・linter rule ID・JSDoc タグ (`@param` `@returns` 等)・`TODO(phase-XX-X):` プレフィックスは英語維持。WHY のみ書く (WHAT は識別子で表現)。3 行以上の解説が必要なら関数分離 or `docs/` へ逃がす。`FIXME` / `HACK` / `XXX` は使わず `TODO(phase-XX-X):` に統一。 |
| 識別子 (変数名・関数名・ファイル名) | 英語 |
| 一次資料からの引用・固有名詞・コード片 | 原文ママ |

例外: 外部公開物 (OSS README の英語版、外部サービス連携時のエラーメッセージなど) は対象読者に合わせて英語を選ぶ。

## Common commands

Run from repo root unless noted. Tasks are turborepo-aware so they fan out across workspaces.

```sh
pnpm install
pnpm dev                                  # apps/web (5173) + apps/api (8787) in parallel
pnpm test                                 # vitest across all workspaces
pnpm test:e2e                             # playwright (chromium only)
pnpm typecheck                            # tsc --noEmit across the repo
pnpm lint                                 # biome ci .
pnpm format                               # biome format --write .
pnpm build                                # vite build (web) + wrangler dry-run (api)

# scope to one workspace
pnpm -F @snap-share/web dev
pnpm -F @snap-share/api test
pnpm -F @snap-share/shared test

# single test file
pnpm -F @snap-share/web test -- src/hooks/__tests__/historyReducer.test.ts

# single playwright test by title
pnpm -F @snap-share/web test:e2e -- -g "renders toolbar"
```

Node 22+ and pnpm 10 are required (`packageManager` pinned in `package.json`).

## Architecture overview

snap-share is a turborepo monorepo. Three workspaces, plus a non-workspace `spikes/` tree for Phase 0 reference implementations:

- **`apps/web`** — Vite + React 19 + Tailwind v4 + Konva editor SPA. Single page (`pages/EditorPage.tsx`) wires `useImageSource` (D&D / paste → ObjectURL), `useAnnotationsStore` (state + history), `useStageSize` and `useKeyboardShortcuts` together. The Konva canvas is split into `ImageLayer` (purely visual, `listening={false}`) and `AnnotationLayer` (dispatches to per-type Shape components based on the discriminated union).
- **`apps/api`** — Hono on Cloudflare Workers with `@hono/zod-openapi`. `OpenAPIHono` is the source of the typed `AppType`; `app.doc31` and Scalar UI are mounted separately so they don't leak into the `hc` client. Routes live under `apps/api/src/routes/`.
- **`packages/shared`** — Zod-driven SSOT. All cross-process types (`RoomSchema`, `AnnotationSchema`, MIME / size constants) live here and are consumed by both `apps/web` and `apps/api` via `workspace:*` (no build step — TypeScript reads `src/index.ts` directly).

### Cross-cutting design rules

These have repeatedly tripped past Claude sessions and are not obvious from individual files:

1. **Annotations are a Zod discriminated union** (`packages/shared/src/annotation.ts`). Add new annotation types by extending the union there first; the web app's reducers and Konva shape dispatcher rely on `switch (a.type)` exhaustiveness with `const _: never = a` checks.
2. **The web store is a single `useReducer`.** `useAnnotationsStore` composes `annotationsReducer` + `historyReducer` inside one reducer so that consecutive `dispatch` calls in the same React render cycle (e.g. `add` → `select/set` from `handleMouseUp`) cannot race. Never re-introduce a wrapper that closes over `state` outside the reducer.
3. **Drag-time mutable values use `useRef`, not `useState`.** `dragStart` / `draft` in `CanvasStage` are refs because `useState` updates aren't flushed before the same click cycle's `mouseup` fires, leaving the handler's closure stale.
4. **Konva does not resolve CSS variables.** All colors passed to Konva (stroke/fill) come from `apps/web/src/components/canvas/colors.ts` as hex literals, kept in sync manually with `apps/web/src/styles/tokens.css`.
5. **`<KonvaImage>` must have `listening={false}`** (and the wrapping `<Layer>` too). Otherwise the image absorbs hit detection and `e.target !== stage` early-returns the annotation handlers.
6. **Catalog-managed deps.** React, Konva, lucide-react, vitest, zod, hono, etc. live in `pnpm-workspace.yaml` under `catalog:` and are referenced as `"pkg": "catalog:"`. Bumping a version means editing the catalog, not individual `package.json` files. **Policy** (Phase 8.x): a dep used in 2+ workspaces MUST be catalog-managed; a dep used in only 1 workspace MAY stay workspace-local but moving it to the catalog is always acceptable when forward-looking sharing is plausible.
7. **`spikes/` is outside the workspace.** It's kept on disk for reference but `pnpm install` ignores it. To run a spike: `cd spikes/<name> && pnpm install`.
8. **Yjs mutators must wrap operations in `doc.transact(fn, LOCAL_ORIGIN)`.** `LOCAL_ORIGIN` is the symbol defined in `apps/web/src/domain/annotation/yjs-mutations.ts` (re-exported from `apps/web/src/lib/yjs-config.ts` to keep symbol identity consistent across imports). The `Y.UndoManager` is configured with `trackedOrigins: new Set([LOCAL_ORIGIN])`, so only local-origin mutations are reversible — remote merges (origin null) are skipped, which is what prevents undo from stealing peers' work.

### TypeScript & Biome quirks

- `tsconfig.base.json` enables `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax`. Type-only imports must use `import type`. Tuples (e.g. Konva's `points: [number, number, number, number]`) must be typed as tuples to avoid `number | undefined`.
- Biome runs in CI and as the formatter. Settings: single quotes (JS) / double quotes (JSX), trailing commas everywhere, semicolons. `noConsole` is `warn` — files that genuinely need `console` (e.g. `apps/web/src/lib/logger.ts`) start with `// biome-ignore-all lint/suspicious/noConsole: ...`.

## Workflow conventions

This repo follows a PRP (PRD → Plan → Implement → Report → Review → PR) workflow with everything under `.claude/PRPs/`:

| Folder | Purpose |
|---|---|
| `.claude/PRPs/prds/` | Product requirements per phase. Phase status table lives in `snap-share.prd.md`. |
| `.claude/PRPs/plans/` | Active plans. Completed plans move to `plans/completed/`. |
| `.claude/PRPs/reports/` | Implementation reports (assessment vs reality, deviations, validation). |
| `.claude/PRPs/reviews/` | Code review artifacts (one per round, `-v2` for re-reviews). |
| `.claude/rules/` | Coding rules layered as `common/` + `{typescript,web,python}/`. Read these before non-trivial work; web-specific rules override common where they overlap. |
| `.claude/PRPs/plans/completed/` | Past plans. Useful as patterns for new plan files. |

Slash commands used regularly: `/everything-claude-code:prp-prd`, `:prp-plan`, `:prp-implement`, `:code-review`, `:prp-pr`. Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, ...) — see `.claude/rules/common/git-workflow.md`.

### umbrella plan vs sub-plan の選択基準 (Phase 8.x で明文化)

親 Phase が複数 sub-step に分かれるとき、Plan の粒度を以下で決める:

- **umbrella plan (1 ファイル)**: sub-step が密結合（前 step の出力 → 次 step の入力 / 同 PR で merge / 単独で価値が出ない）。例: Phase 7.6 manual QA bug recovery、Phase 8 integration review。
- **sub-plan 分割 (`phase-N-{1,2,...}.plan.md`)**: sub-feature が独立に merge 可能 / それぞれ単独で価値を出す。例: Phase 7.7 / 7.8。

### umbrella report の必須化 (Phase 9 以降)

親 Phase が複数 sub-phase に分かれた場合 (例: Phase 7.7-1〜7.7-4)、各 sub-phase report に加えて親 Phase の **umbrella report** を `reports/phase-N-umbrella-report.md` として作成する。内容:

- Phase 全体の Acceptance Criteria 達成度 (table)
- 全 sub-phase の deliverable 概要 + report への link
- Phase 内で発見された未解決事項 / 次フェーズへの引き継ぎ
- 工数 (commit 数 + LOC + duration) の retrospective

Phase 7.7 / 7.8 については retroactive 作成しない (Phase 8 PRD で NOT Building 明示)。Phase 9 以降から適用。

## API conventions

- All failing API responses use the envelope `{ ok: false, error: { code, message } }` with codes `INVALID_REQUEST` (400), `UNAUTHORIZED` (401), `PAYLOAD_TOO_LARGE` (413), `NOT_FOUND` (404), `UNSUPPORTED_MEDIA_TYPE` (415), `UNPROCESSABLE_ENTITY` (422), `RATE_LIMITED` (429), `INTERNAL` (500). Defined in `apps/api/src/lib/error.ts`.
- API response Zod schemas (`RoomCreatedSchema`, `RoomPublicSchema`, `AuthResponseSchema`, ...) live in `packages/shared/src/`, not in `apps/api/src/routes/*`. Web and api workspaces import the same schema so the response contract is single-sourced — server side `parse`s before sending and web side `safeParse`s after receiving. New API response schemas MUST be added to `packages/shared` rather than route-local.
- WebSocket auth uses one-shot 60s tickets (Cloudflare KV minimum `expirationTtl`), not the 24h JWT directly. Web calls `POST /rooms/:id/ws-ticket` with `Authorization: Bearer <jwt>` to exchange the JWT for a 32-hex ticket, then opens `wss://.../sync/:id?ticket=<hex>`. The server consumes the ticket from KV (`WS_TICKETS`) on first use so platform access logs only see the short-lived ticket. JWTs never appear on WS upgrade URLs. Burn-on-consume keeps the effective lifetime to "first WS upgrade" — the 60s ceiling is just the auto-expiry safety net.
- The R2 binding `IMAGES` (`apps/api/wrangler.toml`) is in-memory under `wrangler dev` — no real bucket needed locally. Real bucket creation and Pages deployment land in Phase 7.
- Phase 2 endpoints (`POST /rooms`, `GET /rooms/:id`, `GET /rooms/:id/image`) are documented with curl examples in `README.md`. Auth, rate limiting, and TTL enforcement land in Phase 5/7.
