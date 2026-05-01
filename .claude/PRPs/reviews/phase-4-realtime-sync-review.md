# コードレビュー — Phase 4 リアルタイム同期

**レビュー日**: 2026-05-01
**ブランチ**: feat/phase-4-realtime-sync
**判定**: コメント付き承認 — CRITICAL なし、HIGH 3 件はマージ前または直後のフォローアップで対応推奨

## サマリ

実装は plan を忠実に踏襲、型安全、テストも十分（新規 62 件すべて green）。CRDT/Awareness の factory 分離は妥当な逸脱。気になる点は 3 つ — `awareness` の脆い構造的キャスト、ルームモードの「画像をクリア」が他参加者の注釈も巻き込む破壊的操作、`CopyUrlButton` の unmount 後 setState リーク。

## 指摘

### CRITICAL
なし。

### HIGH

**[H1] `RoomEditor.tsx:38-39` — `awareness` を取り出すための脆い構造的キャスト**

```ts
const awareness = (store as unknown as { provider?: { awareness?: Awareness } }).provider
  ?.awareness as AwarenessLike | undefined;
```

`YjsAnnotationsStore` 型は意図的に `provider` を隠蔽しているのに、`RoomEditor` が二重 `as unknown as` で `provider.awareness` に手を突っ込んでいる。`y-websocket` が将来フィールド名を変えると、キャストは黙って `undefined` を返し、`usePresence` は no-op handle にフォールバック — コンパイルエラーも実行時警告もなく、Awareness が静かに死ぬ。

**修正案**: `awareness` を `YjsAnnotationsStore` の一級フィールドとして直接 hook から返す。

```ts
// useYjsAnnotationsStore.ts
return { ..., awareness: ctx.provider.awareness };
```

そうすればキャストが消え、契約が型システムの管理下に入る。

---

**[H2] `RoomEditor.tsx:87` — `onClearImage` が確認なしで他参加者の注釈を全削除**

```ts
<EditorShell
  ...
  onClearImage={() => store.reset()}   // ← CRDT 全削除を全参加者に伝搬
/>
```

`LocalEditor` での「画像をクリア」はローカル限定（自分の ObjectURL + reducer をリセット）。同じツールバーボタンが `RoomEditor` では `store.reset()` を呼び、`clearAllY` トランザクションを全参加者にブロードキャストする。誰でも 1 クリック・確認なしでルーム全注釈を吹き飛ばせる状態。

**選択肢**（どれか採用）:
1. ルームモードではクリアボタンを disable（`EditorShell` に `canClear` prop を追加）
2. 挙動を「ルームから抜ける」に変更し、CRDT を触らずに `/` にナビゲート
3. `window.confirm("ルーム内のすべての注釈を削除します...")` ゲートを追加

これは出荷前にプロダクト判断が必要。

---

**[H3] `CopyUrlButton.tsx:14` — unmount 後の `setTimeout(setState)`**

```ts
setCopied(true);
window.setTimeout(() => setCopied(false), FEEDBACK_MS);
```

クリック後 1.8 秒以内にユーザーがページから離れると（戻るボタンで `/r/:id` を抜ける等）、タイマーが unmount 後に発火して React が「Can't perform a React state update on an unmounted component」を警告する。

**修正案**: タイマー ID を ref に保持し、unmount 時にクリアする。

```ts
const timerRef = useRef<number | null>(null);
useEffect(() => () => {
  if (timerRef.current !== null) window.clearTimeout(timerRef.current);
}, []);
// onCopy 内:
if (timerRef.current !== null) window.clearTimeout(timerRef.current);
timerRef.current = window.setTimeout(() => {
  timerRef.current = null;
  setCopied(false);
}, FEEDBACK_MS);
```

### MEDIUM

**[M1] `useYjsAnnotationsStore.ts:35` — StrictMode の二重実行コスト**

`createYjsAnnotationsContext(factory)` を `useMemo` 内で構築している。React 19 + StrictMode の dev では二重マウントされ、cleanup の `useEffect` で `ctx.destroy()` が走った後、二回目のマウントで新しい `ctx` が生成される。挙動は正しいが無駄 — dev 起動時に WebSocket 接続が一度開いて閉じてまた開く。許容範囲、ただし prod デバッグで再接続ストームが見えたら見直し。

---

**[M2] `useImageSource.ts:63-68` — fire-and-forget が unmount を生き延びる**

`void (async () => { ... })()` の IIFE は hook が unmount しても走り続ける。`onRoomCreatedRef.current?.(room.id)` の ref ガードで「callback なし」は処理できるが、IIFE 自体はキャンセルできない。実際には親（`LocalEditor`）が unmount するのは URL が `/r/:id` に遷移するタイミング、つまり callback が発火した時だけ — 自己整合は取れている。コメントを残すか `AbortController` を入れるとより明確。

---

**[M3] `yjs-annotations-context.ts:94-97` — exhaustiveness を `void` で済ませている**

```ts
default: {
  const _exhaustive: never = action;
  void _exhaustive;
}
```

`void _exhaustive` は biome の `noVoidTypeReturn` を黙らせるが、型システムをすり抜けた variant（例: `as` キャスト経由）が来たときの実行時フィードバックを失う。`throw new Error(\`unknown action: ${(action as { type: string }).type}\`)` のほうが本物のバグを表面化させる。現状は silent fallthrough。

---

**[M4] `useYjsAnnotationsStore.ts` — 安定 ref が依存配列に入っている**

`selectedIdRef`（line 99）、`useStateRef` から返る `setStatus` / `setCanUndo` / `setCanRedo` setter が `useCallback` / `useEffect` の deps に並んでいる。これらは安定なので本来不要。lint ルールが要求しているなら無害、対応は任意。

### LOW

**[L1] `useYjsAnnotationsStore.ts:31` — デフォルト factory がテストできない**

デフォルト factory が `useMemo` 内でインライン構築されている。テストは常に `providerFactory` を渡す必要あり。コメントを追加するか、名前付き定数に切り出すと意図が明確になる。

---

**[L2] `RoomEditor.tsx:34` — `useMemo([])` 内で `getOrCreateLocalUser()` が render 中に localStorage を触る**

`getOrCreateLocalUser` は `window.localStorage` を render 中に読み書きする。React 19 + StrictMode では二重に呼ばれる可能性あり。storage チェックで冪等なので問題はないが、`useState(() => getOrCreateLocalUser())` の lazy-init パターンのほうが慣用句的。

---

**[L3] `wrangler.toml` — DO migration が v1 のみ**

`[[migrations]] tag = "v1" new_classes = ["YDurableObjects"]` は新規 DO クラスとしては正しい。将来スキーマを変える場合は `tag = "v2"` 等が必要。Phase 5 plan に書き残しておく。

---

**[L4] `CanvasStage.tsx:160-162` — `handleMouseLeave` が rAF throttle を回避**

`RoomEditor` から渡される `presence.setCursor` は rAF throttle 済みだが、`onMouseLeave` は `null` を直接渡している。これは正解 — カーソル消失は即時反映したい — がコメントで意図を残しておく価値あり。

---

**[L5] `presence-context.ts:36` — Awareness state の型キャストに runtime parse なし**

`raw.user as { userId, displayName, color } | undefined` は wire payload を信頼している。Yjs Awareness は認証されておらず、悪意ある peer が長すぎる `displayName` を送りうる（`UserPresenceSchema` で 32 文字上限を定義しているが、ここでは `safeParse` していない）。Phase 5（auth）で defense-in-depth として `UserPresenceSchema.safeParse(raw)` を追加すべき。

---

**[L6] `local-user.ts:33-34` — `parsed.color ?? colorForUser(parsed.userId)`**

storage に `{ userId, displayName }` だけ入っているケース（`color` 欠損）のフォールバック。正しいが、color 欠損時は毎回 hash 計算が走る — 軽微。

## 検証結果

| 項目 | 結果 |
|---|---|
| Type check | ✅ Pass（`pnpm turbo run typecheck`、4/4 tasks） |
| Lint | ✅ Pass（`pnpm lint`、エラー 0 / 既存 warning 1 件 — `local-user.ts:25`） |
| Tests | ✅ Pass（api 41 + web 125 = 166 件 green） |
| Build | ✅ Pass（wrangler dry-run で DO binding 検出 / vite build 695 KB / gzip 212 KB） |
| E2E | ⏭ 既存 4 件 pass、新規 1 件は plan 通り `.skip` |
| DO 実機動作 | ⏭ 手動 smoke 必要（`wrangler dev` + 2 タブ） |

## レビュー対象ファイル

**新規 (24)**

| File | Status |
|---|---|
| `apps/api/src/__tests__/yjs.test.ts` | ✅ |
| `apps/web/src/components/canvas/AwarenessLayer.tsx` | ✅ |
| `apps/web/src/components/connection/ConnectionBadge.tsx` | ✅ |
| `apps/web/src/components/toolbar/CopyUrlButton.tsx` | ⚠️ HIGH (H3) |
| `apps/web/src/domain/annotation/yjs-codec.ts` | ✅ |
| `apps/web/src/domain/annotation/__tests__/yjs-codec.test.ts` | ✅ |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | ✅ |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | ✅ |
| `apps/web/src/hooks/yjs-annotations-context.ts` | ⚠️ MEDIUM (M3) |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | ✅ |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | ⚠️ MEDIUM (M1, M4) |
| `apps/web/src/hooks/presence-context.ts` | ⚠️ LOW (L5) |
| `apps/web/src/hooks/__tests__/presence-context.test.ts` | ✅ |
| `apps/web/src/hooks/usePresence.ts` | ✅ |
| `apps/web/src/hooks/useStateRef.ts` | ✅ |
| `apps/web/src/lib/yjs-config.ts` | ✅ |
| `apps/web/src/lib/__tests__/yjs-config.test.ts` | ✅ |
| `apps/web/src/lib/local-user.ts` | ⚠️ LOW (L6) |
| `apps/web/src/lib/__tests__/local-user.test.ts` | ✅ |
| `apps/web/src/lib/url-room.ts` | ✅ |
| `apps/web/src/lib/__tests__/url-room.test.ts` | ✅ |
| `apps/web/src/pages/EditorShell.tsx` | ✅ |
| `apps/web/src/pages/LocalEditor.tsx` | ✅ |
| `apps/web/src/pages/RoomEditor.tsx` | ⚠️ HIGH (H1, H2), LOW (L2) |

**変更 (14)**

| File | Status |
|---|---|
| `apps/api/vitest.config.ts` | ✅ — Vite plugin による virtualization は適切な形 |
| `apps/api/src/index.ts` | ✅ |
| `apps/api/src/__tests__/openapi.test.ts` | ✅ |
| `apps/api/wrangler.toml` | ⚠️ LOW (L3) |
| `apps/web/src/App.tsx` | ✅ |
| `apps/web/src/pages/EditorPage.tsx` | ✅ |
| `apps/web/src/hooks/useImageSource.ts` | ⚠️ MEDIUM (M2) |
| `apps/web/src/lib/api-client.ts` | ✅ |
| `apps/web/src/components/canvas/CanvasStage.tsx` | ⚠️ LOW (L4) |
| `apps/web/src/components/canvas/colors.ts` | ✅ |
| `apps/web/src/styles/tokens.css` | ✅ |
| `apps/web/vite.config.ts` | ✅ |
| `apps/web/e2e/landing.spec.ts` | ✅ |
| `CLAUDE.md` | ✅ |

## 推奨される次の手順

1. **H1 修正** — `useYjsAnnotationsStore` から `awareness` を直接公開する（小さな・隔離された変更で脆さが消える）
2. **H2 を判断** — 破壊的 UX なので、マージ前にプロダクト方針を決める
3. **H3 修正** — `CopyUrlButton` の setTimeout cleanup（短時間で安全性が上がる）
4. MEDIUM 項目はこの PR か次の PR で対処（M2 + M3 は短時間で済む）
5. PR 作成前に手動 smoke（`wrangler dev` + `vite dev` + 2 タブ）を実施
