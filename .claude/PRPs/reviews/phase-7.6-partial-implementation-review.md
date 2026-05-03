# Code Review: Phase 7.6 部分実装（既知-1 fix + E2E 拡充 + RL bypass）

**Reviewed**: 2026-05-03
**Branch**: `feat/phase-7.6-manual-qa-bug-recovery`
**Decision**: **APPROVE WITH MEDIUM/LOW COMMENTS** (CRITICAL / HIGH なし)

## Summary

Phase 7.6 plan のうち Claude 単独で完遂可能な領域（既知-1 fix 再投入 / unit + integration + E2E test 追加 / RL bypass の dev・E2E 経路新設 / E2E spec 4 ファイル新設 / 既知-4 の発見と CI 固定）を全て実装。typecheck / lint / unit test / build / E2E すべて緑。CRITICAL や HIGH の問題は無いが、**`BYPASS_RATE_LIMIT` の単体テスト未追加**（MEDIUM）と **`.dev.vars.example` への記載漏れ**（LOW）が改善余地。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

#### M1. `BYPASS_RATE_LIMIT` short-circuit に対する unit test が未追加
- **File**: `apps/api/src/middleware/__tests__/rate-limit.test.ts`
- **問題**: `apps/api/src/middleware/rate-limit.ts:30-37` に追加した `if (c.env.BYPASS_RATE_LIMIT === 'true') return next();` 分岐は E2E 経由でしか動作確認されていない。同 test ファイルには「binding undefined」「success」「block」「throw」の 4 ケースがあるが、bypass ケースが欠落。
- **影響**: 将来 middleware リファクタで bypass 分岐を誤って削除しても unit test が落ちない（E2E でやっと検出）。Phase 7.6 既知-4 と同じく「サイレントに本番 RL が無効化される」シナリオが起こり得る。
- **Suggested fix**:
  ```ts
  it('passes through when BYPASS_RATE_LIMIT="true" even if binding would block', async () => {
    const app = buildApp(createStubRateLimit({ alwaysBlock: true }));
    const env = { BYPASS_RATE_LIMIT: 'true' } as Bindings;
    const res = await app.request('/protected', undefined, env);
    expect(res.status).toBe(200);
  });

  it('does NOT bypass when BYPASS_RATE_LIMIT="false"', async () => {
    const app = buildApp(createStubRateLimit({ alwaysBlock: true }));
    const env = { BYPASS_RATE_LIMIT: 'false' } as Bindings;
    const res = await app.request('/protected', undefined, env);
    expect(res.status).toBe(429);
  });
  ```

### LOW

#### L1. `.dev.vars.example` に `BYPASS_RATE_LIMIT` の記載なし
- **File**: `apps/api/.dev.vars.example`
- **問題**: `BYPASS_TURNSTILE` は line 23-32 で説明 + デフォルト値ありで example に存在するが、`BYPASS_RATE_LIMIT` は記述なし。新規開発者 / fork ユーザーが local dev で RL 5/60 に当たる可能性。
- **Suggested fix**: `BYPASS_TURNSTILE` の直後に同様のブロックを追加:
  ```
  # When "true", all withRateLimit middleware short-circuits. Use only in
  # dev / E2E so the production limit (5/60s on POST /rooms) does not block
  # rapid local testing. Production MUST stay "false" / unset.
  BYPASS_RATE_LIMIT="true"
  ```

#### L2. `Bindings.BYPASS_RATE_LIMIT: string` は実態と乖離
- **File**: `apps/api/src/lib/bindings.ts:60-67`
- **問題**: 本番 wrangler.toml の `[vars]` には未設定なので runtime では `undefined`。型は `string` を約束しているため将来 `c.env.BYPASS_RATE_LIMIT.toLowerCase()` 等を書くと runtime crash。
- **影響**: 既存の `BYPASS_TURNSTILE` も同じパターン (`string` だが本番は `"false"` 明示) なので一貫性は保てている。ただし `BYPASS_RATE_LIMIT` は本番で *unset* を想定しているため、`string | undefined` がより誠実。
- **Suggested fix**: 型を `string | undefined` に変えて、middleware の `=== 'true'` 判定はそのまま機能する。または wrangler.toml `[vars]` に `BYPASS_RATE_LIMIT = "false"` を明示して unset を回避し、type は `string` のまま揃える（後者を推奨 — `BYPASS_TURNSTILE` と運用統一）。

#### L3. README の fork CORS 注意が ```sh コードブロック内に書かれている
- **File**: `README.md:204-214`
- **問題**: `**fork して...**` や `` `CORS_ALLOWED_ORIGINS` `` の markdown 装飾が code block 内では plain text として表示される。GitHub の README で読みづらい。
- **Suggested fix**: code block の外に `> **Note**: fork 時は ...` 形式の callout として移動する。または現状の場所のまま markdown 装飾を取り除く（純粋なシェル comment 風に整える）。

#### L4. `apps/web/e2e/annotation-tools.spec.ts` の `waitForTimeout(700)` マジックナンバー
- **File**: `apps/web/e2e/annotation-tools.spec.ts:146, 153`
- **問題**: Y.UndoManager の `captureTimeout: 500` を超えるための wait だが、500 という数字は `apps/web/src/hooks/yjs-annotations-context.ts:52` 側にハードコードされている。両者を独立に変更すると test が silently 壊れる。
- **影響**: low — captureTimeout を変えることはあまり無いが、将来のリスク。コメントで根拠は説明されているので現状でも理解は可能。
- **Suggested fix (optional)**: 共通定数に extract — `packages/shared` か web 内 constants ファイルに `YJS_UNDO_CAPTURE_TIMEOUT_MS = 500` を置いて両側で参照する。あるいは `expect.poll` で undo stack の長さを直接観察する E2E hook を新設。

#### L5. wrangler.toml に `BYPASS_RATE_LIMIT` の言及なし
- **File**: `apps/api/wrangler.toml`
- **問題**: 本番 deploy 時の `[vars]` セクションに `BYPASS_RATE_LIMIT = "false"` の明示が無い（unset で運用）。`BYPASS_TURNSTILE = "false"` は明示されているので一貫性が崩れている。
- **影響**: なし（middleware は `=== 'true'` で undefined を false 扱い）
- **Suggested fix**: `BYPASS_TURNSTILE` 直下に同様の defensive default を追加:
  ```toml
  # `BYPASS_RATE_LIMIT` MUST be `"false"` (or unset) in production. The flag
  # exists only so dev/CI E2E can run without hitting the 5/60s RL.
  BYPASS_RATE_LIMIT = "false"
  ```

#### L6. `dropzone-validation.spec.ts` の「既知-4 回帰固定」spec は将来書き換えが必須
- **File**: `apps/web/e2e/dropzone-validation.spec.ts:55-102`
- **問題**: 「バグが修正されたら本テストは失敗する」コメントで明記されているが、修正 PR と同時に test の書き換えも必須。修正者が忘れると CI が落ちて何が起きたか分かりづらい可能性。
- **影響**: low — コメントに修正方針 (a)/(b)/(c) が並んでいるので修正者が test を見ながら理解はできる。
- **Suggested fix (optional)**: spec を `test.describe('既知-4 — 修正されるまで現状挙動を固定する', ...)` のように describe レベルでも明示。または spec を `test.fail()` でマークすることで「失敗が期待値」を表現する選択肢もあるが、現状のコメント運用で十分。

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm typecheck`) | ✅ Pass (4 workspaces) |
| Lint (`pnpm lint` = `biome ci`) | ✅ Pass (157 files) |
| Tests (`pnpm test`) | ✅ Pass (api + web 全 unit) |
| Build (`pnpm build`) | ✅ Pass (vite build + wrangler --dry-run) |
| E2E (`pnpm exec playwright test`) | ✅ Pass (29 passed / 19 skipped) |

## Files Reviewed

### Modified (10)
- `.claude/PRPs/prds/snap-share.prd.md` — Phase 7.6 status pending → in-progress + plan link (1 行)
- `.github/workflows/ci.yml` — `BYPASS_RATE_LIMIT="true"` を E2E .dev.vars に追加 (1 行)
- `README.md` — fork 時の `CORS_ALLOWED_ORIGINS` 書き換え注意追記 (6 行) ⚠ L3
- `apps/api/.dev.vars` — `BYPASS_RATE_LIMIT="true"` 追加 (1 行)
- `apps/api/src/__tests__/helpers/build-env.ts` — テスト default に `BYPASS_RATE_LIMIT: 'false'` (4 行)
- `apps/api/src/__tests__/images.test.ts` — Phase 7.6 CORS describe block (74 行 / 4 spec)
- `apps/api/src/lib/bindings.ts` — `BYPASS_RATE_LIMIT: string` 型追加 (8 行) ⚠ L2
- `apps/api/src/middleware/rate-limit.ts` — `BYPASS_RATE_LIMIT === 'true'` で short-circuit (7 行) ⚠ M1
- `apps/web/e2e/global-setup.ts` — `BYPASS_RATE_LIMIT="true"` を auto-write に追加 (3 行)
- `apps/web/e2e/room-create.spec.ts` — sender 側 PNG export spec 追加 (39 行)
- `apps/web/src/components/canvas/ImageLayer.tsx` — `useImage(src, 'anonymous')` 再投入 (5 行)

### Added (5)
- `.claude/PRPs/plans/phase-7.6-manual-qa-bug-recovery.plan.md` — Phase 7.6 plan (773+ 行)
- `apps/web/e2e/annotation-tools.spec.ts` — 4 spec (167 行) ⚠ L4
- `apps/web/e2e/dropzone-validation.spec.ts` — 3 spec + 既知-4 documentation (104 行) ⚠ L6
- `apps/web/e2e/keyboard-shortcuts.spec.ts` — 4 spec (128 行)
- `apps/web/e2e/room-export-receiver.spec.ts` — 1 spec (78 行)
- `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` — anonymous 検証 unit test (63 行)

## Decision Rationale

- **CRITICAL なし** — 機密情報リーク / SQL injection / XSS / SSRF / 認証バイパスの新規導入なし
- **HIGH なし** — ロジックバグ / null 不安定 / race condition なし。既知-1 fix は commit `2e2d533` で一度書かれて revert されたコードの再投入で、API 側 CORS allowlist と整合
- **MEDIUM 1 件 (M1)** — middleware の bypass 分岐は unit テスト追加が望ましい。merge 前推奨だが blocker ではない（E2E でカバレッジあり）
- **LOW 6 件** — 整合性 / ドキュメント / マジックナンバー類

→ **Approve with comments**. M1 の unit test 追加を推奨する。L1-L6 はオプション（特に L1 / L5 は dev experience 改善）。
