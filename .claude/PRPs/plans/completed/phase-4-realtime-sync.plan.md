# Plan: Phase 4 — リアルタイム同期 (Yjs + Cloudflare Durable Objects + Awareness)

## Summary

`apps/api` に `y-durableobjects` を組み込み、Cloudflare Durable Objects + WebSocket Hibernation でルームごとの Yjs ドキュメントを保持する。`apps/web` 側は Phase 3 の `useAnnotationsStore`（純粋 reducer）を **Yjs `Y.Map` バック**の `useYjsAnnotationsStore` に差し替え可能な設計にして、URL `/r/:roomId` を持つルームに入ると 2 タブ以上で注釈状態が同期する。Awareness で他ユーザーのカーソル位置・色・名前をリアルタイム表示し、再接続・Hibernation 復帰も `y-websocket` のリトライに任せる。Phase 3 の URL 無し（ローカル編集）モードはそのまま維持し、ルーム入室時のみ CRDT に切替。Undo/Redo は **Yjs `UndoManager`**（local origin tracking）に置換。

## User Story

As a snap-share の最初のユーザー（オーナー）が画像注釈を共同編集したいリモートワーカー,
I want 画像をアップロードすると即時に共有 URL が発行され、URL 経由で参加した相手の注釈・カーソル・選択状態がリアルタイムで見える状態を,
So that Teams 長文や Excel 図形の代わりに「URL 一発で 2 人以上の作業者が同じ画像に同時注釈する」体験が成立し、PRD の中核仮説（軽量 + URL 一発 + 共同編集）を一次検証できる.

## Problem → Solution

**Current**:
- `apps/web` の編集状態は `useAnnotationsStore`（`useReducer` ベースのローカル state）で完結。複数タブを開いてもそれぞれが独立したローカル state。
- ルーム URL の概念がフロント側に存在しない（`apps/web/src/App.tsx` は `<EditorPage />` のみで、URL は常にトップ）。
- `apps/api` には `Y_ROOM` Durable Object Namespace が未バインド（`wrangler.toml` のコメントに「Phase 4 で Durable Object、Phase 5 で SECRETS を追加する」とのみ記載）。
- 画像アップロードは `POST /rooms` で `Room` を返すが、フロントはレスポンスを画面遷移に使っていない（D&D した画像は `URL.createObjectURL` のみ）。
- Phase 0 spike B (`spikes/yjs-durable-object/`) で `y-durableobjects@1.0.5` + Hono 4.12 + wrangler 4.86 + `compatibility_date 2026-04-07` の最小疎通は実証済み。Awareness 拡張は未確認。

**Desired**:
- `apps/api/src/yjs.ts` に `YDurableObjects` クラスを export し、`wrangler.toml` で `Y_ROOM` バインドを宣言。`/sync/:roomId` で WebSocket upgrade を提供（`yRoute` shorthand）し、接続前に R2 メタストアでルーム存在を検証。
- `apps/web` で D&D アップロード成功時に `POST /rooms` の `room.id` を URL に反映（`history.pushState('/r/:id')`）し、ページ初期化時に `location.pathname` から roomId を読み取る。
- ルーム URL の場合は `useYjsAnnotationsStore(roomId)` を使い、Yjs `Y.Map` をバックエンドとした state を提供。これは `useAnnotationsStore`（local-only）と**同じ `AnnotationsStore` インタフェース**を返すドロップイン互換 hook。
- 注釈の追加・移動・リサイズ・削除・テキスト変更が `doc.transact(fn, LOCAL_ORIGIN)` 内で実行され、すべての接続クライアントに 200ms 以内（同一リージョン）で反映。
- `provider.awareness` で他ユーザーのカーソル位置 / 選択 ID / ユーザー色 / 表示名 を共有し、Konva 上に「他ユーザーカーソル」レイヤを描画。
- Yjs `UndoManager` で local origin だけを undo/redo 対象にし、相手の操作は奪わない。
- 5 分以上アイドル → DO Hibernation → 再操作 → 自動再接続 → state 復元のフローが破綻しない。
- `pnpm turbo run lint typecheck test build` および E2E smoke 全 green。

## Metadata

- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 4 — リアルタイム同期（pending → in-progress 化）
- **Depends on**: Phase 2（complete: `POST /rooms` + R2 メタ）/ Phase 3（complete: `AnnotationsStore` インタフェース、Konva canvas、`packages/shared` SSOT）
- **Parallel with**: なし（Phase 5/6 がこのフェーズに依存）
- **Estimated Files**: 約 16 ファイル新規 + 7 ファイル更新
- **Estimated LOC**: 1500〜2000 行（テスト含む）
- **Confidence**: 6/10 — Phase 0 spike で `y-durableobjects` の最小疎通は確認済だが、(1) `Y.Map` 上に Discriminated Union な `Annotation` を載せるエンコーディング設計、(2) `UndoManager` の local-origin 設定と React state の整合、(3) Awareness の throttle と React re-render コスト、(4) DO の `wrangler.toml` migrations の実機確認、の 4 つに想定外のハマりどころが残る

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────────┐
│  http://localhost:5173/                                   │
│  ┌──────────────────────────────────────────────────────┐│
│  │ snap-share              [↶][↷][⌫]                   ││
│  │ [▢ ▭ ↗ Aa ▒]                                         ││
│  │                                                      ││
│  │ < D&D した画像 + ローカル注釈 (タブごとに独立) >     ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│  別タブを開いても何も同期しない。URL は固定。              │
└──────────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────┐
│  http://localhost:5173/r/V1StGXR8_Z5jdHi6B-mYT            │
│  ┌──────────────────────────────────────────────────────┐│
│  │ snap-share              [↶][↷][⌫] [📋 URL コピー]   ││
│  │ [▢ ▭ ↗ Aa ▒]                                         ││
│  │                                                      ││
│  │ < 画像 + 注釈レイヤ + 他ユーザーカーソル >            ││
│  │   ●←Aさん (#5b6dff) の選択中矩形                     ││
│  │   ▽ Bさん (#e74c3c) のカーソル                       ││
│  │                                                      ││
│  └──────────────────────────────────────────────────────┘│
│  右下: 接続状態インジケータ (●connected / ⚠reconnecting)  │
└──────────────────────────────────────────────────────────┘
   ↑ 別タブで同じ URL を開けば即同期
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 画像 D&D | ObjectURL 生成のみ、URL 不変 | `POST /rooms` で R2 アップロード成功後 `history.pushState('/r/:id')` + Yjs ストアに切替 | 既存 ObjectURL は残し、CRDT は注釈のみ同期。画像 src は `/rooms/:id/image` に切替 |
| URL 直アクセス | 経路なし | `/r/:roomId` で入室 → `GET /rooms/:id` で画像メタ取得 → 画像とルームを表示 | 不正 ID は 404 画面、画像未取得は loading 表示 |
| URL コピー | 経路なし | ツールバー右の「📋 URL コピー」ボタン | `navigator.clipboard.writeText(window.location.href)` |
| 注釈追加 | ローカル state のみ | Yjs `Y.Map` への `doc.transact` でブロードキャスト | 他タブに 200ms 以内に反映 |
| カーソル表示 | 経路なし | Konva `<Layer>` 上に他ユーザーカーソル描画 | 60ms スロットル、3 秒非アクティブで非表示 |
| 接続状態 | 経路なし | 画面右下に `connected` / `connecting` / `disconnected` 小バッジ | y-websocket の `provider.on('status', ...)` |
| Undo/Redo | ローカル history stack | Yjs `UndoManager`（local origin のみ tracking） | 自分の操作のみ undo / 相手の操作は奪わない |
| Hibernation 復帰 | 経路なし | `y-websocket` の自動リトライで透過的に復帰 | Hibernation 中も WS 維持（compat date 2026-04-07） |
| ルーム未入室時 | 常にローカル | `/` ではローカル動作のまま（D&D で初めて URL 生成） | Phase 3 動作を維持 |

### Edge Case Behaviors（UX レベル）

- ルーム入室時、画像メタ取得前は `<DropZone>` 風の「読込中…」表示（`<DropZone>` は再利用しない、既に画像 src がある前提）。
- `GET /rooms/:id` が 404 を返したら「ルームが見つかりません（TTL 7 日切れの可能性）」を中央表示し、トップに戻るリンクを出す。
- WebSocket 接続が失敗 / 切断された場合、既存の注釈はローカルに残し、操作は **disable せずに継続可** とする。`y-websocket` が再接続したタイミングで CRDT が双方向 merge する（CRDT の利点を活かす）。バッジで「⚠ 再接続中」を表示。
- ローカルモード（URL `/`）で D&D アップロード中に Network エラーで `POST /rooms` が失敗したら、Phase 3 と同じく ObjectURL のままで開き、トースト等は出さず（Phase 5 で error toast 設計）コンソール warn のみ。
- 同一画面の同一タブを `Cmd+R` でリロードしても URL は維持されるため、再接続後に同じ Yjs state に復帰する。

---

## Mandatory Reading

実装前に必ず読むファイル。**この一覧を全部読めば、再度コードベースを探索する必要はない**。

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 192, 236-239 | Phase 4 行 / Goal / Scope / Success signal |
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 156-163 | Architecture Notes: CRDT 永続化戦略 / NanoID 21 字 / SSOT |
| P0 | `.claude/PRPs/prds/snap-share.prd.md` | 270-291 | Decisions Log: Yjs 採用根拠 / R2 / shared SSOT / catalog |
| P0 | `docs/spikes/REPORT.md` | all | Spike B（y-durableobjects 1.0.5 + Hono 4.12 + wrangler 4.86 + compat 2026-04-07）の確定構成 |
| P0 | `spikes/yjs-durable-object/server/index.ts` | all | **Workers 側のミラー対象**。`yRoute` shorthand + `YDurableObjects` re-export パターン |
| P0 | `spikes/yjs-durable-object/wrangler.toml` | all | **`new_classes`（NOT `new_sqlite_classes`）の根拠 + bindings 構文** |
| P0 | `spikes/yjs-durable-object/package.json` | all | `y-durableobjects@^1.0` / `hono@^4.12` / `yjs@^13.6` / `wrangler@^4` のバージョン確定 |
| P0 | `spikes/yjs-durable-object/client/package.json` | all | `y-websocket@^3.0` / `yjs@^13.6` の確定 |
| P0 | `spikes/yjs-durable-object/README.md` | all | 動作確認手順 / Hibernation 検証 |
| P0 | `apps/api/src/index.ts` | all | エントリポイント — `YDurableObjects` re-export と `app.route('/sync', ...)` 追加場所 |
| P0 | `apps/api/wrangler.toml` | all | `[[durable_objects.bindings]]` 追加場所 + `[[migrations]]` 追加場所（既存 `[[r2_buckets]]` の隣） |
| P0 | `apps/api/src/lib/bindings.ts` | all | `Bindings` 型に `Y_ROOM: DurableObjectNamespace` を追加する場所 |
| P0 | `apps/api/src/routes/rooms.ts` | all | `getRoomRoute` 経由でルーム存在確認 → middleware で再利用するための分離リファレンス |
| P0 | `apps/api/src/services/room-service.ts` | all | `createRoomService(...).get(id)` のサービス層パターン（Yjs route の middleware で使う） |
| P0 | `apps/api/src/__tests__/helpers/build-env.ts` | all | テスト env builder（Yjs テストでは `Y_ROOM` mock を追加する） |
| P0 | `apps/api/src/__tests__/helpers/in-memory-r2.ts` | all | 既存 R2 mock パターン（Yjs DO の mock を新設する場合の参考） |
| P0 | `apps/web/src/App.tsx` | all | 単一画面 → URL ルート分岐の起点 |
| P0 | `apps/web/src/pages/EditorPage.tsx` | all | Phase 3 で完成した EditorPage — `store: AnnotationsStore` を内部生成しているのを **prop 注入** に変える |
| P0 | `apps/web/src/hooks/useAnnotationsStore.ts` | all | **`AnnotationsStore` インタフェース定義の SSOT**。Yjs 版 hook がミラーする型 |
| P0 | `apps/web/src/hooks/annotationsReducer.ts` | all | `AnnotationsAction` の全種別 — Yjs 版で同等 mutation を実装する対照表 |
| P0 | `apps/web/src/hooks/historyReducer.ts` | all | ローカル history stack — Yjs `UndoManager` に切り替える置換対象 |
| P0 | `apps/web/src/components/canvas/CanvasStage.tsx` | all | `store.dispatch` の利用箇所 — インタフェース変更すると影響する |
| P0 | `apps/web/src/components/canvas/AnnotationLayer.tsx` | all | 描画レイヤ — 他ユーザーカーソル用の新規レイヤを **AnnotationLayer の上**に重ねる場所の特定 |
| P0 | `apps/web/src/components/canvas/colors.ts` | all | カラー定数の SSOT — Awareness ユーザー色のパレットを追記する |
| P0 | `apps/web/src/components/canvas/shapes/RectangleShape.tsx` | all | 選択ハイライトの描画パターン — 他ユーザー選択も同パターンで描く |
| P0 | `apps/web/src/components/empty-state/DropZone.tsx` | all | D&D 受口 — D&D 成功時に Yjs ルーム作成を呼ぶ統合点 |
| P0 | `apps/web/src/hooks/useImageSource.ts` | all | ObjectURL 生成 — `POST /rooms` 連携時の修正対象 |
| P0 | `apps/web/src/lib/id.ts` | all | `generateId` — 注釈 ID と user ID の生成パターン |
| P0 | `packages/shared/src/annotation.ts` | all | Discriminated Union の構造 — Yjs `Y.Map` への serialize/deserialize 設計の前提 |
| P0 | `packages/shared/src/room.ts` | all | `RoomSchema` / `ROOM_ID_REGEX` — `/r/:roomId` のパースに使う |
| P0 | `packages/shared/src/index.ts` | all | barrel re-export — Awareness 用 `UserPresenceSchema` を追記する場所 |
| P0 | `pnpm-workspace.yaml` | all | catalog 拡張対象（`yjs` / `y-websocket` / `y-protocols` を追加） |
| P0 | `tsconfig.base.json` | all | `verbatimModuleSyntax` / `noUncheckedIndexedAccess` の前提（Yjs ハンドラで配列インデックス時に効く） |
| P0 | `biome.json` | all | `useConst` / `noConsole: warn` の前提 |
| P0 | `.claude/rules/typescript/coding-style.md` | all | unknown narrowing / Zod 境界検証 / Immutability — Yjs と React state mirror の境界で必要 |
| P0 | `.claude/rules/web/coding-style.md` | all | feature ベース src 構成 |
| P0 | `.claude/rules/common/coding-style.md` | all | KISS / DRY / 800 行上限 / 50 行関数上限 |
| P0 | `.claude/rules/common/testing.md` | all | TDD / 80% カバレッジ / AAA |
| P0 | `CLAUDE.md` | 21-37 | Cross-cutting design rules（特に「Annotations are a Zod discriminated union」「web store は単一 useReducer」「Konva colors are hex literals」「`<KonvaImage>` は `listening={false}`」） |
| P1 | `apps/api/src/__tests__/rooms.test.ts` | all | 既存テストパターン — Yjs middleware が既存ルートを壊さないことの確認に再利用 |
| P1 | `apps/api/src/lib/error.ts` | all | `errorEnvelope` / `AppError` — Yjs middleware の 404 にも使う |
| P1 | `apps/api/src/lib/logger.ts` | all | `[api]` prefix logger — DO の lifecycle ログでも使う |
| P1 | `apps/api/src/__tests__/openapi.test.ts` | all | OpenAPI doc が既存ルートだけで生成されていることを保証（Yjs route は OpenAPI に出さない） |
| P1 | `apps/web/src/lib/logger.ts` | all | `[web]` prefix — WebSocket 接続ログで使う |
| P1 | `apps/web/src/hooks/useKeyboardShortcuts.ts` | all | Undo/Redo 経路 — `UndoManager` 切替後も同じ shortcut で動くこと |
| P1 | `apps/web/src/hooks/useStageSize.ts` | all | カーソル座標の Stage 相対変換に必要 |
| P1 | `apps/web/src/components/canvas/TextEditorOverlay.tsx` | all | テキスト編集中も他ユーザーには中間状態が見える設計の判断材料 |
| P1 | `apps/web/src/styles/tokens.css` | all | OKLCH トークン — Awareness 色のパレット定義場所 |
| P1 | `apps/web/playwright.config.ts` | all | E2E 既存設定 |
| P1 | `apps/web/e2e/landing.spec.ts` | all | E2E 拡張のミラー対象 |
| P1 | `.claude/PRPs/plans/completed/phase-3-canvas-annotation-tools.plan.md` | 1-200 | 直近 plan の文書スタイル / Mandatory Reading 表のサイズ感 |
| P1 | `.claude/PRPs/reports/phase-3-canvas-annotation-tools-report.md` | all | 「dispatch race / stale closure」の対処履歴 — Yjs に移行しても同じ罠が再発しない設計に効く |
| P1 | `docs/adr/ADR-0002-hono-zod-openapi-tanstack-stack.md` | all | TanStack Router 採用の延期判断（Phase 4 では入れない） |
| P2 | `node_modules/.pnpm/y-durableobjects@1.0.5_hono@4.12.15/node_modules/y-durableobjects/dist/index.d.ts` | all | `YDurableObjects` / `yRoute` / `WSSharedDoc` / `Awareness` 公開 API（README より型定義を読む方が早い） |
| P2 | `node_modules/.pnpm/y-durableobjects@1.0.5_hono@4.12.15/node_modules/y-durableobjects/README.md` | 1-150 | shorthand vs without-shorthand の選択肢 |
| P2 | `node_modules/.pnpm/y-durableobjects@1.0.5_hono@4.12.15/node_modules/y-durableobjects/dist/helpers/upgrade.d.ts` | all | upgrade middleware（必要時のみ） |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `y-durableobjects` | https://github.com/napolab/y-durableobjects | `yRoute<E>(env => env.BINDING)` は `/:id` を WebSocket upgrade としてマウント。`YDurableObjects` クラスを Worker module に named export する必要がある（wrangler 検出） |
| Yjs core | https://docs.yjs.dev/ | `Y.Doc` / `Y.Map` / `Y.Array` / `doc.transact(fn, origin)` / `doc.observeDeep(cb)` / `doc.destroy()` |
| `Y.UndoManager` | https://docs.yjs.dev/api/undo-manager | `new Y.UndoManager(yMap, { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout: 500 })` で local origin だけ undo 対象。500ms バッチング |
| `y-websocket` provider | https://github.com/yjs/y-websocket | `new WebsocketProvider(serverUrl, roomName, ydoc, { connect: true, params: {...} })`。`provider.on('status', ({status}) => ...)` で `'connecting' \| 'connected' \| 'disconnected'`、自動再接続あり |
| Yjs Awareness | https://docs.yjs.dev/api/about-awareness | `provider.awareness.setLocalStateField('cursor', {x, y})` / `provider.awareness.on('change', ({added, updated, removed}) => ...)` / `provider.awareness.getStates()` は `Map<clientId, state>` |
| Cloudflare DO Hibernation | https://developers.cloudflare.com/durable-objects/best-practices/websockets/ | `state.acceptWebSocket(ws)` で hibernation 対応 WS（y-durableobjects は内部で対応済）。`web_socket_auto_reply_to_close` は compat date 2026-04-07 以降デフォルト有効 |
| Cloudflare DO migrations | https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/ | `[[migrations]] tag = "v1" new_classes = ["YDurableObjects"]`。SQLite-backed DO ではないので `new_sqlite_classes` ではなく `new_classes` |
| `wrangler dev --local` | https://developers.cloudflare.com/workers/wrangler/commands/#dev | DO は `--local` (Miniflare) で完全動作。R2 もメモリ実行で開発に追加課金なし |
| `useSyncExternalStore` | https://react.dev/reference/react/useSyncExternalStore | Yjs などの**非 React 状態源**を React に橋渡しする標準 API。`subscribe(cb)` + `getSnapshot()` で tearing 回避 |
| Throttle / requestAnimationFrame | https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame | カーソル broadcast は `rAF` ベース throttle が最良（60Hz、スリープタブで自動停止） |
| `navigator.clipboard.writeText` | https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText | secure context 必須（localhost も OK）。失敗時 fallback として `document.execCommand('copy')` は捨てる（deprecated） |
| `history.pushState` / `popstate` | https://developer.mozilla.org/en-US/docs/Web/API/History/pushState | URL 書き換えと戻る/進む対応。TanStack Router を入れない最小構成で十分 |

> **GOTCHA — `Y.Map` に Discriminated Union を入れる**: 注釈の `type` フィールドは Y.Map 上で文字列値として保持する。**ただし `type` の変更はサポート外**（rectangle を arrow に変える操作はないので可）。Y.Map 内部に Y.Map を持たせると Y.Doc の整合は保てるが React への mirror で深い observe が必要 → `from`/`to` は `fromX/fromY/toX/toY` の **flat 4 fields** に展開してハマりを避ける。
>
> **READING ORDER**: この plan を実装するときは、(1) Patterns to Mirror → (2) Files to Change → (3) Step-by-Step Tasks の順で読み、Mandatory Reading は途中で参照値が必要になったときに開く。

> **GOTCHA — `YDurableObjects` の named export**: wrangler は `wrangler.toml` の `class_name = "YDurableObjects"` に対応するクラスを **Worker module の最上位 named export** から探す。`apps/api/src/index.ts` が default export だけだと検出されない。`export { YDurableObjects } from './yjs'` を追加する。

> **GOTCHA — `nodejs_compat` と Yjs**: 既存 `wrangler.toml` の `compatibility_flags = ["nodejs_compat"]` は Yjs (`lib0` 依存) の動作に必須。削らないこと。

> **GOTCHA — Vitest と Yjs / WebSocket**: `apps/api` の vitest 環境は `node`。Yjs DO の単体テストは Cloudflare の `@cloudflare/vitest-pool-workers` が必要だが、Phase 4 では **導入しない**（重い + Phase 0 で実機疎通済）。代わりに、(1) WebSocket route の存在チェック middleware は **Hono の単体テスト**でカバー、(2) Yjs ↔ Annotation エンコーディングは **pure 関数**として `apps/web/src/domain/annotation/yjs-codec.ts` に分離して happy-dom でテスト、(3) DO 動作の最終確認は **Playwright E2E + 2 タブ**（CI には載せない、ローカル smoke のみ）で検証。

> **GOTCHA — `useSyncExternalStore` と Yjs `observeDeep`**: `getSnapshot()` は同じデータでも**同じ参照を返す**必要がある（さもなくば毎レンダーで tearing 警告）。Yjs の `observeDeep` callback で `currentSnapshotRef.current = buildSnapshot()` と更新し、`getSnapshot()` は ref を返すパターンが定石。`buildSnapshot()` 内で `Object.freeze` した plain object を作る。

> **GOTCHA — `UndoManager` と `transact` origin**: `doc.transact(fn, LOCAL_ORIGIN)` で実行したものだけが UndoManager の対象になる。**`provider.on('sync')` 経由の remote 適用も `transact` を呼ぶが origin が `null`** なので tracking 対象から自動除外。逆に**ローカル mutator が `transact` 呼び忘れると undo できない**ので必ず通す。

> **GOTCHA — Awareness の clientId**: `provider.awareness.clientID` は `Y.Doc` 単位で発番される number。**ページリロードで変わる**ため、表示名の永続化には `localStorage` 経由の独自 user id を使う。色は user id をハッシュしてパレットから決定論的に選ぶ。

> **GOTCHA — `compatibility_date 2026-04-07` 以前のクライアント**: `wrangler.toml` の compat date を遡らせると `web_socket_auto_reply_to_close` が無効化されて Hibernation 復帰時に WebSocket 切断が遅くなる。**既存値（`2026-04-07`）を絶対に下げない**。

> **GOTCHA — vite proxy と WebSocket**: `apps/web/vite.config.ts` には現在 proxy 設定がない。dev で `ws://localhost:8787/sync/:id` に直接つなぐ場合は CORS / ws 両方の問題が出る可能性。**Vite の `server.proxy` で `'/sync': { target: 'ws://localhost:8787', ws: true, changeOrigin: true }` を追加** することで `ws://localhost:5173/sync/:id` 経由に統一する（同オリジン → CORS / ws 両方クリア）。`/rooms` も同様に proxy。

> **GOTCHA — Konva レイヤと Awareness カーソル**: 他ユーザーカーソルを `<AnnotationLayer>` 内に描くと selectedId 判定や注釈ヒットテストに干渉する。**新規 `<AwarenessLayer>` を `<Stage>` の最上層**として追加し、`listening={false}` で hit detection から外す。

> **GOTCHA — Phase 3 から継承する race / stale closure 対策**: `apps/web/src/components/canvas/CanvasStage.tsx` の `dragStartRef` / `draftRef` は `useRef` 維持。Yjs に移行しても **draft 中の更新は CRDT に流さない**（mouseup commit のときだけ `transact` する）ことでネットワーク負荷とレースを最小化。

---

## Patterns to Mirror

実装中はこのセクションを**他のファイルを開かなくても**書けるよう、SOURCE と実コードを貼っている。

### IMPORT_HEADER (server)
```ts
// SOURCE: spikes/yjs-durable-object/server/index.ts:1-2
import { Hono } from 'hono';
import { YDurableObjects, yRoute } from 'y-durableobjects';
```

### Y_ROOM_BINDING_TYPE
```ts
// SOURCE: spikes/yjs-durable-object/server/index.ts:4-10
type Bindings = {
  Y_ROOM: DurableObjectNamespace;
};
type Env = {
  Bindings: Bindings;
};
```

### YROUTE_MOUNT_PATTERN
```ts
// SOURCE: spikes/yjs-durable-object/server/index.ts:14-16
const route = app.route('/sync', yRoute<Env>((env) => env.Y_ROOM));
export default route;
export type AppType = typeof route;
export { YDurableObjects };  // wrangler が class_name で参照する named export
```

### WRANGLER_DO_MIGRATIONS
```toml
# SOURCE: spikes/yjs-durable-object/wrangler.toml:5-13
[[durable_objects.bindings]]
name = "Y_ROOM"
class_name = "YDurableObjects"

[[migrations]]
tag = "v1"
new_classes = ["YDurableObjects"]
```

### EXISTING_BINDINGS_TYPE_PATTERN
```ts
// SOURCE: apps/api/src/lib/bindings.ts:1-9
export type Bindings = {
  IMAGES: R2Bucket;
  ROOM_TTL_MS: string;
  // 追加対象: Y_ROOM: DurableObjectNamespace;
};
```

### EXISTING_HONO_ENTRY_PATTERN
```ts
// SOURCE: apps/api/src/index.ts:1-22
const app = new OpenAPIHono<{ Bindings: Bindings }>();
const routed = app
  .get('/health', (c) => c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }))
  .route('/rooms', roomsRoute)
  .route('/rooms', imagesRoute);
app.doc31('/api/openapi.json', openApiDocConfig);
app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));
app.notFound(onAppNotFound);
app.onError(onAppError);
export type AppType = typeof routed;
export default app;
```

### ERROR_ENVELOPE_PATTERN
```ts
// SOURCE: apps/api/src/lib/error.ts:32-40
export const errorEnvelope = (code: ErrorCode, message: string): ErrorEnvelope => ({
  ok: false,
  error: { code, message },
});

export class AppError extends HTTPException {
  readonly code: ErrorCode;
  readonly logContext?: Record<string, unknown>;
  constructor(status, code, publicMessage, logContext) { ... }
}
```

### LOGGER_PATTERN_API
```ts
// SOURCE: apps/api/src/lib/logger.ts:5-12
export const logger = {
  info: (msg, meta) => meta ? console.info('[api]', msg, meta) : console.info('[api]', msg),
  warn: (msg, meta) => meta ? console.warn('[api]', msg, meta) : console.warn('[api]', msg),
  error: (msg, meta) => meta ? console.error('[api]', msg, meta) : console.error('[api]', msg),
};
```

### ROOM_SERVICE_USAGE
```ts
// SOURCE: apps/api/src/routes/rooms.ts:31-37
const buildService = (env: Bindings) =>
  createRoomService({
    images: createR2ImageStorage(env.IMAGES),
    meta: createR2MetaStorage(env.IMAGES),
    now: () => Date.now(),
    ttlMs: Number(env.ROOM_TTL_MS),
  });
// 使い方: const room = await buildService(c.env).get(id);   // throws AppError 404
```

### ANNOTATIONS_STORE_INTERFACE (the contract Yjs hook must satisfy)
```ts
// SOURCE: apps/web/src/hooks/useAnnotationsStore.ts:6-15
export type AnnotationsStore = Readonly<{
  state: AnnotationsState;        // { annotations, selectedId, tool }
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (action: AnnotationsAction) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}>;
// AnnotationsAction の全種別は apps/web/src/hooks/annotationsReducer.ts:13-21 を参照
```

### REDUCER_DISPATCH_INVOCATION
```ts
// SOURCE: apps/web/src/components/canvas/CanvasStage.tsx:127-130
dispatch({ type: 'annotation/add', annotation: currentDraft });
dispatch({ type: 'select/set', id: currentDraft.id });
```

### CANVAS_CSS_LITERAL_COLORS
```ts
// SOURCE: apps/web/src/components/canvas/colors.ts:1-15
// Konva does not resolve CSS variables — kept in sync with tokens.css
export const STROKE_RECTANGLE = '#5b6dff';
export const STROKE_ARROW = '#e74c3c';
// 追加対象: AWARENESS_USER_PALETTE = ['#5b6dff', '#e74c3c', '#42a5f5', ...] (8 色)
```

### ZOD_SHARED_SCHEMA_PATTERN
```ts
// SOURCE: packages/shared/src/annotation.ts:7-14
export const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ColorSchema = z.string().regex(COLOR_REGEX);
export const PointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).readonly();
// 追加対象: UserPresenceSchema (cursor / userId / displayName / color)
```

### ID_GENERATION
```ts
// SOURCE: apps/web/src/lib/id.ts:1-6
export const generateId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
```

### TEST_AAA_PATTERN_WEB
```ts
// SOURCE: apps/web/src/hooks/__tests__/annotationsReducer.test.ts:1-15
import { describe, expect, it } from 'vitest';
describe('annotationsReducer', () => {
  it('adds an annotation', () => {
    // Arrange
    const state: AnnotationsState = { annotations: [], selectedId: null, tool: 'select' };
    const annotation = { id: 'a1', type: 'rectangle', ... };
    // Act
    const next = annotationsReducer(state, { type: 'annotation/add', annotation });
    // Assert
    expect(next.annotations).toEqual([annotation]);
    expect(next).not.toBe(state);  // 不変性
  });
});
```

### TEST_HONO_REQUEST_PATTERN_API
```ts
// SOURCE: apps/api/src/__tests__/rooms.test.ts:11-20
const env = buildEnv();   // helpers/build-env.ts
const form = new FormData();
form.set('image', new File([new Uint8Array(4)], 'cat.png', { type: 'image/png' }));
const res = await app.request('/rooms', { method: 'POST', body: form }, env);
expect(res.status).toBe(201);
```

### USE_SYNC_EXTERNAL_STORE_FOR_YJS
```ts
// PATTERN (新規): React 19 の標準 hook で Yjs Doc を購読
// 実装場所: apps/web/src/hooks/useYjsAnnotationsStore.ts
const subscribe = useCallback((cb: () => void) => {
  const handler = () => {
    snapshotRef.current = buildSnapshot(yAnnotations);
    cb();
  };
  yAnnotations.observeDeep(handler);
  return () => yAnnotations.unobserveDeep(handler);
}, [yAnnotations]);
const state = useSyncExternalStore(subscribe, () => snapshotRef.current);
```

### YJS_TRANSACT_WITH_ORIGIN
```ts
// PATTERN (新規): すべての mutator はこの形で書く
// 実装場所: apps/web/src/domain/annotation/yjs-mutations.ts
export const LOCAL_ORIGIN = Symbol('snap-share/local');
const addAnnotationY = (doc: Y.Doc, yAnnotations: Y.Map<Y.Map<unknown>>, annotation: Annotation): void => {
  doc.transact(() => {
    const yEntry = annotationToYMap(annotation);
    yAnnotations.set(annotation.id, yEntry);
  }, LOCAL_ORIGIN);
};
```

### YJS_CODEC_PATTERN
```ts
// PATTERN (新規): Y.Map ↔ Annotation の変換は pure 関数として分離（テスト容易）
// 実装場所: apps/web/src/domain/annotation/yjs-codec.ts
export const annotationToYMap = (annotation: Annotation): Y.Map<unknown> => {
  const m = new Y.Map<unknown>();
  m.set('id', annotation.id);
  m.set('type', annotation.type);
  m.set('createdAt', annotation.createdAt);
  switch (annotation.type) {
    case 'rectangle':
      m.set('x', annotation.x); m.set('y', annotation.y);
      m.set('width', annotation.width); m.set('height', annotation.height);
      m.set('stroke', annotation.stroke); m.set('strokeWidth', annotation.strokeWidth);
      break;
    // ... 4 種すべて
  }
  return m;
};
export const yMapToAnnotation = (m: Y.Map<unknown>): Annotation | null => {
  // Zod parse で fail-safe に Annotation か null を返す（不正な Y.Map は捨てる）
};
```

---

## Files to Change

### 新規作成

| File | Action | Justification |
|---|---|---|
| `apps/api/src/yjs.ts` | CREATE | `YDurableObjects` を re-export + ルーム存在検証 middleware + `/sync` ルート定義 |
| `apps/api/src/__tests__/yjs.test.ts` | CREATE | `/sync/:id` への upgrade なしの GET が 426 / 不正 ID が 400 / 存在しない ID が 404 を返すことの検証 |
| `apps/web/src/lib/api-client.ts` | CREATE | `hc<AppType>` ベースの API クライアント（Phase 2.5 で配線推奨だったが Phase 3 では使われていない） |
| `apps/web/src/lib/__tests__/api-client.test.ts` | CREATE | URL 解決と環境変数 fallback のテスト |
| `apps/web/src/lib/yjs-config.ts` | CREATE | WS URL の解決（`import.meta.env.VITE_API_WS_URL` or `location.origin`） + `LOCAL_ORIGIN` symbol |
| `apps/web/src/domain/annotation/yjs-codec.ts` | CREATE | `Annotation ↔ Y.Map` の pure 変換 + Zod 境界検証 |
| `apps/web/src/domain/annotation/__tests__/yjs-codec.test.ts` | CREATE | 4 注釈型 × encode/decode の round-trip + 不正 Y.Map の rejection |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | CREATE | `add/remove/move/resize-rect/resize-highlight/set-arrow-endpoints/set-text` を `doc.transact(..., LOCAL_ORIGIN)` で実行する関数群 |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | CREATE | 各 mutator の Y.Map state 変化と `Y.UndoManager` tracking |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | CREATE | `AnnotationsStore` インタフェース実装。Yjs Doc + WebsocketProvider + UndoManager + useSyncExternalStore |
| `apps/web/src/hooks/__tests__/useYjsAnnotationsStore.test.ts` | CREATE | mock provider 経由で snapshot 更新 / dispatch / undo の挙動を検証（happy-dom） |
| `apps/web/src/hooks/usePresence.ts` | CREATE | Awareness ラッパ。local user の cursor/selection broadcast + remote users の購読 |
| `apps/web/src/hooks/__tests__/usePresence.test.ts` | CREATE | Awareness mock で broadcast / 受信 / 3 秒タイムアウト |
| `apps/web/src/components/canvas/AwarenessLayer.tsx` | CREATE | 他ユーザーカーソルとカラー triangle を Konva で描画。`listening={false}` |
| `apps/web/src/components/connection/ConnectionBadge.tsx` | CREATE | 画面右下に `connected/connecting/disconnected` を表示する小バッジ |
| `apps/web/src/components/toolbar/CopyUrlButton.tsx` | CREATE | URL クリップボードコピー + 短い成功フィードバック（border 2 秒間色変え） |
| `apps/web/src/lib/local-user.ts` | CREATE | `getOrCreateLocalUser()`：localStorage に user id 保存、id ハッシュから 8 色パレットの 1 つを決定論的に選ぶ |
| `apps/web/src/lib/__tests__/local-user.test.ts` | CREATE | 永続化と決定論色選択のテスト |
| `apps/web/src/lib/url-room.ts` | CREATE | `parseRoomIdFromPath(pathname): string \| null` + `setRoomIdInUrl(id): void` |
| `apps/web/src/lib/__tests__/url-room.test.ts` | CREATE | `/r/V1StGXR8_Z5jdHi6B-mYT` パース + 不正 ID rejection |
| `packages/shared/src/presence.ts` | CREATE | `UserPresenceSchema = z.object({ userId, displayName, color, cursor: PointSchema.nullable(), selectedId: z.string().nullable() })` |
| `packages/shared/src/__tests__/presence.test.ts` | CREATE | スキーマの parse / reject ケース |

### 既存ファイル更新

| File | Action | Justification |
|---|---|---|
| `apps/api/wrangler.toml` | UPDATE | `[[durable_objects.bindings]]` Y_ROOM + `[[migrations]] new_classes = ["YDurableObjects"]` 追加 |
| `apps/api/src/lib/bindings.ts` | UPDATE | `Y_ROOM: DurableObjectNamespace` を `Bindings` 型に追加 |
| `apps/api/src/index.ts` | UPDATE | `app.route('/sync', syncRoute)` 追加 + `export { YDurableObjects } from './yjs'` |
| `apps/api/package.json` | UPDATE | `y-durableobjects` / `yjs` を catalog 経由で追加 |
| `apps/api/src/__tests__/helpers/build-env.ts` | UPDATE | `Y_ROOM` mock を Bindings に追加（unit テストでは null cast 可、結合動作は別経路） |
| `apps/api/src/__tests__/openapi.test.ts` | UPDATE | `/sync/:id` が OpenAPI doc に出現しないことを assert（既存ルートだけがリストされる） |
| `apps/web/vite.config.ts` | UPDATE | `server.proxy` に `/rooms` と `/sync` を追加（後者は `ws: true`） |
| `apps/web/package.json` | UPDATE | `yjs` / `y-websocket` / `y-protocols` を catalog 経由で追加 |
| `apps/web/src/App.tsx` | UPDATE | URL からの roomId パース → `<EditorPage roomId={...} />` または `<EditorPage roomId={null} />` |
| `apps/web/src/pages/EditorPage.tsx` | UPDATE | `store` を内部生成 → `roomId ? useYjsAnnotationsStore(roomId) : useAnnotationsStore()` で切替 + `<ConnectionBadge>` / `<CopyUrlButton>` / `<AwarenessLayer>` の配置 |
| `apps/web/src/hooks/useImageSource.ts` | UPDATE | D&D 成功時に `POST /rooms` を呼んで `room.id` を返す + `setRoomIdInUrl(room.id)` |
| `apps/web/src/components/canvas/CanvasStage.tsx` | UPDATE | `mousemove` 時に `presence.setCursor({x, y})` を rAF throttle で broadcast |
| `apps/web/src/components/canvas/colors.ts` | UPDATE | `AWARENESS_USER_PALETTE` 8 色追加 |
| `apps/web/src/styles/tokens.css` | UPDATE | OKLCH トークン: `--color-presence-1..8` 8 色 + `colors.ts` と物理同期 |
| `pnpm-workspace.yaml` | UPDATE | catalog に `yjs: ^13.6` / `y-websocket: ^3.0` / `y-protocols: ^1.0` / `y-durableobjects: ^1.0` を追加 |
| `packages/shared/src/index.ts` | UPDATE | `export * from './presence';` 追加 |
| `apps/web/e2e/landing.spec.ts` | UPDATE | E2E に「画像 D&D → URL が `/r/...` に変わる」smoke を追加（**2 タブ同期テストは追加しない**：playwright 1 ブラウザコンテキストでは厳密な multi-client 同期が脆い、ローカル手動検証） |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 4 行 `pending` → `in-progress`、PRP Plan 列にこのファイル path（**Phase 3 行も `complete` 反映 + plan path を `completed/` に更新**）— **plan 化と同時に実行済** |
| `CLAUDE.md` | UPDATE | Cross-cutting design rules に Yjs 関連 1 行追加（「Yjs mutators must wrap in `doc.transact(..., LOCAL_ORIGIN)`」） |

### 変更なしを明示するファイル

| File | Reason for non-change |
|---|---|
| `apps/api/src/routes/rooms.ts` | 既存 REST 動作を変えない（Yjs middleware は `/sync` プレフィクスで分離） |
| `apps/api/src/routes/images.ts` | 同上 |
| `apps/api/src/services/room-service.ts` | 既存サービスを `/sync` middleware から再利用するだけ。改変不要 |
| `apps/web/src/hooks/useAnnotationsStore.ts` | local モード用にそのまま残す。Yjs 版は隣に新設 |
| `apps/web/src/hooks/annotationsReducer.ts` | local モード用にそのまま残す。Action 型定義は Yjs mutator にもそのまま使う |
| `apps/web/src/hooks/historyReducer.ts` | local モード用にそのまま残す（Yjs 側は `UndoManager` のみ使用） |

## NOT Building

- **TanStack Router** — Phase 4 では `history.pushState` + `popstate` + 自前 `parseRoomIdFromPath` で十分。ルートが `/` と `/r/:id` の 2 種だけのため。Phase 6 で shadcn と同タイミングで導入を検討（ADR-0002 §「保留判断」と整合）。
- **画像同期** — 画像はルーム作成時に R2 に 1 度だけアップロードし、その URL を CRDT の外で全クライアントが GET。Yjs Doc に画像を入れる設計は採用しない（ペイロード過大）。
- **テキスト編集中の中間文字の broadcast** — `<textarea>` の入力途中を CRDT に流すと帯域 / Awareness が爆発。**確定（commit）時のみ** Y.Map に書き込む（Phase 3 の `handleTextCommit` 経路を維持）。リアルタイム文字入力は将来の拡張（Phase 8 以降）。
- **権限管理 / パスワード保護** — Phase 5 で扱う。Phase 4 は URL を知っていれば誰でも入れる前提。
- **TTL での DO state 自動破棄** — Phase 5 で `state.setAlarm()` を使い実装。Phase 4 は「R2 メタは 7 日 TTL（既存）+ DO は実質永続」で容認。
- **DO storage への明示スナップショット保存** — `y-durableobjects` 内部の `YTransactionStorageImpl` (default 10KB / 500 updates) に任せる。明示制御は Phase 5 の TTL とまとめて入れる。
- **PNG エクスポート** — Phase 6。
- **shadcn UI コンポーネント** — Phase 6。`<ConnectionBadge>` / `<CopyUrlButton>` は手書きの Tailwind で。
- **モバイル / タッチ対応** — Phase 3 と同じく desktop 優先。
- **複数ルーム間切替 UI** — Phase 4 では URL 直入力 / D&D による URL 生成のみ。
- **2 タブ同期の Playwright E2E テスト** — playwright で multi-context multi-tab の WebSocket 同期テストは flaky。手動 smoke で代替し、CI には載せない。
- **`@cloudflare/vitest-pool-workers` 導入** — Phase 4 では DO の単体テストを書かず、(1) middleware は Hono の `app.request` テスト、(2) codec/mutations は pure 関数テスト、(3) DO 全体は手動 smoke。理由は「テストランナー導入コスト > Phase 0 spike B で実機検証済の追加保証」。
- **Yjs offline 編集 / IndexedDB persist** — Phase 8 以降。MVP では入室中接続前提。

---

## Step-by-Step Tasks

### Task 1: catalog 拡張
- **ACTION**: `pnpm-workspace.yaml` の `catalog:` セクションに Yjs 関連 4 deps を追記
- **IMPLEMENT**:
  ```yaml
  catalog:
    # 既存...
    yjs: ^13.6
    y-websocket: ^3.0
    y-protocols: ^1.0
    y-durableobjects: ^1.0
  ```
- **MIRROR**: `pnpm-workspace.yaml` の既存 catalog エントリ（`konva: ^10.2` などの定義スタイル）
- **IMPORTS**: なし
- **GOTCHA**: バージョンは Spike B 実機確認済の `y-durableobjects@1.0.5` / `yjs@13.6.30` / `y-websocket@3.0.0` / `y-protocols@1.0.6` と互換のレンジ。`y-protocols` は `y-durableobjects` の transitive dep だがクライアント側の Awareness 型 import で必要
- **VALIDATE**: `pnpm install --filter ...` を後段で走らせるまでは何も変わらない。`yq` 等で構文確認のみ

### Task 2: apps/api の deps 追加
- **ACTION**: `apps/api/package.json` の `dependencies` に `y-durableobjects` と `yjs` を追加（catalog 経由）
- **IMPLEMENT**:
  ```json
  "dependencies": {
    "@snap-share/shared": "workspace:*",
    "@hono/zod-openapi": "catalog:",
    "@hono/zod-validator": "catalog:",
    "@scalar/hono-api-reference": "catalog:",
    "hono": "^4.12",
    "nanoid": "catalog:",
    "y-durableobjects": "catalog:",
    "yjs": "catalog:",
    "zod": "catalog:"
  }
  ```
- **MIRROR**: `apps/api/package.json` の既存 deps
- **IMPORTS**: なし
- **GOTCHA**: `y-durableobjects` は CommonJS と ESM の dual entry。`apps/api` は `"type": "module"` のため ESM 解決される
- **VALIDATE**: `pnpm install` 成功 + `pnpm -F @snap-share/api typecheck` ゼロエラー

### Task 3: apps/web の deps 追加
- **ACTION**: `apps/web/package.json` の `dependencies` に `yjs` / `y-websocket` / `y-protocols` を追加
- **IMPLEMENT**: `"yjs": "catalog:"`, `"y-websocket": "catalog:"`, `"y-protocols": "catalog:"`
- **MIRROR**: 既存 catalog 利用 (`konva: catalog:`)
- **IMPORTS**: なし
- **GOTCHA**: `y-websocket` v3 は ESM only。Vite で問題なし
- **VALIDATE**: `pnpm install` + `pnpm -F @snap-share/web typecheck` ゼロエラー

### Task 4: shared/presence.ts スキーマ追加（TDD）
- **ACTION**: 失敗するテスト → スキーマ実装 → barrel export の順で `packages/shared/src/presence.ts` を作成
- **IMPLEMENT**:
  ```ts
  // packages/shared/src/presence.ts
  import { z } from 'zod';
  import { PointSchema } from './annotation';

  export const PRESENCE_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
  export const MAX_DISPLAY_NAME_LENGTH = 32;

  export const UserPresenceSchema = z.object({
    userId: z.string().min(1).max(64),
    displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH),
    color: z.string().regex(PRESENCE_COLOR_REGEX),
    cursor: PointSchema.nullable(),
    selectedId: z.string().nullable(),
  }).readonly();

  export type UserPresence = z.infer<typeof UserPresenceSchema>;
  ```
- **MIRROR**: `ZOD_SHARED_SCHEMA_PATTERN`（このプランの Patterns セクション）
- **IMPORTS**: `import { z } from 'zod'; import { PointSchema } from './annotation';`
- **GOTCHA**: `displayName.min(1)` を入れること。空文字は意味がない
- **VALIDATE**: `packages/shared/src/__tests__/presence.test.ts` で valid / invalid 各 4 ケース → `pnpm -F @snap-share/shared test` 全 pass

### Task 5: shared barrel 拡張
- **ACTION**: `packages/shared/src/index.ts` に `export * from './presence';` を追加
- **IMPLEMENT**:
  ```ts
  export * from './annotation';
  export * from './room';
  export * from './presence';
  ```
- **MIRROR**: 既存 barrel
- **IMPORTS**: なし
- **GOTCHA**: なし
- **VALIDATE**: `pnpm -F @snap-share/shared typecheck` + `pnpm -F @snap-share/web typecheck` ゼロエラー

### Task 6: bindings.ts に Y_ROOM 追加
- **ACTION**: `apps/api/src/lib/bindings.ts` の `Bindings` 型に `Y_ROOM: DurableObjectNamespace` を追加
- **IMPLEMENT**:
  ```ts
  export type Bindings = {
    IMAGES: R2Bucket;
    ROOM_TTL_MS: string;
    /** Yjs/CRDT room state. Bound to YDurableObjects class via wrangler.toml. */
    Y_ROOM: DurableObjectNamespace;
  };
  ```
- **MIRROR**: `EXISTING_BINDINGS_TYPE_PATTERN`
- **IMPORTS**: なし（`DurableObjectNamespace` は `@cloudflare/workers-types` 経由でグローバル）
- **GOTCHA**: コメントは TSDoc 1 行（CLAUDE.md / coding-style 準拠）
- **VALIDATE**: `pnpm -F @snap-share/api typecheck` ゼロエラー

### Task 7: yjs.ts 作成（DO クラス re-export + 存在検証 middleware）
- **ACTION**: `apps/api/src/yjs.ts` を新設し、`YDurableObjects` を re-export しつつルーム存在を検証する middleware を組み込む
- **IMPLEMENT**:
  ```ts
  // apps/api/src/yjs.ts
  import { Hono } from 'hono';
  import { ROOM_ID_REGEX } from '@snap-share/shared';
  import { YDurableObjects, yRoute } from 'y-durableobjects';
  import type { Bindings } from './lib/bindings';
  import { errorEnvelope } from './lib/error';
  import { logger } from './lib/logger';
  import { createRoomService } from './services/room-service';
  import { createR2ImageStorage } from './storage/r2-image-storage';
  import { createR2MetaStorage } from './storage/r2-meta-storage';

  export { YDurableObjects };

  export const syncRoute = new Hono<{ Bindings: Bindings }>()
    .use('/:id', async (c, next) => {
      const id = c.req.param('id');
      if (!ROOM_ID_REGEX.test(id)) {
        return c.json(errorEnvelope('INVALID_REQUEST', 'Invalid room ID'), 400);
      }
      try {
        await createRoomService({
          images: createR2ImageStorage(c.env.IMAGES),
          meta: createR2MetaStorage(c.env.IMAGES),
          now: () => Date.now(),
          ttlMs: Number(c.env.ROOM_TTL_MS),
        }).get(id);
      } catch {
        logger.warn('sync ws denied: room not found', { id });
        return c.json(errorEnvelope('NOT_FOUND', 'Room not found'), 404);
      }
      return next();
    })
    .route('/', yRoute<{ Bindings: Bindings }>((env) => env.Y_ROOM));
  ```
- **MIRROR**: `YROUTE_MOUNT_PATTERN` + `ROOM_SERVICE_USAGE` + `ERROR_ENVELOPE_PATTERN`
- **IMPORTS**: 上記参照
- **GOTCHA**:
  - middleware で `room-service.get(id)` が `AppError(404)` を throw する → catch して 404 envelope を返す。`onAppError` までは bubble させない（早期 return が単純）
  - ws upgrade を試みていない通常 GET は y-durableobjects 内部で 426 / 400 を返す。挙動は yRoute に委ねる
  - `ROOM_ID_REGEX` で先にバリデーション → R2 lookup を回避してコスト削減
- **VALIDATE**: 後続 Task 9 のテストで検証

### Task 8: index.ts に sync route と DO export を組み込む
- **ACTION**: `apps/api/src/index.ts` を更新し `syncRoute` を mount + `YDurableObjects` を named export
- **IMPLEMENT**:
  ```ts
  import { OpenAPIHono } from '@hono/zod-openapi';
  import { Scalar } from '@scalar/hono-api-reference';
  import type { Bindings } from './lib/bindings';
  import { onAppError, onAppNotFound } from './lib/error';
  import { openApiDocConfig } from './lib/openapi';
  import { imagesRoute } from './routes/images';
  import { roomsRoute } from './routes/rooms';
  import { syncRoute } from './yjs';

  export { YDurableObjects } from './yjs';

  const app = new OpenAPIHono<{ Bindings: Bindings }>();

  const routed = app
    .get('/health', (c) => c.json({ ok: true, service: 'snap-share-api', ts: Date.now() }))
    .route('/rooms', roomsRoute)
    .route('/rooms', imagesRoute)
    .route('/sync', syncRoute);

  app.doc31('/api/openapi.json', openApiDocConfig);
  app.get('/api/docs', Scalar({ url: '/api/openapi.json' }));

  app.notFound(onAppNotFound);
  app.onError(onAppError);

  export type AppType = typeof routed;
  export default app;
  ```
- **MIRROR**: `EXISTING_HONO_ENTRY_PATTERN`
- **IMPORTS**: 上記
- **GOTCHA**:
  - `export { YDurableObjects } from './yjs'` を **必ず** 追加。wrangler が class 検出できないとデプロイ失敗
  - `routed` チェーンに `.route('/sync', syncRoute)` を追加することで `AppType` に `/sync/:id` の型情報が入るが、yRoute は `outputFormat: 'ws'` なので `hc` 経由では呼ばない（フロントは `WebsocketProvider` を直接使う）
  - OpenAPI ドキュメントには `sync` ルートが**入らないこと** を `openapi.test.ts` で確認する
- **VALIDATE**: `pnpm -F @snap-share/api typecheck` + `pnpm -F @snap-share/api test` で既存 + 新規テスト全 pass

### Task 9: yjs.test.ts 作成（TDD）
- **ACTION**: `apps/api/src/__tests__/yjs.test.ts` を新設
- **IMPLEMENT**:
  ```ts
  import { describe, expect, it } from 'vitest';
  import app from '../index';
  import { buildEnv } from './helpers/build-env';

  describe('GET /sync/:id (validation middleware)', () => {
    it('returns 400 INVALID_REQUEST when ID does not match NanoID pattern', async () => {
      const env = buildEnv();
      const res = await app.request('/sync/..%2Fetc%2Fpasswd', undefined, env);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('INVALID_REQUEST');
    });

    it('returns 404 NOT_FOUND when valid ID does not exist in R2 meta', async () => {
      const env = buildEnv();
      const res = await app.request('/sync/V1StGXR8_Z5jdHi6B-mYT', undefined, env);
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe('NOT_FOUND');
    });

    it('passes through middleware for an existing room (yRoute responds without upgrade header)', async () => {
      const env = buildEnv();
      const form = new FormData();
      form.set('image', new File([new Uint8Array(4)], 'cat.png', { type: 'image/png' }));
      const created = await (await app.request('/rooms', { method: 'POST', body: form }, env)).json();
      const res = await app.request(`/sync/${created.id}`, undefined, env);
      expect(res.status).not.toBe(404);
      const body = await res.json().catch(() => ({}));
      expect(body?.error?.code).not.toBe('NOT_FOUND');
    });
  });
  ```
- **MIRROR**: `TEST_HONO_REQUEST_PATTERN_API`
- **IMPORTS**: 既存 helpers
- **GOTCHA**:
  - 3 番目のテストは `Y_ROOM` binding が存在しないと `app.request` が internal error を返す可能性 → `buildEnv` の更新（Task 10）必須
  - DO の動作そのものは `wrangler dev` + 2 タブの手動 smoke でカバー。本テストでは middleware 振り分けだけを保証
- **VALIDATE**: `pnpm -F @snap-share/api test` で既存 + 新規 3 件全 pass

### Task 10: build-env.ts に Y_ROOM mock を追加
- **ACTION**: `apps/api/src/__tests__/helpers/build-env.ts` の `buildEnv` で `Y_ROOM` を no-op DurableObjectNamespace で埋める
- **IMPLEMENT**:
  ```ts
  import type { Bindings } from '../../lib/bindings';
  import { createInMemoryR2 } from './in-memory-r2';

  export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  // Tests do not exercise the live DO — they only verify the validation
  // middleware in front of yRoute. yRoute itself is exercised by the local
  // `wrangler dev` smoke (manual). A minimal namespace stub satisfies typing.
  const noopY_ROOM = {
    idFromName: (name: string) => ({ toString: () => name }),
    idFromString: (s: string) => ({ toString: () => s }),
    newUniqueId: () => ({ toString: () => 'unique' }),
    get: () => ({
      fetch: async () =>
        new Response(null, { status: 426, headers: { 'content-type': 'application/json' } }),
    }),
  } as unknown as DurableObjectNamespace;

  export const buildEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
    IMAGES: createInMemoryR2(),
    ROOM_TTL_MS: String(DEFAULT_TTL_MS),
    Y_ROOM: noopY_ROOM,
    ...overrides,
  });
  ```
- **MIRROR**: 既存 helpers
- **IMPORTS**: 既存
- **GOTCHA**: `as unknown as DurableObjectNamespace` で型強制 — middleware だけテストするので OK。`get()` から返す stub `fetch` は **必ず Response を返す**（undefined だと yRoute 側で undefined.body アクセスで落ちる）
- **VALIDATE**: 既存 `rooms.test.ts` / `images.test.ts` / `health.test.ts` が無改変で全 pass + Task 9 の新規 3 件も pass

### Task 11: openapi.test.ts に sync 不在の assert 追加
- **ACTION**: `/api/openapi.json` に `/sync/{id}` パスが**含まれない** ことを保証するアサートを追加
- **IMPLEMENT**:
  ```ts
  it('does not include /sync routes in the OpenAPI spec (Yjs WS is out-of-band)', async () => {
    const res = await app.request('/api/openapi.json');
    const spec = await res.json();
    expect(Object.keys(spec.paths)).not.toContain('/sync/{id}');
    expect(Object.keys(spec.paths)).not.toContain('/sync/:id');
  });
  ```
- **MIRROR**: `apps/api/src/__tests__/openapi.test.ts` の既存テスト構造
- **IMPORTS**: 既存
- **GOTCHA**: `routed.route('/sync', syncRoute)` は AppType には現れるが、`syncRoute` 内部は `Hono` (not `OpenAPIHono`) なので OpenAPI doc には出ない。意図通りなのを assert で固定
- **VALIDATE**: `pnpm -F @snap-share/api test` で全 pass

### Task 12: wrangler.toml 更新
- **ACTION**: `apps/api/wrangler.toml` に `[[durable_objects.bindings]]` と `[[migrations]]` を追加
- **IMPLEMENT**:
  ```toml
  name = "snap-share-api"
  main = "src/index.ts"
  compatibility_date = "2026-04-07"
  compatibility_flags = ["nodejs_compat"]

  [[r2_buckets]]
  binding = "IMAGES"
  bucket_name = "snap-share-images"

  [[durable_objects.bindings]]
  name = "Y_ROOM"
  class_name = "YDurableObjects"

  [[migrations]]
  tag = "v1"
  new_classes = ["YDurableObjects"]

  [vars]
  ROOM_TTL_MS = "604800000" # 7 days

  # Phase 5 で SECRETS を追加する
  ```
- **MIRROR**: `WRANGLER_DO_MIGRATIONS` + 既存 `wrangler.toml` 構造
- **IMPORTS**: なし
- **GOTCHA**:
  - `compatibility_date` は **絶対に下げない**（`web_socket_auto_reply_to_close` 維持）
  - `new_sqlite_classes` ではなく `new_classes`（Spike B 確認済）
  - 既存 `[vars]` セクションの**前に** DO セクションを置く方が wrangler 出力が読みやすい
- **VALIDATE**: `pnpm -F @snap-share/api build`（`wrangler deploy --dry-run`）で warning ゼロ

### Task 13: yjs-codec.ts 作成（TDD）
- **ACTION**: `apps/web/src/domain/annotation/yjs-codec.ts` で `Annotation ↔ Y.Map` 変換を pure 関数として実装
- **IMPLEMENT**:
  ```ts
  // apps/web/src/domain/annotation/yjs-codec.ts
  import { type Annotation, AnnotationSchema } from '@snap-share/shared';
  import * as Y from 'yjs';

  export const annotationToYMap = (annotation: Annotation): Y.Map<unknown> => {
    const m = new Y.Map<unknown>();
    m.set('id', annotation.id);
    m.set('type', annotation.type);
    m.set('createdAt', annotation.createdAt);
    switch (annotation.type) {
      case 'rectangle':
        m.set('x', annotation.x); m.set('y', annotation.y);
        m.set('width', annotation.width); m.set('height', annotation.height);
        m.set('stroke', annotation.stroke); m.set('strokeWidth', annotation.strokeWidth);
        break;
      case 'arrow':
        m.set('fromX', annotation.from.x); m.set('fromY', annotation.from.y);
        m.set('toX', annotation.to.x); m.set('toY', annotation.to.y);
        m.set('stroke', annotation.stroke); m.set('strokeWidth', annotation.strokeWidth);
        break;
      case 'text':
        m.set('x', annotation.x); m.set('y', annotation.y);
        m.set('text', annotation.text);
        m.set('fontSize', annotation.fontSize); m.set('fill', annotation.fill);
        break;
      case 'highlight':
        m.set('x', annotation.x); m.set('y', annotation.y);
        m.set('width', annotation.width); m.set('height', annotation.height);
        m.set('fill', annotation.fill);
        break;
    }
    return m;
  };

  export const yMapToAnnotation = (m: Y.Map<unknown>): Annotation | null => {
    const type = m.get('type');
    let candidate: unknown;
    if (type === 'arrow') {
      candidate = {
        id: m.get('id'),
        type: 'arrow',
        createdAt: m.get('createdAt'),
        from: { x: m.get('fromX'), y: m.get('fromY') },
        to: { x: m.get('toX'), y: m.get('toY') },
        stroke: m.get('stroke'),
        strokeWidth: m.get('strokeWidth'),
      };
    } else {
      const base = {
        id: m.get('id'),
        type,
        createdAt: m.get('createdAt'),
      };
      if (type === 'rectangle') {
        candidate = { ...base, x: m.get('x'), y: m.get('y'), width: m.get('width'),
          height: m.get('height'), stroke: m.get('stroke'), strokeWidth: m.get('strokeWidth') };
      } else if (type === 'text') {
        candidate = { ...base, x: m.get('x'), y: m.get('y'), text: m.get('text'),
          fontSize: m.get('fontSize'), fill: m.get('fill') };
      } else if (type === 'highlight') {
        candidate = { ...base, x: m.get('x'), y: m.get('y'), width: m.get('width'),
          height: m.get('height'), fill: m.get('fill') };
      } else {
        return null;
      }
    }
    const parsed = AnnotationSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  };

  export const buildAnnotationsSnapshot = (
    yAnnotations: Y.Map<Y.Map<unknown>>,
  ): ReadonlyArray<Annotation> => {
    const result: Annotation[] = [];
    for (const yEntry of yAnnotations.values()) {
      const annotation = yMapToAnnotation(yEntry);
      if (annotation !== null) result.push(annotation);
    }
    // 安定順序のため createdAt 昇順でソート（描画順に直結）
    return Object.freeze(result.sort((a, b) => a.createdAt - b.createdAt));
  };
  ```
- **MIRROR**: `YJS_CODEC_PATTERN` + `ZOD_SHARED_SCHEMA_PATTERN`
- **IMPORTS**: 上記
- **GOTCHA**:
  - **`type` は最初に取り出して narrow**。`AnnotationSchema.safeParse` 経由で最終バリデーション（不正データは null で捨てる）
  - `from`/`to` は flat 4 fields → decode 時に nested point に組み立て直す
  - `Object.freeze` + `sort` で snapshot 安定化（`useSyncExternalStore` の参照同一性に効く）
  - `for...of yAnnotations.values()` の iteration 順は Y.Map 内部の挿入順
- **VALIDATE**: `apps/web/src/domain/annotation/__tests__/yjs-codec.test.ts` で 4 注釈型 × encode → decode round-trip + 不正 Y.Map → null + 順序保証 = 計 8〜10 ケース → `pnpm -F @snap-share/web test` 全 pass

### Task 14: yjs-mutations.ts 作成（TDD）
- **ACTION**: `apps/web/src/domain/annotation/yjs-mutations.ts` で 7 種の mutator + `LOCAL_ORIGIN` symbol を export
- **IMPLEMENT**:
  ```ts
  // apps/web/src/domain/annotation/yjs-mutations.ts
  import type { Annotation, Point } from '@snap-share/shared';
  import * as Y from 'yjs';
  import { annotationToYMap } from './yjs-codec';

  export const LOCAL_ORIGIN = Symbol('snap-share/local');

  type YAnnotations = Y.Map<Y.Map<unknown>>;
  const tx = (doc: Y.Doc, fn: () => void): void => {
    doc.transact(fn, LOCAL_ORIGIN);
  };

  export const addAnnotationY = (doc: Y.Doc, ya: YAnnotations, a: Annotation): void => {
    tx(doc, () => ya.set(a.id, annotationToYMap(a)));
  };

  export const removeAnnotationY = (doc: Y.Doc, ya: YAnnotations, id: string): void => {
    tx(doc, () => { ya.delete(id); });
  };

  export const moveAnnotationY = (doc: Y.Doc, ya: YAnnotations, id: string, dx: number, dy: number): void => {
    const m = ya.get(id);
    if (!m) return;
    const type = m.get('type');
    tx(doc, () => {
      if (type === 'arrow') {
        m.set('fromX', (m.get('fromX') as number) + dx);
        m.set('fromY', (m.get('fromY') as number) + dy);
        m.set('toX', (m.get('toX') as number) + dx);
        m.set('toY', (m.get('toY') as number) + dy);
      } else {
        m.set('x', (m.get('x') as number) + dx);
        m.set('y', (m.get('y') as number) + dy);
      }
    });
  };

  export const resizeRectangleY = (doc: Y.Doc, ya: YAnnotations, id: string, width: number, height: number): void => {
    const m = ya.get(id);
    if (!m || m.get('type') !== 'rectangle') return;
    tx(doc, () => { m.set('width', width); m.set('height', height); });
  };

  export const resizeHighlightY = (doc: Y.Doc, ya: YAnnotations, id: string, width: number, height: number): void => {
    const m = ya.get(id);
    if (!m || m.get('type') !== 'highlight') return;
    tx(doc, () => { m.set('width', width); m.set('height', height); });
  };

  export const setArrowEndpointsY = (doc: Y.Doc, ya: YAnnotations, id: string, from: Point, to: Point): void => {
    const m = ya.get(id);
    if (!m || m.get('type') !== 'arrow') return;
    tx(doc, () => {
      m.set('fromX', from.x); m.set('fromY', from.y);
      m.set('toX', to.x); m.set('toY', to.y);
    });
  };

  export const setTextY = (doc: Y.Doc, ya: YAnnotations, id: string, text: string): void => {
    const m = ya.get(id);
    if (!m || m.get('type') !== 'text') return;
    tx(doc, () => { m.set('text', text); });
  };

  export const clearAllY = (doc: Y.Doc, ya: YAnnotations): void => {
    tx(doc, () => { ya.clear(); });
  };
  ```
- **MIRROR**: `YJS_TRANSACT_WITH_ORIGIN` + `apps/web/src/domain/annotation/operations.ts`（同等の局所 mutation がローカル版に存在）
- **IMPORTS**: 上記
- **GOTCHA**:
  - **`type` チェックを必ず行う**。例: `resizeRectangleY` を arrow に対して呼ばれても無視
  - `as number` で narrow しているのは、`Y.Map<unknown>` 経由で読むため。Zod parse は snapshot 段階で行うので mutator では信頼してよい
  - **mutator 内で `transact` を呼ぶこと**。呼ばないと `UndoManager` の対象にならない
- **VALIDATE**: `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` で各関数 × happy + 不正型 no-op + UndoManager tracking 計 12〜14 ケース pass

### Task 15: lib/yjs-config.ts 作成
- **ACTION**: `apps/web/src/lib/yjs-config.ts` で WS URL 解決と origin symbol を export
- **IMPLEMENT**:
  ```ts
  // apps/web/src/lib/yjs-config.ts
  // Re-export so all hooks share the SAME symbol identity (UndoManager origin tracking).
  export { LOCAL_ORIGIN } from '../domain/annotation/yjs-mutations';

  /**
   * WebSocket base URL for the Yjs sync endpoint.
   * Resolution order: VITE_API_WS_URL env → derived from window.location → 'ws://localhost:8787'.
   */
  export const resolveWsBaseUrl = (
    env: ImportMetaEnv = import.meta.env,
    location: { protocol: string; host: string } = window.location,
  ): string => {
    const fromEnv = (env as { VITE_API_WS_URL?: string }).VITE_API_WS_URL;
    if (fromEnv) return fromEnv;
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${location.host}`;
  };

  /** Build the full WS URL for a given roomId (depends on Vite proxy or env override). */
  export const buildSyncUrl = (roomId: string, baseUrl: string = resolveWsBaseUrl()): string =>
    `${baseUrl}/sync/${encodeURIComponent(roomId)}`;
  ```
- **MIRROR**: なし（新規パターン）
- **IMPORTS**: `import { LOCAL_ORIGIN } from '../domain/annotation/yjs-mutations';`
- **GOTCHA**:
  - **`LOCAL_ORIGIN` を別ファイルで再 export して identity 共有**。同じ symbol を `mutations.ts` と `useYjsAnnotationsStore.ts` で参照しないと UndoManager の `trackedOrigins.has(...)` が false になる
  - vite proxy 経由なら同オリジンに `/sync` が解決される → デフォルトの `location.host` 派生で十分
  - `encodeURIComponent` は roomId が NanoID（`[A-Za-z0-9_-]`）のみなので実質 no-op だが防御的に
- **VALIDATE**: `apps/web/src/lib/__tests__/yjs-config.test.ts`（新規）で env override / fallback / wss 切替の 3 ケース pass

### Task 16: lib/local-user.ts 作成（TDD）
- **ACTION**: `apps/web/src/lib/local-user.ts` で localStorage 永続 user id + 決定論的色選択を実装
- **IMPLEMENT**:
  ```ts
  // apps/web/src/lib/local-user.ts
  import { generateId } from './id';
  import { AWARENESS_USER_PALETTE } from '../components/canvas/colors';

  const STORAGE_KEY = 'snap-share/user-v1';
  const DEFAULT_NAME_PREFIX = 'ゲスト-';

  export type LocalUser = Readonly<{
    userId: string;
    displayName: string;
    color: string;
  }>;

  // FNV-1a 32-bit hash — small, deterministic, no deps.
  const hashString = (s: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };

  const colorForUser = (userId: string): string => {
    const idx = hashString(userId) % AWARENESS_USER_PALETTE.length;
    return AWARENESS_USER_PALETTE[idx] ?? AWARENESS_USER_PALETTE[0]!;
  };

  export const getOrCreateLocalUser = (storage: Storage = window.localStorage): LocalUser => {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<LocalUser>;
        if (parsed.userId && parsed.displayName) {
          return {
            userId: parsed.userId,
            displayName: parsed.displayName,
            color: parsed.color ?? colorForUser(parsed.userId),
          };
        }
      } catch {
        // 破損データは破棄して新規作成
      }
    }
    const userId = generateId();
    const user: LocalUser = {
      userId,
      displayName: `${DEFAULT_NAME_PREFIX}${userId.slice(0, 4)}`,
      color: colorForUser(userId),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  };
  ```
- **MIRROR**: `ID_GENERATION` + `apps/web/src/lib/imageValidation.ts` の関数分割スタイル
- **IMPORTS**: 上記
- **GOTCHA**:
  - `noUncheckedIndexedAccess` で `AWARENESS_USER_PALETTE[idx]` が `string | undefined` → fallback `?? AWARENESS_USER_PALETTE[0]!` （palette は空でない前提）
  - 破損 JSON は **silently 破棄して新規作成**（ユーザー体験を壊さない）
- **VALIDATE**: `apps/web/src/lib/__tests__/local-user.test.ts` で 永続化 / 破損データ / 同 userId は同色 / 異 userId は異色（衝突を許容、確率検証は不要）= 4〜5 ケース pass

### Task 17: colors.ts に AWARENESS_USER_PALETTE 追加
- **ACTION**: `apps/web/src/components/canvas/colors.ts` に 8 色パレットを追記
- **IMPLEMENT**:
  ```ts
  // 既存定数の下に追加
  export const AWARENESS_USER_PALETTE: ReadonlyArray<string> = [
    '#5b6dff', // indigo (existing rectangle stroke)
    '#e74c3c', // red (existing arrow stroke)
    '#42a5f5', // blue
    '#26a69a', // teal
    '#ab47bc', // purple
    '#ffa726', // orange
    '#ec407a', // pink
    '#66bb6a', // green
  ];
  ```
- **MIRROR**: `CANVAS_CSS_LITERAL_COLORS`
- **IMPORTS**: なし
- **GOTCHA**: hex リテラルのみ（Konva は CSS 変数を解決しない）。`tokens.css` 側にも `--color-presence-1..8` を追加して**物理的に同期**（Phase 6 で UI へ露出する時に使う）
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑

### Task 18: tokens.css に presence パレット追加
- **ACTION**: `apps/web/src/styles/tokens.css` に OKLCH トークンを追加
- **IMPLEMENT**:
  ```css
  /* Awareness palette — kept in sync with apps/web/src/components/canvas/colors.ts */
  --color-presence-1: oklch(60% 0.20 270);  /* #5b6dff */
  --color-presence-2: oklch(60% 0.22 28);   /* #e74c3c */
  /* ... 8 色分 */
  ```
- **MIRROR**: 既存 OKLCH トークン
- **IMPORTS**: なし
- **GOTCHA**: hex と OKLCH は近似値で OK（Konva は hex、CSS は OKLCH を使うので完全一致不要）
- **VALIDATE**: なし（テスト不要）

### Task 19: lib/url-room.ts 作成（TDD）
- **ACTION**: `apps/web/src/lib/url-room.ts` で URL ↔ roomId 変換を pure 関数で実装
- **IMPLEMENT**:
  ```ts
  // apps/web/src/lib/url-room.ts
  import { ROOM_ID_REGEX } from '@snap-share/shared';

  const ROOM_PREFIX = '/r/';

  export const parseRoomIdFromPath = (pathname: string): string | null => {
    if (!pathname.startsWith(ROOM_PREFIX)) return null;
    const id = pathname.slice(ROOM_PREFIX.length).replace(/\/$/, '');
    return ROOM_ID_REGEX.test(id) ? id : null;
  };

  export const buildRoomPath = (roomId: string): string => `${ROOM_PREFIX}${roomId}`;

  export const setRoomIdInUrl = (
    roomId: string,
    history: History = window.history,
  ): void => {
    const next = buildRoomPath(roomId);
    if (window.location.pathname !== next) {
      history.pushState(null, '', next);
    }
  };
  ```
- **MIRROR**: `apps/web/src/lib/imageValidation.ts` のシンプル pure 関数スタイル
- **IMPORTS**: 上記
- **GOTCHA**:
  - `ROOM_ID_REGEX` 検証必須（不正 URL を即 null 化）
  - 末尾 `/` 許容（リライト不要、`/r/abc/` も `abc` 扱い）
  - **`pushState` は同じ pathname なら呼ばない** ← History stack 重複を避ける
- **VALIDATE**: `apps/web/src/lib/__tests__/url-room.test.ts` で valid id / invalid id / no-prefix / 末尾 slash = 4〜5 ケース pass

### Task 20: useYjsAnnotationsStore.ts 作成（TDD）
- **ACTION**: `apps/web/src/hooks/useYjsAnnotationsStore.ts` で `AnnotationsStore` インタフェース実装
- **IMPLEMENT**: 主要構造は以下（実装時はサブ hook `useStateRef` を `apps/web/src/hooks/useStateRef.ts` に切り出す）
  ```ts
  // apps/web/src/hooks/useYjsAnnotationsStore.ts
  import type { Annotation } from '@snap-share/shared';
  import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
  import * as Y from 'yjs';
  import { WebsocketProvider } from 'y-websocket';
  import { buildAnnotationsSnapshot } from '../domain/annotation/yjs-codec';
  import {
    addAnnotationY, clearAllY, moveAnnotationY,
    removeAnnotationY, resizeHighlightY, resizeRectangleY,
    setArrowEndpointsY, setTextY,
  } from '../domain/annotation/yjs-mutations';
  import { LOCAL_ORIGIN, buildSyncUrl } from '../lib/yjs-config';
  import { logger } from '../lib/logger';
  import {
    type AnnotationsAction, type AnnotationsState, type Tool,
  } from './annotationsReducer';
  import type { AnnotationsStore } from './useAnnotationsStore';
  import { useStateRef } from './useStateRef';

  export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

  export type YjsAnnotationsStore = AnnotationsStore & Readonly<{
    status: ConnectionStatus;
    doc: Y.Doc;
    provider: WebsocketProvider;
  }>;

  export const useYjsAnnotationsStore = (roomId: string): YjsAnnotationsStore => {
    // Doc / provider / undoManager は roomId 単位で再生成
    const ctx = useMemo(() => {
      const doc = new Y.Doc();
      const yAnnotations = doc.getMap<Y.Map<unknown>>('annotations');
      // serverUrl にフルパスを埋め込み、roomName は空文字。
      // 結果として ws URL は `${wsBase}/sync/${roomId}` になる。
      const provider = new WebsocketProvider(buildSyncUrl(roomId), '', doc, { connect: true });
      const undoManager = new Y.UndoManager(yAnnotations, {
        trackedOrigins: new Set([LOCAL_ORIGIN]),
        captureTimeout: 500,
      });
      return { doc, yAnnotations, provider, undoManager };
    }, [roomId]);

    // Tool / selectedId は CRDT に乗せず local React state（クライアント単位の関心）
    const [tool, setTool, toolRef] = useStateRef<Tool>('select');
    const [selectedId, setSelectedId, selectedIdRef] = useStateRef<string | null>(null);

    // Snapshot ref：useSyncExternalStore の getSnapshot は同じ参照を返す必要あり
    const snapshotRef = useRef<ReadonlyArray<Annotation>>(buildAnnotationsSnapshot(ctx.yAnnotations));

    const subscribe = useCallback((cb: () => void) => {
      const handler = () => {
        snapshotRef.current = buildAnnotationsSnapshot(ctx.yAnnotations);
        cb();
      };
      ctx.yAnnotations.observeDeep(handler);
      return () => ctx.yAnnotations.unobserveDeep(handler);
    }, [ctx]);
    const annotations = useSyncExternalStore(subscribe, () => snapshotRef.current);

    // Status
    const [status, setStatus] = useStateRef<ConnectionStatus>('connecting');
    useEffect(() => {
      const handler = (e: { status: ConnectionStatus }) => {
        setStatus(e.status);
        logger.info('ws status', { status: e.status, roomId });
      };
      ctx.provider.on('status', handler);
      return () => { ctx.provider.off('status', handler); };
    }, [ctx, roomId, setStatus]);

    // UndoManager state
    const [canUndo, setCanUndo] = useStateRef(false);
    const [canRedo, setCanRedo] = useStateRef(false);
    useEffect(() => {
      const update = () => {
        setCanUndo(ctx.undoManager.undoStack.length > 0);
        setCanRedo(ctx.undoManager.redoStack.length > 0);
      };
      ctx.undoManager.on('stack-item-added', update);
      ctx.undoManager.on('stack-item-popped', update);
      ctx.undoManager.on('stack-cleared', update);
      update();
      return () => {
        ctx.undoManager.off('stack-item-added', update);
        ctx.undoManager.off('stack-item-popped', update);
        ctx.undoManager.off('stack-cleared', update);
      };
    }, [ctx, setCanUndo, setCanRedo]);

    // Cleanup on unmount / roomId change
    useEffect(() => () => {
      ctx.provider.destroy();
      ctx.undoManager.destroy();
      ctx.doc.destroy();
    }, [ctx]);

    // dispatch — local action を Yjs mutator に翻訳
    const dispatch = useCallback((action: AnnotationsAction) => {
      switch (action.type) {
        case 'tool/set':
          setTool(action.tool); return;
        case 'select/set':
          setSelectedId(action.id); return;
        case 'annotation/add':
          addAnnotationY(ctx.doc, ctx.yAnnotations, action.annotation); return;
        case 'annotation/remove':
          if (selectedIdRef.current === action.id) setSelectedId(null);
          removeAnnotationY(ctx.doc, ctx.yAnnotations, action.id); return;
        case 'annotation/move':
          moveAnnotationY(ctx.doc, ctx.yAnnotations, action.id, action.dx, action.dy); return;
        case 'annotation/resize-rect':
          resizeRectangleY(ctx.doc, ctx.yAnnotations, action.id, action.width, action.height); return;
        case 'annotation/resize-highlight':
          resizeHighlightY(ctx.doc, ctx.yAnnotations, action.id, action.width, action.height); return;
        case 'annotation/set-arrow-endpoints':
          setArrowEndpointsY(ctx.doc, ctx.yAnnotations, action.id, action.from, action.to); return;
        case 'annotation/set-text':
          setTextY(ctx.doc, ctx.yAnnotations, action.id, action.text); return;
        default: {
          const _exhaustive: never = action;
          return _exhaustive;
        }
      }
    }, [ctx, selectedIdRef, setSelectedId, setTool]);

    const undo = useCallback(() => { ctx.undoManager.undo(); }, [ctx]);
    const redo = useCallback(() => { ctx.undoManager.redo(); }, [ctx]);
    const reset = useCallback(() => {
      clearAllY(ctx.doc, ctx.yAnnotations);
      setSelectedId(null);
    }, [ctx, setSelectedId]);

    const state: AnnotationsState = {
      annotations,
      selectedId,
      tool,
    };

    return {
      state,
      canUndo, canRedo, dispatch, undo, redo, reset,
      status,
      doc: ctx.doc,
      provider: ctx.provider,
    };
  };
  ```
  > **NOTE**: `useStateRef` は `apps/web/src/hooks/useStateRef.ts` に切り出す（最新値を ref で参照しつつ React state も更新する小ヘルパ。Phase 3 の `useRef` パターンと同思想）。
- **MIRROR**: `ANNOTATIONS_STORE_INTERFACE` + `USE_SYNC_EXTERNAL_STORE_FOR_YJS` + `useAnnotationsStore.ts` のインタフェース全部
- **IMPORTS**: 上記
- **GOTCHA**:
  - `WebsocketProvider` の第 2 引数は `roomName`。**`/sync/:id` のパスを serverUrl 側に組み込み**、roomName は空文字にする方針（y-websocket は `${serverUrl}/${roomName}` を組み立てる）。
  - `ctx` を `useMemo([roomId])` で組み立てて、roomId 変化時に確実に再生成 + 古い ctx は cleanup useEffect で `destroy`
  - **CRDT に乗せるのは `annotations` のみ**。`tool` / `selectedId` はクライアント単位の状態（Awareness で broadcast 別経路）
  - `useStateRef` で `selectedIdRef.current` 等を closure に閉じずに最新参照可能にする（Phase 3 教訓）
- **VALIDATE**: `apps/web/src/hooks/__tests__/useYjsAnnotationsStore.test.ts` で:
  1. dispatch `annotation/add` → snapshot に出現
  2. dispatch `annotation/remove` → snapshot から消える
  3. undo → 直前の add が逆転
  4. UndoManager は `LOCAL_ORIGIN` のみ track（remote origin 操作は undo 対象外）
  5. provider mock 経由で status 変化が反映
  - 計 5〜7 ケース。`y-websocket` は `vi.mock('y-websocket')` で stub 化

### Task 21: usePresence.ts 作成（TDD）
- **ACTION**: `apps/web/src/hooks/usePresence.ts` で Awareness ラッパを実装
- **IMPLEMENT**: 主要構造は以下
  ```ts
  // apps/web/src/hooks/usePresence.ts
  import type { UserPresence } from '@snap-share/shared';
  import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
  import type { Awareness } from 'y-protocols/awareness';
  import { logger } from '../lib/logger';
  import type { LocalUser } from '../lib/local-user';

  export type PresenceContext = Readonly<{
    localUser: LocalUser;
    setCursor: (point: { x: number; y: number } | null) => void;
    setSelectedId: (id: string | null) => void;
    others: ReadonlyArray<UserPresence>;
  }>;

  // Throttle local awareness updates to ~60Hz via rAF.
  const useRafThrottle = <T>(fn: (arg: T) => void): ((arg: T) => void) => {
    const queuedRef = useRef<T | null>(null);
    const rafRef = useRef<number | null>(null);
    return useCallback((arg: T) => {
      queuedRef.current = arg;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (queuedRef.current !== null) {
          fn(queuedRef.current);
          queuedRef.current = null;
        }
      });
    }, [fn]);
  };

  export const usePresence = (
    awareness: Awareness | null,
    localUser: LocalUser,
  ): PresenceContext => {
    useEffect(() => {
      if (!awareness) return;
      awareness.setLocalStateField('user', {
        userId: localUser.userId,
        displayName: localUser.displayName,
        color: localUser.color,
      });
      awareness.setLocalStateField('cursor', null);
      awareness.setLocalStateField('selectedId', null);
      return () => awareness.setLocalState(null);
    }, [awareness, localUser]);

    const setCursor = useRafThrottle((point: { x: number; y: number } | null) => {
      awareness?.setLocalStateField('cursor', point);
    });

    const setSelectedId = useCallback((id: string | null) => {
      awareness?.setLocalStateField('selectedId', id);
    }, [awareness]);

    const othersRef = useRef<ReadonlyArray<UserPresence>>([]);
    const subscribe = useCallback((cb: () => void) => {
      if (!awareness) return () => {};
      const handler = () => {
        const states = awareness.getStates();
        const others: UserPresence[] = [];
        for (const [clientId, raw] of states) {
          if (clientId === awareness.clientID) continue;
          const user = (raw as { user?: { userId: string; displayName: string; color: string } }).user;
          if (!user?.userId) continue;
          others.push({
            userId: user.userId,
            displayName: user.displayName,
            color: user.color,
            cursor: (raw as { cursor?: { x: number; y: number } | null }).cursor ?? null,
            selectedId: (raw as { selectedId?: string | null }).selectedId ?? null,
          });
        }
        othersRef.current = Object.freeze(others);
        cb();
      };
      awareness.on('change', handler);
      handler();
      return () => awareness.off('change', handler);
    }, [awareness]);
    const others = useSyncExternalStore(subscribe, () => othersRef.current);

    return useMemo(() => ({ localUser, setCursor, setSelectedId, others }),
      [localUser, setCursor, setSelectedId, others]);
  };
  ```
- **MIRROR**: `useYjsAnnotationsStore` と同じ `useSyncExternalStore` パターン
- **IMPORTS**: 上記
- **GOTCHA**:
  - **awareness が null の場合の no-op**: roomId が無いローカルモードでも hook を呼ぶ EditorPage を許容するため
  - rAF throttle で broadcast を 60Hz 制限（Awareness は内部で全 client にブロードキャストされるためコスト大）
  - unmount 時に `awareness.setLocalState(null)` で「自分が抜けた」と他 client に通知 → 即座に他クライアントから消える
  - `Object.freeze(others)` で snapshot 同一性を保つ
  - **`Awareness` 型は `y-protocols/awareness` から import**
- **VALIDATE**: `apps/web/src/hooks/__tests__/usePresence.test.ts` で 4〜5 ケース pass

### Task 22: components/canvas/AwarenessLayer.tsx 作成
- **ACTION**: 他ユーザーカーソルと選択状態を Konva で描画する layer を新設
- **IMPLEMENT**:
  ```tsx
  // apps/web/src/components/canvas/AwarenessLayer.tsx
  import type { UserPresence } from '@snap-share/shared';
  import { Group, Layer, Line, Rect, Text } from 'react-konva';

  type Props = Readonly<{
    others: ReadonlyArray<UserPresence>;
    annotations: ReadonlyArray<{ id: string; type: string; x?: number; y?: number; width?: number; height?: number }>;
  }>;

  const CURSOR_TRIANGLE: ReadonlyArray<number> = [0, 0, 0, 16, 4, 12, 12, 12];

  export const AwarenessLayer = ({ others, annotations }: Props) => (
    <Layer listening={false}>
      {others.map((u) => {
        const items = [];
        if (u.cursor) {
          items.push(
            <Group key={`${u.userId}-cursor`} x={u.cursor.x} y={u.cursor.y}>
              <Line points={[...CURSOR_TRIANGLE]} closed fill={u.color} />
              <Text x={14} y={2} text={u.displayName} fontSize={12} fill={u.color} />
            </Group>,
          );
        }
        if (u.selectedId) {
          const target = annotations.find((a) => a.id === u.selectedId);
          if (target && target.type !== 'arrow' && target.x !== undefined && target.y !== undefined) {
            items.push(
              <Rect
                key={`${u.userId}-sel`}
                x={target.x - 2} y={target.y - 2}
                width={(target.width ?? 0) + 4} height={(target.height ?? 0) + 4}
                stroke={u.color} strokeWidth={1} dash={[4, 4]}
              />,
            );
          }
        }
        return items;
      })}
    </Layer>
  );
  ```
- **MIRROR**: `apps/web/src/components/canvas/AnnotationLayer.tsx` の Layer 構造 + `RectangleShape.tsx` の Rect 描画
- **IMPORTS**: 上記
- **GOTCHA**:
  - **`listening={false}`** で hit detection 対象外にする（Phase 0 教訓）
  - cursor triangle は単純化（後で SVG 風 path に置換しやすい）
  - 他ユーザーの選択枠は `arrow` を除外（座標系が異なる）。Phase 6 で arrow も対応してよい
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑 + 後段 E2E smoke で実機描画

### Task 23: components/connection/ConnectionBadge.tsx 作成
- **ACTION**: 画面右下の小バッジ
- **IMPLEMENT**:
  ```tsx
  // apps/web/src/components/connection/ConnectionBadge.tsx
  import type { ConnectionStatus } from '../../hooks/useYjsAnnotationsStore';

  type Props = Readonly<{ status: ConnectionStatus }>;

  const STATUS_LABEL: Record<ConnectionStatus, string> = {
    connecting: '接続中…',
    connected: '同期中',
    disconnected: '再接続中…',
  };

  const STATUS_DOT: Record<ConnectionStatus, string> = {
    connecting: 'bg-amber-400 animate-pulse',
    connected: 'bg-emerald-500',
    disconnected: 'bg-rose-500 animate-pulse',
  };

  export const ConnectionBadge = ({ status }: Props) => (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute right-4 bottom-4 z-10 flex items-center gap-2 rounded-full bg-(--color-surface) px-3 py-1.5 text-xs shadow-sm ring-1 ring-black/10"
    >
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
      <span>{STATUS_LABEL[status]}</span>
    </div>
  );
  ```
- **MIRROR**: `apps/web/src/components/toolbar/ToolButton.tsx` のスタイルアプローチ
- **IMPORTS**: 上記
- **GOTCHA**: `aria-live="polite"` でスクリーンリーダー対応、`pointer-events-none` で UI 干渉なし
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` 緑

### Task 24: components/toolbar/CopyUrlButton.tsx 作成
- **ACTION**: URL コピー
- **IMPLEMENT**:
  ```tsx
  import { Copy, Check } from 'lucide-react';
  import { useCallback, useState } from 'react';
  import { logger } from '../../lib/logger';

  export const CopyUrlButton = () => {
    const [copied, setCopied] = useState(false);
    const onCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch (e: unknown) {
        logger.warn('clipboard write failed', { error: e instanceof Error ? e.message : String(e) });
      }
    }, []);
    return (
      <button
        type="button"
        onClick={onCopy}
        aria-label="ルームURLをコピー"
        className="..."  // Tailwind classes (Toolbar.tsx パターン参照)
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <span>{copied ? 'コピー完了' : 'URL コピー'}</span>
      </button>
    );
  };
  ```
- **MIRROR**: `apps/web/src/components/toolbar/ToolButton.tsx`
- **IMPORTS**: 上記
- **GOTCHA**: `navigator.clipboard.writeText` は secure context 必須（localhost / https）。fallback は実装しない（NOT_BUILDING）
- **VALIDATE**: 手動 smoke

### Task 25: useImageSource.ts 改修（POST /rooms 連携）
- **ACTION**: 既存 `useImageSource` の `loadFromFile` を改修し、validate 後に `POST /rooms` でアップロード → `setRoomIdInUrl(room.id)`
- **IMPLEMENT**:
  ```ts
  // 既存 hook を以下のシグネチャに拡張
  export type ImageSource = Readonly<{
    url: string;
    roomId: string | null;  // null = ローカルモード（API 失敗時 fallback）
  }>;

  // loadFromFile の中で:
  // 1. validateImageFile(file) → throw on error
  // 2. const objectUrl = URL.createObjectURL(file)
  // 3. const room = await createRoom(file)  ← 新規 API クライアント呼出
  // 4. if (room) { setRoomIdInUrl(room.id); setSource({ url: objectUrl, roomId: room.id }) }
  //    else      { setSource({ url: objectUrl, roomId: null }) }
  ```
  > 既存テスト `apps/web/src/hooks/__tests__/useImageSource.test.ts` を先に拡張して fail させ、その後実装。
- **MIRROR**: 既存 `useImageSource.ts`
- **IMPORTS**: `import { setRoomIdInUrl } from '../lib/url-room'; import { createRoom } from '../lib/api-client';`
- **GOTCHA**:
  - **API 失敗時もローカルモードで継続**（PRD 仮説検証を妨げない）。Console.warn のみ
  - `URL.createObjectURL` の cleanup は既存パターン維持（`useEffect` のクリーンアップで `URL.revokeObjectURL`）
  - roomId が決まったら `<EditorPage>` が再レンダーで Yjs ストア生成
- **VALIDATE**: `pnpm -F @snap-share/web test` で hook テスト pass + 既存テストが新シグネチャに追従

### Task 26: lib/api-client.ts 作成
- **ACTION**: `hc<AppType>` ベースの API クライアントを最小実装
- **IMPLEMENT**:
  ```ts
  // apps/web/src/lib/api-client.ts
  import type { AppType } from '@snap-share/api';
  import { hc } from 'hono/client';
  import type { Room } from '@snap-share/shared';

  export const resolveApiBaseUrl = (
    env: ImportMetaEnv = import.meta.env,
  ): string =>
    (env as { VITE_API_URL?: string }).VITE_API_URL ?? '';  // 空文字 → vite proxy 経由

  const client = hc<AppType>(resolveApiBaseUrl());

  export const createRoom = async (file: File): Promise<Room | null> => {
    const form = new FormData();
    form.set('image', file);
    try {
      const res = await client.rooms.$post({ form: form as unknown as { image: File } });
      if (res.status !== 201) return null;
      return (await res.json()) as Room;
    } catch {
      return null;
    }
  };

  export const fetchRoom = async (id: string): Promise<Room | null> => {
    try {
      const res = await client.rooms[':id'].$get({ param: { id } });
      if (res.status !== 200) return null;
      return (await res.json()) as Room;
    } catch {
      return null;
    }
  };

  export const buildImageUrl = (room: Room, base: string = resolveApiBaseUrl()): string =>
    `${base}/rooms/${room.id}/image`;
  ```
- **MIRROR**: ADR-0002 のサンプルコード
- **IMPORTS**: 上記
- **GOTCHA**:
  - `hc<AppType>` は `apps/api` を `workspace:*` 依存しているため型推論される
  - 失敗時は **null を返す**（throw しない）。caller が fallback を制御しやすい
  - `as unknown as { image: File }` の型 cast は `hc` の form 型を満たすため
- **VALIDATE**: `apps/web/src/lib/__tests__/api-client.test.ts` で 3〜4 ケース pass

### Task 27: vite.config.ts に proxy 追加
- **ACTION**: dev で `/rooms` と `/sync` を `http://localhost:8787` に proxy
- **IMPLEMENT**:
  ```ts
  // apps/web/vite.config.ts (server セクション)
  server: {
    port: 5173,
    proxy: {
      '/rooms': { target: 'http://localhost:8787', changeOrigin: true },
      '/sync': { target: 'http://localhost:8787', ws: true, changeOrigin: true },
    },
  },
  ```
- **MIRROR**: 既存 vite.config.ts
- **IMPORTS**: なし
- **GOTCHA**:
  - `ws: true` 必須（WebSocket upgrade を proxy するため）
  - `changeOrigin: true` で Host ヘッダを target に書き換え
  - **prod では Cloudflare Pages + Workers が同オリジン構成を取れない場合、`VITE_API_URL` / `VITE_API_WS_URL` を build 時に渡す**
- **VALIDATE**: 2 ターミナル起動でブラウザから `POST /rooms` と `ws://localhost:5173/sync/:id` の両方が通る

### Task 28: App.tsx に URL ルート分岐を追加
- **ACTION**: `apps/web/src/App.tsx` で `parseRoomIdFromPath` → `<EditorPage roomId={...} />`
- **IMPLEMENT**:
  ```tsx
  import { useEffect, useState } from 'react';
  import { EditorPage } from './pages/EditorPage';
  import { parseRoomIdFromPath } from './lib/url-room';

  export const App = () => {
    const [roomId, setRoomId] = useState<string | null>(() => parseRoomIdFromPath(window.location.pathname));
    useEffect(() => {
      const onPop = () => setRoomId(parseRoomIdFromPath(window.location.pathname));
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);
    return <EditorPage roomId={roomId} onRoomIdChange={setRoomId} />;
  };
  ```
- **MIRROR**: 既存 `App.tsx`
- **IMPORTS**: 上記
- **GOTCHA**: `popstate` のみ listen（`pushState` は自分で発火しても popstate を発火しない → `onRoomIdChange` を prop drilling で回す）。これが嫌なら custom event。**プラン採用は prop drilling**（KISS）
- **VALIDATE**: 後段 EditorPage 改修と組み合わせて手動 smoke

### Task 29: EditorPage.tsx 改修（roomId 受領 + ストア切替）
- **ACTION**: `roomId` prop に応じて store / presence を切替、画像 URL 解決、新コンポーネント配置
- **IMPLEMENT**: 主要変更点：
  1. props `{ roomId: string | null; onRoomIdChange: (id: string | null) => void }` を受領
  2. **EditorPage を 2 種に分割**してフック順序ルールを厳守:
     - `EditorPage` (ラッパ) — roomId の有無で `<RoomEditor>` / `<LocalEditor>` を選ぶ
     - `RoomEditor` (`apps/web/src/pages/RoomEditor.tsx`) — `useYjsAnnotationsStore(roomId)` + `usePresence` を使う
     - `LocalEditor` (`apps/web/src/pages/LocalEditor.tsx`) — `useAnnotationsStore()` を使う（Phase 3 の EditorPage 内容をほぼ流用）
  3. `useImageSource` の戻りに `roomId` が含まれるようになり、roomId 出現時に `onRoomIdChange(id)` で App.tsx 側を更新
  4. `roomId` がある場合は image src を `buildImageUrl(room)` に切替（要 `fetchRoom`）。画像未取得は loading 表示
  5. Toolbar の右に `<CopyUrlButton>` を追加（roomId がある時のみ）
  6. `<CanvasStage>` の上に `<AwarenessLayer>` を mount（store が yjs の場合のみ）
  7. `<ConnectionBadge status={store.status} />` を main 直下に配置
  8. `usePresence(provider.awareness, localUser)` を hook で初期化、`presence.setSelectedId` を `select/set` dispatch と同期
  9. `CanvasStage` の `mousemove` を react で捕捉して `presence.setCursor({x, y})` を呼ぶ（`onCursorMove` prop を `CanvasStage` に追加 — Task 30）
- **MIRROR**: 既存 `EditorPage.tsx`
- **IMPORTS**: 上記
- **GOTCHA**:
  - **hook 順序**: React の rules of hooks を守るため、サブコンポーネント分割が安全（`<RoomEditor>` / `<LocalEditor>`）
  - 共通の Toolbar / CanvasStage は子コンポーネント or 共通 helper で構造化
- **VALIDATE**:
  - `pnpm -F @snap-share/web typecheck` 緑
  - `pnpm -F @snap-share/web test` 既存 + 拡張テスト全 pass
  - 後段 E2E smoke: D&D アップロード → URL が `/r/:id` → リロードしても `/r/:id` のまま開く

### Task 30: CanvasStage に onCursorMove prop を追加
- **ACTION**: `mousemove` 時に Stage 座標を親に通知する optional prop
- **IMPLEMENT**:
  ```tsx
  type CanvasStageProps = Readonly<{
    // 既存 props
    onCursorMove?: (point: { x: number; y: number } | null) => void;
  }>;

  // handleMouseMove の末尾に:
  if (onCursorMove) {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    onCursorMove(pos ? { x: pos.x, y: pos.y } : null);
  }
  // ステージ離脱時の null 通知は onMouseLeave handler を別途追加
  ```
- **MIRROR**: 既存 `CanvasStage.tsx` の handler 構造
- **IMPORTS**: なし
- **GOTCHA**:
  - **rAF throttle は `usePresence` 側で実装済**。CanvasStage は raw 値を渡せばよい
  - `onMouseLeave` で null を通知 → 他クライアント側でカーソル消滅
- **VALIDATE**: `pnpm -F @snap-share/web typecheck` + 既存テスト pass + 手動 smoke

### Task 31: e2e/landing.spec.ts に smoke 追加
- **ACTION**: D&D 経由のルーム生成 → URL 変化を保証する smoke 1〜2 件追加
- **IMPLEMENT**: 既存 4 件に以下を追加（初期は `.skip` で stub、CI 整備は Phase 6/7）
  ```ts
  test.skip('uploading an image transitions the URL to /r/:id (with API running)', async ({ page }) => {
    await page.goto('/');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /画像を選択/ }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(/* 1px PNG */ '...', 'base64'),
    });
    await page.waitForURL(/\/r\/[A-Za-z0-9_-]{21}/, { timeout: 5000 });
  });
  ```
  > 2 タブ同期テストは追加しない（NOT_BUILDING）
- **MIRROR**: `apps/web/e2e/landing.spec.ts` の既存テスト
- **IMPORTS**: 上記
- **GOTCHA**: `.skip` 付与で CI green を維持。手動実行で動作確認
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e` 既存 4 件 pass + 新 1 件は skipped

### Task 32: CLAUDE.md 更新
- **ACTION**: Cross-cutting design rules に Yjs 関連 1 行追加
- **IMPLEMENT**: 「Cross-cutting design rules」リストに追記:
  ```md
  8. **Yjs mutators must wrap operations in `doc.transact(fn, LOCAL_ORIGIN)`.** `LOCAL_ORIGIN` は `apps/web/src/domain/annotation/yjs-mutations.ts` で定義された symbol。`UndoManager` は `trackedOrigins: new Set([LOCAL_ORIGIN])` で local 操作のみ追跡し、remote 操作（origin null）は undo 対象外にする。symbol identity が崩れると tracking が無効化されるため、別ファイルから再 export する場合も同一 import を使うこと。
  ```
- **MIRROR**: 既存 CLAUDE.md の番号付きリスト
- **IMPORTS**: なし
- **GOTCHA**: なし
- **VALIDATE**: `git diff CLAUDE.md` で 1 項目の追加だけに収まる

### Task 33: PRD ステータス更新
- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` の Phase 4 行を `pending` → `in-progress` + plan path を追記（Phase 3 行の `complete` 反映と同時）
- **IMPLEMENT**: 該当行を以下に書き換え（**plan 化と同時に実行済**）
  ```md
  | 4 | リアルタイム同期 | Durable Object WS + y-durableobjects 統合 + Awareness | in-progress | - | 2, 3 | [phase-4-realtime-sync.plan.md](../plans/phase-4-realtime-sync.plan.md) |
  ```
- **MIRROR**: 既存 phase 行（Phase 2.5 完了後の表記）
- **IMPORTS**: なし
- **GOTCHA**: **このタスクは plan 作成時点で先に実行済**。Implementation 段階では検証だけで OK
- **VALIDATE**: `git diff .claude/PRPs/prds/snap-share.prd.md` が表 1〜2 行に収まる

### Task 34: 最終検証 — 全 levels green
- **ACTION**: 全 validation コマンドを順に実行し、エラーゼロを確認
- **IMPLEMENT**: 「Validation Commands」節を全部走らせる
- **MIRROR**: なし
- **IMPORTS**: なし
- **GOTCHA**:
  - DO の動作だけは **手動 smoke**：`pnpm -F @snap-share/api dev` + `pnpm -F @snap-share/web dev` の 2 ターミナル + 2 ブラウザタブで:
    - 同一ルームで矩形追加が反映される
    - 他タブのカーソルが見える
    - 5 分以上アイドル → 戻ってきても同期継続
    - 接続バッジが connected → disconnected → connected の遷移を見せる（API を `Ctrl+C` で停止 → 再起動）
- **VALIDATE**: 下記 Validation Commands を完走

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `presence.test.ts`: valid presence | 全フィールド有効 | parse success | — |
| `presence.test.ts`: cursor null | cursor: null | parse success | edge |
| `presence.test.ts`: 不正 color | color: 'red' | parse fail | edge |
| `presence.test.ts`: displayName 33 char | maxlength 超過 | parse fail | edge |
| `yjs-codec.test.ts`: rectangle round-trip | rect annotation | encode + decode で同値 | — |
| `yjs-codec.test.ts`: arrow flat encoding | arrow annotation | `fromX/fromY/toX/toY` flat保持 | edge |
| `yjs-codec.test.ts`: text round-trip | text annotation | 日本語文字含む round-trip | i18n |
| `yjs-codec.test.ts`: highlight round-trip | highlight annotation | 同値 | — |
| `yjs-codec.test.ts`: 不正 Y.Map → null | type 欠損 Y.Map | `null` 返却 | edge |
| `yjs-codec.test.ts`: snapshot 順序 | createdAt 異なる 3 注釈 | 昇順 sort | — |
| `yjs-mutations.test.ts`: addAnnotationY | 空 Map に rect 追加 | size = 1 | — |
| `yjs-mutations.test.ts`: removeAnnotationY | 1 注釈 → 削除 | size = 0 | — |
| `yjs-mutations.test.ts`: moveAnnotationY rect | dx/dy 加算 | x/y が dx/dy 増加 | — |
| `yjs-mutations.test.ts`: moveAnnotationY arrow | dx/dy 加算 | from/to 両方 移動 | edge |
| `yjs-mutations.test.ts`: 不在 id への mutation | no-op | size 不変 | edge |
| `yjs-mutations.test.ts`: 型不一致 mutation | rect に setText | no-op | edge |
| `yjs-mutations.test.ts`: UndoManager tracked | LOCAL_ORIGIN で transact | undoStack に積まれる | — |
| `useYjsAnnotationsStore.test.ts`: dispatch add → snapshot | mock provider + add | annotations 配列に出現 | — |
| `useYjsAnnotationsStore.test.ts`: undo | add → undo | annotations 空 | — |
| `useYjsAnnotationsStore.test.ts`: status イベント | provider mock の status 変化 | state.status 反映 | — |
| `useYjsAnnotationsStore.test.ts`: roomId 変化で再生成 | rerender with new roomId | 旧 doc が destroy される | edge |
| `usePresence.test.ts`: setLocalState 初期化 | hook mount | user/cursor/selectedId が初期化 | — |
| `usePresence.test.ts`: setCursor rAF throttle | 連続 setCursor | rAF callback 1 回だけ broadcast | — |
| `usePresence.test.ts`: others 自分除外 | clientId 一致 | others に含まれない | edge |
| `usePresence.test.ts`: unmount cleanup | unmount | setLocalState(null) 呼出 | edge |
| `local-user.test.ts`: 永続化 | localStorage に保存 | 2 回目で同 user | — |
| `local-user.test.ts`: 破損 JSON | localStorage に '{' | 新規作成 | edge |
| `local-user.test.ts`: 同 userId 同色 | 同じ userId 2 回 | 同 color | — |
| `url-room.test.ts`: valid roomId | `/r/V1StGXR8_Z5jdHi6B-mYT` | id 返却 | — |
| `url-room.test.ts`: invalid roomId | `/r/short` | null | edge |
| `url-room.test.ts`: no prefix | `/foo` | null | — |
| `url-room.test.ts`: 末尾 slash | `/r/abc.../` | id 返却 | edge |
| `api-client.test.ts`: env override | VITE_API_URL set | 渡された URL を返す | — |
| `api-client.test.ts`: fallback | 未設定 | 空文字 | — |
| `api-client.test.ts`: buildImageUrl | room | `${base}/rooms/${id}/image` | — |
| `yjs-config.test.ts`: env override | VITE_API_WS_URL set | 渡された URL | — |
| `yjs-config.test.ts`: wss 切替 | location.protocol = https | wss:// プレフィクス | edge |
| `yjs.test.ts` (api): 不正 ID | `..%2Fetc` | 400 | security |
| `yjs.test.ts` (api): 存在しない ID | valid format / no R2 meta | 404 | edge |
| `yjs.test.ts` (api): 既存 ID | POST → /sync/:id GET | NOT_FOUND ではない | — |
| `openapi.test.ts` (api): /sync 不在 | OpenAPI doc 取得 | paths に /sync/{id} なし | — |

合計新規テスト想定: **約 35〜40 件**（shared +4 / api +3 / web +30）

### Edge Cases Checklist
- [ ] roomId が変化（URL 直入力 → 別 room へ pushState）したとき、旧 Doc / Provider / UndoManager が destroy される
- [ ] WebSocket 切断中の操作も local Y.Map に commit され、再接続時に merge される（Yjs CRDT 標準保証）
- [ ] 2 タブで同じ注釈の同フィールドを同時編集 → CRDT が deterministic に解決（Yjs 標準保証）
- [ ] テキスト注釈の空文字確定 → 削除（Phase 3 動作維持、CRDT 上でも remove）
- [ ] Awareness 状態が空（接続直後）でも snapshot が安定（others は空配列）
- [ ] `popstate`（戻る/進む）で App.tsx が roomId 切替を検出
- [ ] 不正 roomId（regex 通らない）の URL 直入力 → ローカルモード扱い
- [ ] DO 起動時に既存 R2 meta なし → 404 で接続拒否（middleware で）
- [ ] `vi.useFakeTimers()` 使用テストでも rAF が決定的に動く（`vi.advanceTimersByTime` + `vi.useFakeTimers({ toFake: [...] })`）

---

## Validation Commands

### Static Analysis
```bash
pnpm turbo run typecheck
pnpm turbo run lint
```
EXPECT: ゼロ type / lint エラー

### Unit Tests
```bash
pnpm turbo run test
```
EXPECT: 既存全テスト + 新規約 35〜40 件全 pass

### Single test file（dev loop）
```bash
pnpm -F @snap-share/web test -- src/hooks/__tests__/useYjsAnnotationsStore.test.ts
pnpm -F @snap-share/api test -- src/__tests__/yjs.test.ts
pnpm -F @snap-share/shared test -- src/__tests__/presence.test.ts
```

### Build
```bash
pnpm turbo run build
```
EXPECT: vite build 成功 + wrangler dry-run 成功（DO bindings warning ゼロ）

### E2E（chromium）
```bash
pnpm -F @snap-share/web test:e2e
```
EXPECT: 既存 4 件 pass + 新規 1 件 skipped

### Manual Smoke（最重要 — DO の実機動作確認）
```bash
# ターミナル A
pnpm -F @snap-share/api dev
# ターミナル B
pnpm -F @snap-share/web dev
# ブラウザ: http://localhost:5173 を 2 タブで開く
```

手動チェックリスト:
- [ ] タブ A で画像 D&D → URL が `/r/:id` に変化
- [ ] URL を Copy → タブ B で貼って開く → 同じ画像が表示される
- [ ] タブ A で矩形を描く → タブ B に 200ms 以内に出現
- [ ] タブ B でカーソル移動 → タブ A にカーソル triangle + 名前表示
- [ ] タブ A で注釈を選択 → タブ B に dashed border が表示
- [ ] タブ A で Cmd+Z → タブ A の追加だけ undo（タブ B の追加は影響なし）
- [ ] タブ A の API を `Ctrl+C` で停止 → タブ A の badge が `disconnected` に
- [ ] API 再起動 → badge が `connecting` → `connected` に戻り、停止中の操作が同期復帰
- [ ] 5 分以上アイドル → タブ A で再操作 → タブ B に同期（DO Hibernation 復帰確認）
- [ ] 不正 URL（`/r/invalid`）にアクセス → ローカルモードで開く
- [ ] 存在しない roomId（`/r/V1StGXR8_Z5jdHi6BBBBB`）にアクセス → 「ルームが見つかりません」表示

### Database / Bucket Validation（該当なし）
R2 はメモリ実行（既存）/ DO storage は y-durableobjects 内部管理。明示確認不要。

---

## Acceptance Criteria

- [ ] `apps/api/wrangler.toml` に `[[durable_objects.bindings]]` Y_ROOM と `[[migrations]] new_classes = ["YDurableObjects"]` が追加され、`pnpm -F @snap-share/api build` で warning ゼロ
- [ ] `apps/api/src/index.ts` で `YDurableObjects` を named export し、wrangler が class を検出できる
- [ ] `/sync/:id` への接続前に R2 meta でルーム存在検証され、不正 / 不在 ID は 400 / 404 envelope を返す
- [ ] `apps/web` で D&D 経由で `POST /rooms` が呼ばれ、成功時 URL が `/r/:id` に書き換わる
- [ ] `/r/:id` URL 直アクセスで `GET /rooms/:id` 経由で画像が取得され表示される
- [ ] 2 タブ間で注釈の追加 / 移動 / リサイズ / 削除 / テキスト変更が CRDT 経由で同期する
- [ ] 他ユーザーのカーソル位置・色・名前が live で表示される
- [ ] `Y.UndoManager` で local 操作のみ undo / redo され、相手の操作は奪わない
- [ ] WebSocket 切断後も操作可能、再接続時に CRDT が双方向 merge する
- [ ] 5 分以上アイドル → DO Hibernation → 復帰しても同期継続
- [ ] 接続状態バッジが `connecting/connected/disconnected` を反映
- [ ] `pnpm turbo run typecheck lint test build` 全 green
- [ ] E2E smoke 4 件（既存）+ 1 件（新規・skipped）pass

## Completion Checklist

- [ ] Code follows discovered patterns (Patterns to Mirror セクションの全項目)
- [ ] Error handling は既存 `errorEnvelope` / `AppError` を流用
- [ ] Logging は `[api]` / `[web]` prefix logger を流用
- [ ] テストは AAA + 不変性検証パターン
- [ ] No hardcoded values（color palette は定数 export）
- [ ] PRD Phase 4 行を `in-progress` に更新（plan 化時点で完了）
- [ ] CLAUDE.md に Yjs ルール 1 行追加
- [ ] No unnecessary scope additions（NOT Building セクションの項目に手を出さない）
- [ ] Self-contained — Mandatory Reading の P0 を全部読めば本 plan 1 本で実装完結

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `useYjsAnnotationsStore` の `useSyncExternalStore` で snapshot 参照が tear する | M | H | `snapshotRef` + `Object.freeze` パターンで参照同一性を保つ。`useStateRef` で stale closure 回避 |
| `Y.Map` への Discriminated Union encoding が CRDT merge で壊れる | L | H | `type` フィールドは変更しない（rect → arrow 等は不可）。Zod 境界検証で不正 Y.Map は捨てる |
| Vite proxy 経由の WebSocket が Cloudflare Workers ローカル開発で安定動作しない | M | M | Phase 0 spike B で実機確認済（spike 構成は同オリジンではないが、proxy 動作は vite 公式パターン）。失敗時は `VITE_API_WS_URL` 環境変数で直接指定に fallback |
| `wrangler dev --local` で DO が migration を適用しない | L | H | Phase 0 spike B で確認済（`new_classes`）。失敗時は `wrangler dev --local --persist-to .wrangler/state` で永続化を確認 |
| Awareness の 60Hz broadcast が複数クライアントで帯域 / CPU を圧迫 | L | M | rAF throttle で 60Hz 上限。`provider.awareness.setLocalState(null)` でクリーンアップ |
| `EditorPage` の hook 順序ルール違反（`roomId` 切替時の useYjsAnnotationsStore vs useAnnotationsStore） | M | H | サブコンポーネント分割（`<RoomEditor>` / `<LocalEditor>`）で hook 順序を絶対化 |
| `UndoManager` の `LOCAL_ORIGIN` symbol identity が崩れる | M | M | `lib/yjs-config.ts` から再 export して全 hook で同一 import を使う設計 |
| Phase 3 で発生した dispatch race が Yjs 経路でも再発 | M | H | Yjs `transact` で同 tick 内の全 mutation がアトミック。CanvasStage の `dragStartRef` / `draftRef` は維持 |
| `y-websocket` v3 の API 差異（v2 から） | L | M | Phase 0 spike B で v3 を実機確認済 |
| OpenAPI doc に `/sync/:id` が漏れて型推論を汚染 | L | L | `openapi.test.ts` で paths に含まれないことを assert（Task 11） |
| Playwright で WebSocket 接続が flaky | H | L | E2E では同期テストを書かない（NOT Building）。手動 smoke で代替 |

## Notes

### Phase 5 への布石

- **TTL 自動破棄**: Phase 5 で `state.setAlarm(createdAt + ttlMs)` を `YDurableObjects` のサブクラスで実装。Phase 4 の `apps/api/src/yjs.ts` で `YDurableObjects` を直接 re-export しているのを、Phase 5 では拡張クラスに差し替える設計
- **パスワード保護**: `/sync/:id` middleware の前に password 検証 middleware を追加する経路を確保。Phase 4 の middleware 設計（Hono の `.use().route()` チェーン）はそのまま増設に対応
- **エラー envelope**: 既存 `errorEnvelope` 流用で 401 / 403 を追加するだけで済む

### Phase 6 への布石

- **TanStack Router 導入**: `apps/web/src/lib/url-room.ts` の `parseRoomIdFromPath` / `setRoomIdInUrl` を Router の loader / action に置換する。`App.tsx` の `popstate` listener を Router の navigation に置換
- **shadcn 適用**: `<ConnectionBadge>` / `<CopyUrlButton>` を shadcn の Badge / Button に置換
- **PNG export**: `useYjsAnnotationsStore` から `state.annotations` を取得してそのまま Konva の `stage.toDataURL` で出力。CRDT 側に追加実装不要

### Phase 7 への布石

- **Cloudflare Pages デプロイ時のオリジン問題**: prod では `apps/web` が Pages、`apps/api` が Workers と別オリジンになる前提。`VITE_API_URL` / `VITE_API_WS_URL` を build 時に渡す経路を Phase 4 で既に整備（`api-client.ts` / `yjs-config.ts`）

### 設計判断の根拠

- **Y.Map vs Y.Array**: `Y.Map<id, Y.Map>` を採用。理由は (1) id ベースの O(1) lookup、(2) 削除が `delete(id)` で衝突しない、(3) 順序は `createdAt` で post-sort。`Y.Array<Y.Map>` は order を CRDT で扱える利点があるが、move 操作で index 衝突が発生しがち（不要な複雑性）
- **`tool` / `selectedId` を CRDT に乗せない**: ツール選択は完全にクライアント単位の関心。selectedId は Awareness で broadcast するが、CRDT には載せない（ローカル UI state のみ）
- **`UndoManager` vs ローカル history stack**: Yjs に乗ったら必然的に `UndoManager`。ローカル history stack を併用すると CRDT との不整合が生じる（remote merge 後の undo が壊れる）。完全置換が正解
- **EditorPage 分割**: hook 順序ルール厳守のため、`roomId` 有無で別コンポーネントに分けるのが安全。共通の Toolbar / CanvasStage を子に持たせる構造

### Confidence 6/10 の内訳

- 仕様理解: 9/10（PRD + spike + 既存コード読み込み済）
- 実装難度: 6/10（CRDT + React 統合は経験差が出やすい）
- テスト容易性: 5/10（Yjs hook の単体テストは mock が複雑）
- 実機動作確認: 7/10（Phase 0 spike B で疎通済、Awareness は未確認）
