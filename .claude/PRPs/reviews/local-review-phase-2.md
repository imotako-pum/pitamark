# Local Review: Phase 2 — 画像アップロード基盤

**Reviewed**: 2026-04-30
**Branch**: `feat/phase-2-image-upload` (uncommitted)
**Reviewers**: typescript-reviewer / security-reviewer / silent-failure-hunter (parallel)
**Decision**: **REQUEST_CHANGES**

## Summary

Phase 2 実装は機能としては完成しテストも all green だが、3 軸のレビューで CRITICAL 1 件・HIGH 8 件・MEDIUM 7 件を検出。特に (1) **`pnpm biome ci .` が format/lint で FAIL** していること（CI ブロッカー、turbo run lint は workspace に lint script が無いため no-op で素通りしていた）、(2) **`Number(env.ROOM_TTL_MS)` が NaN になる silent bug**、(3) **image put 成功 → meta put 失敗で orphan が残る**、(4) **SVG XSS / nosniff 欠如 / R2 key 露出のセキュリティ穴** が即座に対処すべき項目。

## Findings (consolidated)

### CRITICAL

| ID | File:Line | Issue | Source |
|---|---|---|---|
| C-1 | `apps/api/src/services/room-service.ts:56-64` | image put 成功 → meta put 失敗時にロールバック無し（orphan 画像が残存） | silent-failure |

### HIGH

| ID | File:Line | Issue | Source |
|---|---|---|---|
| H-1 | `apps/api/src/routes/rooms.ts:21` | `Number(env.ROOM_TTL_MS)` が NaN になる silent bug（→ JSON で null 化） | TS / silent |
| H-2 | `apps/api/src/storage/r2-meta-storage.ts:19-20` | `RoomSchema.parse` が ZodError を生のまま throw、上流で id コンテキスト無し | TS / silent |
| H-3 | `packages/shared/src/__tests__/room.test.ts` | Biome `ci` で format error → CI ブロッカー | TS |
| H-4 | `apps/api/src/lib/logger.ts:5-9` | `biome-ignore` suppression が無効、`noConsole` warning 3 件残存 | TS |
| H-Sec-1 | `apps/api/src/routes/images.ts:24` | SVG XSS — `Content-Disposition: attachment` 未設定で `<script>` 実行リスク | security (OWASP A03) |
| H-Sec-3 | `apps/api/src/routes/images.ts:21-24` | `X-Content-Type-Options: nosniff` ヘッダ未設定 | security (OWASP A05) |
| H-Sec-4 | `apps/api/src/lib/error.ts:33,37` + `routes/images.ts:16,19` | AppError message に R2 key/ID を埋め込み → クライアント露出 | security (OWASP A09) |
| H-Sec-3-Silent | `apps/api/src/storage/r2-image-storage.ts:11-14` | `bucket.put` 失敗時に key/contentType がログに残らない | silent-failure |

### MEDIUM

| ID | File:Line | Issue |
|---|---|---|
| M-Sec-1 | `apps/api/src/routes/rooms.ts:14`, `routes/images.ts:9` | `id: z.string().min(1)` のみ → NanoID パターン `[A-Za-z0-9_-]{21}` で強制すべき |
| M-Sec-2 | `apps/api/src/lib/error.ts:33` | `onAppNotFound` でリクエストパスを verbatim 返却 → ログ injection / 大レスポンス DoS |
| M-Sec-3 | `apps/api/src/index.ts` | CORS 設定なし（Phase 6 のフロント連携前に最低限の許可リスト要） |
| M-Silent-1 | `apps/api/src/routes/rooms.ts:28-33` | `zValidator` hook で `result.error.issues` がログに残らない |
| M-Silent-2 | `apps/api/src/routes/images.ts:16-19` | meta あり・image なしの orphan 状態が通常 404 と区別されない |
| M-Silent-3 | `apps/api/src/lib/error.ts:39` | `err.stack` が明示記録されない（Workers ランタイムのシリアライズ依存） |
| M-TS-1 | `apps/api/src/__tests__/helpers/in-memory-r2.ts:48,52,108` | `as unknown as R2*` 多用（テスト限定の妥協、コメント追加で許容） |

### LOW

| ID | File:Line | Issue |
|---|---|---|
| L-1 | `packages/shared/src/room.ts:36` | `isExpired` 境界 `>` vs `>=`（テストで意図確認済、コメント推奨） |
| L-2 | `apps/api/src/lib/bindings.ts:3` | `ROOM_TTL_MS` 型コメント無し |
| L-3 | `apps/api/src/storage/r2-image-storage.ts:13` | `cacheControl: max-age=3600` が TTL 7d より短い（Phase 5 で再調整） |
| L-4 | `packages/shared/src/room.ts:26` | `RoomSchema.id` も NanoID パターンで二重検証可能 |
| L-5 | `apps/api/src/index.ts:9` | `/health` の `ts: Date.now()` 公開（タイミング攻撃補助情報） |
| L-6 | `apps/api/src/lib/logger.ts:7-9` | `meta ?? {}` で空 `{}` がログに常時出現 |
| L-7 | `apps/api/src/services/room-service.ts:43` | `createRoomService` factory に明示返り値型なし |

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type Check (`turbo typecheck`) | ✅ Pass | shared / api / web 全 0 errors |
| **Lint (`pnpm biome ci .`)** | ❌ **Fail** | 1 format error + 4 noConsole warnings — **`pnpm turbo run lint` が no-op だったため見逃し** |
| Tests (`turbo test`) | ✅ Pass | 49 件 GREEN（shared 19 / api 28 / web 2） |
| Build (`turbo build`) | ✅ Pass | wrangler dry-run 成功、bindings 認識 |
| Integration (Playwright) | ✅ Pass | 1 件 |

## Decision Rationale

**REQUEST_CHANGES**:
- CI ブロッカーが 1 件 (H-3 Biome format)
- 機能バグが 1 件 (H-1 NaN silent → TTL が壊れる)
- データ整合性リスクが 1 件 (C-1 orphan)
- セキュリティ HIGH が 4 件（うち SVG XSS と nosniff は 1-2 行で修正可能）

修正後の再 review が必要。LOW は今回見送り可。

## Required Fixes (in implementation order)

1. **Biome format / suppression** (H-3, H-4) → CI green の前提
2. **Shared NanoID 正規表現定数を export** + ID 検証強化 (M-Sec-1) → 後続修正の基盤
3. **`logger` 改善**: meta なしのとき空 `{}` 出力回避 + suppression を ファイル先頭 `biome-ignore-all` に変更 (L-6, H-4)
4. **`error.ts`**: 外向けメッセージ固定化 + `c.req.path` truncate + stack 明示 (H-Sec-4, M-Sec-2, M-Silent-3)
5. **`r2-meta-storage.ts`**: `RoomSchema.parse` を try/catch で wrap し AppError 化 (H-2)
6. **`r2-image-storage.ts`**: put/get の try/catch で key コンテキスト付与 (H-Sec-3-Silent)
7. **`room-service.ts`**: TTL NaN guard、image→meta の rollback (H-1, C-1)
8. **`routes/rooms.ts`**: zValidator hook でログ + id を NanoID パターンに (M-Silent-1, M-Sec-1)
9. **`routes/images.ts`**: nosniff ヘッダ + SVG Content-Disposition + orphan ログ + id NanoID (H-Sec-1, H-Sec-3, M-Silent-2, M-Sec-1)
10. **テスト追加**: rollback / NaN guard / id pattern / SVG Content-Disposition / nosniff のカバー

## Files Reviewed

ソース 17 ファイル + 設定 5 ファイル + ドキュメント 4 ファイル = 計 26 ファイル。
すべての issue は本セッション内で修正可能（外部 PR / 他 phase 跨ぎ無し）。

---

## Re-review Round 2 — 2026-04-30

### 修正完了状況

前回 review の **CRITICAL 1 + HIGH 8 + MEDIUM 7** すべてに対応:

| 元 ID | 対応 |
|---|---|
| C-1 (orphan rollback) | `room-service.ts` で `try { putMeta } catch { deleteImage; rollbackOk?logger.error:warn; throw }` 実装、テスト 2 件追加 |
| H-1 (NaN silent) | `assertValidTtlMs` で `Number.isFinite && Number.isInteger && >0` を強制、テスト 2 件追加 |
| H-2 (ZodError コンテキスト) | `r2-meta-storage.ts` で `safeParse` + AppError 化 + `id` ログ |
| H-3 (Biome format) | `biome format --write .` で解消、CI で `pnpm lint` ステップを別建てに分離 (`.github/workflows/ci.yml`) — 「`turbo run lint` は no-op」問題の根治 |
| H-4 (suppression) | `biome-ignore-all` でファイルレベル suppression に変更 |
| H-Sec-1 (SVG XSS) | `images.ts` で `Content-Disposition: attachment; filename="image.svg"` を SVG 限定で付与、テスト 1 件 |
| H-Sec-3 (nosniff) | 全画像レスポンスに `x-content-type-options: nosniff` 設定、テスト 1 件 |
| H-Sec-4 (情報漏えい) | `AppError(publicMessage, logContext)` の二層構造を確立、外向け固定文言、内部 ID/key/path/MIME は `logContext` のみ |
| H-Sec-3-Silent (R2 put error) | `r2-image-storage.ts` で try/catch + `logger.error({ key, contentType, err })` |
| M-Sec-1 (id 検証) | `ROOM_ID_REGEX = /^[A-Za-z0-9_-]{21}$/` を `packages/shared` に export、`RoomSchema.id` / `routes/rooms.ts` / `routes/images.ts` 全て regex 検証、テスト 3 件 |
| M-Sec-2 (path verbatim) | `error.ts:sanitizePath` で 0x00-0x1F + 0x7F 制御文字除去 + 80 char truncate (escape sequence で可読化) |
| M-Sec-3 (CORS) | Phase 6 まで保留（plan の NOT Building と同方針） |
| M-Silent-1 (zValidator log) | `rooms.ts` zValidator hook に `logger.warn('upload validation failed', { issues })` |
| M-Silent-2 (orphan log) | `images.ts` で meta あり・image なしを `logger.warn('image object missing for existing meta')` |
| M-Silent-3 (err.stack) | `onAppError` で `{ name, message, stack, path }` を明示 |

### Re-review Round 2 で新たに検出された指摘 (修正済)

| ID | Severity | Resolution |
|---|---|---|
| R2-H-1 | HIGH | `assertAllowedMime` の publicMessage `Unsupported content type: ${type}` がユーザー入力反射 → `'Unsupported media type'` 固定 + `{ receivedType: type }` を logContext に |
| R2-H-2 | HIGH | `PAYLOAD_TOO_LARGE` の publicMessage に内部定数 → `'File too large'` 固定 + `{ actualSize, maxBytes }` を logContext に |
| R2-M-1 | MEDIUM | rollback 失敗が `warn` のみ → `deleteImage` の戻り値で成否を返す API に変更、call site で失敗時 `logger.error('image rollback failed — orphan object remains')` で escalate |
| R2-L-1 | LOW | `bindings.ts` の `ROOM_TTL_MS: string` に JSDoc 追加 (parsing & validation 規約) |
| R2-L-2 | LOW | `sanitizePath` で escape sequence 表記に変更（reviewer の誤読防止）+ ellipsis off-by-one 修正 (`-1`) |

### Re-review で reviewer が誤検出していた箇所

- `error.ts:24` の regex は **元から正しく** `[\x00-\x1f\x7f]` の literal control bytes を含んでいた（`od -c` で確認）。Read tool が control bytes を空白として表示したため reviewer が `[ -]` と誤読した。可読性のため escape sequence に書き直し済み。

### 最終 Validation (Round 2 完了時点)

| Check | Result |
|---|---|
| `pnpm biome ci .` | ✅ Pass (0 errors, 0 warnings, 45 files) |
| `pnpm turbo run typecheck` | ✅ Pass (shared / api / web) |
| `pnpm turbo run test` | ✅ Pass — **57 件 GREEN** (shared 20 / api 35 / web 2) |
| `pnpm turbo run build` | ✅ Pass (wrangler dry-run 成功、bindings 認識) |
| `pnpm turbo run test:e2e` | ✅ Pass (Playwright 1 件) |

### Final Decision: **APPROVE**

CRITICAL / HIGH すべて解消、MEDIUM も主要項目対応、CI ブロッカー (Biome format + lint no-op) も根治。次フェーズ (`/prp-commit` → `/prp-pr`) に進む準備完了。
