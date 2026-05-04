# Local Code Review: Phase 8 — 型の健全性 (#6)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: `as <UserType>` キャスト review-worthy 件を 1 件ずつ判定、`as unknown` production 5 件、`noUncheckedIndexedAccess` 回避、tuple / import type 点検
**Decision**: BLOCK (HIGH 2 件)

## Pre-Review Checks

| Check | Result |
|---|---|
| typecheck (turbo run typecheck) | Pass — 4 tasks cached, 全エラーなし |
| lint (biome ci) | Pass — 189 files, No fixes applied |
| Merge readiness | ローカルブランチ。CI block なし |

## Summary

production コード中の review-worthy `as <UserType>` キャストを全件走査した。`__tests__` / `e2e` を除く **production コードの真の review-worthy cast は 7 件** (triage 想定 30–50 件の大半がテストコード) だった。そのうち以下の 2 件が HIGH 判定:

1. **`api-client.ts` の raw fetch に `as RoomCreated` / `as RoomPublic`** — `fetch` 後の `res.json()` を Zod parse なしで型キャストしており、API レスポンスが想定外の shape でも型エラーが出ない。`RoomCreatedSchema` / `RoomPublicSchema` が `@snap-share/shared` に公開されているにもかかわらず未使用。
2. **`historyReducer.ts` の `as T` が `noUncheckedIndexedAccess` 回避キャスト** — 長さチェック後でも `T | undefined` を強制的に `T` に落としており、将来の refactor でチェックを崩したとき silent なバグが発生しうる。

MEDIUM は 3 件: `SiteverifyResponse` の inline 型定義が Zod スキーマ外、`vite-env.d.ts` 不在で `import.meta.env` を毎回 `as { ... }` で取得、`useYjsAnnotationsStore` の `awareness as AwarenessLike | null` が structural 等価を型システムで保証しない。

LOW は 3 件: `yjs-mutations.ts` の `as number`、`presence-context.ts` の awareness フィールド raw cast、`api-client.ts:117` の `as { token: string }`。

## Findings

### CRITICAL
None.

### HIGH

**H1: `api-client.ts` — `res.json()` を Zod parse なしで `as RoomCreated` / `as RoomPublic` にキャスト**

- **Location**: `apps/web/src/lib/api-client.ts:65`, `apps/web/src/lib/api-client.ts:89`
- **Issue**: 
  ```typescript
  // L65
  const body = (await res.json()) as RoomCreated;
  // L89
  return (await res.json()) as RoomPublic;
  ```
  `fetch` の `res.json()` は `Promise<any>` を返す。`as RoomCreated` / `as RoomPublic` はコンパイラを黙らせるだけで runtime 検証を行わない。`@snap-share/shared` は `RoomCreatedSchema` / `RoomPublicSchema` を公開しているが、`api-client.ts` は `import type` で型のみ利用しており Zod schema を一切 import していない。API が予期しない shape (フィールド欠落、型不一致、追加フィールド) を返した場合、呼び出し元 (`createRoom`, `fetchRoom`) が `null` や `undefined` を含む object を `RoomPublic` として扱い続け、downstream で `room.id` / `room.protected` 等を読んだ時に silent な runtime エラーが発生する。Phase 7.6 で `refine` ブランチ (`protected: true ↔ image === undefined`) を追加したにもかかわらず、クライアント側はその invariant を一切検証していない。

- **Suggested Fix**:
  ```typescript
  import { RoomCreatedSchema, RoomPublicSchema } from '@snap-share/shared';
  
  // createRoom (L64-68)
  if (res.status === 201) {
    const raw = await res.json();
    const parsed = RoomCreatedSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn('createRoom: unexpected response shape', { error: parsed.error.message });
      return { ok: false, reason: 'network' };
    }
    const { token, ...room } = parsed.data;
    return token ? { ok: true, room, token } : { ok: true, room };
  }
  
  // fetchRoom (L87-89)
  const raw = await res.json();
  const parsed = RoomPublicSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('fetchRoom: unexpected response shape', { error: parsed.error.message });
    return null;
  }
  return parsed.data;
  ```
  `import type` は `import { RoomCreatedSchema, RoomPublicSchema }` に変更する。スキーマが runtime で使われるので `type` はつけない。

- **Severity**: HIGH — production のネットワーク境界で型検証が欠落。API side の schema 変更や network error が silent に通過する。

**H2: `historyReducer.ts` — `noUncheckedIndexedAccess` 回避の `as T` キャスト**

- **Location**: `apps/web/src/hooks/historyReducer.ts:44`, `apps/web/src/hooks/historyReducer.ts:55`
- **Issue**:
  ```typescript
  // undo branch (L44)
  const previous = state.past[state.past.length - 1] as T;
  // redo branch (L55)
  const next = state.future[0] as T;
  ```
  `tsconfig.base.json` の `noUncheckedIndexedAccess: true` により `state.past[n]` は `T | undefined` になる。長さチェック (`state.past.length === 0` で早期 return) は行っているため **現状は runtime 安全**だが、`as T` は型チェックを suppress するため、将来の refactor でチェックを緩めた際にコンパイラが警告を出さず silent バグになる。`as T` を排除し、destructuring と null-safe pattern で解決できる。

- **Suggested Fix**:
  ```typescript
  // undo branch
  case 'undo': {
    if (state.past.length === 0) return state;
    const [...restPast] = state.past;
    const previous = restPast.pop();   // T | undefined — TS knows length > 0 after guard
    // より明示的にしたい場合:
    const [previous, ...withoutLast] = [...state.past].reverse();
    if (previous === undefined) return state;  // TS narrows here
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    };
  }
  ```
  または、長さチェック後に non-null assertion (`!`) + biome-ignore コメントで数学的根拠を記す (他箇所の `password.ts` 踏襲):
  ```typescript
  // biome-ignore lint/style/noNonNullAssertion: length > 0 は直上の guard で保証
  const previous = state.past[state.past.length - 1]!;
  ```
  `as T` は `undefined` を `T` に見せかけてコンパイラを欺くが、`!` は `undefined` を除去するだけで残りの型チェックは維持される。後者の方がよりコンパイラに対して誠実。

- **Severity**: HIGH — `noUncheckedIndexedAccess` を有効にした意図 (index アクセスの unsafe を検出する) を `as T` が局所的に無効化。`historyReducer` は全 annotation 操作で呼ばれる中核コード。

### MEDIUM

**M1: `turnstile-service.ts` — `SiteverifyResponse` が Zod スキーマ外のローカル inline 型**

- **Location**: `apps/api/src/services/turnstile-service.ts:41-44`
- **Issue**:
  ```typescript
  type SiteverifyResponse = Readonly<{
    success: boolean;
    'error-codes'?: ReadonlyArray<string>;
  }>;
  // ...
  const json = (await res.json()) as SiteverifyResponse;
  ```
  Cloudflare の siteverify API レスポンスを `fetch` 後に Zod parse なしでキャストしている。`SiteverifyResponse` は module-local 型で外部から検証されない。`success` フィールドが missing / unexpected type であっても `json.success` が `undefined` (falsy) として扱われ「verify failed」に倒れるためセキュリティ上は fail-close だが、型安全という意味では H1 と同じパターン。

- **Suggested Fix**:
  ```typescript
  import { z } from 'zod';
  
  const SiteverifyResponseSchema = z.object({
    success: z.boolean(),
    'error-codes': z.array(z.string()).optional(),
  });
  
  // L62:
  const parsed = SiteverifyResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    logger.warn('turnstile: unexpected siteverify shape');
    return { ok: false, reason: 'network' };
  }
  if (parsed.data.success) return { ok: true };
  ```
  fail-close なので CRITICAL ではないが、zod で統一する副次的メリット (型の一元管理、`@snap-share/shared` への移管の足がかり) がある。

- **Severity**: MEDIUM — fail-close なのでセキュリティリスクは低いが、外部 API boundary に Zod なしのキャストを許容する pattern が定着するとコードベース全体への波及リスクがある。

**M2: `vite-env.d.ts` 不在 — `import.meta.env` アクセスを毎回 `as { ... }` でキャスト**

- **Location**: `apps/web/src/lib/api-client.ts:14`, `apps/web/src/lib/yjs-config.ts:19`, `apps/web/src/pages/LocalEditor.tsx:18`
- **Issue**:
  ```typescript
  // api-client.ts:14
  (env as { VITE_API_URL?: string }).VITE_API_URL ?? ''
  // yjs-config.ts:19
  (env as { VITE_API_WS_URL?: string }).VITE_API_WS_URL
  // LocalEditor.tsx:18
  (import.meta.env as { VITE_TURNSTILE_SITE_KEY?: string }).VITE_TURNSTILE_SITE_KEY
  ```
  Vite の規約では `apps/web/src/vite-env.d.ts` (または `env.d.ts`) に `interface ImportMetaEnv` を augment して `import.meta.env.VITE_*` を直接型安全に読める。当リポジトリには `vite-env.d.ts` が存在せず、各呼び出しサイトで `as { ... }` キャストを繰り返している。キャストが散在するため、新しい env 変数を追加した際に型定義の更新を忘れやすい。

- **Suggested Fix**:
  `apps/web/src/vite-env.d.ts` を作成:
  ```typescript
  /// <reference types="vite/client" />
  
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_API_WS_URL?: string;
    readonly VITE_TURNSTILE_SITE_KEY?: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  ```
  作成後、3 箇所の `as { ... }` キャストを削除して直接 `import.meta.env.VITE_API_URL` で読める。

- **Severity**: MEDIUM — runtime への影響はないが、env 変数が増えるたびにキャストが散在しコードレビューで変更を追いにくい。`vite-env.d.ts` は Vite のベストプラクティスでもある。

**M3: `useYjsAnnotationsStore.ts` — `awareness as AwarenessLike | null` が structural 等価を型システムで検証しない**

- **Location**: `apps/web/src/hooks/useYjsAnnotationsStore.ts:185, 198`
- **Issue**:
  ```typescript
  // L185: Awareness | null に narrowing
  const awareness = ctx ? ((ctx.provider as { awareness?: Awareness }).awareness ?? null) : null;
  // L198: AwarenessLike | null にキャスト
  awareness: awareness as AwarenessLike | null,
  ```
  `Awareness` (y-protocols) と `AwarenessLike` (presence-context の minimal subset) は structural subtype 関係にあると想定されているが、TypeScript に検証させていない。`Awareness` の実装が変わり `AwarenessLike` の要求するメソッド (`on/off` signature など) と乖離した場合、`as AwarenessLike` はエラーを出さない。

- **Suggested Fix**:
  ```typescript
  // y-protocols の Awareness が AwarenessLike を満たすことをコンパイル時に検証
  const _awarenessCompat: Awareness extends AwarenessLike ? true : false = true;
  ```
  または、`AwarenessLike` を `y-protocols/awareness` の `Awareness` から `Pick` で導出する:
  ```typescript
  // presence-context.ts
  import type { Awareness as YAwareness } from 'y-protocols/awareness';
  export type AwarenessLike = Pick<YAwareness, 'clientID' | 'setLocalState' | 'setLocalStateField' | 'getStates' | 'on' | 'off'>;
  ```
  こうすれば `Awareness` → `AwarenessLike` の代入が無条件に型安全になり `as` キャストが不要になる。

- **Severity**: MEDIUM — y-protocols の minor version 変化で silent breakage の可能性。Yjs 層は協調機能の中核。

### LOW

**L1: `yjs-mutations.ts` の `as number` — Yjs `Map<unknown>` からの取得値を型検証なしでキャスト**

- **Location**: `apps/web/src/domain/annotation/yjs-mutations.ts:43-49`
- **Issue**:
  ```typescript
  m.set('fromX', (m.get('fromX') as number) + dx);
  m.set('fromY', (m.get('fromY') as number) + dy);
  m.set('toX', (m.get('toX') as number) + dx);
  m.set('toY', (m.get('toY') as number) + dy);
  // ...
  m.set('x', (m.get('x') as number) + dx);
  m.set('y', (m.get('y') as number) + dy);
  ```
  `Y.Map<unknown>.get()` は `unknown` を返す。上位で `type === 'arrow'` のチェックをしているが、`m.get('fromX')` が実際に `number` である保証はキャストで消されている。Yjs ドキュメントが `annotationToYMap` 以外の経路で汚染された場合 (外部ピアからの malformed sync など)、`NaN + dx` が Y.Map に書き込まれ、次の `yMapToAnnotation` → `AnnotationSchema.safeParse` で `z.number().finite()` に弾かれる。`safeParse` が防壁になっているため runtime データ破壊は防がれるが、`NaN` が書き込まれるまでの中間状態が発生する。

- **Suggested Fix**:
  `moveAnnotationY` 内で取得値を `typeof v === 'number' ? v : 0` で narrow するか、Yjs codec 側に `getNumber(m, key): number` helper を追加する:
  ```typescript
  const getNumber = (m: Y.Map<unknown>, key: string): number => {
    const v = m.get(key);
    return typeof v === 'number' && isFinite(v) ? v : 0;
  };
  ```

- **Severity**: LOW
- **Human Friction**:
  - 改修時必読: yes — `yjs-mutations.ts` は collab 機能追加で必ず触る
  - 再発生コスト: low — helper 追加で全箇所を一括修正できる
  - 認知負荷増: no — `as number` の意図は文脈から明確

  **Human Friction = false** (yes/low/no → 1 点)

**L2: `presence-context.ts` の awareness フィールド raw cast — Zod parse も type guard もなし**

- **Location**: `apps/web/src/hooks/presence-context.ts:36, 42-43`
- **Issue**:
  ```typescript
  const user = raw.user as { userId: string; displayName: string; color: string } | undefined;
  // ...
  cursor: (raw.cursor as { x: number; y: number } | null | undefined) ?? null,
  selectedId: (raw.selectedId as string | null | undefined) ?? null,
  ```
  `AwarenessLike.getStates()` の返り値 `Map<number, Record<string, unknown>>` から各フィールドを raw cast で取り出している。`user?.userId` のオプショナルチェーンで `falsy` 時は `continue` しているが、`user.displayName` や `user.color` が `undefined` の場合は `UserPresence` に `undefined` が混入する。`UserPresence` は `presence.ts` schema で `displayName: string` / `color: string` と定義されているが検証されない。

- **Suggested Fix**:
  `@snap-share/shared` の `UserPresenceSchema` を用いて:
  ```typescript
  import { UserPresenceSchema } from '@snap-share/shared';
  // buildOthers 内:
  const parsed = UserPresenceSchema.omit({ cursor: true, selectedId: true }).safeParse(raw.user);
  if (!parsed.success) continue;
  ```
  または `presence-context.ts` にローカルな Zod スキーマを定義する。

- **Severity**: LOW
- **Human Friction**:
  - 改修時必読: yes — presence 機能を触る際は必読
  - 再発生コスト: low — 局所修正
  - 認知負荷増: yes — `as { ... }` の連鎖で awareness state の実際の shape がコード上で見えにくい

  **Human Friction = true** (yes/low/yes → 2 点)

**L3: `api-client.ts:117` の `as { token: string }` — auth レスポンスが Zod 外**

- **Location**: `apps/web/src/lib/api-client.ts:117`
- **Issue**:
  ```typescript
  const body = (await res.json()) as { token: string };
  return { ok: true, token: body.token };
  ```
  `POST /rooms/:id/auth` の 200 レスポンスを Zod parse なしでキャスト。`token` が missing の場合 `body.token` は `undefined` になり `AuthResult.token` に `undefined` が混入するが型は `string` のまま。`setRoomToken` (呼び出し元) が `undefined` を sessionStorage に書き込む可能性がある。なお、`token` schema は API 側 (`rooms.ts`) で `z.string().min(1)` として定義されているため、正常稼働時は発生しない。

- **Suggested Fix**:
  ```typescript
  import { z } from 'zod';
  const AuthResponseSchema = z.object({ token: z.string().min(1) });
  const parsed = AuthResponseSchema.safeParse(await res.json());
  if (!parsed.success) return { ok: false, reason: 'unexpected' };
  return { ok: true, token: parsed.data.token };
  ```

- **Severity**: LOW
- **Human Friction**:
  - 改修時必読: yes — `api-client.ts` は認証フロー変更で必ず触る
  - 再発生コスト: low — 1 箇所の局所修正
  - 認知負荷増: no — `as { token: string }` の意図は自明

  **Human Friction = false** (yes/low/no → 1 点)

---

## 副次的観察 (他観点にエスクロー)

以下はスコープ外のため finding に昇格させず、該当観点にエスクロー:

- `api-client.ts` の `createRoom` / `fetchRoom` が `hc<AppType>` 型推論を使わず raw `fetch` を呼んでいる (M1 の根本原因の一つ) → **#4 Hono BP** で確認
- `presence-context.ts` の `UserPresence` 型が `@snap-share/shared` で Zod スキーマとして存在するか → **#1 SSOT** で確認
- E2E instrumentation hatch (window globals 5 件) が production bundle に含まれる設計の是非 → **#3 React BP / #5 band-aids** で確認済 (import.meta.env.DEV ガード付きで deliberate 判定)

---

## 判定テーブル — production review-worthy cast 全件

| # | Location | Cast | 判定 | Finding |
|---|---|---|---|---|
| 1 | `api-client.ts:65` | `as RoomCreated` | Zod parse で代替可能 | **H1** |
| 2 | `api-client.ts:89` | `as RoomPublic` | Zod parse で代替可能 | **H1** |
| 3 | `api-client.ts:117` | `as { token: string }` | Zod parse で代替可能 | L3 |
| 4 | `historyReducer.ts:44` | `as T` | noUncheckedIndexedAccess 回避 | **H2** |
| 5 | `historyReducer.ts:55` | `as T` | noUncheckedIndexedAccess 回避 | **H2** |
| 6 | `turnstile-service.ts:62` | `as SiteverifyResponse` | fail-close なので M | M1 |
| 7 | `token.ts:51` | `as TokenPayload` | 直上の runtime guard で型検証済 | **妥当** |
| 8 | `useYjsAnnotationsStore.ts:198` | `as AwarenessLike \| null` | structural 等価の型検証なし | M3 |
| 9 | `useYjsAnnotationsStore.ts:185` | `as { awareness?: Awareness }` | `YjsProviderLike` に `awareness` が定義されていない型推論ギャップ補填 | **deliberate** |
| 10 | `yjs-mutations.ts:43-49` | `as number` (6 件) | Yjs Map<unknown> からの取得 — downstream safeParse が防壁 | L1 |
| 11 | `presence-context.ts:36,42,43` | `as { ... }` (3 件) | awareness raw field cast | L2 |
| 12 | `api-client.ts:14` | `as { VITE_API_URL?: string }` | vite-env.d.ts 不在の workaround | M2 (同一根本原因) |
| 13 | `yjs-config.ts:19` | `as { VITE_API_WS_URL?: string }` | 同上 | M2 |
| 14 | `LocalEditor.tsx:18` | `as { VITE_TURNSTILE_SITE_KEY?: string }` | 同上 | M2 |
| 15 | `CanvasStage.tsx:183` | `as { current: Konva.Stage \| null }` | React `Ref<T>` は readonly — コメント付き deliberate | **deliberate** |
| 16 | `token.ts:45-47` | `as Record<string, unknown>` (3 件) | unknown を object property で型検証する前処理 | **deliberate** |
| 17 | `EditorShell.tsx:244,251,257,268` | `as unknown as Record<...>` (4 件) | DEV-only E2E hatch (`import.meta.env.DEV` ガード付) | **deliberate** |
| 18 | `useYjsAnnotationsStore.ts:108` | `as unknown as { __SNAP_SHARE_*__ }` | 同上 | **deliberate** |

### `as Y.*` / `as Record` sanity check

- `as Y.*` の production hit: 0 件 (grep 結果なし)。`yjs-mutations.ts` の `m.get()` 結果は `as number` で直接キャストしており、`as Y.Map` / `as Y.Array` は存在しない。
- `as Record` production 5 件: `token.ts:45-47` (runtime guard の前) + `EditorShell.tsx` の window globals 4 件。いずれも deliberate。

### `import type` 漏れ

`verbatimModuleSyntax: true` + `biome ci` が全件 pass しているため、現時点での漏れはなし。

### tuple 型

`ArrowShape.tsx:31` の `points: [number, number, number, number]` は正しく tuple 型定義されており、`number[]` への退化なし。

---

## Validation Results

| Check | Result |
|---|---|
| typecheck (turbo run typecheck) | Pass |
| lint (biome ci . ) | Pass |

---

## Files Reviewed

| File | Production? | 主な Cast | 判定 |
|---|---|---|---|
| `apps/web/src/lib/api-client.ts` | Yes | `as RoomCreated`, `as RoomPublic`, `as { token: string }` | H1, L3 |
| `apps/web/src/hooks/historyReducer.ts` | Yes | `as T` × 2 | H2 |
| `apps/api/src/services/turnstile-service.ts` | Yes | `as SiteverifyResponse` | M1 |
| `apps/web/src/lib/api-client.ts` | Yes | `as { VITE_API_URL?: string }` 等 | M2 |
| `apps/web/src/lib/yjs-config.ts` | Yes | `as { VITE_API_WS_URL?: string }` | M2 |
| `apps/web/src/pages/LocalEditor.tsx` | Yes | `as { VITE_TURNSTILE_SITE_KEY?: string }` | M2 |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | Yes | `as AwarenessLike \| null` | M3 |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | Yes | `as number` × 6 | L1 |
| `apps/web/src/hooks/presence-context.ts` | Yes | `as { ... }` × 3 | L2 |
| `apps/api/src/lib/token.ts` | Yes | `as TokenPayload`, `as Record<string, unknown>` | 妥当 |
| `apps/web/src/components/canvas/CanvasStage.tsx` | Yes | `as { current: Konva.Stage \| null }` | 妥当 |
| `apps/web/src/pages/EditorShell.tsx` | Yes | `as unknown as Record<...>` × 4 | deliberate (DEV guard) |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | Yes | `as unknown as { ... }` × 1 | deliberate (DEV guard) |
| `apps/web/src/domain/annotation/yjs-codec.ts` | Yes | キャストなし (`safeParse` 使用) | 模範例 |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | Yes | `points: [number, number, number, number]` | tuple 正常 |

---

## Decision Rationale

- **H1 (api-client.ts raw fetch cast)**: ネットワーク境界で Zod parse なし。`RoomCreatedSchema` / `RoomPublicSchema` が利用可能なのに未使用。BLOCK。
- **H2 (historyReducer.ts as T)**: `noUncheckedIndexedAccess` を明示的に有効化した設計判断を局所でキャストが裏切っている。中核コード。BLOCK。
- **MEDIUM 3 件**: 修正コストは低いが Phase 8.x で対処すべき。
- **LOW 3 件 (うち Human Friction true = L2 のみ)**: L2 (`presence-context` の raw cast) は collab 機能改修時に必読かつ認知負荷が増す。

---
*Generated: 2026-05-04*
*Reviewer: Claude Sonnet 4.6 (typescript-reviewer axis)*
