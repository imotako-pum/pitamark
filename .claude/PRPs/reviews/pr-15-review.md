# PR Review: #15 — fix(phase-8.x): Phase 8 review の 37 finding を一括解消 — security / perf / SSOT / cleanup / modernity

**Reviewed**: 2026-05-04
**Author**: imotako-pum
**Branch**: fix/phase-8-x-fixes → main
**Decision**: **APPROVE with comments**

## Summary

Phase 8 統合レビューの 37 finding を 8 commit で完全解消する PR。security / perf を Phase 9 開始前必修条件として最初の 2 commit に隔離、TS 6 upgrade などのリスクを最後の commit に分離する設計が合理的。「綺麗 + 型 + ライブラリ + 改修しやすく」方針が直近 3 commit (6-8) の extensibility refactor によく現れている (新 annotation 種を追加したときの「忘れたら気付かない場所」5 → 0)。

CRITICAL/HIGH 0。MEDIUM 1 件は merge を妨げないが、PR の方針 (Zod safeParse + hc 型推論) に最も整合する書き換えなので追加 commit 推奨。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1: `requestWsTicket` で hc 経由化したが `as { ticket: string }` cast が残っている**

- **Location**: `apps/web/src/lib/api-client.ts:206-213`
- **Issue**: theme 7 で 4 関数を hc に移行した際、`requestWsTicket` の 201 branch だけが `(await res.json()) as { ticket: string }` の cast を残している。`fetchRoom` / `authenticateRoom` は同 commit で `RoomPublicSchema` / `AuthResponseSchema` の `safeParse` 経由になっているため、ws-ticket だけ pattern が一貫しない。
- **Why it matters**: PR の核となる方針「Zod safeParse は維持 (hc は型推論のみ runtime 検証なし)」に対する局所的な逸脱。defense-in-depth の hex regex は維持されているので runtime 安全性に直接の漏れはないが、shape mismatch (`{ ticket: 12345 }` のような型不一致) を捉える防壁としては Zod の方が完全。
- **Suggested fix**: `WsTicketResponseSchema` を `apps/api/src/routes/rooms.ts` の `wsTicketResponseSchema` から `packages/shared` に export し、`safeParse` 経由に置換:
  ```ts
  // packages/shared/src/room.ts
  export const WsTicketResponseSchema = z.object({
    ticket: z.string().regex(/^[0-9a-f]{32}$/),
  }).readonly();
  export type WsTicketResponse = z.infer<typeof WsTicketResponseSchema>;
  ```
  ```ts
  // apps/web/src/lib/api-client.ts
  if (res.status === 201) {
    const parsed = WsTicketResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn('requestWsTicket: unexpected response shape', {
        issues: parsed.error.issues.map(...),
      });
      return { ok: false, reason: 'network' };
    }
    return { ok: true, ticket: parsed.data.ticket };
  }
  ```
  これで `as` cast 撤廃 + manual hex check 削除 (Zod が同じ regex を runtime 強制) + `apps/api/src/routes/rooms.ts` 側の inline `wsTicketResponseSchema` を shared 経由に統合できる (theme 3 の AuthResponseSchema と同じ pattern)。

### LOW

**L1: `yMapToAnnotation` の `as Annotation['type']` cast が type lie**

- **Location**: `apps/web/src/domain/annotation/yjs-codec.ts:57`
- **Issue**: `const type = rawType as Annotation['type'];` は外部ピアから unknown kind が来た場合に「known kinds の 1 つ」と TS に錯覚させる cast。runtime には switch の default が `void _exhaustive; return null;` で safely fallback するので bug ではないが、型レベルで `Annotation['type']` を主張するのは正直ではない。
- **Suggested fix**: cast を外して switch を runtime string に対して回し、default 内で `never` check するパターンに:
  ```ts
  const rawType = m.get('type');
  if (typeof rawType !== 'string') return null;
  let candidate: unknown;
  switch (rawType as Annotation['type']) {  // narrow で十分、外側では type 名なし
    case 'arrow': /*...*/ break;
    /* ... */
    default: {
      // rawType is unknown — defensively ignore. Compile-time exhaustiveness:
      const _: never = rawType as Annotation['type'];
      void _;
      return null;
    }
  }
  ```
  または `kind: AnnotationKind | undefined` で明示的に narrowing。現状でも runtime 動作は OK のため LOW。
- **Human Friction**: false (改修時必読 no、再発生コスト low)

**L2: `TOOL_BY_KEY` の `Object.entries` を `as Array<[Tool, string]>` で cast**

- **Location**: `apps/web/src/hooks/useKeyboardShortcuts.ts:51-53`
- **Issue**: `Object.entries(TOOL_KEYS)` は `[string, string][]` を返す (TS 仕様)。`as Array<[Tool, string]>` で workaround しているが、`TOOLS` 配列を直接使う方が cast 不要:
  ```ts
  const TOOL_BY_KEY: ReadonlyMap<string, Tool> = new Map(
    TOOLS.map((t) => [TOOL_KEYS[t], t] as const),
  );
  ```
  `TOOLS` は既に typed `readonly Tool[]` なので indexed access が型安全。
- **Human Friction**: false

**L3: `__SNAP_SHARE_STOP_UNDO_CAPTURE__` window hatch の cleanup なし**

- **Location**: `apps/web/src/hooks/useYjsAnnotationsStore.ts:226-231`
- **Issue**: `useEffect` の return cleanup がないため、`useYjsAnnotationsStore` がアンマウントされた後も window prop は残置する。実際には RoomEditor は 1 セッションで 1 つしかマウントされないため runtime 影響は皆無、かつ既存の `__SNAP_SHARE_ANNOTATIONS__` も同じ pattern なので consistent。
- **Suggested fix**: 真摯にやるなら:
  ```ts
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __SNAP_SHARE_STOP_UNDO_CAPTURE__?: () => void };
    w.__SNAP_SHARE_STOP_UNDO_CAPTURE__ = stopUndoCapture;
    return () => { delete w.__SNAP_SHARE_STOP_UNDO_CAPTURE__; };
  }, [stopUndoCapture]);
  ```
  既存の DEV hatch 全部 (5 件) を一斉に cleanup 化する別 PR が望ましい。本 PR では既存 pattern との一貫性を保つのが優先。
- **Human Friction**: false

## Validation Results

| Check | Result |
|---|---|
| Type check (TS 6.0.3) | **Pass** (turbo cache hit) |
| Lint (biome ci) | **Pass** (warning なし) |
| Tests | **Pass** — web 292 / api 176 / shared 68 = **536 件** |
| Build | **Pass** — web bundle gz `index-*.js` 86.14 KB / vendor-canvas 97.29 KB / vendor-yjs 27.82 KB chunking 維持。api wrangler dry-run pass |
| Production hatch grep | **Pass** — `grep -r '__SNAP_SHARE_' apps/web/dist/` ゼロ件 |
| E2E (annotation-tools) | **Skipped** (local 未実行 / CI 任せ) — commit 6 の `__SNAP_SHARE_STOP_UNDO_CAPTURE__` 経路は手元で実行確認推奨 |

## Files Reviewed (commits 6-8 範囲)

| File | Change |
|---|---|
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | Modified (commit 6 hatch expose) |
| `apps/web/e2e/annotation-tools.spec.ts` | Modified (commit 6 waitForTimeout 置換 × 2) |
| `apps/api/src/index.ts` | Modified (commit 7 syncRoute mount 分離) |
| `apps/api/src/yjs.ts` | Modified (commit 7 コメント / commit 8 cross-ref) |
| `apps/api/src/routes/images.ts` | Modified (commit 7 header schema 追加) |
| `apps/web/src/lib/api-client.ts` | Modified (commit 7 hc 移行 4 関数) |
| `apps/web/src/lib/__tests__/api-client.test.ts` | Modified (commit 7 smoke test 拡充) |
| `apps/web/src/domain/annotation/yjs-codec.ts` | Modified (commit 8 案 A switch+never) |
| `apps/web/src/components/toolbar/Toolbar.tsx` | Modified (commit 8 案 B Record) |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | Modified (commit 8 案 B Record + inverse Map) |
| `apps/web/src/components/dialogs/HelpModal.tsx` | Modified (commit 8 案 B Record) |
| `apps/web/src/hooks/annotationsReducer.ts` | Modified (commit 8 案 C switch+never / L4 TOOLS 導出) |
| `apps/web/src/components/canvas/CanvasStage.tsx` | Modified (commit 8 L3 DRAFT_BUILDERS) |
| `.claude/PRPs/reviews/phase-8-{tests,hono,extensibility}-review.md` | Modified (Resolution Update) |

## Recommendations

1. **Recommended (M1)**: `WsTicketResponseSchema` を `packages/shared` に export し、`requestWsTicket` の `as { ticket: string }` を `safeParse` 経由に置換。**5 分** 程度の修正で PR の方針一貫性が完璧になる。
2. **Optional (L1+L2)**: cast 表現の磨き込み。コードレビューの「型をつける」方針に最も忠実な書き換えだが、runtime 影響なし。merge 後の独立 commit でも可。
3. **Manual verification**: Phase 9 dogfood 開始前に手動で:
   - `pnpm dev` → `?ticket=<hex>` での WS 接続確認
   - `prefers-reduced-motion: reduce` 切替で `animate-pulse` 停止確認
   - `pnpm -F @snap-share/web test:e2e -- annotation-tools` で commit 6 deterministic 化を実機検証

## Decision Rationale

Phase 9 dogfood の Conditional Go 条件 (security + perf 完了) はすでに commit 1+2 で達成済み。残り 6 commit は code-quality 整備 + extensibility refactor で、いずれも regression なく green。M1 は方針整合性の問題で、merge を妨げない (defense-in-depth が runtime 安全性を担保している) ため **APPROVE with comments**。

## Self-review follow-up (commit 9: `<sha>`)

| Finding | Status |
|---|---|
| **M1** `requestWsTicket` の `as { ticket: string }` cast | **Resolved** — `WsTicketResponseSchema` を `packages/shared/src/room.ts` に export、`api-client.ts` を `safeParse` 経由 fail-soft に。`apps/api/src/routes/rooms.ts` の inline `wsTicketResponseSchema` も shared 経由に統一 (theme 3 の `AuthResponseSchema` パターンと完全一致)。32-hex regex は schema 1 箇所に集約され、手書き check 削除 |
| **L2** `Object.entries(TOOL_KEYS) as Array<[Tool, string]>` cast | **Resolved** — `TOOLS.map((t) => [TOOL_KEYS[t], t] as const)` で cast 撤廃 |
| L1 `yMapToAnnotation` の `as Annotation['type']` cast | (deferred) runtime 安全性は維持、型 lie のみ。別 PR で扱う |
| L3 window hatch の `useEffect` cleanup なし | (deferred) 既存 `__SNAP_SHARE_*` 5 件と一斉統一を別 PR で |

---
*Generated: 2026-05-04*
*Reviewer: Claude Opus 4.7 (self-review)*
