# Implementation Report: Phase 4 — リアルタイム同期 (Yjs + Cloudflare Durable Objects + Awareness)

## Summary

`apps/api` に `y-durableobjects` を統合し、Hono の `/sync/:roomId` 経由で Cloudflare Durable Object + WebSocket Hibernation を起動。`apps/web` は URL `/r/:roomId` で `useYjsAnnotationsStore` (Yjs `Y.Map` バック) と `usePresence` (Awareness) を有効化し、ローカルモードと共存する `RoomEditor` / `LocalEditor` の二段構成で実装。Vitest が `cloudflare:workers` を解決できない問題は **Vite plugin で virtual module 化** して解決し、`@cloudflare/vitest-pool-workers` 不採用方針を維持。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 6/10 | 7/10 (テスト戦略の分離で実装容易性 +1) |
| Files Created | 約 16 | 18 (factory split で +2) |
| Files Updated | 約 7 | 14 (chrome 抽出 + biome 自動整形含む) |
| Estimated LOC | 1500–2000 | 約 1900 (テスト含む) |
| New tests | 約 35–40 | **62** (api 4 + web 53 + shared 4) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1–7, 10 | Plan Tasks 1–7 + 10 | ✅ | 前セッションで完了 |
| 0 | **Unblock**: vitest cloudflare:workers virtualization | ✅ | Vite plugin (`resolveId`/`load`) + `server.deps.inline` |
| 8 | index.ts に syncRoute mount + YDurableObjects export | ✅ | wrangler dry-run で DO 検出 |
| 9 | yjs.test.ts 3 テスト (400 / 404 / passthrough) | ✅ | |
| 11 | openapi.test.ts /sync 不在 assert | ✅ | |
| 12 | wrangler.toml DO bindings + migrations | ✅ | `new_classes`、compat 2026-04-07 維持 |
| 13 | yjs-codec.ts + 9 テスト | ✅ | round-trip 4 種 + 不正棄却 + 順序 |
| 14 | yjs-mutations.ts + 14 テスト | ✅ | UndoManager origin tracking 込 |
| 15 | lib/yjs-config.ts + 5 テスト | ✅ | env / wss / encodeURIComponent |
| 16 | lib/local-user.ts + 4 テスト | ✅ | localStorage 永続 + 破損 JSON 復元 |
| 17 | colors.ts に AWARENESS_USER_PALETTE 8 色 | ✅ | |
| 18 | tokens.css に --color-presence-1..8 | ✅ | OKLCH 近似 |
| 19 | lib/url-room.ts + 6 テスト | ✅ | NanoID regex + 末尾 slash |
| 20 | useYjsAnnotationsStore + factory + 9 テスト | ✅ | Plan 逸脱: factory 分離 (後述) |
| 21 | usePresence + factory + 7 テスト | ✅ | rAF throttle / no-op handle |
| 22 | AwarenessLayer.tsx | ✅ | listening={false} |
| 23 | ConnectionBadge.tsx | ✅ | aria-live |
| 24 | CopyUrlButton.tsx | ✅ | clipboard + 1.8s フィードバック |
| 25 | useImageSource onRoomCreated callback | ✅ | API 失敗でローカル続行 |
| 26 | api-client createRoom / fetchRoom / buildImageUrl | ✅ | 失敗時 null |
| 27 | vite.config.ts /rooms + /sync (ws) proxy | ✅ | |
| 28 | App.tsx URL 分岐 + popstate listener | ✅ | |
| 29 | EditorPage 分割 → EditorShell + LocalEditor + RoomEditor | ✅ | hook 順序ルール厳守 |
| 30 | CanvasStage onCursorMove + extraLayers props | ✅ | onMouseLeave で null 通知 |
| 31 | E2E skip テスト 1 件追加 | ✅ | CI 統合は Phase 7 |
| 32 | CLAUDE.md Yjs ルール (item 8) | ✅ | |
| 33 | PRD ステータス確認 | ✅ | 既に in-progress |
| 34 | 全 validation green | ✅ | typecheck/lint/test/build all pass |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ | turbo 4 tasks; tsc zero errors |
| Linting (biome) | ✅ | 0 errors / 1 既存 warning (local-user の `!`) |
| Unit Tests | ✅ | api 41 / web 125 / 新規 62 件 |
| Build | ✅ | wrangler dry-run で `env.Y_ROOM (YDurableObjects)` 検出、vite build 695KB / gzip 212KB |
| Integration | ⏭ | DO 実機動作は手動 smoke (Plan 通り) |
| E2E | ✅ | 既存 4 件 + 新規 1 件 (skipped) |

## Files Changed

### 新規作成 (24 files)

| File | Purpose |
|---|---|
| `apps/api/src/__tests__/yjs.test.ts` | sync middleware 3 テスト |
| `apps/web/src/domain/annotation/yjs-codec.ts` | Annotation ↔ Y.Map 純関数 |
| `apps/web/src/domain/annotation/__tests__/yjs-codec.test.ts` | round-trip + 不正棄却 |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | 8 mutator + LOCAL_ORIGIN |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | mutator + UndoManager |
| `apps/web/src/lib/yjs-config.ts` | WS URL 解決 + LOCAL_ORIGIN re-export |
| `apps/web/src/lib/__tests__/yjs-config.test.ts` | env / protocol / encode |
| `apps/web/src/lib/local-user.ts` | localStorage 永続 user |
| `apps/web/src/lib/__tests__/local-user.test.ts` | 永続 / 破損 / 決定論色 |
| `apps/web/src/lib/url-room.ts` | parseRoomId / setRoomIdInUrl |
| `apps/web/src/lib/__tests__/url-room.test.ts` | パターン validation |
| `apps/web/src/hooks/useStateRef.ts` | useState + useRef 合成 |
| `apps/web/src/hooks/yjs-annotations-context.ts` | **Plan 逸脱**: pure CRDT factory |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | factory 9 テスト |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | factory + useSyncExternalStore |
| `apps/web/src/hooks/presence-context.ts` | **Plan 逸脱**: pure presence factory |
| `apps/web/src/hooks/__tests__/presence-context.test.ts` | factory 7 テスト |
| `apps/web/src/hooks/usePresence.ts` | rAF throttle + useSyncExternalStore |
| `apps/web/src/components/canvas/AwarenessLayer.tsx` | 他ユーザーカーソル + 選択枠 |
| `apps/web/src/components/connection/ConnectionBadge.tsx` | 接続状態バッジ |
| `apps/web/src/components/toolbar/CopyUrlButton.tsx` | URL コピー |
| `apps/web/src/pages/EditorShell.tsx` | 共通 chrome |
| `apps/web/src/pages/LocalEditor.tsx` | local-only モード |
| `apps/web/src/pages/RoomEditor.tsx` | Yjs + Awareness モード |

### 既存ファイル更新 (14 files)

| File | Action |
|---|---|
| `apps/api/vitest.config.ts` | cloudflare:workers virtualization plugin |
| `apps/api/src/index.ts` | syncRoute mount + YDurableObjects re-export |
| `apps/api/src/__tests__/openapi.test.ts` | /sync 不在 assert |
| `apps/api/wrangler.toml` | DO bindings + migrations |
| `apps/web/src/App.tsx` | URL routing + popstate |
| `apps/web/src/pages/EditorPage.tsx` | dispatcher (LocalEditor / RoomEditor) |
| `apps/web/src/hooks/useImageSource.ts` | onRoomCreated callback |
| `apps/web/src/lib/api-client.ts` | createRoom / fetchRoom / buildImageUrl |
| `apps/web/src/components/canvas/CanvasStage.tsx` | onCursorMove + extraLayers props |
| `apps/web/src/components/canvas/colors.ts` | AWARENESS_USER_PALETTE |
| `apps/web/src/styles/tokens.css` | --color-presence-1..8 |
| `apps/web/vite.config.ts` | /rooms + /sync proxy |
| `apps/web/e2e/landing.spec.ts` | skipped upload→/r/:id smoke |
| `CLAUDE.md` | Cross-cutting rule #8 (Yjs LOCAL_ORIGIN) |

## Deviations from Plan

### 1. CRDT/Awareness ロジックを React-free factory に分離

**WHAT**: Plan の `useYjsAnnotationsStore` / `usePresence` を、それぞれ React 非依存の `createYjsAnnotationsContext` / `createPresenceContext` 純関数 factory + 薄い React hook の二段構成に分割。

**WHY**:
- Plan の元設計では React hook を `vi.mock('y-websocket')` + `@testing-library/react` の `renderHook` で検証する想定だったが、本リポジトリは `@testing-library/react` 未導入。
- `@testing-library/react` を新規 devDep として持ち込むよりも、CRDT のコア責務 (Yjs Doc / UndoManager / WebsocketProvider lifecycle / dispatch routing) を React-free factory に切り出して直接テストするほうが、(1) テスト脆弱性が減り、(2) Plan §527 の「重い deps の追加抑制」と整合する。
- React hook 側は `useSyncExternalStore` + `useStateRef` のみの薄い接続層となり、不具合面が小さい。

**Impact**: 公開 API は Plan と完全互換。CRDT 同期ロジックの全カバレッジは factory 層で達成。React glue 層のみ E2E + 手動 smoke でカバー。

### 2. EditorShell 抽出

**WHAT**: Plan §Task 29 の `RoomEditor` / `LocalEditor` 二分割に加え、共通 chrome を `EditorShell.tsx` に抽出。

**WHY**: 二分割そのものは Plan 通り (hook 順序ルール厳守)。chrome 抽出は両編集者間の重複排除であり、Plan §1722 の許容範囲。

### 3. useImageSource 改修方針

**WHAT**: Plan は `loadFromFile` の戻り値型を変える設計だったが、戻り値型は変えず**optional `onRoomCreated` callback** を追加。

**WHY**: `useImageSource` は now local モード専用 hook (RoomEditor は使わない)。callback 形式で既存呼び出しへの影響ゼロかつ責務分離が明確。

### 4. api-client.ts の fetch 直接呼び出し

**WHAT**: Plan は `hc<AppType>` 経由で `createRoom` / `fetchRoom` を実装する想定。実装では `hc` の `api` export を維持しつつ、`createRoom` / `fetchRoom` は `fetch` 直接呼び出し。

**WHY**: `hc` の form 型 cast (`as unknown as { image: File }`) が happy-dom 環境で型推論を巻き戻す挙動が観測されたため、`fetch` 直呼びのほうがシンプルで failure path も明確。

## Issues Encountered

| Issue | Resolution |
|---|---|
| `cloudflare:workers` virtual module が Node-env vitest で解決失敗 | Vite plugin (`resolveId` + `load` で `\0virtual:` ID 経由) で `DurableObject` / `WorkerEntrypoint` のスタブを返す。`server.deps.inline = [/y-durableobjects/]` で transformer 適用を強制 |
| Yjs `Y.Map.get(...)` が doc 統合前は undefined を返し、テストで `null` 棄却が誤発火 | テストヘルパで `yAnnotations.set(id, ymap)` を経由して attach する round-trip パターンに修正 |
| Biome lint で `noVoidTypeReturn` (`return _exhaustive` in void function) | `void _exhaustive;` に変更し exhaustiveness 型チェックは保ちつつ警告を解消 |
| `EditorPage.tsx` 単一コンポーネントでの hook 順序リスク | Plan §Task 29 通り `RoomEditor` / `LocalEditor` を完全別コンポーネントにし、`<RoomEditor key={roomId} />` で roomId 変化時に強制 unmount/remount |

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/api/src/__tests__/yjs.test.ts` | 3 | sync middleware (400 / 404 / passthrough) |
| `apps/api/src/__tests__/openapi.test.ts` (+1) | 1 (添加) | OpenAPI doc に /sync 含まれない |
| `apps/web/src/domain/annotation/__tests__/yjs-codec.test.ts` | 9 | encode/decode 4 型 + 不正棄却 + snapshot |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | 14 | 8 mutator + UndoManager origin tracking |
| `apps/web/src/lib/__tests__/yjs-config.test.ts` | 5 | env / protocol / URL 組立 |
| `apps/web/src/lib/__tests__/local-user.test.ts` | 4 | 永続 / 破損 / 決定論色 |
| `apps/web/src/lib/__tests__/url-room.test.ts` | 6 | parse / build round-trip |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | 9 | factory dispatch / subscribe / undo / status |
| `apps/web/src/hooks/__tests__/presence-context.test.ts` | 7 | initLocal / setCursor / others / dispose |
| `packages/shared/src/__tests__/presence.test.ts` | 4 | UserPresenceSchema validation |
| **合計** | **62** | (Plan 想定 35–40 を上回る) |

## Manual Smoke Pending

DO の実機動作は **Plan §Validation Commands → Manual Smoke** に従い、以下が残：

```bash
pnpm -F @snap-share/api dev   # ターミナル A
pnpm -F @snap-share/web dev   # ターミナル B
# ブラウザで http://localhost:5173 を 2 タブで開く
```

チェックリスト:
- [ ] タブ A で画像 D&D → URL が `/r/:id` に変化
- [ ] URL コピー → タブ B で同じ画像表示
- [ ] 矩形追加 200ms 以内に同期
- [ ] カーソル / 選択 highlight 同期
- [ ] Undo はローカル操作のみ取り消し
- [ ] API 停止 → disconnected バッジ → 再起動で connected
- [ ] 5 分以上アイドル → Hibernation 復帰

## Next Steps

- [ ] Manual smoke (上記チェックリスト)
- [ ] `/code-review` で実装レビュー
- [ ] `/prp-pr` で PR 作成
