# Code Review: Phase 7.5 — 本番プロビジョニング + 観測 + E2E 拡充

**Reviewed**: 2026-05-02
**Mode**: Local Review (uncommitted)
**Decision**: ✅ **APPROVE WITH COMMENTS** — コミット可。CRITICAL / HIGH 無し。MEDIUM 1 件、LOW 4 件。

## Summary

Phase 7.5 のコード / ドキュメント部分は方針通り「最小限を最小限に」を達成。コード変更は 9 ファイル（うち 5 はコメントのみ）、E2E spec が新規 4 本 + ヘルパ / global-setup / fixture。新規ロジックの API 変更は LOW-2 sanitize と dev-only window expose のみで、production bundle 影響を grep 確認済み。Track A の Cloudflare 実機オペは未実施 — README runbook で次セッション分担を明確化。

## Findings

### CRITICAL

なし。

### HIGH

なし。

### MEDIUM

#### M-1. `playwright.config.ts` の `webServer.env` が dead code（実機の bypass 経路と二重化）

- **場所**: `apps/web/playwright.config.ts:33-37`
- **詳細**:
  - 当初プランは `webServer.env` で `BYPASS_TURNSTILE=true` 等を渡せば wrangler が拾う想定だった
  - 実装中に「`wrangler dev` は process.env では `[vars]` を上書きしない」ことが判明し、`apps/web/e2e/global-setup.ts` で `.dev.vars` を生成する方式に切替
  - 結果として `webServer.env` の 3 値は wrangler に取り込まれず **dead code**。値が一致しているので動作影響は無いが、将来 `global-setup` の値だけ更新して config が古くなる drift 余地が残る
- **推奨対応（ブロッキングではない）**:
  - 案 A（クリーン）: `webServer.env` を削除、コメントで「.dev.vars は global-setup が保証する」と明記
  - 案 B（互換）: コメントだけ追加し、なぜ env も残しているかを 1 行で書く（global-setup が `.dev.vars` 既存時に touch しないので、開発者が独自 .dev.vars を持っていても OK な保険として）
- **推奨は案 A**: 現実装で env は何も達成していない。説明が必要な dead code は削るほうがレビュー負荷が低い

### LOW

#### L-1. `room-mobile.spec.ts` の Linux snapshot 未生成（CI で skip 化）

- **場所**: `apps/web/e2e/room-mobile.spec.ts:13-17`
- **詳細**: `process.platform !== 'darwin'` で skip。CI（Linux）では実行されない。`docs/observability.md` の Phase 8 follow-up に Linux snapshot 生成タスクは記録済み
- **対応**: 今回はスコープ通り、follow-up ありで OK。Phase 8 開始時に `UPDATE_SNAPSHOTS=1` で生成して commit する

#### L-2. `room-share.spec.ts` が hook 内部の debug expose に依存

- **場所**: `apps/web/e2e/room-share.spec.ts:27-35,56-64`
- **詳細**: `window.__SNAP_SHARE_ANNOTATIONS__` を peer 反映の probe に使う。`useYjsAnnotationsStore` の dev/test 限定 expose に密結合
- **対応**: プラン C5 GOTCHA で代替策（Konva DOM count / undo enabled）を比較した上で採用された設計判断。コメントで意図が明確化されているので追加対応不要。Annotation の peer 同期はそもそも CRDT 由来で観測手段が限られる

#### L-3. ROOM_TOKEN_SECRET の dummy 値が config と global-setup に重複

- **場所**: `apps/web/playwright.config.ts:36` と `apps/web/e2e/global-setup.ts:22`
- **詳細**: 同じ dummy secret 文字列が 2 箇所にハードコード。M-1 で `webServer.env` を削除すれば自動的に解消する
- **対応**: M-1 と一括で対応するか、定数を抽出する

#### L-4. `apps/web/.env.development` の Turnstile 鍵追加は dev 体験を変える

- **場所**: `apps/web/.env.development:18`
- **詳細**: 元の dev では Turnstile widget が render されなかった（widget 不在）。新規追加で widget が常時 render される（dev test key で常時パス）
- **対応**: 必要な変更。コメントで理由（schema `min(1)` 制約 + `[vars]` override 不可）を明示済み。リスク低

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm typecheck`) | ✅ Pass — 全 4 workspace 0 error |
| Lint (`pnpm lint`) | ✅ Pass — biome ci 緑（150 files） |
| Unit / Integration tests (`pnpm test`) | ✅ Pass — 既存 154 件維持 |
| Build (`pnpm build`) | ✅ Pass — wrangler --dry-run 緑、`__SNAP_SHARE_ANNOTATIONS__` が prod bundle に残らないことを grep 確認 |
| E2E (`pnpm exec playwright test`) | ✅ Pass — 16 passed / 6 skipped (別 project の skip 化された spec) |

## Security Audit

| Item | Status | Notes |
|---|---|---|
| Hardcoded credentials | ✅ Clean | コミット内の secret 風文字列はすべて公開済み dev test key（`1x...`）または E2E 用 dummy。本番 secret は `wrangler secret put` 経由のみ |
| XSS via VITE_CF_ANALYTICS_TOKEN | ✅ Improved | `[^A-Za-z0-9_-]` sanitize で JS 文字列脱出を防止。LOW-2 解消 |
| Path traversal | ✅ N/A | 新規ファイルにファイル経路操作なし |
| SSRF | ✅ N/A | 新規ファイルに外部 URL 構築なし |
| Token logging | ✅ N/A | 新規ログ追加なし。LOW-4 (WS query token) は follow-up に積み |
| `.gitignore` 漏れ | ✅ OK | `.dev.vars` は gitignored、global-setup が生成するファイルも対象 |
| Production secret 漏出 | ✅ OK | `apps/web/.env.production` は commit せず Pages env のみで管理する Decisions Log 確定 |

## Pattern Compliance

| 観点 | 評価 |
|---|---|
| 日本語ファースト | ✅ コメント / docs / commit 候補メッセージとも日本語 |
| Conventional Commits | ✅ コミット粒度が分かれていればトラック別に切れる（A 実機オペ未実施なので今回は code/docs を 1〜2 commit にまとめるのが妥当） |
| 型安全 | ✅ `any` 不使用、`unknown` で narrow（window expose の cast も unknown 経由） |
| 命名規則 | ✅ kebab-case spec ファイル、camelCase 関数、UPPER_SNAKE 定数 |
| ロケーター主体 | ✅ E2E は role + accessible name 主体。`getByLabel` の strict-mode 衝突を `getByRole('textbox')` に切替対応済み |
| コメント方針 | ✅ WHY を中心に記述。WHAT のみのコメントは見当たらない |

## Files Reviewed

### Code (M = Modified, A = Added)

| File | Type | LOC delta | Risk |
|---|---|---|---|
| `apps/api/.dev.vars.example` | M | +9 | comment only |
| `apps/api/wrangler.toml` | M | +18 / -7 | comment only |
| `apps/web/.env.development` | M | +8 | dev key 追加（公開鍵） |
| `apps/web/index.html` | M | +9 / -3 | sanitize 強化（XSS 緩和） |
| `apps/web/playwright.config.ts` | M | +35 / -9 | E2E config |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | M | +10 | dev/test 限定 expose |
| `apps/web/e2e/global-setup.ts` | A | +27 | E2E `.dev.vars` 生成 |
| `apps/web/e2e/fixtures/upload.ts` | A | +44 | E2E drop helper |
| `apps/web/e2e/fixtures/sample.png` | A | binary 68B | 1×1 透過 PNG |
| `apps/web/e2e/room-create.spec.ts` | A | +23 | E2E spec |
| `apps/web/e2e/room-share.spec.ts` | A | +80 | E2E spec |
| `apps/web/e2e/room-protected.spec.ts` | A | +56 | E2E spec |
| `apps/web/e2e/room-mobile.spec.ts` | A | +31 | E2E spec |
| `apps/web/e2e/room-mobile.spec.ts-snapshots/landing-mobile-mobile-chrome-darwin.png` | A | binary | screenshot baseline |

### Docs (M / A)

| File | Type | Notes |
|---|---|---|
| `.claude/PRPs/prds/snap-share.prd.md` | M | Phase 7.5 status / Decisions Log 4 行 |
| `CONTRIBUTING.md` | M | 「本番デプロイ」セクション新設 |
| `README.md` | M | Production deploy 章を runbook 化 |
| `docs/observability.md` | A | KPI / SLO / wrangler tail / follow-up |
| `.claude/PRPs/plans/completed/phase-7.5-production-provisioning.plan.md` | A (moved) | 完了アーカイブ |
| `.claude/PRPs/reports/phase-7.5-production-provisioning-report.md` | A | 実装レポート |

## Recommended Commit Plan

Track A の実機オペ未実施を踏まえ、code/docs を**1〜2 コミット**でまとめるのが妥当。

### Option A — シングルコミット

```
feat(phase-7.5): 観測 docs / E2E 拡充 / 本番 runbook 整備

- docs: KPI / SLO / wrangler tail / Web Analytics / LOW-3/4 follow-up
- e2e: room-create / share / protected / mobile を chromium + mobile-chrome で
- security: VITE_CF_ANALYTICS_TOKEN を sanitize（LOW-2）
- ops: README / CONTRIBUTING / wrangler.toml に Phase 7.5 runbook
- prd: Decisions Log 4 行追加（手動 deploy / .env.production 非 commit / E2E project / 観測手段）
```

### Option B — 2 コミットに分割

1. `feat(phase-7.5): E2E 拡充 (chromium + mobile-chrome / 4 spec)` — apps/web 配下のみ
2. `docs(phase-7.5): 観測 / 運用 runbook / Decisions Log` — docs / md / wrangler.toml / .dev.vars.example / PRD

> 推奨は **Option A**。一連の変更で完結しており、レビュー観点でも切り分け不要。`feat` プレフィックスは「観測 docs と E2E spec を新機能として導入」と読めるので適切。

## Next Steps

1. **M-1 を反映（任意）**: `playwright.config.ts:33-37` の `webServer.env` を削除し、コメントを 1 行追記。LOW-3 も同時解消。`pnpm exec playwright test` で動作確認
2. **コミット**: 上記いずれかのコミットメッセージで `git add` + `git commit`。`apps/web/e2e/fixtures/` と `*-snapshots/` も忘れずに `add`
3. **次セッション**: Track A の実機オペを README runbook 通りに踏む（オーナー作業）
4. **PR 作成**: `/everything-claude-code:prp-pr` で `feat/phase-7.5-production-provisioning` ブランチを切って PR
