# 06. Realtime & Konva — 深堀り章

> [← INDEX](./INDEX.md) | 前: [05-web-anatomy](./05-web-anatomy.md) | 次: [07-flows](./07-flows.md)

React + Hono の業務アプリ経験者向けに、snap-share の「未知ゾーン」(Konva / Yjs CRDT / Cloudflare Workers / Durable Objects / WebSocket Hibernation) を最低限のメンタルモデルだけ補強する章。深い API リファレンスは公式に任せ、ここでは **「このコードベースを読み解くために知っていれば足りる」** ところに絞る。

## §1 Konva 最低限

Konva は Canvas 2D を React で扱うライブラリ。重要な抽象は 4 つ。

| 概念 | 役割 |
|---|---|
| `Stage` | 描画ルート (`<canvas>` を包む)。サイズ / scale / position を持つ |
| `Layer` | Stage の子。Layer 1 つにつき内部で Canvas が 2 枚 (描画用 + hit test 用) |
| `Group` | 複数 Shape をまとめる中間ノード (snap-share では現状未使用) |
| `Shape` | Rect / Arrow / Text / Image 等。最終描画ノード |

[apps/web/src/components/canvas/CanvasStage.tsx](../../apps/web/src/components/canvas/CanvasStage.tsx) の構造はこう (簡略):

```tsx
<Stage onMouseDown onMouseMove onMouseUp onWheel>
  <ImageLayer />          {/* 画像専用 Layer */}
  <AnnotationLayer />     {/* Rect/Arrow/Text/Highlight Shapes */}
  {pendingAutoArrow && <Layer listening={false}>...preview...</Layer>}
  {extraLayers}           {/* AwarenessLayer (cursor / selection) */}
</Stage>
```

### Listening / Hit Detection

各ノードには `listening` プロパティがあり、**hit test (= pointer event 受付) の対象にするか** を制御する:

- `listening={true}` (デフォルト) → pointer event をキャッチする
- `listening={false}` → 同じ位置でもイベントは下層 (or Stage) に貫通

Konva は hit detection を「最上層 Layer から下へ」走査するため、**最上層が listening=true だと下層 Shape はクリック不可**。これが §2 の前提。

### イベントの `e.target` 判定

`Stage.onMouseDown` ハンドラでは `e.target` は **クリックされた最も具体的なノード** が入る:

- 何もない場所 → `e.target === stage` (Stage 自身)
- Shape 上 → `e.target === shape インスタンス`
- listening=true な Image 上 → `e.target === image` ← 罠の元

CanvasStage はこう判定する:

```typescript
const isStageClick = e.target === stage;
if (e.target !== stage) return;  // 既存 shape 上のクリックは drag tool 開始しない
```

ハマったら見るファイル: `apps/web/src/components/canvas/CanvasStage.tsx` (`handleMouseDown`)

## §2 ImageLayer の `listening={false}` がなぜ必須か

[apps/web/src/components/canvas/ImageLayer.tsx](../../apps/web/src/components/canvas/ImageLayer.tsx) は **Layer と KonvaImage の両方に `listening={false}`** を付けている:

```tsx
<Layer listening={false}>
  {image && <KonvaImage image={image} listening={false} />}
</Layer>
```

理由:
1. Konva の `KonvaImage` は **デフォルト listening=true**。画像が画面全体を覆うサイズで配置されるため、画像クリックは常に `e.target === imageNode` になる。
2. 上記の判定 `if (e.target !== stage) return` で drag tool 開始処理が早期 return → **画像の上では矩形/矢印を描けない**。
3. Layer 側にも `listening={false}` を付けるのは、Layer 自体の hit canvas が pointer event を吸収してしまう経路を消すため (Konva は二段の hit detection を持つ)。

これは Phase 0 spike report で実際に踏んだ罠 ([docs/spikes/REPORT.md](../spikes/REPORT.md))。Phase 3 本実装で修正済。

### CORS と canvas tainting

ImageLayer は `useImage(src, 'anonymous')` で **CORS-enabled fetch** を強制する。本番では web (Cloudflare Pages) と画像配信 (Workers の `/rooms/:id/image`) が **別 origin** なので、CORS なしで読み込むと canvas は taint され `stage.toDataURL()` で SecurityError が出て PNG export が落ちる。

`anonymous` を付けると `<img crossorigin="anonymous">` 相当の fetch になり、サーバ側 CORS 設定 (Workers の `cors()` middleware) が allow すれば taint しない。

ハマったら見るファイル: `apps/web/src/components/canvas/ImageLayer.tsx`、`apps/web/src/lib/exportPng.ts`

## §3 useRef vs useState — drag draft の同期参照問題

[CanvasStage.tsx](../../apps/web/src/components/canvas/CanvasStage.tsx) の draft 管理は **ref と state を二重に持つ** という一見冗長な構造になっている:

```typescript
const dragStartRef = useRef<DragStart | null>(null);
const draftRef = useRef<Annotation | null>(null);
const [draft, setDraft] = useState<Annotation | null>(null);
```

理由は React の状態更新タイミング:

1. `mousedown` で `dragStartRef.current = start`
2. `mousemove` (連続) で `draftRef.current = next` (ref) と `setDraft(next)` (state)
3. `mouseup` で `draftRef.current` を読んで commit

`setDraft` は React の reconcile を待たないと反映されない。**同じイベントループ内で連続して読み書きしたい値は ref**、**re-render trigger が必要な値は state**。両方欲しい場合は両方持つ。

state 側 (`draft`) が必要なのは drag 中に半透明 preview を描画するため:

```typescript
const visibleAnnotations = draft ? [...annotations, draft] : annotations;
```

state がないと preview が `mousemove` ごとに re-render されない。逆に ref がないと `mouseup` のクロージャに古い値が捕まる (closure trap)。

ハマったら見るファイル: `apps/web/src/components/canvas/CanvasStage.tsx` (`dragStartRef` / `draftRef` / `setDraft`)

## §4 Yjs CRDT 最低限

Yjs は CRDT (Conflict-free Replicated Data Type) ライブラリ。**3 つの抽象** だけ押さえれば snap-share は読める。

| 抽象 | 意味 |
|---|---|
| `Y.Doc` | ドキュメントルート。`new Y.Doc()` で作る |
| `Y.Map` / `Y.Array` / `Y.Text` | Doc の中に作るデータ構造。CRDT 性を持つ |
| `update` binary | Doc 間で同期するバイト列 |

snap-share は **`Y.Map<string, Y.Map<string, unknown>>`** だけ使う:

```typescript
const doc = new Y.Doc();
const yAnnotations = doc.getMap<Y.Map<unknown>>('annotations');
// yAnnotations.set(annotationId, ymapForOneAnnotation)
```

外側の `Y.Map` のキーは annotation の id、値は **そのアノテーションの全フィールドを flat に格納した内側 Y.Map**。詳細は §6。

### `doc.transact(fn, origin)`

複数の Y.Map mutation を **1 つの atomic な update** にまとめる API。第二引数の `origin` は「この transaction を起こした主体を識別するタグ」で、UndoManager や observer はこの値で remote / local を判別する。

```typescript
doc.transact(() => {
  ymap.set('x', 100);
  ymap.set('y', 200);
}, LOCAL_ORIGIN);
// → リモートに 1 つの update binary として送信される
```

snap-share の全 mutation は [apps/web/src/domain/annotation/yjs-mutations.ts](../../apps/web/src/domain/annotation/yjs-mutations.ts) の `tx(doc, fn)` ヘルパー経由で必ず `LOCAL_ORIGIN` を渡す。

### `Y.UndoManager`

特定の Y 型 (Y.Map など) を監視し、その mutation を **stack に積んで undo/redo 可能にする** ヘルパー。snap-share の構成:

```typescript
const undoManager = new Y.UndoManager(yAnnotations, {
  trackedOrigins: new Set([LOCAL_ORIGIN]),
  captureTimeout: 500,
});
```

- `trackedOrigins`: ここに含まれる origin の transaction だけ undo stack に積む。**リモートからの merge (origin = null) は無視**される
- `captureTimeout`: 連続した mutation を 1 step に merge する閾値 (500ms)。500ms 以上空けば独立 step

### Provider (`y-websocket`)

`Y.Doc` だけだとローカル単独。`WebsocketProvider(url, room, doc)` を attach すると update binary が WS 経由で peer / server と自動同期する。snap-share は **server = `SnapShareYDO` (Durable Object)** で集約型 (P2P ではない)。

## §5 LOCAL_ORIGIN — Symbol identity の罠

[apps/web/src/domain/annotation/yjs-mutations.ts](../../apps/web/src/domain/annotation/yjs-mutations.ts):

```typescript
export const LOCAL_ORIGIN = Symbol('pitamark/local');
```

**Symbol は同じファイルから import される限り identity が同一**。逆に言うと、別の場所で `Symbol('pitamark/local')` を作っても **別物**。`Set` に入れた `LOCAL_ORIGIN` と一致しない。

これが UndoManager の `trackedOrigins: new Set([LOCAL_ORIGIN])` の前提。**全 mutator と UndoManager 構築側が完全に同じ symbol を共有しなければならない**。

そのため [apps/web/src/lib/yjs-config.ts](../../apps/web/src/lib/yjs-config.ts) で **single source of re-export**:

```typescript
export { LOCAL_ORIGIN } from '../domain/annotation/yjs-mutations';
```

`yjs-annotations-context.ts` は `lib/yjs-config` 経由で import、`yjs-mutations.ts` 内では直接 export を使う。両方とも同じ symbol インスタンスを参照する構造になる。

### なぜ origin を分けるのが大事か

CRDT で undo/redo を素朴に実装すると **「自分の Cmd+Z で他人の編集が消える」** バグが起きる。

snap-share では:
- ローカル mutation (`doc.transact(fn, LOCAL_ORIGIN)`) → UndoManager に追跡される
- リモート merge (provider 経由、origin = null) → UndoManager は無視

これにより Cmd+Z は **自分の操作だけ巻き戻す**。他人の操作はそのまま残る。

ハマったら見るファイル: `apps/web/src/domain/annotation/yjs-mutations.ts`、`apps/web/src/lib/yjs-config.ts`、`apps/web/src/hooks/yjs-annotations-context.ts`

## §6 yjs-codec — Y.Map ↔ Annotation 双方向変換

[apps/web/src/domain/annotation/yjs-codec.ts](../../apps/web/src/domain/annotation/yjs-codec.ts) は Y 型と TS 型の境界。

### `annotationToYMap(annotation)` — 出口

discriminated union (`Annotation`) を flat な `Y.Map<string, unknown>` に詰める。**arrow の `from`/`to` を `fromX`/`fromY`/`toX`/`toY` に分解** するのが一番のポイント:

```typescript
case 'arrow':
  m.set('fromX', annotation.from.x);
  m.set('fromY', annotation.from.y);
  m.set('toX', annotation.to.x);
  m.set('toY', annotation.to.y);
```

理由はコメント通り「`Y.Map` の中に `Y.Map` を nest すると `observeDeep` の event chain が複雑化する」から。flat にすれば observer は単純なキー差分だけで反応する。

### `yMapToAnnotation(m)` — 入口

逆向き。`m.get('type')` で type を見て candidate オブジェクトを組み立て、最後に `AnnotationSchema.safeParse` で **runtime 検証** してから返す。

```typescript
const parsed = AnnotationSchema.safeParse(candidate);
return parsed.success ? parsed.data : null;
```

`safeParse` を挟むのは **将来の Yjs migration safety net**。
- 古い peer がまだ存在する古いフィールド形式で push してきた場合に弾く
- 新しい annotation type を追加した将来、未対応 peer の古いコードが壊れたデータを sync してきた場合に弾く

加えて `switch` の default で `const _exhaustive: never = type` を書いているので、**`Annotation` union に新種を追加すると compile error** で気付く構造。

### `buildAnnotationsSnapshot(yAnnotations)` — 全体スナップショット

`Y.Map<Y.Map>` を `ReadonlyArray<Annotation>` に変換、`createdAt` で sort、`Object.freeze`。`yjs-annotations-context.ts` の `subscribe` 内で `observeDeep` callback が呼ばれるたびに作り直されてキャッシュされる。

ハマったら見るファイル: `apps/web/src/domain/annotation/yjs-codec.ts`、`apps/web/src/hooks/yjs-annotations-context.ts` (`subscribe`)

## §7 Cloudflare Workers メンタルモデル

Workers は **「グローバル分散の Node 風サーバレス」** ではなく **「グローバル分散の V8 isolate サーバレス」**。違いは大きい:

| 観点 | 普通の Node サーバ | Cloudflare Workers |
|---|---|---|
| 実行単位 | プロセス (起動コストあり、状態保持可) | V8 isolate (起動 < 5ms、リクエスト終了で破棄) |
| ストレージ | localfs / DB を直接叩く | bindings 経由のみ (R2 / KV / DO / D1 / etc) |
| グローバル変数 | プロセス寿命の間保持 | リクエスト間で保持されない (ただし isolate 再利用はある) |
| WebSocket | 自前で常駐 | Durable Object 経由 (§8) |
| デプロイ単位 | コンテナ / VM | JS bundle (1MB 以下推奨) |

### Bindings

Workers が外部リソースに触る唯一の方法。snap-share では:
- `IMAGES` (R2) — 画像 + room メタ
- `Y_ROOM` (Durable Object) — Yjs ルーム
- `WS_TICKETS` / `IMAGE_BLOCKLIST` (KV) — 短命データ
- `RL_CREATE_ROOM` / `RL_AUTH` / `RL_SYNC` (Rate Limit)
- `ROOM_TOKEN_SECRET` / `TURNSTILE_SECRET_KEY` (secret)
- `CORS_ALLOWED_ORIGINS` 等 (vars)

すべて [apps/api/src/lib/bindings.ts](../../apps/api/src/lib/bindings.ts) で `Bindings` 型として一箇所に定義。Hono の `c.env` がこの型で型付けされる。

### 重要な性質

- **Edge で実行される**: 各リクエストは最寄りのデータセンターで isolate 起動。R2 / KV は eventually consistent
- **CPU 時間制限**: 1 リクエスト 50ms (free) / 30s (paid) などの上限。snap-share は API 側ではほぼ I/O bound
- **Hibernation**: §9

ハマったら見るファイル: `apps/api/src/lib/bindings.ts`、`apps/api/wrangler.toml`

## §8 Durable Object — 単一インスタンス + 永続ステート

普通の Worker は「リクエストごとに使い捨て」だが、**Durable Object は世界に 1 つだけ存在する long-lived なオブジェクト**。同じ id を持つ DO は世界中どこからアクセスしても同じインスタンスにルーティングされる (Cloudflare 側が管理)。

### snap-share での使い方

[apps/api/src/yjs.ts](../../apps/api/src/yjs.ts) の `SnapShareYDO`:

- `Y_ROOM.idFromName(roomId)` で `roomId` ごとに DO ID を派生
- 各ルームにつき **世界に 1 つの DO** が存在
- DO 内に `Y.Doc` を in-memory で持ち、すべての WS クライアントの update binary を broadcast
- `state.storage` (DO 内蔵の永続 storage) に doc snapshot を保存

### Alarm API — TTL cleanup

DO は `state.storage.setAlarm(timestamp)` で「指定時刻に `alarm()` メソッドを呼んでもらう」予約ができる。snap-share は room TTL 切れで R2 + DO storage を全削除するために使う:

```typescript
protected override async onStart() {
  await super.onStart();
  const existing = await this.state.storage.getAlarm();
  if (existing != null) return;        // 二重 set 防止
  const room = await meta.getMeta(roomId).catch(() => null);
  if (!room) return;
  await this.state.storage.setAlarm(room.createdAt + room.ttlMs);
}

override async alarm() {
  // R2 image / meta 削除 + DO storage wipe
  await images.deleteImage(room.image.key);
  await meta.deleteMeta(roomId);
  await this.state.storage.deleteAll();
}
```

`onStart` は DO がメモリにロードされるたびに呼ばれる (= Hibernation wake 含む) ため、`getAlarm()` で重複 set を防ぐのが必須。

ハマったら見るファイル: `apps/api/src/yjs.ts` (`SnapShareYDO.onStart` / `alarm`)

## §9 WebSocket Hibernation API

WebSocket を抱えた DO を「アイドル中はメモリ解放、wake on event で復活」させるための仕組み。

### 普通の WS との違い

通常の WebSocket サーバ:
- 接続中は常にメモリに居続ける必要がある
- 100 ルーム × 10 ユーザーの `Y.Doc` を全部メモリ保持 → コスト爆発

Hibernation 対応:
- WS 接続自体は Cloudflare 側のインフラで保持
- DO は idle (= 一定時間 message なし) で **メモリ解放されて休眠**
- 次の WS message が来たら DO が再起動 (`onStart` 経由) → state を storage から復元 → message 処理
- ユーザーから見ると接続は切れない

snap-share では `y-durableobjects` ライブラリが Hibernation 対応の WebSocket handler を内部実装している。`yRoute(env => env.Y_ROOM)` で router を組み込むだけで自動的に Hibernation が効く。

### 注意点

- **メモリで持つ state は wake で消える**。`Y.Doc` も含む。`y-durableobjects` は storage への snapshot 保存と wake 時の復元を内部で行う
- **Alarm はメモリ寿命に依存しない**。`setAlarm` した時刻に DO は自動的に wake して `alarm()` を実行する

snap-share の `SnapShareYDO.onStart` で `existing != null` チェックがあるのは、「Hibernation wake のたびに `setAlarm` を再実行してしまう」問題を防ぐため。

ハマったら見るファイル: `apps/api/src/yjs.ts` (`SnapShareYDO.onStart` のコメント)、[docs/spikes/REPORT.md](../spikes/REPORT.md) (Spike B)

## §10 `y-durableobjects` ライブラリ

Yjs の WS provider と Cloudflare DO を繋ぐためのオープンソースライブラリ。snap-share は v1.0.5 を採用。

### 提供するもの

| API | 役割 |
|---|---|
| `class YDurableObjects extends DurableObject` | DO 基底クラス。`Y.Doc` 管理 + WS handling + Hibernation を内蔵 |
| `yRoute<{ Bindings }>((env) => env.Y_ROOM)` | Hono router マウンタ。`/sync/:id` → DO にディスパッチ |

snap-share は `YDurableObjects` を継承して `SnapShareYDO` を作り、`onStart` / `alarm` だけ override して TTL 機能を追加している。

### Phase 5 の rename 経緯

[apps/api/wrangler.toml](../../apps/api/wrangler.toml) には migration が 2 段ある:

```toml
[[migrations]]
tag = "v1"
new_classes = ["YDurableObjects"]    # Phase 0-4: 元の名前

[[migrations]]
tag = "v2"
renamed_classes = [{ from = "YDurableObjects", to = "SnapShareYDO" }]  # Phase 5: 改名
```

Phase 5 で TTL 機能 (= Alarm 利用) を入れる際にサブクラス化したが、すでにライブ DO が `YDurableObjects` ID で存在していたため、**rename migration で既存 DO のクラスを差し替え**た。新規 deploy ではなく既存 state を保ったまま移行できる。

### `new_classes` vs `new_sqlite_classes`

`y-durableobjects` v1 は **DO 内蔵の永続 storage** (`state.storage.put` / `get`) ベース。Cloudflare の `new_sqlite_classes` (新しい SQLite-backed DO) ではない。`wrangler.toml` の migration tag が `new_classes` を使っているのはそのため。spike report ([docs/spikes/REPORT.md](../spikes/REPORT.md)) 起票時に間違えて `new_sqlite_classes` で書いていたが、ライブラリ要件は `new_classes` 側で、spike 中に修正された。

ハマったら見るファイル: `apps/api/wrangler.toml` の migrations 定義、`apps/api/src/yjs.ts` (`SnapShareYDO` 継承部分)

## まとめ — 6 レイヤの積み上げ

snap-share の realtime ロジックは **6 つのレイヤ** で組み立てられている:

```
┌─ Konva (canvas 描画 + listening 制御 + ref ベース drag draft)
├─ Annotation Schema (packages/shared, discriminated union)
├─ yjs-codec (Annotation ↔ Y.Map flat 化)
├─ yjs-mutations (LOCAL_ORIGIN tag 付き transact)
├─ Y.Doc + WebsocketProvider (y-websocket)
└─ SnapShareYDO + yRoute (DO + Hibernation + Alarm)
```

各レイヤの境界は薄く、**型は `Annotation` で一貫**。Yjs の中身は `Y.Map<Y.Map>` 1 種類だけ、UndoManager は LOCAL_ORIGIN だけを track、DO は y-durableobjects に丸投げ + Alarm だけ override — という **「ライブラリの素直な使い方」** で組まれている。新規拡張時もこの境界を踏襲すれば破綻しない。

## 次に読むファイル

- フローを時系列で見る → [07-flows](./07-flows.md)
- 用語まとめ + 罠リスト → [08-glossary-and-pitfalls](./08-glossary-and-pitfalls.md)
