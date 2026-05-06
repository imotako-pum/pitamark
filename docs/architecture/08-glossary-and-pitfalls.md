# 08. Glossary & Pitfalls

> [← INDEX](./INDEX.md) | 前: [07-flows](./07-flows.md) | 次: [09-environment-and-deploy](./09-environment-and-deploy.md)

ドキュメント全体で出てくる用語の定義と、コードを触るときに踏みやすい罠を集約する章。最後に「執筆中に断定で書ききれなかった項目」を Open Questions として明示する。

## 用語集

### CRDT 周辺

| 用語 | 定義 |
|---|---|
| **CRDT** | Conflict-free Replicated Data Type。複数ノードが同じデータを並行編集しても、全ノードが最終的に同じ状態に収束するデータ構造。Yjs / Automerge が代表例 |
| **Y.Doc** | Yjs のドキュメントルート。複数の Y.Map / Y.Array / Y.Text を内包する |
| **Y.Map** | キー → 値の CRDT-aware Map。snap-share では `Y.Map<string, Y.Map<string, unknown>>` の二段構造を使う |
| **Origin** | `doc.transact(fn, origin)` の第二引数。誰がその transaction を起こしたかを区別するタグ。snap-share では `LOCAL_ORIGIN` (Symbol) と remote merge (null) を使い分ける |
| **UndoManager** | Yjs 組み込みの undo/redo マネージャ。`trackedOrigins` set で「どの origin の操作だけ stack に積むか」を制御 |
| **Awareness** | 接続中ユーザーの cursor 位置 / 選択 / displayName など、永続化したくない短命 state を broadcast する仕組み (Yjs の awareness protocol) |
| **WebsocketProvider** | `y-websocket` パッケージが提供する WS provider。Y.Doc にアタッチすると update binary を WS 経由で同期する |

### Cloudflare 周辺

| 用語 | 定義 |
|---|---|
| **Workers** | Cloudflare の V8 isolate ベースサーバレス。リクエストごとに isolate 起動、bindings 経由でしか外部リソースに触れない |
| **Bindings** | `wrangler.toml` で宣言する Worker から外部リソース (R2 / KV / DO / RL / secret / var) への参照。コード上では `c.env.<name>` |
| **Durable Object (DO)** | 世界に 1 つだけ存在する long-lived な Worker インスタンス。同じ id を持つ DO は地理的にどこからアクセスしても同じインスタンスにルーティングされる |
| **Hibernation** | DO が idle 時にメモリ解放 → 次の event で wake する仕組み。WS 接続自体は Cloudflare 側で保持されるためユーザーから見ると切れない |
| **Alarm** | DO の `state.storage.setAlarm(timestamp)` で予約する時刻ベース callback。snap-share は TTL cleanup に使う |
| **R2** | Cloudflare のオブジェクトストレージ (S3 互換)。**エグレス無料**が大きい特徴 |
| **KV** | Cloudflare の eventual consistent key-value store。expirationTtl の最小値は 60 秒 |
| **Rate Limit (RL) binding** | Workers Rate Limiting バインディング。`limit({ key })` を呼ぶと `{ success: boolean }` が返る |
| **Turnstile** | Cloudflare の CAPTCHA 代替ボット対策。client widget が token を発行、server で siteverify する |

### snap-share 固有

| 用語 | 定義 |
|---|---|
| **Annotation** | 矩形 / 矢印 / テキスト / ハイライトの 4 種を `type` で区別する discriminated union (`packages/shared/src/annotation.ts`) |
| **LocalEditor** | URL `/` の画像未投入モード。Yjs ネットワークコードを fetch しない |
| **RoomEditor** | URL `/r/:id` のルームモード。Yjs + WS で同期 |
| **EditorShell** | 両モード共通の React シェル。Konva Stage / Toolbar / TextEditorOverlay を統合 |
| **LOCAL_ORIGIN** | `doc.transact` の origin に渡す Symbol。UndoManager の追跡対象を「自分の操作」に絞るための識別子 (`apps/web/src/domain/annotation/yjs-mutations.ts` で定義) |
| **WS Ticket** | 60 秒一回限りの 32 hex 文字。protected room で 24h JWT を WS upgrade URL に乗せないため、KV burn-on-consume で交換する |
| **Burn-on-consume** | 一度使ったら即削除する KV パターン。snap-share では WS_TICKETS で採用 |
| **Fail-open** | 検証 binding (RL / blocklist KV / Turnstile bypass フラグ) がエラーや未設定のとき、リクエストを通す方針。可用性 > 厳格性のトレードオフ |
| **Fail-closed** | 上の逆。CORS allowlist が空のとき例外を throw する仕様はこれ。誤設定を沈黙させない |
| **Auto-next-A / Auto-next-B** | UX フロー名。矢印確定 → 終端で text 編集を自動起動 (A)、矩形確定 → 既定矢印 preview を pending 表示 (B) |

## ハマりポイント集

実際にこのリポジトリで踏まれた / 踏まれそうな罠を一覧化する。各項目は **「症状 → 原因 → 対策」** の三段構成。

### Konva 周り

#### `KonvaImage` で annotation tool が反応しない

- **症状**: rectangle / arrow tool で画像の上を drag しても矩形が描けない
- **原因**: `KonvaImage` のデフォルト `listening=true` で画像が pointer event を吸収。`e.target !== stage` 判定で drag tool が早期 return
- **対策**: `<Layer listening={false}><KonvaImage listening={false} /></Layer>` の二重指定 (`apps/web/src/components/canvas/ImageLayer.tsx`)
- 詳細: [06-realtime-and-konva §2](./06-realtime-and-konva.md)

#### `stage.toDataURL` で SecurityError

- **症状**: PNG export ボタンを押すと例外
- **原因**: 別 origin から画像をロードしているのに `<img crossorigin>` が付いていない → canvas が taint
- **対策**: `useImage(src, 'anonymous')` で CORS-enabled fetch、サーバ側 CORS を allow

#### drag tool の draft が `mouseup` で見えない

- **症状**: drag した時に preview が出るが、`mouseup` の瞬間に annotation として確定されない
- **原因**: `useState` 経由で draft を持つと `mouseup` ハンドラのクロージャに reconcile 前の古い値が捕まる
- **対策**: `dragStartRef` / `draftRef` を `useRef` で持ち、再レンダー目的で state にもミラーする (`apps/web/src/components/canvas/CanvasStage.tsx`)
- 詳細: [06-realtime-and-konva §3](./06-realtime-and-konva.md)

#### `colors.ts` と `tokens.css` の色がズレる

- **症状**: UI 側 (Tailwind 色トークン) と Konva 側で同じ「青」が違う色に見える
- **原因**: Konva は Canvas 2D を使うため CSS 変数 (`var(--color-...)`) を解釈できない。色は両方手動同期
- **対策**: `apps/web/src/components/canvas/colors.ts` の hex リテラルと `apps/web/src/styles/tokens.css` の oklch 値を **必ずセットで更新**。色を増やすときの変更単位は両ファイル

### Yjs / 同期周り

#### Cmd+Z で他人の編集が消える

- **症状**: 共同編集中、自分の Cmd+Z で peer の操作まで undo される
- **原因**: `Y.UndoManager` の `trackedOrigins` を設定していない / origin が一致していない
- **対策**: `trackedOrigins: new Set([LOCAL_ORIGIN])` を必ず設定し、すべての mutation が **同じ symbol identity** の `LOCAL_ORIGIN` で `doc.transact` する
- 詳細: [06-realtime-and-konva §5](./06-realtime-and-konva.md)

#### 連続操作が 1 step に merge されすぎる / 分かれすぎる

- **症状**: 矩形描画 + 矢印描画が Cmd+Z 1 回で両方消える、またはテキスト連打中に文字単位で undo step が増える
- **原因**: `Y.UndoManager` の `captureTimeout` (snap-share は 500ms) と、明示 break point (`store.stopUndoCapture()`) の制御不足
- **対策**: 連続したい操作は 500ms 以内に発火、独立 step にしたい操作は `stopUndoCapture()` を呼ぶ。Auto-next-A の矢印 → text の境界で実装済 (`apps/web/src/components/canvas/CanvasStage.tsx` `handleMouseUp`)

#### Y.Doc が二重初期化される

- **症状**: room 切替時に古い Y.Doc / WebsocketProvider がリーク、メモリ増加
- **原因**: `useEffect` 内で `new Y.Doc()` するが cleanup で `doc.destroy()` / `provider.destroy()` を呼んでいない
- **対策**: `createYjsAnnotationsContext` の `destroy()` を unmount 時に呼ぶ。`<RoomEditor key={roomId} />` で key を渡しているので room 切替で完全 unmount → cleanup される

#### `arrow` の peer 同期で coords が壊れる

- **症状**: 別 peer に矢印を sync すると `from` / `to` が undefined
- **原因**: `Y.Map` の中に `Y.Map` を nest して同期した場合、片側だけ flat 化されている
- **対策**: arrow の coords は `fromX / fromY / toX / toY` に flat 化して保存。`yjs-codec.ts` の規約を守る
- 詳細: [06-realtime-and-konva §6](./06-realtime-and-konva.md)

### Cloudflare / Bindings 周り

#### WS upgrade で 401 (ticket 関連)

- **症状**: protected room の WS が `Invalid ticket` で開かない
- **原因**: 多くは:
  - `requestWsTicket` を叩く前に WS を open している (順序不正)
  - 同じ ticket を二回 consume しようとしている (burn-on-consume なので二回目は失敗)
  - 60 秒以上経過している
- **対策**: 「JWT 取得 → ws-ticket 発行 → 即 WS open」を 1 連の同期処理として実装 (`useYjsAnnotationsStore` 参照)。再接続時は ticket を取り直す

#### `IMAGE_BLOCKLIST` がブロックリストとして機能していない

- **症状**: ブロックしたはずの画像が通る
- **原因**: KV namespace ID が wrangler.toml に貼られていない / preview namespace と本番 namespace が別 / 画像 SHA-256 hex の casing 不一致 (key は lowercase 必須)
- **対策**: `wrangler kv namespace create` の戻り値を `wrangler.toml` の `[[kv_namespaces]]` に貼る、provision 後に dashboard で list 確認 ([docs/observability.md](../observability.md))。**fail-open 設計なので「沈黙して全画像が通る」状態**になる、CI / dashboard で必ず確認する

#### `RL_*` rate limit が dev で効きすぎる / 効かない

- **症状**: dev で 5 ルーム作成しただけで 429、もしくは本番で全く効かない
- **原因**: `BYPASS_RATE_LIMIT` フラグが本番で `"true"` のまま、または dev `.dev.vars` に未設定
- **対策**: 本番は必ず `BYPASS_RATE_LIMIT="false"` (or 未設定)。dev は `.dev.vars` で `"true"` に上書き。Phase 7.6 で挙動統一済 (yjs.ts の `/sync` も同フラグを尊重)

#### `.dev.vars` の上書きで本番設定が消える

- **症状**: ローカル dev で `CORS_ALLOWED_ORIGINS=http://localhost:5173` だけ書いたら、本番 origin (`https://snap-share.pages.dev`) も上書きされ preview / 本番 hit が CORS で死ぬ
- **原因**: `.dev.vars` は `wrangler.toml` の `[vars]` を **マージではなく完全置換** する
- **対策**: `.dev.vars` には本番含めて全 origin を再列挙する。`.dev.vars.example` を更新する場合は前提として記載

#### Hibernation wake で `setAlarm` が二重発火

- **症状**: 同じ TTL alarm が複数回発火、削除処理がエラー混入
- **原因**: `onStart()` が wake のたびに呼ばれるが、setAlarm を無条件に実行している
- **対策**: `getAlarm() === null` チェックを必ず入れる (`apps/api/src/yjs.ts` の `SnapShareYDO.onStart` で実装済)
- 詳細: [06-realtime-and-konva §8 / §9](./06-realtime-and-konva.md)

### React / hook 周り

#### room 切替で hook order error

- **症状**: `/r/abc` → `/r/xyz` の遷移で React が "rendered fewer hooks" 警告
- **原因**: 同じ `RoomEditor` インスタンスを使い回すと、内部 hook の登録順が異なる場合に React が破綻判定
- **対策**: `<RoomEditor key={roomId} />` で key を渡し、room 切替で完全 unmount/remount させる (`apps/web/src/pages/EditorPage.tsx`)

#### `pendingAutoArrow` の preview がズレる

- **症状**: Auto-next-B の自動矢印 preview が rectangle 確定の瞬間 1 frame ずれた位置に出る
- **原因**: `pendingAutoArrow` を state だけ / ref だけで管理すると、立て直し / クリアの順序がレンダーと噛み合わない
- **対策**: `EditorShell` で **state + ref の両建て** にし、setter wrapper で常に同期させる

#### TextEditorOverlay の位置が stage transform と合わない

- **症状**: zoom/pan した状態で text 編集すると overlay が画像と別の場所に出る
- **原因**: overlay の screen 座標を `stageRef.getAbsolutePosition()` で計算してしまうと scale を二重適用する
- **対策**: `stageContainerRef.getBoundingClientRect()` を基準に screen 座標を組み立て、stage transform (scale + offset) は logical → screen の変換で 1 度だけ適用する

### i18n 周り

#### `LangToggle` が画像未投入時に消える

- **症状**: landing 画面 (画像未投入) で言語切替ボタンが見えなくなる
- **原因**: `Toolbar` の中に LangToggle を置くと、画像なし時は Toolbar 自体が hide されるため
- **対策**: `EditorShell` の header (source 有無に依存しない領域) に独立配置する (Phase 10.H で修正済)

## Open Questions

執筆中に Context7 / 公式ドキュメント / リポジトリ内コメントで断定しきれなかった項目を集約する。理想は空になること。残った場合は「次回 docs improvement で潰す」または「現時点で運用上問題なし → そのまま残す」を判断する。

### 現時点では空

執筆時点 (2026-05-06、Phase 10.H 完了直後) では、リポジトリ内のコメント・PRD・spike report が十分詳細だったため、**断定で書けない項目はゼロ** で完了した。

将来追加され得るカテゴリ:
- `y-durableobjects` v1.0.5 内部実装の細部 (Hibernation handler の具体)
- Cloudflare RL binding のスケール挙動 (グローバル分散 vs リージョン局所)
- DO の `idFromName` ハッシュ衝突確率の Cloudflare 公式数値

これらは現状の実装を読み解く上では不要なので、必要が出たタイミング (例: Phase 11 でスケール検証を行うとき) で個別に Context7 + 公式に当たって追記する。

## 次に読むファイル

- 環境変数 / デプロイ手順 → [09-environment-and-deploy](./09-environment-and-deploy.md)
- 起点に戻る → [INDEX](./INDEX.md)
