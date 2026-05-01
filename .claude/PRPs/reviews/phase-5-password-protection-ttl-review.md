# コードレビュー: Phase 5 — パスワード保護 + DO Alarms TTL

**レビュー実施日**: 2026-05-01
**ブランチ**: `feat/phase-5-password-ttl` → `main` (PR 未作成、ローカル diff レビュー)
**コミット**: `80bb167` backend / `f686909` frontend / `88a86cf` docs / `ee9fec5` HIGH-1 fix
**差分**: 39 files, +3437 / -79
**判定**: **REQUEST CHANGES** → **APPROVE** (HIGH-1 は本レビュー実施中に修正適用済み。残り MEDIUM 3 件 / LOW 4 件はマージブロックではない)

## サマリ

Phase 5 の実装は構造として健全で、テストも厚い (247 件→248 件 pass、Phase 5 で +75)。PBKDF2 ハッシュ・HS256 JWT・DO Alarm による TTL クリーンアップ・`RoomEditor` の 4-state machine はいずれも plan に沿って実装され、constant-time 比較・`super.onStart()` 先行 await・alarm の冪等化など、慎重なパターンが採用されている。plan からの逸脱 3 点はいずれも妥当な技術判断。

レビュー時点でブロッカーは **HIGH-1** (Phase 2 から継承された `Cache-Control: public, max-age=3600` が保護ルームの画像配信時にも効いてしまい、PRD の脅威モデル「URL を Teams で雑に貼っても画像内容は守られる」と矛盾する) のみだった。Auto mode で 1 行修正 + 回帰テストを `ee9fec5` で適用済み。

その他の所見は品質改善であり、セキュリティや正しさをブロックするものではない。

---

## 所見

### CRITICAL

なし。

### HIGH

#### HIGH-1: 保護ルームの画像が `Cache-Control: public, max-age=3600` で配信される 【修正済み】

- **位置**: `apps/api/src/routes/images.ts:90-91` (R2 メタデータからレスポンスヘッダを構築する箇所)
- **根本原因**: `apps/api/src/storage/r2-image-storage.ts:22` が PUT 時に `httpMetadata: { contentType, cacheControl: 'public, max-age=3600' }` を設定。Phase 2 で未保護ルーム向けに導入されたものが、`obj.writeHttpMetadata(headers)` を介して Phase 5 の Bearer 認証付きレスポンスにもそのまま伝播していた。
- **影響**: ブラウザのプライベートキャッシュ (および RFC 非準拠の中間キャッシュ) が保護画像を最大 1 時間保持し、同一マシンで Authorization なしの後続リクエストにキャッシュから返してしまう。共有 PC やキャッシュリーク経由で第三者にも漏洩しうる。
- **PRD 契約違反**: 「URL を Teams で雑に貼っても画像内容は守られる」 — URL を知っているだけで (パスワードなしで) 1 時間以内ならキャッシュから画像を取得できる状態だった。
- **重大度**: HIGH。CRITICAL ではない理由は (1) 悪用可能なウィンドウが 1 時間で限定的、(2) Cloudflare Workers の `fetch()` レスポンスはデフォルトでエッジキャッシュされない、ため。現実的にはブラウザレベルのキャッシュリークが主リスク。
- **適用済み修正** (`ee9fec5`、`apps/api/src/routes/images.ts:91` 直後):
  ```ts
  if (meta.auth) {
    headers.set('cache-control', 'private, no-store');
  }
  ```
  保護ルームのみ上書き。未保護ルームは共有リンク用途のため `public, max-age=3600` を維持。
- **回帰テスト** (`ee9fec5`、`apps/api/src/__tests__/images.test.ts`):
  ```ts
  it('overrides Cache-Control to private/no-store for protected rooms', async () => {
    // ... バリデートトークンで GET → cache-control に no-store 含む / public 含まない
  });
  ```

### MEDIUM

#### MEDIUM-1: 認証前に WebSocket が接続を試行する (保護ルーム)

- **位置**: `apps/web/src/pages/RoomEditor.tsx:103` (`useYjsAnnotationsStore(roomId, undefined, token)` がレンダー中に無条件実行される)
- **挙動**: `imageState === 'gate'` のとき RoomEditor は早期に `<RoomGate />` を return するが、`useYjsAnnotationsStore` フックは既に `token=null` で実行済みで、`WebsocketProvider` が `?token=` 無しのまま `/sync/:id` に接続を試みる。サーバ middleware (`yjs.ts:90-92`) が 401 を返し、y-websocket は exponential backoff で再接続を繰り返す (token state が更新されるまで)。
- **影響**: ユーザーがパスワードを入力中も背後で 401 が連続発生し、ネットワークログ/サーバログにノイズが乗る。正しさやセキュリティへの影響なし。
- **修正案**: `<RoomEditorAuthenticated roomId token>` を子コンポーネントとして切り出し、`imageState === 'ready'` のときだけ Yjs ストアをマウントする:
  ```tsx
  if (imageState.kind === 'ready') {
    return <RoomEditorAuthenticated roomId={roomId} token={token} url={imageState.url} />;
  }
  ```
- **重大度**: MEDIUM。Phase 7 (公開準備) でレート制限と Turnstile が入る際にあわせて整理すれば良い。

#### MEDIUM-2: `base64UrlDecode` が非アルファベット文字を黙って受理する

- **位置**: `apps/api/src/lib/password.ts:88-128`
- **挙動**: `REVERSE[未知文字]` は `undefined`、それを `undefined!` で non-null アサーション → 後続のビット演算で `undefined << 2` → `NaN` → 0 に強制変換。関数は throw せず、ガベージで埋まった `Uint8Array` を返す。
- **影響**: `password-service.verify` 経路では `constantTimeEqual` が false を返すので fail-closed で安全。ただし、防御的プログラミングとしてはストレージ破損が「沈黙したガベージ」ではなく明示的なエラーとして surface するべき。
- **修正案**: アルファベット検証を入れて throw する:
  ```ts
  const v0 = REVERSE[str[i++]!];
  if (v0 === undefined) throw new Error('Invalid base64url character');
  ```
- **重大度**: MEDIUM。本番入力は全て `base64UrlEncode` 経由で、ラウンドトリップが安全なため、現時点で能動的な悪用経路は無い (攻撃者が R2 メタを書き換えられる前提が必要、それ自体が別問題)。

#### MEDIUM-3: `ErrorResponseSchema` が `routes/rooms.ts` と `routes/images.ts` で重複定義

- **位置**: `apps/api/src/routes/rooms.ts:12-25` と `apps/api/src/routes/images.ts:11-24` (同一の Zod enum)
- **挙動**: Phase 5 で `'UNAUTHORIZED'` を両ファイルに手動で追加した。今後 `lib/error.ts` の `ErrorCode` union に新しいコードを追加するとき、両方の Zod enum を同期する必要があり、ドリフト (片方だけ更新) のリスクがある。
- **修正案**: `apps/api/src/lib/error.ts` に集約して両 route で import:
  ```ts
  // lib/error.ts
  export const ErrorResponseSchema = z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['INVALID_REQUEST', 'UNSUPPORTED_MEDIA_TYPE', 'PAYLOAD_TOO_LARGE',
                    'NOT_FOUND', 'UNAUTHORIZED', 'INTERNAL']),
      message: z.string(),
    }),
  });
  ```
- **重大度**: MEDIUM (保守性)。現時点で実害なし。

### LOW

#### LOW-1: LocalEditor の `passwordId` が活用されていない

- **位置**: `apps/web/src/pages/LocalEditor.tsx:34` で `const passwordId = useId();` を宣言
- **問題**: `id={passwordId}` で input には付くが、対応する `<label htmlFor={passwordId}>` が無い。代わりに `aria-label="ルームのパスワード"` でフォールバック。`passwordId` を削除するか、可視ラベルを追加するか、どちらかに揃えるべき。

#### LOW-2: RoomEditor の `ImageState.ready.ownsObjectUrl` が読まれていない

- **位置**: `apps/web/src/pages/RoomEditor.tsx:25` の `ImageState.ready` が `ownsObjectUrl: boolean` を持つが、cleanup は別の local 変数 `createdObjectUrl` (line 49) を使っている。
- **問題**: state フィールドが書かれるだけで読まれない。state を cleanup に使うか、フィールドを削除するか、どちらかに統一すべき。

#### LOW-3: `authRoute` がリクエスト毎に 3 つのサービスを再構築

- **位置**: `apps/api/src/routes/rooms.ts:175-177`
- **問題**: `buildRoomService` / `buildPasswordService` / `buildTokenService` が認証リクエスト毎に再生成される。各々のコストは小さいが、Cloudflare Worker のコールドスタート + リクエスト毎のアロケーションを抑えるなら `c.set('services', ...)` ミドルウェアでまとめるとクリーン。プロファイリングで圧迫が見えれば Phase 7 で再検討。

#### LOW-4: `buildSyncUrl` の `token` 引数がデッドコード

- **位置**: `apps/web/src/lib/yjs-config.ts:25-35` で `buildSyncUrl(roomId, base, token)` の token 第3引数を公開しているが、`useYjsAnnotationsStore` は `WebsocketProvider` の `params: { token }` オプション経由に切替済み (実装レポートの逸脱 #1)。production 呼び出し側で token を渡す箇所が無い。
- **問題**: `token` 引数とそれに対応するテスト 3 件が production からは到達不可能。削除するか、`useYjsAnnotationsStore` 側で `buildSyncUrl` を使う形に統一するか、どちらかに揃えるべき。将来読み手が混乱する。

---

## バリデーション結果

| チェック | 結果 | 備考 |
|---|---|---|
| 型チェック (`pnpm turbo run typecheck`) | ✅ Pass | 4 workspace、tsc --noEmit でエラーゼロ |
| Lint (`pnpm lint` / `biome ci .`) | ✅ Pass | エラーゼロ |
| テスト (`pnpm test`) | ✅ Pass | 248/248 (api 94 / web 140 / shared 14) |
| ビルド (`pnpm build`) | ✅ Pass | vite 702 KB / gzip 214 KB、wrangler dry-run で `env.Y_ROOM (SnapShareYDO)` 認識 |

すべてキャッシュ green、Phase 5 によるテスト/lint regression 無し。

---

## レビューしたファイル (主要箇所)

| ファイル | 種別 | 備考 |
|---|---|---|
| `apps/api/src/lib/password.ts` | 新規 | PBKDF2 + base64url。constant-time 比較がバッファ全体を bit-XOR で集約していて正しい。**MED-2** が base64UrlDecode の入力検証 |
| `apps/api/src/lib/token.ts` | 新規 | HS256 JWT ラッパ。hono の `verify` は signature → exp の順で検証するため、`expired` reason が signature 情報を漏らす経路は無い (タイミング oracle なし)。Bearer 抽出の正規表現も妥当 |
| `apps/api/src/services/password-service.ts` | 新規 | factory パターンが綺麗。未知 algo の forward-compat 対応あり。verify 経路は `base64UrlDecode` の例外を try/catch で吸収 (MED-2 を throw 化したときに有効) |
| `apps/api/src/services/token-service.ts` | 新規 | クロージャラッパ。secret を closure に閉じる |
| `apps/api/src/services/room-service.ts` | 変更 | 画像 PUT 前にパスワードをハッシュ化 — orphan 防止ロールバックの順序として正しい。`protected: !!auth` フラグだけがログに乗る (hash / salt は絶対に乗らない) |
| `apps/api/src/routes/rooms.ts` | 変更 | auth route は誤パスワードを全て同一の 401 メッセージで返す (メッセージ文言経由の oracle 無し)。未保護ルームへの 400 / 不存在の 404 は意図的に区別 (plan Decisions Log 記載) |
| `apps/api/src/routes/images.ts` | 変更 | **HIGH-1 修正済み**。nosniff + SVG の content-disposition は Phase 2 から維持、Bearer ゲートは fail-closed |
| `apps/api/src/yjs.ts` | 変更 | `SnapShareYDO.onStart` が `super.onStart()` を先頭で await。`getAlarm()` の冪等化が正しい。`alarm()` の順序 (R2 image → R2 meta → DO storage wipe) は部分失敗にも耐える。WS query token middleware は token を絶対にログに乗せない |
| `apps/api/src/storage/r2-meta-storage.ts` | 変更 | `deleteMeta` が `deleteImage` の non-fatal パターンと整合 |
| `apps/api/wrangler.toml` | 変更 | migration v2 `renamed_classes` の構文正確、secret コメントも実情を反映 |
| `apps/web/src/lib/api-client.ts` | 変更 | tagged union の `AuthResult` が良い API。`fetchProtectedImage` のドキュメントが `URL.revokeObjectURL` 責務を明示 |
| `apps/web/src/lib/auth-storage.ts` | 新規 | try/catch が網羅的 (storage-disabled / quota-full をすべて吸収)。localStorage ではなく sessionStorage を選んだのも脅威モデルに合致 |
| `apps/web/src/lib/yjs-config.ts` | 変更 | **LOW-4**: `buildSyncUrl` の token 引数がデッドコード |
| `apps/web/src/pages/RoomEditor.tsx` | 変更 | 4-state machine が正しい。`cancelled` フラグ + cleanup 時の `revokeObjectURL` でレース条件を回避。**MED-1** が WS 早期接続、**LOW-2** が `ownsObjectUrl` 未使用 |
| `apps/web/src/pages/LocalEditor.tsx` | 変更 | 空 password で送信ブロック — silent な未保護アップロード防止に寄与。**LOW-1** が `passwordId` |
| `apps/web/src/components/room-gate/RoomGate.tsx` | 新規 | a11y がしっかり (aria-invalid / aria-describedby / role=alert)。submitting フラグを成功時に意図的に未クリアにし、親の unmount で破棄する設計 |

### テスト

新規 75 件 (HIGH-1 regression 含む)、248/248 pass。

| テストファイル | 件数 | カバレッジ |
|---|---|---|
| `apps/api/src/lib/__tests__/password.test.ts` | 14 | iteration 数を regression-guard、0/1/2/3/16/32 byte の境界網羅 |
| `apps/api/src/lib/__tests__/token.test.ts` | 7 | expiry / sub_mismatch / signature mismatch をすべて assert。`now: () => 0` で時刻注入 |
| `apps/api/src/services/__tests__/password-service.test.ts` | 9 | 空 + 257 文字超 reject、未知 algo の forward-compat、corrupt salt の graceful false |
| `apps/api/src/__tests__/{rooms,images,yjs}.test.ts` | +22 | REST + WS の 3 surface すべてで 保護/未保護の分岐を網羅。HIGH-1 regression 1 件含む |
| `apps/web/src/lib/__tests__/auth-storage.test.ts` | 8 | throwing-Storage stub で耐性を assert |
| `apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx` | 5 | react-dom/client + happy-dom + fetch stub で submit フローを再現 (testing-library 依存無し) |

---

## 推奨事項

### マージブロック修正

1. **HIGH-1**: 修正済み (`ee9fec5`)。

### 強く推奨 (次セッション)

2. **MED-1**: `useYjsAnnotationsStore` を `imageState === 'ready'` のときだけマウントする RoomEditor のリファクタリング。401 ノイズの削減
3. **MED-2**: `base64UrlDecode` でアルファベット検証 + 不正入力で throw に変更
4. **MED-3**: `ErrorResponseSchema` を `lib/error.ts` に集約し、両 route で import

### 任意のクリーンアップ

5. **LOW-1/2/3/4**: 上記の通り。マージブロックではない

### 手動検証 (実装レポート記載済、未実施)

- [ ] `ROOM_TTL_MS=10000` での DO Alarm cleanup smoke test
- [ ] 保護ルームでの 2 タブ E2E (認証 + 同期動作)

---

## 判定の理由

レビュー実施時点では HIGH-1 (PRD 脅威モデルとの矛盾、1 行修正可能) があったため **REQUEST CHANGES** だったが、Auto mode の方針に従い fix + regression test を `ee9fec5` で適用済み。残る MED 所見は品質改善であり、Phase 5 のマージは可能。後続 PR で順次解消する想定。

最終判定: **APPROVE** (HIGH-1 修正反映後)。
