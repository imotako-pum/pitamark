# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
6. **Catalog-managed deps.** React, Konva, lucide-react, vitest, zod, etc. live in `pnpm-workspace.yaml` under `catalog:` and are referenced as `"pkg": "catalog:"`. Bumping a version means editing the catalog, not individual `package.json` files.
7. **`spikes/` is outside the workspace.** It's kept on disk for reference but `pnpm install` ignores it. To run a spike: `cd spikes/<name> && pnpm install`.

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

## API conventions

- All failing API responses use the envelope `{ ok: false, error: { code, message } }` with codes `INVALID_REQUEST` (400), `UNSUPPORTED_MEDIA_TYPE` (415), `PAYLOAD_TOO_LARGE` (413), `NOT_FOUND` (404), `INTERNAL` (500). Defined in `apps/api/src/lib/error.ts`.
- The R2 binding `IMAGES` (`apps/api/wrangler.toml`) is in-memory under `wrangler dev` — no real bucket needed locally. Real bucket creation and Pages deployment land in Phase 7.
- Phase 2 endpoints (`POST /rooms`, `GET /rooms/:id`, `GET /rooms/:id/image`) are documented with curl examples in `README.md`. Auth, rate limiting, and TTL enforcement land in Phase 5/7.
