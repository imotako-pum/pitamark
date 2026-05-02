# Implementation Report: Phase 7.5 — 本番プロビジョニング + 観測 + E2E 拡充

## Summary

Phase 7 で「コード上は公開可能」になった snap-share を Phase 8 dogfood に向けて段階的に整備した。本実装の責務は (B) 観測 / KPI 設計、(C) E2E 拡充、(D) Phase 7 review LOW の処遇確定、(E) PRD / README / CONTRIBUTING の追従。Track A（Cloudflare 本番リソースの provision / wrangler secret 投入 / Pages プロジェクト作成 / 実機 deploy）はオーナー権限の Cloudflare CLI / dashboard 操作が必要で、本セッションからは実行できないため **コード / ドキュメント面の準備のみ完了し、実機オペは次セッションで踏む** 形にした。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 6/10 | コード変更面は完了 / 実機オペ面は未着手 |
| Files Changed | 新規 6〜8 + 更新 5〜7 | 新規 9 / 更新 9 |
| LOC (コード) | 約 200〜400 行 | 約 240 行（spec 4 + helper / global-setup） |
| LOC (docs) | 約 200〜300 + 80 | 約 230（observability）+ 70（README/CONTRIBUTING） |

## Tasks Completed

| # | Track | Task | Status | Notes |
|---|---|---|---|---|
| A1 | A | R2 / KV / DO / RL provision | **未実施** | Cloudflare CLI 認証が必要。runbook を README / .dev.vars.example / wrangler.toml コメントに記述済み |
| A2 | A | wrangler.toml placeholder 差替え | **部分** | `REPLACE_WITH_PRODUCTION_KV_ID` は実機 ID 投入待ち。Phase 7.5 で runbook コメントを補強し、実機オペ手順を明確化 |
| A3 | A | Turnstile widget 作成 + secret 投入 | **未実施** | CF dashboard 操作が必要。手順は README に記載 |
| A4 | A | CF Web Analytics + .env.production | **未実施** | token 発行と Pages build env 投入はオーナー作業 |
| A5 | A | Pages プロジェクト + Git 連携 | **未実施** | dashboard 操作が必要。Build settings は README / Decisions Log に記載 |
| A6 | A | API `wrangler deploy` | **未実施** | A1〜A5 完了後に実行 |
| A7 | A | 自動 vs 手動デプロイ判断 | ✅ Complete | **手動 `wrangler deploy` + Pages Git 連携** で確定。PRD Decisions Log と README / CONTRIBUTING に反映 |
| B1 | B | observability.md KPI 表 | ✅ Complete | 7 KPI を測定方法 / 目標 / 悪化時に疑う原因とセットで記述 |
| B2 | B | SLO / エラーバジェット / 撤退ライン | ✅ Complete | 30 日 rolling SLO 3 項目、撤退ライン 3 項目を言語化 |
| B3 | B | wrangler tail クエリ集 | ✅ Complete | 9 種のクエリ + ログ structured meta 表 |
| B4 | B | CF Web Analytics ダッシュボード設計 | ✅ Complete | 標準 4 ビュー（PV / Referrers / Device / Country）に絞り、設定手順記載 |
| B5 | B | LOW-3 / LOW-4 follow-up 記録 | ✅ Complete | docs/observability.md `## Follow-ups` セクションに具体トリガーと対応案を記述 |
| C1 | C | playwright multi-process + mobile | ✅ Complete | webServer 配列化、mobile-chrome (Pixel 5) project 追加。readiness probe は既存 `/health` を流用 |
| C2 | C | /healthz 追加 | ✅ Plan 逸脱（不要） | 既存 `/health`（apps/api/src/index.ts:18）を readiness probe に流用。コード追加不要 |
| C3 | C | sample.png fixture | ✅ Complete | 1×1 透過 PNG (68 bytes) を base64 経由で生成 |
| C4 | C | room-create.spec.ts | ✅ Complete | 画像 drop → /r/:nanoid 遷移 → ツールバー enabled 確認 |
| C5 | C | room-share.spec.ts | ✅ Complete | 2 context 同期、`window.__SNAP_SHARE_ANNOTATIONS__` 経由で peer 反映 assert |
| C6 | C | room-protected.spec.ts | ✅ Complete | 誤答 → エラートースト、正答 → エディタ入室 |
| C7 | C | room-mobile.spec.ts | ✅ Complete | Pixel 5 viewport screenshot 回帰。Linux snapshot は follow-up に積み |
| C8 | C | window debug expose | ✅ Complete | `useYjsAnnotationsStore` に dev/test 限定の `window.__SNAP_SHARE_ANNOTATIONS__` 露出。production bundle に文字列残存無し |
| C9 | C | CI E2E 緑 | ✅ ローカル緑 / CI は次回 push で確認 | macOS で 16 passed / 6 skipped。Linux CI は room-mobile を skip し残り 14 ケースが緑になる想定 |
| D1 | D | index.html token sanitize | ✅ Complete | `[^A-Za-z0-9_-]` を replace で削る形に変更。LOW-2 解消 |
| D2 | D | LOW-3 / LOW-4 follow-up | ✅ Complete | B5 に内包 |
| E1 | E | PRD status 更新 | ✅ Complete | Phase 7.5 status `in-progress`、PRP plan リンク確定 |
| E2 | E | README / CONTRIBUTING 追従 | ✅ Complete | Production deploy 章を runbook 化、CONTRIBUTING に「本番デプロイ」セクション新設 |
| E3 | E | Decisions Log 追記 | ✅ Complete | 4 行追加（運用 / .env.production / E2E project / 観測手段） |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (`pnpm typecheck`) | ✅ Pass | 全 4 workspace 0 error |
| Lint (`pnpm lint`) | ✅ Pass | biome ci 緑（150 files） |
| Unit / Integration (`pnpm test`) | ✅ Pass | 既存件数維持（154 件 web, api / shared 既存） |
| Build (`pnpm build`) | ✅ Pass | wrangler --dry-run 緑 / vite build 緑。`__SNAP_SHARE_ANNOTATIONS__` 文字列が dist bundle に含まれないことを grep で確認 |
| E2E (ローカル `pnpm exec playwright test`) | ✅ Pass | 16 passed / 6 skipped (別 project の skip 化された spec) |
| E2E (CI Linux) | ⏳ 次回 push で確認 | room-mobile が skip される想定。残り 14 ケースが緑 |
| 本番手動 smoke | ⏳ Track A 完了後 | `curl /health` / D&D / 共有 / PNG export / RoomGate を README runbook 通りに |

## Files Changed

### Created (9)

| File | Lines | Purpose |
|---|---|---|
| `apps/web/e2e/fixtures/sample.png` | binary | 1×1 透過 PNG fixture (68 bytes) |
| `apps/web/e2e/fixtures/upload.ts` | 44 | drop ヘルパー（DataTransfer + locator.dispatchEvent） |
| `apps/web/e2e/global-setup.ts` | 27 | E2E 用 `.dev.vars` 自動生成（既存ファイルは上書きしない） |
| `apps/web/e2e/room-create.spec.ts` | 24 | 画像ドロップ → ルーム遷移 → エクスポート enabled |
| `apps/web/e2e/room-share.spec.ts` | 73 | 2 ブラウザコンテキストの Yjs 同期検証 |
| `apps/web/e2e/room-protected.spec.ts` | 53 | パスワード保護ルームの誤答 / 正答経路 |
| `apps/web/e2e/room-mobile.spec.ts` | 32 | Pixel 5 screenshot 回帰（darwin only） |
| `apps/web/e2e/room-mobile.spec.ts-snapshots/landing-mobile-mobile-chrome-darwin.png` | binary | screenshot baseline (darwin) |
| `docs/observability.md` | 134 | KPI / SLO / wrangler tail / Web Analytics / follow-up |

### Updated (9)

| File | Action | Notes |
|---|---|---|
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Decisions Log 4 行追加、Phase 7.5 ステータスはすでに in-progress |
| `CONTRIBUTING.md` | UPDATE | 「本番デプロイ」セクション新設、observability.md / PRD Decisions Log への参照を追加 |
| `README.md` | UPDATE | Production deploy 章を runbook 化（KV id 反映 / Turnstile Allowed hostnames / Pages Node22+pnpm10 / smoke check / observability.md リンク） |
| `apps/api/.dev.vars.example` | UPDATE | Phase 7.5 production runbook を BYPASS_TURNSTILE のコメントに追記 |
| `apps/api/wrangler.toml` | UPDATE | KV placeholder と Turnstile 関連 vars に Phase 7.5 runbook コメントを補強。`REPLACE_WITH_PRODUCTION_KV_ID` 自体は実機オペで上書き予定 |
| `apps/web/.env.development` | UPDATE | dev 用 Turnstile site key (`1x00000000000000000000AA`) を追加。理由は Deviations 参照 |
| `apps/web/index.html` | UPDATE | LOW-2 sanitize 化（`[^A-Za-z0-9_-]` を replace で削る） |
| `apps/web/playwright.config.ts` | UPDATE | webServer 配列化、mobile-chrome project、globalSetup |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | UPDATE | E2E 用 `window.__SNAP_SHARE_ANNOTATIONS__` 露出（dev/test 限定） |

## Deviations from Plan

1. **C2 `/healthz` の新規追加は不要**。既存 `/health` (`apps/api/src/index.ts:18`) を readiness probe に流用した。プランの想定通り「dev only なら `/api/docs` でも可」と GOTCHA に記載があった。
2. **`apps/web/.env.development` に `VITE_TURNSTILE_SITE_KEY` を追加**。プラン外の追加変更だが必要だった。理由: API の Zod スキーマが `cf-turnstile-response` に `min(1)` を要求し、空文字列の bypass 経路を成立させない。`.env.development` に dev test key を入れることで、Turnstile widget が dev/E2E でも適切に token を発行できるようになる。プランは「BYPASS_TURNSTILE=true で済む」と想定していたが、実態は `[vars]` 上書きできない（`.dev.vars` 必須）+ schema が空文字を弾く構造。
3. **`apps/web/e2e/global-setup.ts` の追加**。プラン外。Cloudflare wrangler の `[vars]` は process.env で上書きできず、E2E でも `.dev.vars` が必要だったため、欠落時のみ書き出す globalSetup を導入。
4. **`apps/web/e2e/fixtures/upload.ts` を独立ヘルパー化**。プランは `setInputFiles` を想定していたが、`DropZone` は `<input type="file">` を持たず drag&drop / paste のみで画像を受け付けるため、`page.evaluateHandle` + `locator.dispatchEvent('drop', { dataTransfer })` 経路に切替。
5. **room-protected.spec.ts でキーボード経路に切替**。Toolbar と password panel が同一 z-10 領域でオーバーラップし、Playwright が pointer events 遮断と判断するため、`focus + Space` でチェックボックスを切り替える経路にした。a11y 経路の実証も兼ねる。
6. **room-protected.spec.ts の RoomGate 入力を `getByRole('textbox', { name: 'パスワード' })` に変更**。`getByLabel('パスワード')` は form の `aria-labelledby` と strict-mode 衝突した。
7. **room-mobile.spec.ts を darwin platform に限定**。プランは「`maxDiffPixelRatio: 0.02` で吸収、CI 用 `-linux.png` を別途生成して commit」だったが、本セッションは macOS 上のため Linux snapshot を生成できない。Phase 8 follow-up に積み（observability.md `## Follow-ups`）。
8. **Track A の実機オペは未実施**。Cloudflare アカウントへの認証 / dashboard 操作が必要なオペは本セッション環境から実行できないため、コード / ドキュメント面の準備のみ完了。次セッションでオーナーが README runbook 通りに実機オペを踏む想定。

## Issues Encountered

1. **wrangler `[vars]` の override 経路を誤解**。最初の試行で `BYPASS_TURNSTILE: 'true'` を Playwright `webServer.env` に渡したが、wrangler dev は process.env では `[vars]` を上書きしない。`.dev.vars` が必須。globalSetup で対応。
2. **DropZone に `<input type="file">` がない**。プランの GOTCHA は「`<input>` は必ず存在する」と仮定していたが、実装は drag&drop / paste のみ。`DataTransfer` を `evaluateHandle` で構築し、Playwright の `locator.dispatchEvent` で渡す経路で解消。
3. **Toolbar と password panel の z-index 衝突**。`<header>` の z-10 と LocalEditor 内 password panel の z-10 が重なり、Playwright が pointer events 遮断と判断。E2E はキーボード経路に切替。プロダクトとしては UX 上の懸念は残るが、Phase 7.5 のスコープ外。
4. **`getByLabel('パスワード')` の strict mode 衝突**。RoomGate の form に `aria-labelledby` で同じ名前が紐付けられているため複数マッチ。`getByRole('textbox', { name: 'パスワード' })` で限定。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `apps/web/e2e/room-create.spec.ts` | 1 | 画像ドロップ → POST /rooms → URL 遷移 → ツールバー enabled |
| `apps/web/e2e/room-share.spec.ts` | 1 | 2 context 間の Yjs 矩形同期 |
| `apps/web/e2e/room-protected.spec.ts` | 1 | パスワード保護ルームの作成 → ゲート表示 → 誤答 / 正答 |
| `apps/web/e2e/room-mobile.spec.ts` | 1 | Pixel 5 viewport screenshot 回帰（darwin only） |

新 unit / integration テストは無し（プラン通り）。

## Next Steps

- [ ] Track A 実機オペ（次セッションでオーナーが実行）
  - [ ] `wrangler r2 bucket create snap-share-images`
  - [ ] `wrangler kv namespace create IMAGE_BLOCKLIST` → wrangler.toml に貼付
  - [ ] CF dashboard で Turnstile widget 作成 → `wrangler secret put`
  - [ ] CF Web Analytics token 発行 → Pages build env に投入
  - [ ] Pages プロジェクト作成 + Git 連携
  - [ ] `cd apps/api && pnpm wrangler deploy`
  - [ ] 本番 URL での手動 smoke
- [ ] Code review via `/everything-claude-code:code-review`
- [ ] Create PR via `/everything-claude-code:prp-pr`
- [ ] CI Linux 上で `room-mobile` の Linux snapshot 生成（`UPDATE_SNAPSHOTS=1 pnpm exec playwright test --update-snapshots`）→ commit
- [ ] dogfood 開始時に `wrangler tail` を 1 セッション流して LOW-4 (token query string) の実害を観測
