# Plan: Phase 8.x — Phase 8 統合レビュー 37 finding の段階的修正 (1 PR / 5 commit)

## Summary

Phase 8 統合レビュー (`reports/phase-8-integration-review-report.md`) で抽出された **HIGH 7 + MEDIUM 21 + LOW (Human Friction=true) 9 = 37 finding** を、`fix/phase-8-x-fixes` 1 ブランチ / 1 PR / 5 commit で全件解消する。Phase 9 dogfood の Conditional Go 条件 (security + perf を Phase 9 開始前に解消) を満たし、TS 6 upgrade 等の高リスク変更は最終 commit に隔離して、詰まったら `git reset HEAD~1` で剥がせる構造にする。LOW (HF=false) 36 件は backlog (Phase 9 後再判断)、frozen archive は touch しない。

## User Story

As a snap-share オーナー兼コードベース保守者,
I want Phase 8 で抽出された 37 finding を 1 PR で段階的に commit して全件 close したい,
So that Phase 9 dogfood の Go condition (CRITICAL 0 + 主要 HIGH 解消) を満たし、片務的 SSOT (#1)・bundle 圧迫・JWT URL leak・E2E hatch の prod 漏洩・stale Phase コメントといった構造的弱点を一掃して、コードベースを「個人開発の MVP として水準以上」から「次フェーズ開始に耐える土台」へ引き上げられる.

## Problem → Solution

### Current (Phase 8 完了 / 本ブランチ branch-out 時点)

- **片務的 SSOT (#1 H1)**: `apps/web/src/lib/api-client.ts:65, 89, 117` で `as RoomCreated` / `as RoomPublic` / `as { token: string }` が runtime parse なしで素通り。`packages/shared` の Zod schema が web 受信側で **import すらされていない**。`refine` (protected ↔ image 排他) もクライアントで未検証。
- **bundle 283.82 KB gz / 予算 300 KB の 94.6% (#10 H1)**: `vite.config.ts` に chunking 設定なし、`React.lazy()` ゼロ件。Konva (~152 KB gz) と Yjs/y-websocket が landing(local mode) でも同期ロード。Vite 自体が 500 KB 超過警告。
- **WebSocket JWT が URL query で wrangler tail に leak (#13 H1)**: `apps/api/src/yjs.ts:90` の `?token=<JWT>` がプラットフォームレベルアクセスログに記録される。JWT TTL 24h で奪取時影響範囲大。
- **HSTS preload 欠如 (#13 H2)**: `apps/web/public/_headers:19` に `preload` ディレクティブなし。
- **E2E hatch が production bundle に焼き込まれる (#5 H1)**: `EditorShell.tsx:244, 251, 257, 268` の 4 つの `useEffect` が `import.meta.env.DEV` ガードなし。`__SNAP_SHARE_TRANSFORM_ACTIONS__` が `fitToViewport` 等の関数を window 経由で外部から呼べる状態。`useYjsAnnotationsStore.ts:106` は同パターンで DEV ガード済み → 非対称が明確。
- **`historyReducer` の `as T` キャスト (#6 H2)**: `:44, 55` が `noUncheckedIndexedAccess` 設計を局所的に裏切る。
- **TypeScript 5.6.3 → 6.0.3 で major 1 つ遅れ (#2 H1)**: 加えて lucide-react `^0.460` (v1 から major 遅れ) と `hono ^4.12` 直書き (catalog 6 違反) が積み残し。

### Desired (Phase 8.x 完了時点)

- **API 境界の Zod parse 完全化** (`api-client.ts` で `RoomCreatedSchema` / `RoomPublicSchema` / `AuthResponseSchema` 経由 + fail-soft network reason)。`AuthResponseSchema` を `packages/shared` に新設して両 workspace 共有。`historyReducer` は `as T` を非 null assertion + 数学的根拠コメントへ。
- **bundle gz ≤ 200 KB 目標** (`vite.config.ts` に `manualChunks: { 'vendor-canvas': [...], 'vendor-yjs': [...] }`、`RoomEditor` を `React.lazy()` boundary に)。`useStageSize` を `ResizeObserver` ベースに統合して resize 二重登録解消。
- **WS JWT ticket 化** (`POST /rooms/:id/ws-ticket` で 30s TTL ワンタイムチケット発行、`?ticket=<short>` で送信)、`_headers` に `; preload` 追加、`AppError(500, INTERNAL, 'Internal server error', { cause: 'invalid ROOM_TTL_MS', ttlMs })` でレスポンス本文から内部変数名を撤去、CSP `unsafe-inline` の Phase 8 follow-up 状況を `_headers` コメントで明示化。
- **E2E hatch の `import.meta.env.DEV` ガード統一** (4 useEffect 冒頭に 1 行追加)、production bundle で `__SNAP_SHARE_*__` の grep ゼロ確認。
- **TypeScript 6.0.3 / lucide-react v1 / hono catalog 化** (最終 commit、詰まったら revert)。
- **小修正の網羅**: `vite-env.d.ts` 新設で `import.meta.env` の `as { ... }` キャスト撤去、`AwarenessLike` を `Pick<YAwareness, ...>` で structural 等価コンパイル時検証、`turnstile-service` の `SiteverifyResponse` を Zod スキーマ化、stale Phase コメント (`logger.ts × 2` / `autoNextOffset.ts` / `autoArrowDefault.ts`) 整理、`--muted-foreground` を `oklch(50%) → oklch(42%)` で AAA 達成、`prefers-reduced-motion` 5 行追加、`@vitest/coverage-v8` 導入、`annotation/set-font-size` non-text identity test 追加、`waitForTimeout(700)` を deterministic 待機に置換、`yMapToAnnotation` を switch + exhaustive never に書き換え、`COMMITTING_ACTIONS` を switch 経由に、`TOOL_DEFS` / `TOOL_KEY_MAP` / `TOOL_ROWS` を `Record<Tool, ...>` 化、`syncRoute` を `routed` から外して `AppType` 露出を絞る or `OpenAPIHono` に統一、`hc<AppType>` の用途明確化、`idParamSchema` shared 化、`ToolButton.danger` を shadcn `--destructive` 経由へ、`presence-context` を `UserPresenceSchema` 経由へ、CLAUDE.md の envelope codes 8 個更新。

### 受け入れ条件 (Acceptance)

- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` / `pnpm build` がすべて緑。
- `pnpm -F @snap-share/web build` の gz 出力が **200 KB 以下** (chunking 後に `index-*.js` 単体で測定、vendor-canvas / vendor-yjs は別チャンク)。
- production bundle で `grep '__SNAP_SHARE_'` がゼロ件 (E2E hatch の DEV ガード確認)。
- Phase 8 review file 14 本の `## Resolution Update` セクションに「どの finding を どの commit で解消したか」が追記済み。
- `fix/phase-8-x-fixes` ブランチ上で 5 commit が `git log --oneline` で確認できる順序で並ぶ (security → perf → ssot/typesafety → quality cleanup → modernity)。
- TS 6 upgrade で詰まった場合は最終 commit を `git reset HEAD~1` で剥がし、PR は残り 4 commit で merge 可能 (Phase 9 開始 condition は満たす)。

## Metadata

- **Complexity**: **XL** (37 finding / 5 commit / cross-cutting / web+api+shared+config 全 workspace に touch)
- **Source PRD**: `.claude/PRPs/prds/phase-8-integration-review.prd.md` (本 plan は phase-8 の派生 phase 8.x、PRD の Phase Details 参照)
- **PRD Phase**: Phase 8.x — Phase 8 review fix-up
- **Source Report**: `.claude/PRPs/reports/phase-8-integration-review-report.md`
- **Source Reviews**: 14 ファイル `.claude/PRPs/reviews/phase-8-{triage,ssot,modernity,react,hono,band-aids,typesafety,extensibility,tests,a11y,perf,error-envelope,prp-hygiene,security}-review.md`
- **Branch**: `fix/phase-8-x-fixes` (already created)
- **Depends on**: Phase 8 (complete: integration review report)
- **Parallel with**: なし (Phase 9 dogfood は本 plan の theme 1+2 commit 後に開始可)
- **Estimated Files Touched**: web ~30 / api ~10 / shared ~3 / configs ~5 / tests ~10 / docs ~3 = **約 60 ファイル**
- **Estimated LOC**: 1500-2500 行 (TS 6 upgrade で出る型修正分は読めない)
- **Confidence**: **6/10** — TS 6 upgrade の breaking change 量が読めず、`syncRoute` の `OpenAPIHono` 統一 / JWT ticket 化が 100-200 LOC の新規実装になる。Phase 7 までで土台は堅固だが、5 theme を 1 PR に詰めるため commit 順序遵守と TDD 規律が confidence の鍵。

---

## UX Design

### Before (Phase 8 完了時点)

```
┌──────────────────────────────────────────────────────────┐
│ 残課題 37 件 (review report 抽出)                            │
│ - JWT が ?token= で wrangler tail に流れる                  │
│ - bundle gz 283KB (予算 300KB の 94.6%)                    │
│ - api-client は as RoomCreated で素通り                     │
│ - production に __SNAP_SHARE_* globals が焼き込まれる        │
│ - TS 5.6 / lucide v0 / hono 直書き                          │
│ - その他 stale comment / a11y 境界 / catalog drift         │
└──────────────────────────────────────────────────────────┘
```

### After (Phase 8.x 完了時点)

```
┌──────────────────────────────────────────────────────────┐
│ 残課題 0 件 (HIGH 7 + MED 21 + LOW HF=true 9 すべて解消)    │
│ Phase 9 dogfood Go condition 達成 (security + perf 完備)   │
│ TS 6 / lucide v1 / hono catalog 化、modernity 整地         │
│ E2E hatch は DEV のみ、production bundle clean            │
│ bundle gz ≤ 200KB (chunking + lazy)                       │
│ a11y AAA (DialogDescription contrast 7:1)                 │
│ + reduced-motion 対応                                       │
└──────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Room 接続 (protected) | `wss://.../sync/:id?token=<JWT-24h>` | `POST /rooms/:id/ws-ticket` で 30s ticket 発行 → `wss://.../sync/:id?ticket=<short>` | platform log に長命 token が残らない |
| Bundle download (landing/local mode) | 単一 chunk 283KB gz をフル DL | main < 100KB gz、room モード遷移時に vendor-yjs を on-demand | LCP 改善余地 |
| HelpModal description (a11y) | `--muted-foreground=oklch(50%)` で 4.5:1 境界 | `oklch(42%)` で 7:1 AAA | 弱視ユーザーで本文が境界値で陥没していた問題解消 |
| 動きが苦手なユーザー | アニメーション unconditional | `prefers-reduced-motion: reduce` で `animate-pulse` 等が停止 | ConnectionBadge の disconnected 永続点滅が解消 |
| サーバーレスポンス (500 misconfigured) | `"Server is misconfigured: invalid ROOM_TTL_MS"` を本文返却 | `"Internal server error"` のみ、詳細は logContext へ | 内部環境変数名の漏洩を排除 |
| DevTools console | `window.__SNAP_SHARE_TOOL__` などが production で読める | DEV ビルドのみ存在、production では tree-shake | 情報開示 + 関数 expose の閉鎖 |

---

## Mandatory Reading

実装前に必ず読むファイル。優先度順:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `.claude/PRPs/reports/phase-8-integration-review-report.md` | all | 全 finding と Phase 8.x テーマ別の集約・観点間 merge 記録・Phase 9 Go/No-Go condition |
| P0 | `.claude/PRPs/reviews/phase-8-triage-review.md` | 117-145 | 観点境界マップ / Human Friction 3 軸スコア rubric |
| P0 | `CLAUDE.md` | all | cross-cutting design rules 1-8 / API conventions / 言語ポリシー / "API conventions" 節 (envelope codes) |
| P0 | `.claude/PRPs/reviews/phase-8-security-review.md` | all | theme 1 主担当 (H1+H2+M1+L1) |
| P0 | `.claude/PRPs/reviews/phase-8-perf-review.md` | all | theme 2 主担当 (H1+M1+M2+M3) |
| P0 | `.claude/PRPs/reviews/phase-8-ssot-review.md` + `phase-8-typesafety-review.md` | all | theme 3 主担当 (H1+H4+M1-M3+L2-L3) |
| P0 | `.claude/PRPs/reviews/phase-8-modernity-review.md` | all | theme 5 主担当 (H2+M1+M2+L1-L3) |
| P1 (important) | `.claude/PRPs/reviews/phase-8-band-aids-review.md` | all | theme 4 (H3+M1+M2+L2) |
| P1 | `.claude/PRPs/reviews/phase-8-extensibility-review.md` | all | theme 4 (M1 案 A+B+C / L3 / L4) |
| P1 | `.claude/PRPs/reviews/phase-8-tests-review.md` | all | theme 4 (M1+M2+M3) |
| P1 | `.claude/PRPs/reviews/phase-8-a11y-review.md` | all | theme 4 (M1+L3) |
| P1 | `.claude/PRPs/reviews/phase-8-error-envelope-review.md` | all | theme 1+4 (M1=#13 M1 cross-ref / L1 CLAUDE.md update) |
| P1 | `.claude/PRPs/reviews/phase-8-hono-review.md` | all | theme 4 (M1+M2+L1+L2) |
| P1 | `.claude/PRPs/reviews/phase-8-prp-hygiene-review.md` | all | theme 4 (M1 = umbrella report policy CLAUDE.md 追記) |
| P1 | `.claude/PRPs/reviews/phase-8-react-review.md` | all | theme 4 (L1+L3 HF=true) |
| P2 (reference) | `apps/api/src/yjs.ts` | all | theme 1: WS upgrade + token query / `syncRoute` 構造 |
| P2 | `apps/api/src/lib/token.ts`, `services/token-service.ts` | all | theme 1: ticket 化の追加点 |
| P2 | `apps/web/src/lib/api-client.ts` | all | theme 1+3: ticket 取得 + Zod parse 化 |
| P2 | `apps/web/vite.config.ts` | all | theme 2: chunking 設定 |
| P2 | `apps/web/src/pages/EditorPage.tsx`, `LocalEditor.tsx`, `RoomEditor.tsx`, `EditorShell.tsx` | all | theme 2+4: lazy boundary + window globals |
| P2 | `apps/web/src/hooks/historyReducer.ts`, `useStageSize.ts`, `useYjsAnnotationsStore.ts`, `presence-context.ts` | all | theme 3 |
| P2 | `apps/web/src/hooks/annotationsReducer.ts`, `useKeyboardShortcuts.ts` | all | theme 4: COMMITTING_ACTIONS / TOOL_KEY_MAP |
| P2 | `apps/web/src/components/canvas/CanvasStage.tsx` | all | theme 4: tool === 'text' 分岐 / buildDraftFactory |
| P2 | `apps/web/src/domain/annotation/yjs-codec.ts` | all | theme 4: yMapToAnnotation switch 化 |
| P2 | `apps/web/src/components/empty-state/DropZone.tsx` | all | theme 4: onFile ref 化 / role=alert nesting |
| P2 | `apps/web/src/components/room-gate/RoomGate.tsx` | all | theme 4: async handler try/catch |
| P2 | `apps/web/src/components/toolbar/Toolbar.tsx`, `ToolButton.tsx`, `dialogs/HelpModal.tsx` | all | theme 4: TOOL_DEFS / danger tone / TOOL_ROWS |
| P2 | `apps/web/public/_headers` | all | theme 1: HSTS / CSP |
| P2 | `apps/web/src/styles/global.css`, `tokens.css` | all | theme 4: reduced-motion / `--muted-foreground` 0.50→0.42 |
| P2 | `pnpm-workspace.yaml` | all | theme 5: catalog 編集 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| TypeScript 6.0 release notes | https://github.com/microsoft/TypeScript/releases | breaking changes (lib types / decorators / tighter checks)、5.6 → 6.0 で `noUncheckedIndexedAccess` の検知精度が更に上がるため `historyReducer` の修正は TS 6 で必須化 |
| WebSocket auth ticket pattern | RFC 6455 + Cloudflare WebSocket guide | URL query token を避け、短命 ticket を別エンドポイント発行する方針が standard。Hono + Workers では DO or KV に ticket を 30s だけ保持 |
| Vite manualChunks | https://vite.dev/config/build-options.html#build-rollupoptions / rolldownOptions | snap-share は Vite 7+ で `rolldownOptions` を使う前提 (`vite.config.ts` 既存方式に合わせる)、設定可否は `apps/web/vite.config.ts` の現行で確認 |
| Zod safeParse fail-soft pattern | `packages/shared` 既存 (`r2-meta-storage.ts:46`) | サーバ書き込み側は既に `Schema.safeParse(...).success` で fail-soft、web 受信側を同じパターンに揃える |
| HSTS preload 申請 | hstspreload.org | `max-age=31536000; includeSubDomains; preload` が登録要件、preload 取り消しに数ヶ月かかるが Pages 配下なら HTTPS 確実 |
| sonner aria-live | https://sonner.emilkowal.ski/ | sonner はデフォルトで polite live region、error 用に assertive 切替が `toastOptions.classNames` 経由で可能 |

---

## Patterns to Mirror

実コード由来の現行パターン。新規/変更コードはこれらと区別がつかない見た目を維持する。

### NAMING_CONVENTION (workspace + Zod schema)

```typescript
// SOURCE: packages/shared/src/room.ts:8-30
export const RoomCreatedSchema = z.object({ /* ... */ }).readonly();
export type RoomCreated = z.infer<typeof RoomCreatedSchema>;
```

新規 `AuthResponseSchema` も `RoomCreatedSchema` と同じ shape (大文字始まり Schema、`.readonly()`、`z.infer` で型導出) に揃える。

### ZOD_FAIL_SOFT_PARSE (server side)

```typescript
// SOURCE: apps/api/src/storage/r2-meta-storage.ts:46
const parsed = RoomSchema.safeParse(raw);
if (!parsed.success) {
  throw new AppError(500, 'INTERNAL', 'Internal server error', {
    cause: 'meta_schema_mismatch',
    issues: parsed.error.issues,
  });
}
return parsed.data;
```

web 側も同様: `safeParse → !parsed.success → logger.warn + return { ok: false, reason: 'network' }`、データ流入は absolutely 阻止。

### USE_REDUCER_COMPOSITION (single dispatch)

```typescript
// SOURCE: apps/web/src/hooks/useAnnotationsStore.ts:36-51
const storeReducer = (state, action) => {
  const next = annotationsReducer(state, action);
  return historyReducer(next, action);
};
const [state, dispatch] = useReducer(storeReducer, initial);
```

CLAUDE.md cross-cutting rule 2。新規 reducer も storeReducer 1 本に合成する。

### DEV_ONLY_HATCH_PATTERN

```typescript
// SOURCE: apps/web/src/hooks/useYjsAnnotationsStore.ts:105-110
useEffect(() => {
  if (!import.meta.env.DEV) return;
  (window as unknown as Record<string, unknown>).__SNAP_SHARE_FOO__ = foo;
}, [foo]);
```

EditorShell.tsx の 4 件もこのパターンに揃える。Vite が production で `if (false) return` に置換、dead code elimination で副作用ごと除去される。

### CREATE_ROUTE_MIDDLEWARE_DECLARATION

```typescript
// SOURCE: apps/api/src/routes/rooms.ts:62-76 (createRoom route)
const createRoomRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [withRateLimit('RL_CREATE_ROOM')] as const,
  request: { /* ... */ },
  responses: { /* ... */ },
});
```

PRD Decisions Log: 「ルート middleware 配線は `createRoute({ middleware })` フィールドで宣言、`OpenAPIHono.use()` を chain しない」。新 ws-ticket route もこのパターンに準拠。

### FAIL_SOFT_HOOK_PATTERN

```typescript
// SOURCE: apps/web/src/lib/api-client.ts (createRoom 等)
export const createRoom = async (file: File, password?: string): Promise<CreateRoomResult> => {
  try {
    const res = await fetch(...);
    // status 分岐
  } catch {
    return { ok: false, reason: 'network' };
  }
};
```

新規 `requestWsTicket` も同 shape (`Promise<{ ok: true; ticket: string } | { ok: false; reason: 'network' | 'auth' }>`) に。

### TUPLE_TYPE_FOR_KONVA

```typescript
// SOURCE: apps/web/src/components/canvas/shapes/ArrowShape.tsx:31
points: [number, number, number, number]
```

`noUncheckedIndexedAccess` 下では `number[]` だと `number | undefined` になり Konva 型と不整合。tuple 型を保つ。

### DISCRIMINATED_UNION_EXHAUSTIVENESS

```typescript
// SOURCE: apps/web/src/hooks/annotationsReducer.ts:142
default: {
  const _: never = action;
  return _;
}
```

新規 switch (`yMapToAnnotation`、`isCommittingAction`) もこの末尾形式に揃える。

### RECORD_FOR_TOOL_DEFS (proposed)

```typescript
// PROPOSED PATTERN for theme 4 (Toolbar.tsx)
const TOOL_DEFS: Readonly<Record<Tool, ToolDef>> = {
  select: { /* ... */ },
  rectangle: { /* ... */ },
  arrow: { /* ... */ },
  text: { /* ... */ },
  highlight: { /* ... */ },
};
```

key 漏れがコンパイル時に enforce される。`Object.values(TOOL_DEFS)` で iteration 維持。

### TEST_STRUCTURE (vitest AAA)

```typescript
// SOURCE: apps/web/src/hooks/__tests__/historyReducer.test.ts
describe('historyReducer', () => {
  it('undo restores previous state', () => {
    const initial = { past: [{ x: 1 }], present: { x: 2 }, future: [] };
    const next = historyReducer(initial, { type: 'undo' });
    expect(next).toEqual({ past: [], present: { x: 1 }, future: [{ x: 2 }] });
  });
});
```

Arrange-Act-Assert、`it('xxx', ...)` の主語 + 動詞、describe で対象を 1 つに絞る。

---

## Files to Change

> theme 別。同一ファイルに複数 theme で touch する場合は順序を守って各 commit でのみ該当部分を変更。

### Theme 1: Security hardening

| File | Action | Justification |
|---|---|---|
| `apps/api/src/routes/rooms.ts` | UPDATE | `POST /rooms/:id/ws-ticket` route 追加 (createRoute + middleware: rate-limit + handler)、`AuthResponseSchema` import 切替 |
| `apps/api/src/services/token-service.ts` | UPDATE | `issueWsTicket(roomId, jwt)` / `verifyWsTicket(ticket)` を追加、KV または DO で 30s TTL 保持 |
| `apps/api/src/lib/bindings.ts` | UPDATE | `WS_TICKETS` KV binding を追加 (or 既存 KV を流用、決定は実装時) |
| `apps/api/wrangler.toml` | UPDATE | `WS_TICKETS` KV namespace 追加、または既存 `IMAGE_BLOCKLIST` パターンに準拠 |
| `apps/api/src/yjs.ts` | UPDATE | `?token=` を受け取らず `?ticket=` 検証へ移行、`Never log the ticket` コメント維持 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | UPDATE | WebSocket 接続前に `requestWsTicket` で短命 ticket 取得 → URL を構築 |
| `apps/web/src/lib/api-client.ts` | UPDATE | `requestWsTicket(roomId, jwt)` 関数追加 |
| `apps/api/src/services/room-service.ts` | UPDATE | `assertValidTtlMs` の publicMessage を generic 化、ttlMs と cause を logContext に押し込め |
| `apps/web/public/_headers` | UPDATE | HSTS に `; preload` 追加、CSP コメントを「Phase 9 dogfood 後に nonce 化検討」に更新 |
| `CLAUDE.md` | UPDATE | API conventions の error envelope codes を 5 → 8 (UNAUTHORIZED 401 / UNPROCESSABLE_ENTITY 422 / RATE_LIMITED 429 を追記) |
| 関連 test 追加 | CREATE/UPDATE | `apps/api/src/__tests__/ws-ticket.test.ts` (新規)、`apps/api/src/__tests__/yjs.test.ts` (ticket 検証へ更新)、`apps/api/src/__tests__/rooms.test.ts` (assertValidTtlMs publicMessage が generic か検証) |

### Theme 2: Bundle / perf

| File | Action | Justification |
|---|---|---|
| `apps/web/vite.config.ts` | UPDATE | `build.rolldownOptions.output.manualChunks` に `vendor-canvas` / `vendor-yjs` を追加 |
| `apps/web/src/pages/EditorPage.tsx` | UPDATE | `LocalEditor` / `RoomEditor` を `React.lazy()` でラップ、`Suspense` fallback (aria-busy) を導入 |
| `apps/web/src/hooks/useStageSize.ts` | UPDATE | `window.addEventListener('resize')` を捨て、`stageContainerRef` の `ResizeObserver` ベースに切替 (M2 + M3 同時解消) |
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | M2 解消で重複した resize listener を削除、`stageRect` を hook 経由に統一 |
| 関連 test 更新 | UPDATE | `useStageSize.test.ts` 新規 or 更新、`vite.config.test` に chunking 期待を追加するか、CI で bundle 上限チェック (将来 `pnpm build:check`) |

### Theme 3: SSOT + typesafety

| File | Action | Justification |
|---|---|---|
| `packages/shared/src/room.ts` | UPDATE | `AuthResponseSchema = z.object({ token: z.string().min(1) }).readonly()` を export、`type AuthResponse` |
| `packages/shared/src/index.ts` | UPDATE | `AuthResponse` / `AuthResponseSchema` re-export |
| `apps/api/src/routes/rooms.ts` | UPDATE | ローカル `authResponseSchema` 撤去、shared から import |
| `apps/web/src/lib/api-client.ts` | UPDATE | `RoomCreatedSchema` / `RoomPublicSchema` / `AuthResponseSchema` を value import、`safeParse` 経由で fail-soft、`as { token: string }` 撤去 |
| `apps/web/src/hooks/historyReducer.ts` | UPDATE | `as T` を撤去、length check 直後に `!` non-null assertion + `biome-ignore lint/style/noNonNullAssertion: length > 0 は guard で保証` コメント |
| `apps/api/src/services/turnstile-service.ts` | UPDATE | inline `SiteverifyResponse` を Zod schema 化 (`SiteverifyResponseSchema`)、`safeParse` 経由 |
| `apps/web/src/vite-env.d.ts` | CREATE | `interface ImportMetaEnv { VITE_API_URL?, VITE_API_WS_URL?, VITE_TURNSTILE_SITE_KEY? }` |
| `apps/web/src/lib/api-client.ts` / `lib/yjs-config.ts` / `pages/LocalEditor.tsx` | UPDATE | `as { VITE_* }` 3 件を撤去して直接 `import.meta.env.VITE_*` |
| `apps/web/src/hooks/presence-context.ts` | UPDATE | `AwarenessLike` を `Pick<YAwareness, 'clientID' | 'setLocalState' | 'setLocalStateField' | 'getStates' | 'on' | 'off'>` で導出、`as AwarenessLike` を排除 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | UPDATE | `as AwarenessLike` 撤去、structural 等価をコンパイラに任せる |
| `apps/web/src/hooks/presence-context.ts` (raw cast 部) | UPDATE | `UserPresenceSchema` 経由で safeParse、raw `as { ... }` cast 3 件を撤去 |
| `apps/web/src/components/canvas/__tests__/colors-presence-sync.test.ts` | CREATE | `culori` 依存追加 (catalog) または oklch→hex 換算手書きで、`AWARENESS_USER_PALETTE` ↔ `--color-presence-1..8` の deltaE 同期 snapshot test |
| `apps/api/src/__tests__/rooms.test.ts` | UPDATE | `ErrorEnvelope` 型を import、`error.code` の string→ErrorCode narrowing |

### Theme 4: Quality cleanup

| File | Action | Justification |
|---|---|---|
| `apps/web/src/pages/EditorShell.tsx` | UPDATE | `useEffect` 4 件の冒頭に `if (!import.meta.env.DEV) return;` を追加 (#5 H1) |
| `apps/web/src/lib/logger.ts` (web) | UPDATE | biome-ignore-all コメントの「Phase 5+ で structured logger」を「Phase 9 dogfood 後に判断」に更新 (#5 M1) |
| `apps/api/src/lib/logger.ts` (api) | UPDATE | 同上 (#5 M1) |
| `apps/web/src/lib/autoNextOffset.ts` / `autoArrowDefault.ts` | UPDATE | 「Phase 5 で再評価する」→「Phase 9 dogfood で再評価する」 (#5 M2) |
| `apps/web/src/styles/tokens.css` | UPDATE | per-tool color 4 トークン削除 or 「Konva 用は colors.ts」コメント追加 (#1 M2)、`--muted-foreground: oklch(50%) → oklch(42%)` (#9 M1) |
| `apps/api/src/routes/rooms.ts` / `images.ts` | UPDATE | `idParamSchema` を `apps/api/src/lib/schemas.ts` 新規モジュールへ集約 (#4 L1) |
| `apps/api/src/lib/schemas.ts` | CREATE | `idParamSchema` を export |
| `apps/api/src/yjs.ts` | UPDATE | `syncRoute` を `routed` から外して `app` に直接 mount、`AppType` から除外。コメントで「WebSocket upgrade 専用、hc<AppType> 非対象」明示 (#4 M1) — または `OpenAPIHono` への完全移行は別 phase に escrow |
| `apps/api/src/index.ts` | UPDATE | 上記に対応する mount 変更 |
| `apps/web/src/lib/api-client.ts` | UPDATE | `hc<AppType>` の使用方針を判断 (削除 or 段階移行コメント追加)、`createRoom` を含めた fail-soft pattern を整理 (#4 M2) |
| `apps/web/src/components/empty-state/DropZone.tsx` | UPDATE | `onFile` を `onFileRef` に格納し effect deps を `[]` に (#3 L1)、`role="alert"` を `<button>` 外側に出して `aria-describedby` で連携 (#9 L2) |
| `apps/web/src/components/room-gate/RoomGate.tsx` | UPDATE | `handleSubmit` に try/catch 追加、unexpected rejection を `setError('unexpected')` 経路へ (#3 L3) |
| `apps/web/src/components/toolbar/ToolButton.tsx` | UPDATE | `danger` tone を `text-destructive hover:bg-destructive/10` に (#5 L2) |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATE | `TOOL_DEFS` を `Readonly<Record<Tool, ToolDef>>` 化 (#7 M1 案 B) |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | UPDATE | `TOOL_KEY_MAP` を `Readonly<Record<Tool, string>>` 化 (#7 M1 案 B) |
| `apps/web/src/components/dialogs/HelpModal.tsx` | UPDATE | `TOOL_ROWS` を `Record<Tool, ...>` 化 (#7 M1 案 B) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | `buildDraftFactory: Record<Tool, (start, end, color) => Annotation | null>` を導入し `tool === 'text'` 特殊分岐と `else if` chain を畳む (#7 L3) |
| `apps/web/src/domain/annotation/yjs-codec.ts` | UPDATE | `yMapToAnnotation` を switch + `const _: never` で網羅性 enforce (#7 M1 案 A) |
| `apps/web/src/hooks/annotationsReducer.ts` | UPDATE | `COMMITTING_ACTIONS` 配列を撤去、`isCommittingAction(action): boolean` を switch + never で導出 (#7 M1 案 C)、`TOOLS = ['select', ...ANNOTATION_TYPES] as const` で導出 (#7 L4) |
| `apps/api/src/__tests__/rooms.test.ts` / `images.test.ts` / `yjs.test.ts` | UPDATE | local `ErrorBody` 型を `ErrorEnvelope` import に置換 (#11 L3) |
| `apps/api/src/routes/rooms.ts`, `images.ts` | UPDATE | 二重ログを `AppError` の logContext のみに統一、explicit `logger.warn` 撤去 (#11 L2) |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | UPDATE | `annotation/set-font-size` non-text identity test 追加 (#8 M2) |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | UPDATE (or 別 helper) | `captureTimeout=0` を test-only で渡せるよう yjs-annotations-context.ts に option 追加 (#8 M3) |
| `apps/web/e2e/annotation-tools.spec.ts` | UPDATE | `waitForTimeout(700)` を `expect.poll(...)` or window hatch 観測に置換 (#8 M3) |
| `pnpm-workspace.yaml` | UPDATE | `catalog:` に `@vitest/coverage-v8: ^4.1` 追加 (#8 M1) |
| `apps/web/package.json` | UPDATE | `@vitest/coverage-v8: catalog:` 追加、`test:coverage` script 追加 |
| `apps/api/package.json` | UPDATE | 同上 (api 側も計測対象) |
| `apps/web/vite.config.ts` (test ブロック) | UPDATE | `coverage: { provider: 'v8', reporter: ['text', 'lcov'], include: ['src/**/*.{ts,tsx}'] }` |
| `apps/api/vite.config.ts` | UPDATE | 同上 |
| `apps/web/src/styles/global.css` | UPDATE | `@media (prefers-reduced-motion: reduce) { *,::before,::after { animation-duration: 0.01ms!important; ... } }` 5 行追加 (#9 L3) |
| `apps/web/public/_headers` | UPDATE | (theme 1 と同 PR 内、CSP コメント整理) |
| `CLAUDE.md` | UPDATE | umbrella plan vs sub-plan 選択基準を workflow conventions 節に追記 (#12 M1)、umbrella report 必須化方針追記 |
| `.claude/rules/common/development-workflow.md` | UPDATE | 同上 (具体ルールは rules 側に書き、CLAUDE.md は要約 link) |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | UPDATE | `biome-ignore` の justification を ColorPalette 相対参照から自立させる (#9 L5) |

### Theme 5: Modernity bumps

| File | Action | Justification |
|---|---|---|
| `pnpm-workspace.yaml` | UPDATE | `typescript: 5.6.3 → ^6.0` (caret 化、policy 文書化コメント)、`lucide-react: ^0.460 → ^1.0`、`hono: ^4.12` を catalog に追加 |
| `apps/web/package.json` | UPDATE | `"hono": "^4.12" → "catalog:"` |
| `apps/api/package.json` | UPDATE | 同上 |
| `package.json` (root) | UPDATE | `@biomejs/biome: ^2.2 → ^2.4` (caret 揃え、L1) |
| `tsconfig.base.json` | UPDATE (option) | `target: ES2022 → ES2023` / `lib: [..., ES2023, ...]` (#2 L2)。TS 6 upgrade 副次。 |
| TS 6 / lucide-react v1 で発生する型修正 | UPDATE (read-only-not) | `pnpm typecheck` の結果に応じて pinpoint で修正、件数は実装時に確定 |

## NOT Building

- LOW (HF=false) 36 件の修正 (Phase 9 dogfood 後再判断、本 plan の対象外)
- frozen archive (`reviews/local-review-phase-{0,1,2,2.5}.md` / `phase-7.6-partial-implementation-review.md`) の rename / 削除 / 整理 (Phase 8 PRD で touch しない明示済)
- Phase 7.7-1 / 7.7-2 / 7.7-3 / 7.8-5 の retroactive review file 作成 (#12 L1、Phase 8 PRD の NOT Building)
- Phase 7.7 / 7.8 の retroactive umbrella report 作成 (Phase 9 以降から policy 適用 / 過去分は遡らない)
- CSP nonce 化の本実装 (Phase 8.x では `_headers` コメント整理のみ、nonce 注入は Vite plugin 設計で別 phase に escrow / 統合 review report の Open Items)
- Yjs persistence migration 機構 (#7 L2、永続化 phase で別 plan)
- React 19 `useDeferredValue` の `CanvasStage` への投入 (#3 L4、Phase 9 dogfood で perf 顕在化したら投入)
- Firefox / WebKit E2E 拡張 (#8 L3、Phase 9 dogfood 後判断)
- `room-mobile.spec.ts` の Linux snapshot 生成 (#8 L4、Phase 9 dogfood 後)
- annotation 永続化機構の追加 (Phase 9+)

---

## Step-by-Step Tasks

### Task 1: Theme 1 — Security hardening (commit 1)

- **ACTION**: TDD で WS JWT ticket 化 + HSTS preload + ROOM_TTL_MS leak fix + CSP コメント整理 + envelope code 文書化を 1 commit にまとめる。
- **IMPLEMENT**:
  1. (RED) `apps/api/src/__tests__/ws-ticket.test.ts` を新規作成し、`POST /rooms/:id/ws-ticket` が JWT bearer 検証 → ticket 発行 → KV に 30s TTL で保存されること、ticket 検証成功後は KV から削除されること、TTL 超過 / 不正 ticket / 不正 roomId で 401 を返すことを検証する失敗 test を書く。
  2. (GREEN) `token-service.ts` に `issueWsTicket(roomId, jwt) → ticket` / `verifyWsTicket(ticket) → roomId | null` を実装。`bindings.ts` に `WS_TICKETS: KVNamespace` 追加、`wrangler.toml` に namespace 定義 (新規 namespace ID は実装時 `wrangler kv namespace create WS_TICKETS` で生成)。`rooms.ts` に `createRoute({ method: 'post', path: '/:id/ws-ticket', middleware: [withRateLimit('RL_AUTH')] as const, ... })` で route 追加。
  3. (GREEN) `apps/api/src/yjs.ts` を変更: `?token=` 検証を `?ticket=` 検証に切替、verify 後即座に `WS_TICKETS.delete(ticket)`。token query を完全排除。
  4. (GREEN) `apps/web/src/lib/api-client.ts` に `requestWsTicket(roomId, jwt)` 追加 (fail-soft pattern)。`useYjsAnnotationsStore.ts` で WebSocket 接続前に ticket 取得 → URL を `?ticket=...` で構築。
  5. (RED) `apps/api/src/__tests__/rooms.test.ts` の TTL misconfigured シナリオで「レスポンス本文に `ROOM_TTL_MS` 文字列が含まれない」assertion を追加 (現状 RED)。
  6. (GREEN) `room-service.ts:81` の `AppError(500, 'INTERNAL', 'Server is misconfigured: invalid ROOM_TTL_MS', { ttlMs })` を `AppError(500, 'INTERNAL', 'Internal server error', { cause: 'invalid ROOM_TTL_MS', ttlMs })` に置換。
  7. (UPDATE) `apps/web/public/_headers:19` の HSTS に `; preload` 追加。CSP コメントを「Phase 9 dogfood 後に nonce 化を別 Phase で再検討」に更新。
  8. (UPDATE) `CLAUDE.md` の API conventions error envelope codes 列挙を 5 → 8 に更新 (`UNAUTHORIZED` 401 / `UNPROCESSABLE_ENTITY` 422 / `RATE_LIMITED` 429 を追記、ファイル参照 `apps/api/src/lib/error.ts` を維持)。
  9. (UPDATE) 各 review file の `## Resolution Update` に: `phase-8-security-review.md` (H1+H2+M1+L1)、`phase-8-error-envelope-review.md` (M1 cross-ref + L1) を「commit <hash> (theme 1) で解消」と追記。
- **MIRROR**: ZOD_FAIL_SOFT_PARSE / FAIL_SOFT_HOOK_PATTERN / CREATE_ROUTE_MIDDLEWARE_DECLARATION
- **IMPORTS**:
  - api: `import { z } from '@hono/zod-openapi'`、`import { AppError } from '../lib/error'`、`import type { Bindings } from '../lib/bindings'`
  - web: `import { logger } from './logger'`
- **GOTCHA**:
  - WebSocket upgrade で `Authorization` header は使えない → ticket query 方式は維持。ticket は **3〜10 文字程度の base64url 文字列で十分** (KV lookup key、長い JWT より platform log への影響軽微、TTL 30s で brute-force 不可能)。
  - `wrangler dev` ではローカル KV が in-memory、namespace ID は wrangler.toml の `preview_id` を空にして `wrangler kv` 経由で生成 → CI/dev で別 ID。
  - rate-limit を ws-ticket route にも適用 (`RL_AUTH` 流用 or 専用 binding)、ticket lookup spam を防ぐ。
- **VALIDATE**:
  ```bash
  pnpm -F @snap-share/api test -- ws-ticket
  pnpm -F @snap-share/api test -- rooms.test
  pnpm -F @snap-share/api test -- yjs.test
  pnpm -F @snap-share/web test -- api-client
  pnpm typecheck && pnpm lint
  pnpm -F @snap-share/web test:e2e -- room-protected
  curl -I https://localhost:8787/health  # HSTS 確認は staging で
  ```
- **COMMIT**: `fix(phase-8.x): security hardening — WS JWT ticket 化 + HSTS preload + ROOM_TTL_MS leak + envelope code 文書化`

### Task 2: Theme 2 — Bundle / perf optimization (commit 2)

- **ACTION**: bundle gz 283KB → ≤200KB を目指して chunking + lazy boundary、resize 二重登録を `ResizeObserver` で一本化。
- **IMPLEMENT**:
  1. (RED) `apps/web/src/hooks/__tests__/useStageSize.test.ts` を新規 (or update) し、resize イベント 1 回で再描画が 1 回に収まる ResizeObserver ベース挙動を検証。`MockResizeObserver` を vi.mock で stub。
  2. (GREEN) `useStageSize.ts` を viewport global → container ResizeObserver に切替。EditorShell.tsx の重複 resize listener を削除。
  3. (UPDATE) `EditorPage.tsx` で `LocalEditor` / `RoomEditor` を `React.lazy()` でラップ、`<Suspense fallback={<div aria-busy="true" />}>` を導入。
  4. (UPDATE) `vite.config.ts` の `build.rolldownOptions.output.manualChunks` に `vendor-canvas: ['konva', 'react-konva', 'use-image']`、`vendor-yjs: ['yjs', 'y-websocket', 'y-protocols']`。
  5. (VERIFY) `pnpm -F @snap-share/web build` で `index-*.js` 単体が gz ≤ 200KB、`vendor-canvas-*.js` と `vendor-yjs-*.js` が別チャンクとして出力されることを確認。
  6. (UPDATE) review files: `phase-8-perf-review.md` (H1+M1+M2+M3) の Resolution Update に commit hash を追記。
- **MIRROR**: USE_REDUCER_COMPOSITION (state は触らないが React 19 lazy + Suspense は既に CLAUDE.md rule 準拠)、TUPLE_TYPE_FOR_KONVA (Stage prop 形式維持)
- **IMPORTS**: `import { lazy, Suspense } from 'react'`、`import { useEffect, useState } from 'react'`、(test) `import { ResizeObserver as ResizeObserverPolyfill } from 'resize-observer-polyfill'` (vi.stubGlobal)
- **GOTCHA**:
  - `React.lazy()` は default export 必須 — `LocalEditor.tsx` / `RoomEditor.tsx` が named export のみなら `lazy(() => import('./LocalEditor').then(m => ({ default: m.LocalEditor })))` 形式。
  - manualChunks key は chunk ファイル名のプレフィックスになる、既存 hash suffix は維持。
  - `useStageSize` を `ResizeObserver` 化すると初期 stage size が `0,0` になる瞬間がある → fallback で `viewport.innerWidth/Height` を初期値に保持 or container `getBoundingClientRect()` を sync 取得。
  - lazy boundary 越しでも `useYjsAnnotationsStore` の WebSocket 接続が想定通り動くか E2E (`room-share.spec.ts`) で確認。
- **VALIDATE**:
  ```bash
  pnpm -F @snap-share/web build
  ls -lh apps/web/dist/assets/  # vendor-canvas-*, vendor-yjs-*, index-* が分離
  pnpm -F @snap-share/web test -- useStageSize
  pnpm -F @snap-share/web test:e2e -- room-share
  pnpm -F @snap-share/web test:e2e -- room-create
  ```
- **COMMIT**: `perf(phase-8.x): bundle chunking + lazy(EditorPage) + ResizeObserver で 283KB gz → ≤200KB`

### Task 3: Theme 3 — SSOT + typesafety (commit 3)

- **ACTION**: 片務的 SSOT 解消。`api-client` を Zod parse 完全化、`historyReducer` の `as T` 排除、`AuthResponseSchema` を shared 化、`vite-env.d.ts` 新設、`AwarenessLike` Pick 化、`presence-context` Zod 化、`Siteverify` Zod 化、color presence palette sync test 追加。
- **IMPLEMENT**:
  1. (UPDATE) `packages/shared/src/room.ts` に `AuthResponseSchema = z.object({ token: z.string().min(1) }).readonly()` + `type AuthResponse`、`packages/shared/src/index.ts` で re-export。
  2. (UPDATE) `apps/api/src/routes/rooms.ts` のローカル `authResponseSchema` を撤去、shared から import。
  3. (RED → GREEN) `apps/web/src/lib/__tests__/api-client.test.ts` に「不正な shape の response が `{ ok: false, reason: 'network' }` に倒れる」test を追加。
  4. (GREEN) `apps/web/src/lib/api-client.ts` で:
     - `import { RoomCreatedSchema, RoomPublicSchema, AuthResponseSchema } from '@snap-share/shared'` (value import)
     - `createRoom` (L65) / `fetchRoom` (L89) / `authenticateRoom` (L117) すべてを `safeParse` 経由 fail-soft pattern に。
     - `as { token: string }` を `AuthResponseSchema` 経由に。
  5. (RED → GREEN) `apps/web/src/hooks/__tests__/historyReducer.test.ts` に「past を空配列にした state で undo dispatch しても crash しない」test を追加 (現行も通るが contract 明示)。
  6. (GREEN) `historyReducer.ts:44, 55` の `as T` を `!` + `biome-ignore lint/style/noNonNullAssertion: length > 0 は直上の guard で保証` コメントに変更。
  7. (CREATE) `apps/web/src/vite-env.d.ts`:
     ```typescript
     /// <reference types="vite/client" />
     interface ImportMetaEnv {
       readonly VITE_API_URL?: string;
       readonly VITE_API_WS_URL?: string;
       readonly VITE_TURNSTILE_SITE_KEY?: string;
     }
     interface ImportMeta { readonly env: ImportMetaEnv; }
     ```
  8. (UPDATE) `api-client.ts:14`, `yjs-config.ts:19`, `LocalEditor.tsx:18` の `as { VITE_* }` 3 件を撤去して直接 `import.meta.env.VITE_*`。
  9. (UPDATE) `apps/api/src/services/turnstile-service.ts` に `SiteverifyResponseSchema = z.object({ success: z.boolean(), 'error-codes': z.array(z.string()).optional() })` を追加、`safeParse` 経由。失敗時は `logger.warn('turnstile: unexpected siteverify shape')` + `{ ok: false, reason: 'network' }`。
  10. (UPDATE) `apps/web/src/hooks/presence-context.ts` で `AwarenessLike` を `Pick<YAwareness, ...>` で導出、raw `as { ... }` cast 3 件を `UserPresenceSchema.omit(...).safeParse` 経由に置換。`useYjsAnnotationsStore.ts:185, 198` の `as AwarenessLike` 撤去。
  11. (CREATE) `apps/web/src/components/canvas/__tests__/colors-presence-sync.test.ts`: `culori` (catalog 追加) で oklch→hex 換算、`AWARENESS_USER_PALETTE` ↔ `--color-presence-1..8` (tokens.css から手動文字列パース or static import) の deltaE ≤ 5 を全 8 index で確認。
  12. (UPDATE) review files: `phase-8-ssot-review.md` (H1+M1+L3 + L2 if 含む)、`phase-8-typesafety-review.md` (H1+H2+M1+M2+M3+L2+L3) の Resolution Update に commit hash 追記。
- **MIRROR**: ZOD_FAIL_SOFT_PARSE / NAMING_CONVENTION / FAIL_SOFT_HOOK_PATTERN / DISCRIMINATED_UNION_EXHAUSTIVENESS
- **IMPORTS**:
  - shared: `import { z } from 'zod'`
  - web: `import { RoomCreatedSchema, RoomPublicSchema, AuthResponseSchema, UserPresenceSchema } from '@snap-share/shared'`、`import { differenceEuclidean, oklch, rgb, formatHex } from 'culori'`
- **GOTCHA**:
  - `import { RoomCreatedSchema }` (value import) と既存 `import type { RoomCreated }` の混在。`verbatimModuleSyntax: true` で `import { RoomCreatedSchema, type RoomCreated }` 形式が必要。
  - `culori` は重い (gz ~30KB) → 4.x の minimal sub-import (`'culori/fn'`) 使用 + test only 依存に留める。または手書き oklch→sRGB 換算で依存を増やさない選択。
  - `vite-env.d.ts` を作成すると Biome の `noUnusedVariables` で `interface ImportMetaEnv` が未使用扱いされる可能性 → `tsconfig.json` の include に明示的に含める。
  - `historyReducer` の `!` non-null assertion は biome-ignore + コメントで「length > 0 guard 直後」を明記しないと lint で警告。`password.ts` の踏襲。
  - `AwarenessLike = Pick<YAwareness, ...>` で `y-protocols/awareness` の Awareness 型に依存が発生 → minor version drift で型 break リスクは bump 時に検出される (期待挙動)。
- **VALIDATE**:
  ```bash
  pnpm -F @snap-share/shared test
  pnpm -F @snap-share/web test -- api-client
  pnpm -F @snap-share/web test -- historyReducer
  pnpm -F @snap-share/web test -- presence-context
  pnpm -F @snap-share/web test -- colors-presence-sync
  pnpm -F @snap-share/api test -- turnstile-service
  pnpm typecheck && pnpm lint
  pnpm -F @snap-share/web test:e2e -- room-create
  ```
- **COMMIT**: `refactor(phase-8.x): SSOT + typesafety — api-client Zod parse 完全化 + AuthResponseSchema 共有 + historyReducer 安全化 + AwarenessLike Pick`

### Task 4: Theme 4 — Quality cleanup (commit 4)

- **ACTION**: H3 (window globals DEV ガード) を最優先に、band-aids / a11y / tests / extensibility / Hono / PRP-hygiene の MED 9 + LOW 6 (HF=true) を一括整理。
- **IMPLEMENT**:
  1. (UPDATE) `EditorShell.tsx:243-274` の 4 useEffect 冒頭に `if (!import.meta.env.DEV) return;` を追加 (#5 H1)。`useYjsAnnotationsStore.ts:106` パターンと統一。
  2. (UPDATE) `logger.ts × 2` / `autoNextOffset.ts` / `autoArrowDefault.ts` の Phase 番号コメントを「Phase 9 dogfood」に修正 (#5 M1+M2)。
  3. (UPDATE) `tokens.css`: per-tool 4 token を grep ゼロ確認後に削除 or コメント追加 (#1 M2)。`--muted-foreground: oklch(50% 0 0) → oklch(42% 0 0)` (#9 M1)。
  4. (CREATE) `apps/api/src/lib/schemas.ts` で `idParamSchema` を export、`rooms.ts` / `images.ts` から重複定義を撤去 (#4 L1)。
  5. (UPDATE) `apps/api/src/yjs.ts` の `syncRoute` を `routed` から外して `app` 直接 mount に変更、`AppType` 露出から除外。コメントで「WebSocket upgrade 専用、hc<AppType> 非対象」明示 (#4 M1 境界明確化案)。`buildRoomService` を `buildRoomReadService` にリネーム (#4 L2)。
  6. (UPDATE) `api-client.ts` の `hc<AppType>` 削除案を採用: `api` export と `hc` import を削除、smoke test 削除 or 最小化 (#4 M2)。raw fetch を正式方針として確定。
  7. (UPDATE) `DropZone.tsx` で `onFile` を ref に格納し effect deps を `[]` (#3 L1)、`role="alert"` を `<button>` 外に移動 + `aria-describedby` 連携 (#9 L2)。
  8. (UPDATE) `RoomGate.tsx:32-46` の `handleSubmit` に try/catch 追加、unexpected rejection を `setError('unexpected')` 経路へ (#3 L3)。
  9. (UPDATE) `ToolButton.tsx:21` の `danger` tone を `text-destructive hover:bg-destructive/10` に (#5 L2)。
  10. (UPDATE) `Toolbar.TOOL_DEFS` / `useKeyboardShortcuts.TOOL_KEY_MAP` / `HelpModal.TOOL_ROWS` を `Readonly<Record<Tool, ...>>` 化 (#7 M1 案 B)。
  11. (UPDATE) `CanvasStage.tsx` で `buildDraftFactory: Record<Tool, draftFn>` を導入し `tool === 'text'` 特殊分岐 + `else if` chain を畳む (#7 L3)。
  12. (UPDATE) `yjs-codec.yMapToAnnotation` を switch + `const _: never` で網羅性 enforce (#7 M1 案 A)。
  13. (UPDATE) `annotationsReducer.ts` で `COMMITTING_ACTIONS` 配列を撤去、`isCommittingAction(action)` を switch + never で導出 (#7 M1 案 C)、`TOOLS = ['select', ...ANNOTATION_TYPES] as const` (#7 L4)。
  14. (UPDATE) `apps/api/src/__tests__/{rooms,images,yjs}.test.ts` の local `ErrorBody` 型を `import type { ErrorEnvelope } from '../../lib/error'` に置換 (#11 L3)。
  15. (UPDATE) `rooms.ts` / `images.ts` の二重ログを `AppError` の logContext のみに統一、explicit `logger.warn` 撤去 (#11 L2)。
  16. (CREATE/UPDATE) `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` に non-text identity test 追加 (#8 M2)。
  17. (UPDATE) `yjs-annotations-context.ts` に `captureTimeout?: number` option を追加 (test-only)、test では 0 渡して deterministic 化。`annotation-tools.spec.ts` の `waitForTimeout(700)` を `expect.poll(...)` で window hatch (`__SNAP_SHARE_ANNOTATIONS__.length === 1`) を観測する形に置換 (#8 M3)。
  18. (UPDATE) `pnpm-workspace.yaml` の catalog に `@vitest/coverage-v8` を追加、apps/web/api/shared package.json に参照 + `test:coverage` script、各 vite.config.ts に coverage block (#8 M1)。
  19. (UPDATE) `apps/web/src/styles/global.css` 末尾に `@media (prefers-reduced-motion: reduce) { *,::before,::after { animation-duration: 0.01ms!important; animation-iteration-count: 1!important; transition-duration: 0.01ms!important; } }` を追加 (#9 L3)。
  20. (UPDATE) `CLAUDE.md` の workflow conventions 節に umbrella plan vs sub-plan policy + umbrella report 必須化 policy を追記 (#12 M1)。`.claude/rules/common/development-workflow.md` に同方針の詳細を追加。
  21. (UPDATE) `FontSizeControl.tsx:24` の `biome-ignore` justification を ColorPalette 相対参照から自立させる (#9 L5)。
  22. (UPDATE) review files: `phase-8-band-aids-review.md` (H1+M1+M2+L2)、`phase-8-extensibility-review.md` (M1+L3+L4)、`phase-8-tests-review.md` (M1+M2+M3)、`phase-8-a11y-review.md` (M1+L3 を含む theme 4 該当分)、`phase-8-error-envelope-review.md` (L1+L2+L3)、`phase-8-hono-review.md` (M1+M2+L1+L2)、`phase-8-prp-hygiene-review.md` (M1)、`phase-8-react-review.md` (L1+L3)、`phase-8-ssot-review.md` (M2)、`phase-8-typesafety-review.md` (L2)、`phase-8-perf-review.md` (副次なし)、`phase-8-security-review.md` (L1 cross-ref / 該当部分のみ) の Resolution Update に commit hash 追記。
- **MIRROR**: DEV_ONLY_HATCH_PATTERN / DISCRIMINATED_UNION_EXHAUSTIVENESS / RECORD_FOR_TOOL_DEFS / TEST_STRUCTURE
- **IMPORTS**:
  - test: `import type { ErrorEnvelope } from '../../lib/error'`
  - api: `import { idParamSchema } from '../lib/schemas'`
  - web: `import type { ErrorEnvelope } from '...'` (test) など
- **GOTCHA**:
  - `--muted-foreground` を 50%→42% に下げると shadcn 由来の placeholder / sonner border にも影響 → DropZone / RoomGate 等で contrast 過剰にならないか視覚確認。
  - `Record<Tool, ToolDef>` 化は `ANNOTATION_TYPES` を増やすたびに自動 enforce、`Object.values` で iteration を維持。
  - `syncRoute` を `routed` から外すと `hc<AppType>` の `api.sync` が型から消える → smoke test 削除と同時実施。
  - `prefers-reduced-motion` の `*` セレクタ強制は a11y ベストプラクティス、Tailwind v4 の `@layer base` 内 override も同時に効く。
  - `@vitest/coverage-v8` 導入後の初回 `pnpm test:coverage` で 80% 未達でも commit を完了させる (Phase 9 中に未テストファイルを増やさない方針を CLAUDE.md に追記、retroactive coverage 達成は別 phase)。
  - umbrella report 必須化 policy は Phase 9 以降から適用、過去分は遡らない (#12 M1 の Suggested Fix 通り)。
- **VALIDATE**:
  ```bash
  pnpm -F @snap-share/web build && grep -r "__SNAP_SHARE_" apps/web/dist/  # 空一致を期待
  pnpm typecheck && pnpm lint
  pnpm -F @snap-share/web test:coverage
  pnpm -F @snap-share/api test:coverage
  pnpm test
  pnpm -F @snap-share/web test:e2e -- annotation-tools  # waitForTimeout 排除後の deterministic 確認
  pnpm -F @snap-share/web test:e2e -- landing  # DropZone role=alert 移動後の SR 改善確認 (e2e は a11y 直接検証は無いが regression 確認)
  ```
- **COMMIT**: `chore(phase-8.x): quality cleanup — DEV ガード + band-aids + a11y + tests + extensibility + Hono + PRP-hygiene 一括整理`

### Task 5: Theme 5 — Modernity bumps (commit 5、最後)

- **ACTION**: TS 6 / lucide-react v1 / hono catalog 化を最後に実施。詰まったら最終 commit を `git reset HEAD~1` で剥がして PR 完了。
- **IMPLEMENT**:
  1. (UPDATE) `pnpm-workspace.yaml`: `typescript: 5.6.3 → ^6.0`、`lucide-react: ^0.460 → ^1.0`、`hono` を catalog に追加 (`hono: ^4.12`)。`@biomejs/biome` を root で `^2.4` に。
  2. (UPDATE) `apps/web/package.json` / `apps/api/package.json`: `"hono": "^4.12" → "catalog:"`。
  3. (RUN) `pnpm install` で lockfile 更新。
  4. (FIX) `pnpm typecheck` で出る TS 6 由来の新規エラーを 1 件ずつ修正。lucide-react v1 で icon 名変更があれば `import` を更新。
  5. (UPDATE) `tsconfig.base.json`: `target: ES2022 → ES2023`、`lib: ['ES2023', 'DOM', 'DOM.Iterable']` (#2 L2、TS 6 副次)。
  6. (VALIDATE) `pnpm test` / `pnpm build` で全緑確認。
  7. (UPDATE) `CLAUDE.md` cross-cutting rule 6 に「2 つ以上の workspace で使う dep は必ず catalog 化、1 workspace 専用は workspace 内 OK」を追記。
  8. (UPDATE) review files: `phase-8-modernity-review.md` (H1+M1+M2+L1+L2+L3) の Resolution Update に commit hash 追記。
- **MIRROR**: NAMING_CONVENTION (catalog: の参照形式 `"pkg": "catalog:"` 既存パターン)
- **IMPORTS**: なし (workspace 設定の変更が主)
- **GOTCHA**:
  - **TS 6 で詰まったら**: `git reset HEAD~1` でこの commit のみ剥がし、PR 残り 4 commit で完結させる。Phase 9 開始 condition は theme 1+2 で満たす。`fix/phase-8-x-fixes` ブランチを `--force-with-lease` で push (PR の commit が消える、リモートからも消える)。
  - lucide-react v1 で `lucide-react/icons/X` のサブパス import 形式に変わっている可能性 → `pnpm dlx lucide-react@1 --help` で migration guide 確認。
  - TS 6 で `noUncheckedIndexedAccess` 検知が強化される可能性 → theme 3 で対処済の `historyReducer` の `!` 形式は OK だが、別箇所で出る可能性あり (5-10 件想定、量により判断)。
  - `target: ES2023` で `Array.findLast` 等が使えるようになるが、既存コードを書き換える必要はない (target 引き上げは backward compatible)。
  - hono ^4.12 catalog 化で `pnpm install` 後の lockfile 差分が大きく見えるが、dep 名前変更ではないので runtime 影響なし。
- **VALIDATE**:
  ```bash
  pnpm install
  pnpm typecheck  # TS 6 のエラーを修正
  pnpm lint
  pnpm test
  pnpm build
  pnpm -F @snap-share/web test:e2e
  ```
  TS 6 で `pnpm typecheck` が大量エラーで詰まった場合は **stop** し、`git reset HEAD~1 && git checkout pnpm-workspace.yaml apps/web/package.json apps/api/package.json package.json tsconfig.base.json` で剥がす。
- **COMMIT** (成功時): `chore(phase-8.x): TypeScript 6 + lucide-react v1 + hono catalog 化 + ES2023 target`
- **COMMIT** (失敗で TS 6 のみ revert する場合): theme 5 の他要素 (lucide-react v1 / hono catalog) は別 commit 化を試みる。それすら無理なら最終 commit 全体を剥がして PR は 4 commit で merge、別 phase で再挑戦。

---

## Testing Strategy

### Unit Tests (theme 別)

| Theme | Test | Input | Expected Output | Edge Case? |
|---|---|---|---|---|
| 1 | `ws-ticket.test.ts` | valid JWT, valid roomId | 201 + ticket (10-20 chars), KV に 30s TTL で保存 | ticket TTL 0 |
| 1 | `ws-ticket.test.ts` | invalid JWT | 401 UNAUTHORIZED | malformed bearer |
| 1 | `yjs.test.ts` (updated) | valid ticket query | WS upgrade 成功 + KV から ticket 削除 | ticket 再使用 → 401 |
| 1 | `rooms.test.ts` (updated) | TTL misconfigured | response body に "ROOM_TTL_MS" 文字列を **含まない** | env 不正 |
| 2 | `useStageSize.test.ts` | container resize 1 回 | re-render 1 回 (現状 2 回) | container ref unmount |
| 3 | `api-client.test.ts` | malformed RoomCreated response | `{ ok: false, reason: 'network' }` | 部分欠損フィールド |
| 3 | `historyReducer.test.ts` | empty past で undo | state 不変 + crash しない | past=[] |
| 3 | `colors-presence-sync.test.ts` | each index 0..7 | deltaE ≤ 5 | OKLCH→hex 浮動小数 |
| 3 | `presence-context.test.ts` | malformed awareness state | `continue` (skip) | user.color=undefined |
| 3 | `turnstile-service.test.ts` | malformed siteverify response | `{ ok: false, reason: 'network' }` | success=undefined |
| 4 | `annotationsReducer.test.ts` (M2) | annotation/set-font-size on rect | `next.annotations === seeded.annotations` | non-text |
| 4 | `annotation-tools.spec.ts` (M3) | undo×2 on text annotation | history step が分離して 1 つずつ undo | captureTimeout=0 |
| 5 | (TS 6) typecheck | 全 workspace | 0 errors | strict 強化 |

### Edge Cases Checklist

- [ ] WS ticket TTL 切れ後の WS 接続 → 401
- [ ] WS ticket 再使用 → 401 (KV からは削除済み)
- [ ] HSTS preload は staging で確認 (production deploy までは hstspreload.org 申請しない)
- [ ] bundle 200KB 上限を CI で計測する仕組みは Phase 8.x では入れない (Phase 9 後に判断)、手動 `ls -lh dist/assets/` で確認
- [ ] `prefers-reduced-motion` を Chrome DevTools Rendering タブで切替して `animate-pulse` 停止確認
- [ ] `__SNAP_SHARE_` を production bundle で grep ゼロ確認 (`grep -r '__SNAP_SHARE_' apps/web/dist/`)
- [ ] TS 6 で `verbatimModuleSyntax: true` の挙動が変わっていないか (既存の `import type` が壊れないか)
- [ ] lucide-react v1 で icon 名変更があれば全 import を移行
- [ ] HelpModal description のコントラストを Chrome DevTools の Vision deficiency: blurred シミュレーションで確認

---

## Validation Commands

### Static Analysis

```bash
pnpm typecheck
```
EXPECT: Zero type errors across web / api / shared

```bash
pnpm lint
```
EXPECT: Biome ci 全 pass、no fixes applied

### Unit Tests

```bash
pnpm -F @snap-share/web test
pnpm -F @snap-share/api test
pnpm -F @snap-share/shared test
```
EXPECT: 全 spec 緑、Phase 8 比で +20-30 件 (theme 1 ws-ticket, theme 2 useStageSize, theme 3 colors-presence-sync ほか)

### Coverage (theme 4 で導入後)

```bash
pnpm -F @snap-share/web test:coverage
pnpm -F @snap-share/api test:coverage
```
EXPECT: 計測可能 (80% 達成は別 phase 目標)、lcov.info 生成

### Full Test Suite + E2E

```bash
pnpm test
pnpm test:e2e
```
EXPECT: 全 spec 緑、E2E は chromium + mobile-chrome 範囲で regress なし

### Build Verification (bundle 確認)

```bash
pnpm build
ls -lh apps/web/dist/assets/
```
EXPECT:
- `index-*.js` gz ≤ 200 KB
- `vendor-canvas-*.js` 分離 (gz ~150-180 KB)
- `vendor-yjs-*.js` 分離 (gz ~50-80 KB)
- `grep -r '__SNAP_SHARE_' apps/web/dist/` がゼロ件

### Production Bundle Audit

```bash
grep -r '__SNAP_SHARE_' apps/web/dist/ || echo "OK: no E2E hatch leaked"
grep -r 'ROOM_TTL_MS' apps/api/dist/  # 内部参照は OK、レスポンス本文に乗らないことは ws-ticket.test.ts でカバー済
```

### Manual Validation

- [ ] `pnpm dev` で local mode (画像 D&D) → annotation 描画 → PNG export までゴールデンパス確認
- [ ] room 作成 (パスワード付き) → 別タブで参加 → 同期確認 → ticket 経路で WebSocket 接続成功確認
- [ ] Chrome DevTools の Network タブで WS 接続 URL に `?ticket=...` (短文字列) が出ていることを確認、`?token=<JWT>` がないことを確認
- [ ] HelpModal を開いて `prefers-reduced-motion: reduce` を有効化 → ConnectionBadge の `animate-pulse` が停止
- [ ] HelpModal description の本文を Vision deficiency: blurred で確認、可読性向上を体感
- [ ] DevTools Console で `window.__SNAP_SHARE_TOOL__` が `undefined` であることを production build で確認

---

## Acceptance Criteria

- [ ] 5 commit が `git log --oneline fix/phase-8-x-fixes` に正順 (security → perf → ssot/typesafety → quality cleanup → modernity) で並ぶ
- [ ] HIGH 7 件すべて解消 (review file の Resolution Update で確認可能)
- [ ] MEDIUM 21 件すべて解消
- [ ] LOW (HF=true) 9 件すべて解消
- [ ] LOW (HF=false) 36 件は **触っていない** (backlog)
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` / `pnpm build` がすべて緑
- [ ] bundle gz `index-*.js` ≤ 200 KB
- [ ] production bundle に `__SNAP_SHARE_*` が存在しない
- [ ] WS 接続 URL に JWT が乗らない (ticket 経路のみ)
- [ ] `_headers` の HSTS に `preload` ディレクティブが存在
- [ ] CLAUDE.md の envelope codes が 8 個記載 + umbrella plan/report policy 追記
- [ ] 14 review file の Resolution Update が更新済み

## Completion Checklist

- [ ] Code follows discovered patterns (Patterns to Mirror)
- [ ] Error handling matches codebase style (`AppError` + `errorEnvelope` + `safeParse` fail-soft)
- [ ] Logging follows codebase conventions (`logger.warn` + `logContext`、二重ログなし)
- [ ] Tests follow test patterns (vitest AAA、describe で対象 1 つに絞る)
- [ ] No hardcoded values (catalog / env / constants)
- [ ] Documentation updated (CLAUDE.md / `.claude/rules/`)
- [ ] No unnecessary scope additions (LOW HF=false / Open Items / NOT Building セクションを厳守)
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TS 6 upgrade で型エラー大量発生 | Medium | High | 最終 commit に隔離、`git reset HEAD~1` で剥がし可能。事前に 5.7 経由の段階 upgrade も検討 |
| WS ticket 化で Yjs 接続が break | Medium | High | `room-share.spec.ts` E2E で必ず確認、wrangler dev で local 検証、stack 全体 (`yjs.ts` + `useYjsAnnotationsStore.ts` + `api-client.ts`) を 1 commit にまとめて partial state 防止 |
| bundle chunking で初回ロード時に lazy chunk が遅延 → LCP 悪化 | Low | Medium | local mode は vendor-yjs を含まず軽くなるため改善方向、room mode は ticket fetch + WS 接続が dominant なので chunk fetch 1 つ追加は無視できる範囲 |
| Konva / react-konva の chunk 分離で SSR 再現問題 | Low | Low | snap-share は CSR-only (Cloudflare Pages 静的配信)、SSR なし |
| `hc<AppType>` 削除で smoke test が壊れる | Low | Low | smoke test を削除 or 最小化、production への影響なし |
| KV `WS_TICKETS` の追加で wrangler.toml の deploy が破綻 | Low | Medium | `wrangler kv namespace create` を先に実行し ID を `wrangler.toml` に書く、production deploy 前に staging で確認 |
| 1 PR に 5 commit 混在で review しにくい | Medium | Low | commit 順序遵守 + 各 commit を独立 reviewable な単位に保つ、PR 本文で commit 別 finding 一覧を提示 |
| `--muted-foreground` を 0.42 に下げて他 UI で過剰コントラスト | Low | Low | DropZone / RoomGate 等で視覚確認、回帰時は 0.45 程度で再調整 |

## Notes

- 本 plan は `report/phase-8-integration-review-report.md` の「Phase 8.x 推奨着手順」を **5 PR 分割 → 1 PR 5 commit に再編成** した派生形。memory ルール「PRP は PRD 単位で 1 ブランチ 1 PR」を満たし、commit 単位で Phase 8.x の sub-axis を切り分ける形にしている。
- TS 6 upgrade のリスクを最後に隔離する設計は、ユーザーから明示的に指示された制約 (auto モード prompt 内 "テーマ 5 で詰まったら最終 commit のみ revert すれば残りは生かせる構造")。
- LOW (HF=false) 36 件 / frozen archive / Phase 7.7+7.8 の retroactive umbrella report は **本 plan で touch しない** こと。これは review の判定 + Phase 8 PRD の NOT Building と整合する重要制約。
- 各 review file の `## Resolution Update` セクション更新は、commit 単位で対応する review を逐一更新する形。漏れを防ぐため Task 1-5 の最終ステップに必ず `## Resolution Update 追記` を明示している。
- 完了後の PR タイトル候補: `fix(phase-8.x): Phase 8 review の 37 finding を一括解消 — security / perf / SSOT / cleanup / modernity`。PR 本文に commit 別 finding 一覧 (HIGH/MED/LOW HF=true) と「LOW HF=false 36 件は backlog」を明示し、reviewer が commit 単位で読めるようにする。
- `prp-implement` を使う場合は theme 1 の Task 1 ブロックから順次実行。各 commit 完了時に PR を更新 (`git push`) して reviewer が早期にフィードバックできる状態を保つ。
