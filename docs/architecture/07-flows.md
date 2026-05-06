# 07. Flows — 主要フローのシーケンス図

> [← INDEX](./INDEX.md) | 前: [06-realtime-and-konva](./06-realtime-and-konva.md) | 次: [08-glossary-and-pitfalls](./08-glossary-and-pitfalls.md)

snap-share の 5 つの主要フローを **時系列のシーケンス図** で示す。各図の下に、登場するファイル・bindings・schema の参照リストを置く。

## §1 認証フロー (protected room)

protected room (パスワード付き) を **アップローダーが作成 → 別ブラウザで参加 → WebSocket で同期開始** までの全経路。

```mermaid
sequenceDiagram
  autonumber
  participant U as Uploader Browser
  participant V as Visitor Browser
  participant W as Worker (Hono)
  participant K as KV (WS_TICKETS)
  participant DO as SnapShareYDO

  Note over U,W: 画像 upload + password 設定
  U->>W: POST /rooms (multipart, Turnstile)
  W->>W: turnstile verify / blocklist / R2 put
  W->>W: token-service.issue(roomId)
  W-->>U: 201 RoomCreatedSchema { id, token, ... }
  U->>U: sessionStorage.setRoomToken(id, token)

  Note over V,W: 別ブラウザで /r/:id を訪問
  V->>W: GET /rooms/:id
  W-->>V: 200 RoomPublicSchema { protected: true }
  V->>V: RoomGate 表示 (token 未保有)
  V->>W: POST /rooms/:id/auth { password }
  W->>W: password-service.verify (PBKDF2)
  W-->>V: 200 AuthResponseSchema { token }
  V->>V: sessionStorage.setRoomToken(id, token)

  Note over U,K: WebSocket チケット交換
  U->>W: POST /rooms/:id/ws-ticket (Bearer JWT)
  W->>W: token-service.verify
  W->>K: KV put ws-ticket:hex → roomId (TTL 60s)
  W-->>U: 200 WsTicketResponseSchema { ticket }

  Note over U,DO: WS upgrade (burn-on-consume)
  U->>W: WS /sync/:id?ticket=hex
  W->>K: KV get ws-ticket:hex
  K-->>W: roomId
  W->>K: KV delete ws-ticket:hex
  W->>DO: yRoute → Y_ROOM
  DO-->>U: WS opened (Yjs sync 開始)
```

### 関連ファイル / schema

- API: `apps/api/src/routes/rooms.ts` (POST /rooms / POST /auth / POST /ws-ticket)
- API: `apps/api/src/yjs.ts` の `syncRoute` middleware (ticket consume)
- API services: `token-service.ts` / `password-service.ts` / `ws-ticket-service.ts`
- Web: `apps/web/src/components/room-gate/RoomGate.tsx` (auth form)
- Web: `apps/web/src/lib/api-client.ts` (`createRoom` / `authenticateRoom` / `requestWsTicket`)
- Web: `apps/web/src/lib/auth-storage.ts` (sessionStorage)
- Schema: `RoomCreatedSchema` / `AuthResponseSchema` / `WsTicketResponseSchema` (`packages/shared/src/room.ts`)

### 設計の意図

- **JWT は Authorization header だけに乗せる** (URL に乗せない)。WS upgrade URL は wrangler tail / Referer / browser history に残るため、ここに 24h JWT を置くと長時間の認証情報漏洩リスクになる
- **WS ticket は 60 秒で expire + 一度使ったら KV から削除** (burn-on-consume)。漏れても即無効化される

## §2 画像アップロードフロー

LocalEditor で画像を D&D してから、URL 共有可能な room として配信されるまで。

```mermaid
sequenceDiagram
  autonumber
  participant U as Browser (LocalEditor)
  participant W as Worker (Hono)
  participant T as Turnstile siteverify
  participant B as KV (IMAGE_BLOCKLIST)
  participant R as R2 (IMAGES)

  U->>U: useImageSource: validateImageFile(file)<br/>(MIME / size 検証)
  U->>U: URL.createObjectURL → local preview
  U->>W: POST /rooms (multipart: image + password? + turnstile + ttlMs?)
  W->>W: uploadFormSchema.parse
  W->>W: MIME / size 再検証 (415 / 413)
  W->>T: siteverify(turnstileToken)
  T-->>W: ok / fail
  W->>W: sha256(bytes) → hex
  W->>B: KV get IMAGE_BLOCKLIST[hex]
  B-->>W: blocked? (fail-open)
  alt password 指定あり
    W->>W: password-service.hash → RoomAuth
  end
  W->>R: r2-image-storage.putImage(file)
  W->>R: r2-meta-storage.putMeta(roomId, RoomStored)
  alt protected
    W->>W: token-service.issue(roomId) → JWT
  end
  W-->>U: 201 RoomCreatedSchema
  U->>U: history.pushState(`/r/:id`) + setRoomId(...)
  Note over U: EditorPage が RoomEditor に切替<br/>(React.lazy が vendor-yjs を fetch)
```

### 関連ファイル / schema

- Web: `apps/web/src/hooks/useImageSource.ts`
- Web: `apps/web/src/lib/imageValidation.ts` / `apps/web/src/lib/api-client.ts`
- API: `apps/api/src/routes/rooms.ts` の POST /rooms ハンドラ
- API services: `turnstile-service.ts` / `image-blocklist-service.ts` / `room-service.ts` / `password-service.ts` / `token-service.ts`
- API storage: `r2-image-storage.ts` / `r2-meta-storage.ts`
- API lib: `apps/api/src/lib/sha256.ts`
- Schema: `MAX_IMAGE_BYTES` / `ALLOWED_IMAGE_MIME_TYPES` / `RoomStoredSchema` / `RoomCreatedSchema` (`packages/shared/src/room.ts`)
- Bindings: `IMAGES` (R2) / `IMAGE_BLOCKLIST` (KV) / `RL_CREATE_ROOM` (RL) / `TURNSTILE_SECRET_KEY` (secret)

### 検証レイヤ

| 層 | チェック | エラー code |
|---|---|---|
| Web (`imageValidation.ts`) | MIME / size | i18n key 表示 |
| API schema (`uploadFormSchema`) | `instanceof(File)` / max(256) | 400 INVALID_REQUEST |
| API handler | `ALLOWED_IMAGE_MIME_TYPES` | 415 UNSUPPORTED_MEDIA_TYPE |
| API handler | `file.size > MAX_IMAGE_BYTES` | 413 PAYLOAD_TOO_LARGE |
| API handler | Turnstile siteverify | 401 UNAUTHORIZED |
| API handler | SHA-256 blocklist hit | 422 UNPROCESSABLE_ENTITY |
| API middleware | `withRateLimit(RL_CREATE_ROOM)` | 429 RATE_LIMITED |

## §3 Yjs 同期フロー

ローカル mutation がリモート peer に届くまでの内部経路。**LocalEditor では発生しない** (画像未投入 / `Y.Doc` 不在のため)。

```mermaid
sequenceDiagram
  autonumber
  participant U1 as Browser A
  participant DO as SnapShareYDO
  participant U2 as Browser B

  U1->>U1: dispatch({ type: 'annotation/add', ... })
  U1->>U1: applyDataAction → addAnnotationY
  U1->>U1: doc.transact(fn, LOCAL_ORIGIN)<br/>yAnnotations.set(id, annotationToYMap(a))
  U1->>U1: UndoManager (trackedOrigins=LOCAL_ORIGIN)<br/>→ stack に push
  U1->>DO: WS update binary (encoded diff)
  DO->>DO: y-durableobjects: doc に apply + storage 永続化
  DO->>U2: WS broadcast update binary
  U2->>U2: provider が update を doc に apply<br/>(origin = null)
  U2->>U2: UndoManager は origin=null を skip<br/>→ U2 の Cmd+Z は U1 の編集を消さない
  U2->>U2: yAnnotations.observeDeep callback<br/>→ buildAnnotationsSnapshot 再生成
  U2->>U2: useSyncExternalStore listener<br/>→ React re-render
```

### 関連ファイル

- Web hooks: `apps/web/src/hooks/yjs-annotations-context.ts` (Y.Doc + WebsocketProvider + UndoManager)
- Web hooks: `apps/web/src/hooks/useYjsAnnotationsStore.ts` (factory + ws-ticket 取得 + subscribe)
- Web domain: `apps/web/src/domain/annotation/yjs-mutations.ts` (LOCAL_ORIGIN + tx ヘルパー)
- Web domain: `apps/web/src/domain/annotation/yjs-codec.ts` (annotationToYMap / yMapToAnnotation)
- Web lib: `apps/web/src/lib/yjs-config.ts` (LOCAL_ORIGIN re-export + resolveWsBaseUrl)
- API: `apps/api/src/yjs.ts` (`SnapShareYDO` + `syncRoute`)
- 詳細メカニズム: [06-realtime-and-konva](./06-realtime-and-konva.md) §4–§6

### 罠の再掲

- **`LOCAL_ORIGIN` は同じ symbol を全箇所で共有**しないと UndoManager が正しく動かない (§5 参照)
- **arrow の `from`/`to` は `Y.Map` 上では `fromX/fromY/toX/toY` に flat 化**されている (§6 参照)
- **`yMapToAnnotation` は `safeParse` を挟む** ので、壊れた peer データは silent に skip される (Open Questions に該当: 壊れた entry を log で観測したいか — [08-glossary-and-pitfalls.md](./08-glossary-and-pitfalls.md) 参照)

## §4 Export PNG フロー

stage の現在の見た目を PNG として download する。

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant H as useExportPng
  participant S as Konva.Stage
  participant A as AwarenessLayer
  participant D as DOM (a[download])

  U->>H: Cmd+S / Toolbar button
  H->>A: 一時的に visible=false<br/>(他人の cursor を export に含めない)
  H->>S: stage.toDataURL({ pixelRatio })
  S-->>H: data URL (image/png)
  H->>H: data URL → Blob → Object URL
  H->>D: <a download="..."> click()
  H->>A: visible=true (rollback)
```

### 関連ファイル

- Web hooks: `apps/web/src/hooks/useExportPng.ts`
- Web lib: `apps/web/src/lib/exportPng.ts`
- Web canvas: `apps/web/src/components/canvas/AwarenessLayer.tsx` (visibility 制御)

### 罠

- **画像が CORS taint されていると `toDataURL` が SecurityError を投げる**。本番は web (Pages) と画像配信 (Workers) が別 origin なので、`useImage(src, 'anonymous')` で CORS-enabled fetch を強制する必要がある (§2 参照)
- **AwarenessLayer を非表示にする操作は同期的に再描画されないと export に間に合わない**。Konva の `Layer.draw()` を明示的に呼んで強制反映してから `toDataURL` する

## §5 TTL & 破棄フロー

ルーム作成から TTL 期限到達 → R2 / DO 自動削除まで。

```mermaid
sequenceDiagram
  autonumber
  participant W as Worker (POST /rooms)
  participant R as R2 (IMAGES)
  participant DO as SnapShareYDO

  W->>R: putImage / putMeta(roomId, RoomStored)<br/>{ createdAt, ttlMs }
  Note over DO: 初回 WS upgrade 時に DO が起動
  DO->>DO: onStart()<br/>getAlarm() === null → setAlarm(createdAt + ttlMs)

  Note over DO: ... ユーザー編集 / Hibernation wake/sleep ...
  Note over DO: ... 時間が経つ ...

  DO->>DO: alarm() 発火 (TTL 期限到達)
  DO->>R: r2-meta-storage.getMeta(roomId)
  R-->>DO: RoomStored
  DO->>R: r2-image-storage.deleteImage(image.key)
  DO->>R: r2-meta-storage.deleteMeta(roomId)
  DO->>DO: state.storage.deleteAll()
  Note over DO: 以降の GET /rooms/:id は 404
```

### 関連ファイル

- API: `apps/api/src/yjs.ts` (`SnapShareYDO.onStart` / `alarm`)
- API storage: `r2-image-storage.ts` / `r2-meta-storage.ts`
- Schema: `DEFAULT_ROOM_TTL_MS` (24h) / `MAX_ROOM_TTL_MS` (7d) (`packages/shared/src/room.ts`)
- Bindings: `IMAGES` (R2) / `Y_ROOM` (DO) / `ROOM_TTL_MS` (var)

### 設計の意図

- **TTL を Worker 側 cron で回さない**: 全 room を走査する batch job は無駄。各 DO の Alarm に分散させた方がスケーラブル
- **`onStart` の冪等性**: Hibernation wake のたびに `onStart` が呼ばれるので、`getAlarm() === null` チェックがないと `setAlarm` が二重発火する
- **`alarm()` は idempotent**: 失敗時 Cloudflare 側がリトライする可能性があるので、削除済みリソースに対する重複 delete を吸収する設計 (R2 / DO storage の delete はどちらも 404 不問)

## まとめ

5 つのフローはすべて **「shared schema を介した型一貫性 + bindings 経由の I/O」** で組み立てられている:

| フロー | 鍵となる layer |
|---|---|
| 認証 | `RoomCreatedSchema` / `AuthResponseSchema` / `WsTicketResponseSchema` |
| 画像 upload | `RoomStoredSchema` + R2 IMAGES + KV IMAGE_BLOCKLIST |
| Yjs 同期 | `LOCAL_ORIGIN` symbol + `Y.Map` flat 化 + DO Hibernation |
| Export | Konva Stage.toDataURL + CORS anonymous |
| TTL | DO Alarm + R2 + DO storage の冪等 delete |

各 layer の責務分離は [04-api-anatomy](./04-api-anatomy.md) / [05-web-anatomy](./05-web-anatomy.md) / [06-realtime-and-konva](./06-realtime-and-konva.md) に対応するので、フローで詰まったらその章へ戻る。

## 次に読むファイル

- 用語集 + ハマりポイント + Open Questions → [08-glossary-and-pitfalls](./08-glossary-and-pitfalls.md)
- 環境変数 / デプロイ → [09-environment-and-deploy](./09-environment-and-deploy.md)
