# Plan: Phase 7.6 — 手動 QA + バグ回収 + E2E 強化

## Summary

Phase 7.5 で「コード上は本番投入可能」「runbook 完備」「E2E 5 spec 緑」まで来たが、本番スモークを踏み始めた時点で 3 件のバグが即座に検出された（既知-1 tainted canvas / 既知-2 password UI 不可視 / 既知-3 画像クリアが期待通りに動かない）。Phase 7.6 は (A) Track A 実機オペの完了確認、(B) `docs/.tmp/cloudflare-runbook.md` A7 系を起点とした網羅的な手動 QA で全バグを GitHub Issue 化、(C) 検出した全バグを `re-produce spec → fix → 緑` の TDD で hotfix、(D) 再発防止のため対応する E2E spec を `apps/web/e2e/` に追加して CI で永続的にロックする。クロージング条件は「本番再デプロイ後の手動 QA が clean run で全緑」「新設 E2E spec が CI Linux で緑」「Phase 8 dogfood の Go/No-Go 判断材料が `reports/phase-7.6-*.md` に揃う」の 3 点。

## User Story

As a snap-share の オーナー兼 Phase 8 dogfood の唯一の被験者,
I want Phase 7.5 で建てた本番 Cloudflare 環境（API + Pages）を「クリック / D&D / paste / 別ブラウザ参加 / PNG エクスポート / パスワード経路を踏み倒す」ユーザー操作で 1 サイクル全緑にし、その過程で見つかったバグは全件 issue 化 → hotfix → 同一バグが再混入したら CI が落ちる E2E spec まで揃った状態にしたい,
So that Phase 8 dogfood を「2 週間使って未知のクラッシュに振り回される期間」ではなく「事前定義した KPI を観測する期間」として走らせられる。

## Problem → Solution

### Current（Phase 7.5 完了時点）

- **Track A 実機オペが部分実施**: `wrangler r2 bucket create` / `wrangler kv namespace create` / Turnstile widget 作成 / Web Analytics token 発行 / Pages project + Git 連携 / `cd apps/api && pnpm wrangler deploy` の 6 手順を `docs/.tmp/cloudflare-runbook.md` 通りに踏むこと自体は始まっており、`apps/api/wrangler.toml:64` に本番 KV id（`750e562861214964ab8e157b79a1d42d`）と本番 Turnstile site key（`0x4AAAAAADHtSX4zIeH_vH_NJOJFTqQCS-A`）は反映済。残りは「本番 API URL（`https://snap-share-api.<account>.workers.dev`）と本番 Web URL（`https://snap-share.pages.dev`）が `/health` 200 を返す」「Pages の Build env vars に確定値が入る」の最終確認。
- **本番スモーク（A7-1〜A7-3）が未踏 / 部分踏み**: 受信側エクスポートまで踏んで 3 件の不具合を検出した時点で停止。残りの A7-1（通常ルームの画像表示 + 矩形描画 + リアルタイム同期 + 別ブラウザ参加）、A7-2（パスワードゲート）、A7-3（PNG エクスポートの注釈焼き込み）、A8（`wrangler tail` でのログ確認 + Web Analytics の PV 確認）、A9（Turnstile Allowed hostnames 確認）はクリーンに踏み切れていない。
- **既知バグ 3 件の根本原因 / 修正未完**:
  - **既知-1（tainted canvas / 公開ルームの受信側で PNG エクスポート失敗）**: 原因特定済。`apps/web/src/components/canvas/ImageLayer.tsx:9` の `useImage(src)` に `crossOrigin='anonymous'` が無いため、本番（`snap-share.pages.dev` ↔ `snap-share-api.workers.dev` の cross-origin）で `<KonvaImage>` の元 `<img>` が canvas を tainted 化し `stage.toCanvas().toBlob()` が `SecurityError` を投げる。試験的に修正（commit `2e2d533`）→ 再検証のため revert（commit `d139a06`）。preview URL では `VITE_API_URL` が空のため再現せず、本番だけで顕在化する点に注意。CORS allowlist は `apps/api/src/index.ts:25-40` で `*.snap-share.pages.dev` を許容済のため、`crossOrigin='anonymous'` を再投入すれば理論上は ACAO が返って tainted 化が解消する想定。
  - **既知-2（パスワード設定 UI が画面に出ない）**: ローカルでも再現する既存バグ。`apps/web/src/pages/LocalEditor.tsx:78-115` で password panel は `absolute top-4 z-10` に置かれ、`apps/web/src/pages/EditorShell.tsx:188-212` の header（toolbar）も `top-0 z-10` で同領域。Phase 7.5 report の Issues #3 に「Toolbar と password panel の z-index 衝突」「Playwright が pointer events 遮断と判断」と記録あり。E2E はキーボード経路で迂回したが、UX としては「toolbar 配下に隠れて見えない / クリックできない」可能性が高い。原因切り分けは未着手。
  - **既知-3（画像クリアが効かない）**: ローカルでも再現する既存バグ。`apps/web/src/pages/RoomEditor.tsx:109-117` で「画像をクリア」ボタン（`apps/web/src/components/toolbar/Toolbar.tsx:118-125` で `ImageMinus` アイコン）を押すと `ConfirmClearAllDialog` が開き、確定すると `store.reset()` が呼ばれる — つまり**注釈は全削除されるが画像は消えない**。ボタンラベル「画像をクリア」と実挙動「注釈を全削除」の乖離。原因切り分けは未着手。
- **未知バグの蓋然性**: 既知 3 件は A7-1 経路の 1/10 程度しか踏んでいない時点で検出されたもの。網羅的に手動 QA すれば追加で検出される可能性が高い。
- **再発防止の自動回帰網が未整備**: 既知-1 の試験的 fix 時には `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` を新規作成して `useImage(src, 'anonymous')` 呼び出しを vi.mock で検証していたが、revert で消失。Phase 7.5 で追加した E2E は localhost ↔ same-origin のため「本番だけで起きる cross-origin tainted canvas」は CI で再現できない。受信側エクスポート / パスワード設定 UI / 画像クリア / 画像差し替え / 共有 URL の cross-origin 経路は E2E カバレッジ ZERO。

### Desired（Phase 7.6 完了時点）

- **本番 URL 全経路が手動 QA で 1 サイクル全緑**:
  - A7-1（通常ルーム）: ランディング描画 → D&D で `/r/<21文字>` 遷移 → 矩形描画 → 別ブラウザで参加 → リアルタイム同期 → PNG 保存
  - A7-2（パスワード保護）: 保護チェック → パスワード入力 → ルーム生成 → 別ブラウザで RoomGate → 誤答エラー → 正答で入室
  - A7-3（PNG エクスポート）: 矩形 + 矢印描画 → PNG 保存 → 開いて元画像 + 注釈の焼き込み確認（**送信側 / 受信側 / 公開ルーム / パスワード保護ルーム の 4 組み合わせ全て**）
  - 上記を Chrome / Safari / Firefox（デスクトップ）+ iOS Safari / Android Chrome（モバイル）+ タブレット の 6 環境で踏み倒す
- **検出バグが全件 GitHub issue 化 → hotfix → close**: 既知 3 件 + 網羅 QA で発見した分すべて。各 hotfix は「再現 spec を先に書いて RED → 修正で GREEN」の TDD で進める。Severity が低いものを Phase 8 follow-up へ送る場合は `reports/phase-7.6-*.md` に「Phase 8 へ送る理由」を明記。
- **既知-1（tainted canvas）解消**:
  - `apps/web/src/components/canvas/ImageLayer.tsx` で `useImage(src, 'anonymous')` を再投入（commit `2e2d533` の差分を再適用）。
  - `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` を再作成し、`useImage` を vi.mock してその第 2 引数が `'anonymous'` で渡ることを検証。
  - API の CORS middleware が `GET /rooms/:id/image` に対しても `Access-Control-Allow-Origin: <origin>` + `Vary: Origin` を返すことを `apps/api/src/__tests__/images.test.ts` に追加 spec で確認（hono/cors はデフォルトで Vary を付ける想定だが本番 cache hit を考えると明示確認したい）。
  - 本番再デプロイ後の手動 QA で「公開ルームの受信側でも PNG エクスポートが成功する」を実機で確認。
- **既知-2（password UI 不可視）解消**:
  - 切り分けの最初: ローカルでも再現するか改めて踏む。再現するなら原因を特定（toolbar 重なり / DropZone のスタッキングコンテキスト / Tailwind v4 の token 解決ミス / shadcn `<Checkbox>` の SSR-related issue 等を順に潰す）。
  - 修正方針候補: (a) password panel を toolbar より上の z-index に上げる、(b) toolbar の右下 / 下部に panel を配置し直して干渉を避ける、(c) 画像未ロード時は toolbar の左半分を空にする、(d) panel を toolbar 自体の中に組み込む。UX を壊さない最小修正を選ぶ。
  - E2E `apps/web/e2e/landing.spec.ts` か新規 spec で「画像未ロード時に password 保護 checkbox + label が `toBeVisible` で見える」を assert（既存 `room-protected.spec.ts` は `keyboard.press('Space')` で迂回しているため可視性自体は検証していない）。
- **既知-3（画像クリア）の挙動を「ボタンラベルと一致」させる**:
  - 設計判断 — 以下のいずれかをオーナーと相談して確定:
    - **(a) ラベルを実挙動に合わせる**: 「画像をクリア」→「注釈をすべて削除」、アイコンも `Trash2` 等に変更。最小差分。
    - **(b) 実挙動をラベルに合わせる**: 「画像をクリア」で画像も削除し、ランディングに戻る。RoomEditor は room を抜けて `setRoomIdInUrl(null)` 相当の動きをする。Server 側の R2 オブジェクトは TTL 任せで放置。
    - **(c) 「画像をクリア」と「注釈を削除」を別ボタンに分ける**: UX 的に最も誠実だが UI 面積が増える。
  - Plan 段階の推奨は **(a) または (b)**。MVP の「最小限を最小限に」方針 + ボタン数増加コストから (a) を default 選択肢とし、(b) を選ぶならパス遷移を伴うため別 task に分割。
  - LocalEditor の `handleClear`（`apps/web/src/pages/LocalEditor.tsx:47-50`）は ObjectURL revoke + `store.reset()` を実行しているため、(b) を選んだ場合は RoomEditor 側でも同等の挙動（room を抜ける）を実装。
- **未発見バグも回収**: B 章の網羅 QA で見つかった分すべてを issue → hotfix → close。
- **E2E が「次に同じバグが入ったら CI で落ちる」状態**:
  - 既知-1: `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx`（unit）+ `apps/web/e2e/room-export-receiver.spec.ts`（E2E、本番 cross-origin を mock するか、`apps/api` を 別ポート / 別ホスト名で起動して再現）
  - 既知-2: `apps/web/e2e/landing-password-toggle.spec.ts`（password チェック → input 出現 → 文字入力 が `toBeVisible` ベース）
  - 既知-3: `apps/web/e2e/room-clear-image.spec.ts`（クリアボタン → 確認 → 想定挙動を踏む。挙動 (a) なら「注釈消える / 画像残る」、(b) なら「ランディングに戻る」）
  - 網羅 QA で発見した bug ごとに spec を 1 本ずつ追加。
- **Firefox / WebKit プロジェクト追加の判断**:
  - Phase 7.5 の Decisions Log で「Phase 8 dogfood 後に判断」としたが、既知-1 が「本番だけ再現するブラウザ依存ではない cross-origin 問題」だったため、追加判断の主因は「本番手動 QA で Firefox / WebKit 専用バグが出たかどうか」。出なければ判断は据え置き、出れば前倒しで `playwright.config.ts:projects` に追加。
- **`room-mobile.spec.ts` の Linux snapshot 整備**: Phase 7.5 carry-over。CI Linux 上で `UPDATE_SNAPSHOTS=1 pnpm exec playwright test --update-snapshots` を 1 度走らせて `room-mobile.spec.ts-snapshots/landing-mobile-mobile-chrome-linux.png` を生成 → commit。`apps/web/e2e/room-mobile.spec.ts:14-17` の `process.platform !== 'darwin'` skip を Linux でも走るように緩和。
- **Phase 8 Go/No-Go 判断材料が揃う**: `reports/phase-7.6-*.md` に「手動 QA チェック表（A7-1〜A9 全項目 + デバイス×OS マトリクス）」「検出バグ一覧（issue # / severity / fix commit / 対応 E2E spec）」「E2E カバレッジ差分（before/after）」「Phase 8 へ送ったバグ一覧と理由」を載せる。

### 受け入れ条件（Acceptance）

- 本番 URL `https://snap-share.pages.dev` で手動 QA チェック表が clean run で全緑（再走時に新たなバグが出ない）
- 既知-1 / 既知-2 / 既知-3 が close 状態（または明示的に Phase 8 送り）
- 網羅 QA で発見したすべてのバグが close 状態（または明示的に Phase 8 送り）
- 新設 E2E spec が CI Linux で緑（chromium + mobile-chrome の 2 プロジェクト最低）
- `apps/web/e2e/room-mobile.spec.ts` の Linux snapshot が commit され、CI Linux で skip されずに実行されて緑
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` がすべて緑（Phase 7.5 比で web 側のテスト件数が +5〜+15 程度）
- `reports/phase-7.6-*.md` が `.claude/PRPs/reports/` に作成され、QA チェック表 + 検出バグ表 + E2E カバレッジ差分 + Phase 8 dogfood Go/No-Go 判断が記載される
- PRD の Phase 7.6 ステータスが `complete` に更新される（PR マージ時）

## Metadata

- **Complexity**: Medium（バグ修正 3 件 + 網羅 QA から派生する hotfix が N 件 + E2E 拡充。コード差分は小〜中規模だが「手動 QA を踏み倒す工数」が読みづらい。）
- **Source PRD**: `.claude/PRPs/prds/snap-share.prd.md`
- **PRD Phase**: Phase 7.6 — 手動 QA + バグ回収 + E2E 強化
- **Depends on**: Phase 7.5（complete: 本番 runbook + observability docs + E2E 5 spec）
- **Parallel with**: なし（Phase 8 dogfood は本フェーズ完了で開始可能）
- **Estimated Files**:
  - 新規: 約 4〜10（既知 3 件分の E2E spec 3 + 未発見バグ分 N + ImageLayer unit test 1 + Phase 7.6 report 1）
  - 更新: 約 5〜8（`apps/web/src/components/canvas/ImageLayer.tsx` / `apps/web/src/pages/LocalEditor.tsx` または `EditorShell.tsx` / `apps/web/src/components/toolbar/Toolbar.tsx` / `apps/web/src/pages/RoomEditor.tsx` / `apps/api/src/__tests__/images.test.ts` / `apps/web/e2e/room-mobile.spec.ts` / PRD phase status / `apps/web/e2e/room-mobile.spec.ts-snapshots/landing-mobile-mobile-chrome-linux.png`）
- **Estimated LOC**:
  - コード差分: 約 100〜300 行（既知-1 は 5 行 fix + 60 行 test、既知-2 は CSS / 配置調整中心、既知-3 はラベル / アイコン変更 or RoomEditor flow 拡張、各 E2E spec が 50〜80 行）
  - ドキュメント: `reports/phase-7.6-*.md` 約 200〜400 行
- **Confidence**: **6/10** — 「網羅 QA で何件の未知バグが出るか」が見えないため見積りが幅広い。既知 3 件の修正自体は理路整然としているが、(1) 既知-1 を fix した後に本番で別の cross-origin issue が出る可能性、(2) 既知-2 の z-index 問題は単純そうだが Tailwind v4 + shadcn のスタッキングコンテキスト次第で泥臭い、(3) 既知-3 の挙動判断（a/b/c）は Plan 段階で確定しきれずオーナー判断を要する、(4) 未発見バグが 5 件超出ると Phase スコープ膨張、の 4 リスク。

---

## UX Design

### Before（Phase 7.5 完了時点）

```
┌──────────────────────────────────────────────────────────────┐
│  本番 URL: https://snap-share.pages.dev (alive、A7 部分踏み)     │
│  ├─ 公開ルームの受信側で PNG エクスポート: ❌ tainted canvas      │
│  ├─ パスワード設定 UI: ❌ 画面に出ない（ローカルでも再現）          │
│  └─ 画像クリアボタン: ❌ ボタンと挙動の乖離（ローカルでも再現）       │
│                                                              │
│  E2E カバレッジ:                                                │
│  ├─ ✅ landing 描画 / toolbar / disabled state                │
│  ├─ ✅ room-create (画像 → /r/:id → ツールバー有効化)            │
│  ├─ ✅ room-share (2 context Yjs 同期)                        │
│  ├─ ✅ room-protected (ゲート → 誤答 → 正答)                   │
│  ├─ ✅ room-mobile (Pixel 5 screenshot, darwin only)         │
│  ├─ ❌ 受信側 PNG エクスポート (cross-origin)                   │
│  ├─ ❌ パスワード UI 可視性（keyboard 迂回のみ）                 │
│  └─ ❌ 画像クリアの実挙動                                        │
│                                                              │
│  bug tracker: GitHub issue 0 件                               │
└──────────────────────────────────────────────────────────────┘
```

### After（Phase 7.6 完了時点）

```
┌──────────────────────────────────────────────────────────────┐
│  本番 URL: https://snap-share.pages.dev                        │
│  ├─ 公開ルームの受信側で PNG エクスポート: ✅                    │
│  ├─ パスワード設定 UI: ✅ 画面に見える / クリックできる              │
│  └─ 画像クリアボタン: ✅ ラベルと挙動が一致                        │
│                                                              │
│  E2E カバレッジ (新規):                                          │
│  ├─ ✅ ImageLayer unit test (anonymous crossOrigin)            │
│  ├─ ✅ room-export-receiver (cross-origin PNG export)          │
│  ├─ ✅ landing-password-toggle (UI 可視性)                      │
│  ├─ ✅ room-clear-image (実挙動の検証)                           │
│  └─ ✅ images.test.ts に CORS header 検証 spec 追加              │
│                                                              │
│  E2E プロジェクト構成: chromium + mobile-chrome                  │
│  ├─ Linux snapshot 整備済 (room-mobile.spec.ts も CI で実行)    │
│  └─ Firefox / WebKit: QA で必要性が出たら追加 (判断未定)         │
│                                                              │
│  bug tracker: 検出 N 件 / close N 件 / Phase 8 送り M 件         │
│  reports/phase-7.6-*.md: QA 表 + bug 表 + E2E diff 完備        │
└──────────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 公開ルームを別ブラウザで開いて PNG 保存 | `Failed to execute 'toBlob' ... Tainted canvases may not be exported.` でクラッシュ | PNG ファイルがダウンロードされる | 既知-1 fix |
| ランディングで「パスワードで保護する」チェック | チェックボックスが視認できない / クリックできない | チェック → password input が出現 → 入力できる | 既知-2 fix |
| ルーム内で「画像をクリア」ボタン | ダイアログ確認 → 注釈は消えるが画像が残る（ラベル不一致） | (a) ラベルを「注釈をすべて削除」に変更 / (b) 画像も消えてランディングに戻る | 既知-3 fix（a / b / c はオーナー判断） |
| iOS Safari / Android Chrome で全経路 | 未検証 | 手動 QA で全経路 1 サイクル踏破 | B 章 |
| Firefox / WebKit | E2E カバレッジ無 | 手動 QA で経由 → 必要なら Playwright project 追加 | D 章 |

---

## Mandatory Reading

実装前に必ず読むべきファイル。

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/components/canvas/ImageLayer.tsx` | 1-13 | 既知-1 fix 対象。`useImage(src)` を `useImage(src, 'anonymous')` に再投入する |
| P0 | `apps/web/src/pages/LocalEditor.tsx` | 1-133 | 既知-2 の発生源 — password panel の配置 / z-index / 表示条件 |
| P0 | `apps/web/src/pages/EditorShell.tsx` | 186-212 | toolbar header の z-index / position（password panel と衝突する側） |
| P0 | `apps/web/src/pages/RoomEditor.tsx` | 109-117, 156-161 | 既知-3 の発生源 — 「画像をクリア」が `store.reset()` のみで画像クリアしていない |
| P0 | `apps/web/src/components/toolbar/Toolbar.tsx` | 95-127 | 「画像をクリア」ボタンのラベル / アイコン定義 |
| P0 | `apps/web/src/components/dialogs/ConfirmClearAllDialog.tsx` | 1-30 | ダイアログのタイトル「ルーム内の注釈をすべて削除しますか？」と現挙動の整合性 |
| P0 | `apps/api/src/index.ts` | 25-46 | CORS middleware 設定 — `Access-Control-Allow-Origin` の発行有無 |
| P0 | `apps/api/src/lib/cors.ts` | 1-37 | CORS allowlist パーサ — `*.snap-share.pages.dev` ワイルドカード仕様 |
| P0 | `apps/api/src/routes/images.ts` | 1-101 | `GET /rooms/:id/image` のレスポンスヘッダ — Cache-Control / ETag |
| P1 | `apps/api/wrangler.toml` | 60-90 | 本番 KV id / Turnstile site key / `CORS_ALLOWED_ORIGINS` の確定値 |
| P1 | `apps/web/public/_headers` | 1-23 | Pages CSP — `connect-src 'self' https: wss:` で API への XHR 許可 / `img-src 'self' blob: data: https:` で cross-origin 画像許可 |
| P1 | `apps/web/playwright.config.ts` | 1-50 | E2E 設定 — chromium + mobile-chrome の 2 project / `webServer` 配列 |
| P1 | `apps/web/e2e/global-setup.ts` | 1-27 | `.dev.vars` 自動生成 — Turnstile bypass の前提 |
| P1 | `apps/web/e2e/fixtures/upload.ts` | 1-44 | DropZone への画像投入ヘルパー — `dataTransfer` + `dispatchEvent` 経路 |
| P1 | `apps/web/e2e/room-protected.spec.ts` | 17-22 | 既存 spec で password チェックボックスを keyboard 経路で迂回している箇所 — 既知-2 の証跡 |
| P1 | `docs/.tmp/cloudflare-runbook.md` | 631-732 | A7 系の手動 QA チェック表 — 本フェーズ B 章のチェックリスト元ネタ |
| P2 | `.claude/PRPs/reports/phase-7.5-production-provisioning-report.md` | all | Carry-over to Phase 7.6 セクションが本 plan の起源 |
| P2 | `apps/web/src/hooks/useExportPng.ts` | 1-52 | 既知-1 の最終消費点 — `stage.toCanvas` → `toBlob` がクラッシュする経路 |
| P2 | `apps/web/src/lib/exportPng.ts` | all | `stageToBlob` の実装 — tainted canvas 例外がここから上がる |
| P2 | `apps/api/src/services/image-blocklist-service.ts` | all | KV fail-open の挙動（網羅 QA で「ブラックリストが効いていない」を検知する用） |
| P2 | `.github/workflows/ci.yml` | 35-72 | E2E job の構造 — 新 spec 追加で実行時間が伸びるかの判断材料 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| HTML `<img crossorigin="anonymous">` | https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin | クロスオリジン画像を `<img crossOrigin="anonymous">` で取得すると、サーバが `Access-Control-Allow-Origin` を返す場合のみ canvas を tainted 化せずに取り込める。`Vary: Origin` を CDN cache 段で扱える必要がある |
| Konva `toCanvas` / `toDataURL` の tainted 問題 | https://konvajs.org/docs/sandbox/Get_Image_From_URL.html | Konva 公式が「外部画像を扱うときは `Konva.Image` のソース `<img>` に `crossOrigin = 'anonymous'` を設定するか、ダウンロードして blob: 経由で読み込む」を明示推奨 |
| `use-image` の 2nd 引数 | https://github.com/konvajs/use-image | 第 2 引数 `crossOrigin` がそのまま `<img>.crossOrigin` に渡る |
| hono/cors の `Vary: Origin` | https://hono.dev/middleware/builtin/cors | hono/cors は許可された origin に対して `Access-Control-Allow-Origin: <origin>` + `Vary: Origin` を自動付与 — Cloudflare CDN cache でも origin ごとに別エントリとして扱われる |
| Playwright multi-browser project 追加 | https://playwright.dev/docs/test-projects | `projects` に `firefox` / `webkit` を追加するだけで実行可能。`devices['Desktop Firefox']` / `devices['Desktop Safari']` を use 値に渡す。globalSetup は project ごとには走らないため共通の前提整備として残せる |
| Playwright snapshot per platform | https://playwright.dev/docs/test-snapshots | snapshot ファイル名は `<spec>-snapshots/<name>-<project>-<platform>.png`。OS ごとに別 baseline が必要なので `linux` 用を CI 上で 1 度 update-snapshots 実行して commit |

---

## Patterns to Mirror

既存コードベースで確立されているパターン。新規コードはこれらに揃える。

### NAMING_CONVENTION
```typescript
// SOURCE: apps/web/src/components/canvas/ImageLayer.tsx:8-13
type ImageLayerProps = Readonly<{
  src: string;
}>;

export const ImageLayer = ({ src }: ImageLayerProps) => {
  // ...
};
```
- `Props` は `Readonly<{ ... }>` で type alias、`type` キーワード（`interface` 不使用）
- export は `const Foo = (...) =>` の named export

### REACT_COMPONENT_TEST_STRUCTURE
```typescript
// SOURCE: apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx (commit 2e2d533, revert 済)
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('use-image', () => ({
  default: vi.fn(() => [undefined, 'loading'] as const),
}));
vi.mock('react-konva', () => ({
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Image: () => null,
}));

import useImage from 'use-image';
import { ImageLayer } from '../ImageLayer';

const useImageMock = vi.mocked(useImage);

describe('ImageLayer', () => {
  beforeEach(() => {
    useImageMock.mockClear();
    useImageMock.mockReturnValue([undefined, 'loading']);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes crossOrigin="anonymous" to use-image', () => {
    // ... act + createRoot で render → expect(useImageMock).toHaveBeenCalledWith(src, 'anonymous')
  });
});
```
- happy-dom で `react-konva` を mock してレンダリングを通す（実 canvas を必要としない）
- `vi.mocked(useImage)` で型付きの mock ハンドル
- `act` で render を包む

### E2E_SPEC_STRUCTURE
```typescript
// SOURCE: apps/web/e2e/room-create.spec.ts:1-23
import { expect, test } from '@playwright/test';
import { dropImage } from './fixtures/upload';

test.describe('room creation flow', () => {
  test('画像ドロップでルームが作成され /r/:id に遷移し...', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Yjs 経由のルーム生成は chromium 1 プロジェクトで十分',
    );

    await page.goto('/');
    await dropImage(page);

    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: '矩形' })).toBeEnabled();
  });
});
```
- spec タイトルは日本語、describe + it の二段
- chromium-only な spec は `test.skip(testInfo.project.name !== 'chromium', '理由')` で明示
- `dropImage(page)` ヘルパーで画像投入（DropZone は `<input type="file">` を持たないため）
- セレクタは `getByRole` を優先（accessibility 検証兼用）

### API_TEST_STRUCTURE
```typescript
// SOURCE: apps/api/src/__tests__/images.test.ts (既存)
import { describe, expect, it } from 'vitest';
import app from '../index';
import { buildEnv } from './helpers/build-env';

describe('GET /rooms/:id/image', () => {
  it('returns 404 when room does not exist', async () => {
    const env = buildEnv();
    const res = await app.fetch(new Request('http://x/rooms/abc/image'), env);
    expect(res.status).toBe(404);
  });
});
```
- `app.fetch(new Request, env)` で Hono アプリを直接叩く（Cloudflare Workers ランタイム不要）
- `buildEnv()` で in-memory R2 / KV / Rate Limit / Turnstile を組み立て
- 環境変数の上書きは `buildEnv({ CORS_ALLOWED_ORIGINS: '...' })` で渡す

### TURNSTILE_BYPASS_FOR_E2E
```typescript
// SOURCE: apps/web/e2e/global-setup.ts:13-26
export default async function globalSetup(): Promise<void> {
  const devVarsPath = path.resolve(__dirname, '../../api/.dev.vars');
  if (existsSync(devVarsPath)) return;
  writeFileSync(devVarsPath, [
    'BYPASS_TURNSTILE="true"',
    'TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"',
    'ROOM_TOKEN_SECRET="e2e-test-token-secret-min-32-bytes-long-enough"',
    '',
  ].join('\n'));
}
```
- 既存の `.dev.vars` を上書きしないため `existsSync` でガード
- E2E は wrangler dev 経由で API を起動するので `.dev.vars` から TURNSTILE bypass を読ませる

### CSS_TOKEN_USAGE
```tsx
// SOURCE: apps/web/src/pages/LocalEditor.tsx:79-95
<div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
  <div className="pointer-events-auto flex flex-col gap-2 rounded-lg bg-(--color-surface) p-3 shadow-sm ring-1 ring-black/5 backdrop-blur">
    {/* ... */}
  </div>
</div>
```
- 色は `bg-(--color-surface)` のように Tailwind v4 の token 直参照
- 配置の親に `pointer-events-none`、内側で `pointer-events-auto` で受けるパターン

### HEADER_LAYOUT_AND_Z_INDEX
```tsx
// SOURCE: apps/web/src/pages/EditorShell.tsx:188-212
<header
  ref={headerRef}
  className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 px-3 py-2"
>
  {/* h1 + Toolbar + toolbarRight */}
</header>
```
- 既知-2 の競合相手はこの `z-10`。LocalEditor の panel も `z-10` のため stacking context の親で順序が決まる
- 既知-2 修正時に panel 側を `z-20` に上げる、または header 側で max-width を制限して左右分離する

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/canvas/ImageLayer.tsx` | UPDATE | 既知-1: `useImage(src)` → `useImage(src, 'anonymous')` |
| `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` | CREATE | 既知-1: `crossOrigin='anonymous'` の回帰検知 unit test |
| `apps/web/src/pages/LocalEditor.tsx` または `apps/web/src/pages/EditorShell.tsx` | UPDATE | 既知-2: password panel の z-index / 配置調整 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | UPDATE | 既知-3 (a) を選んだ場合: ラベル「画像をクリア」→「注釈をすべて削除」、アイコン `ImageMinus` → `Trash2` 等 |
| `apps/web/src/components/dialogs/ConfirmClearAllDialog.tsx` | UPDATE | 既知-3: ダイアログタイトル / 説明文の調整（実挙動と一致） |
| `apps/web/src/pages/RoomEditor.tsx` | UPDATE | 既知-3 (b) を選んだ場合: 画像クリアで room を抜けて landing へ |
| `apps/web/src/pages/LocalEditor.tsx` | UPDATE | 既知-3 (b) を選んだ場合: clear で path を `/` に戻す配線（既存 `clear()` は ObjectURL revoke + state reset で完結している） |
| `apps/web/e2e/landing-password-toggle.spec.ts` | CREATE | 既知-2: password チェックボックスの可視性 + input 出現 + 入力経路 |
| `apps/web/e2e/room-clear-image.spec.ts` | CREATE | 既知-3: 「画像をクリア」ボタンの実挙動検証（a/b で assertion が変わる） |
| `apps/web/e2e/room-export-receiver.spec.ts` | CREATE | 既知-1: 受信側 PNG エクスポート — 別 origin の API mock or 別 host 起動で再現 |
| `apps/web/e2e/landing.spec.ts` | UPDATE | 既知-2 の追従: password panel 関連の追加 assertion を入れる選択肢 |
| `apps/api/src/__tests__/images.test.ts` | UPDATE | CORS header 検証 spec 追加（`Access-Control-Allow-Origin` + `Vary: Origin`） |
| `apps/web/e2e/room-mobile.spec.ts` | UPDATE | `process.platform !== 'darwin'` skip を緩和、Linux でも実行 |
| `apps/web/e2e/room-mobile.spec.ts-snapshots/landing-mobile-mobile-chrome-linux.png` | CREATE | CI Linux 用 snapshot を生成して commit |
| `apps/web/playwright.config.ts` | UPDATE（条件付き） | Firefox / WebKit を追加するなら `projects` に追記 |
| `.claude/PRPs/prds/snap-share.prd.md` | UPDATE | Phase 7.6 status を pending → in-progress、PR マージで complete + plan / report リンク追加 |
| `.claude/PRPs/reports/phase-7.6-manual-qa-bug-recovery-report.md` | CREATE | 手動 QA チェック表 + 検出バグ表 + E2E カバレッジ差分 + Phase 8 dogfood Go/No-Go 判断 |

未発見バグの修正対象ファイルは B 章の探索的 QA で確定する。

## NOT Building

- **dogfood で実際に発生する不具合の小修正**: Phase 8 のスコープ。本フェーズは「踏み倒して見つかったバグ」を回収するが、Phase 8 開始後に「使ってみて気づいた」レベルの小修正は含まない
- **観測 KPI の実値レビュー / SLO 達成判定**: Phase 8 で初回計測。本フェーズは「KPI が読める状態」を維持するだけで、数字を見て判断するのは次フェーズ
- **パフォーマンス最適化（CLS / LCP / バンドルサイズ）**: Phase 8 で観測してから判断。本フェーズではバグ修正の副作用で偶発的な改善があっても積極的に追わない
- **English UI / privacy policy ページ追加**: Phase 7.5 の NOT Building と同じく、公開規模が固まってから判断
- **認証 / アカウント / 永続ストレージ機能**: PRD の Could スコープ。MVP 以後の判断
- **Firefox / WebKit を機械的に追加**: 手動 QA でブラウザ依存バグが出た場合のみ前倒し。出なければ Phase 8 dogfood 後に判断（Phase 7.5 Decisions Log の継承）
- **CI auto-deploy 経路の整備**: Phase 7.5 Decisions Log で「手動 `wrangler deploy` + Pages Git 連携」を確定済。本フェーズは触らない

---

## Step-by-Step Tasks

### Phase A — Track A 実機オペの完了確認

#### Task A1: 本番 API URL の `/health` 200 確認
- **ACTION**: `curl https://snap-share-api.<account>.workers.dev/health` で 200 OK を確認
- **IMPLEMENT**: shell コマンド実行のみ。コード変更なし
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` の A6-3 / A8-1
- **GOTCHA**: account ID は `08046c7a95a245c21e26fe834b553dac`（runbook 0-2 で記録済）。URL がうまく返らない場合は `cd apps/api && pnpm wrangler deployments list` で最新デプロイの確認
- **VALIDATE**: HTTP 200 + JSON body `{ ok: true, service: 'snap-share-api', ts: <number> }`

#### Task A2: 本番 Web URL の TLS / CSP / HSTS 確認
- **ACTION**: ブラウザで `https://snap-share.pages.dev` を開き、DevTools Network タブで `Document` の Response Headers を確認
- **IMPLEMENT**: ブラウザ手動確認
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A7-1 のヘッダ確認項目
- **VALIDATE**: `Content-Security-Policy: default-src 'self'; ...` / `Strict-Transport-Security: max-age=31536000; includeSubDomains` / `X-Content-Type-Options: nosniff` / `X-Frame-Options: DENY` 全て確認

#### Task A3: Pages Build env の確認
- **ACTION**: Cloudflare ダッシュボード → Pages → snap-share → Settings → Environment variables で `VITE_API_URL` / `VITE_API_WS_URL` / `VITE_TURNSTILE_SITE_KEY` / `VITE_CF_ANALYTICS_TOKEN` / `VITE_PUBLIC_URL` の 5 変数が production / preview 両方に投入されていることを確認
- **IMPLEMENT**: ダッシュボード手動確認
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A5
- **GOTCHA**: 変数追加後は **再 build しないと反映されない**。Pages Deployments → 最新 → Retry deployment で再ビルドする

#### Task A4: Turnstile Allowed hostnames の確認
- **ACTION**: Cloudflare ダッシュボード → Turnstile → snap-share widget → Settings → Hostname management で `snap-share.pages.dev` が含まれることを確認
- **IMPLEMENT**: ダッシュボード手動確認 + `pnpm wrangler tail snap-share-api --search "turnstile verify"` を実行しながら本番でルーム作成 → `verify success` のみ流れることを確認
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A9
- **GOTCHA**: Allowed hostnames に漏れがあると本番だけで siteverify 常時失敗する。`turnstile verify failed { codes: [...] }` が流れたら 1. に戻って追加

### Phase B — 網羅的な手動 QA（探索的テスト）

#### Task B1: A7-1（通常ルーム経路）を 1 サイクル踏み切る
- **ACTION**: 本番 URL で D&D / paste / クリア / 差し替え / 注釈 4 種 / Undo/Redo / 共有 URL / 別ブラウザ参加 / リアルタイム同期 / awareness / PNG エクスポートを順次踏む
- **IMPLEMENT**: `docs/.tmp/cloudflare-runbook.md` A7-1 のチェック項目 + `reports/phase-7.6-*.md` に新規作成する手動 QA チェック表に基づく
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A7-1
- **GOTCHA**: 既知-1〜3 のような明確なバグ以外にも「なんか動きが鈍い」「2 回目だけ反応しない」レベルの違和感も全て issue 起票
- **VALIDATE**: 検出バグはすべて GitHub issue として起票（`gh issue create`）。issue タイトルに `[phase-7.6]` プレフィクス + 再現手順 + 期待挙動 / 実挙動を含める

#### Task B2: A7-2（パスワード保護経路）を 1 サイクル踏み切る
- **ACTION**: ランディング → password チェック → 入力 → D&D → /r/:id → 別ブラウザでゲート → 誤答 → 正答
- **IMPLEMENT**: 既知-2 がこの経路で発覚しているため、issue 化して修正後に再走
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A7-2
- **GOTCHA**: 既知-2 修正 PR の前と後で 2 回踏む（fix 検証）

#### Task B3: A7-3（PNG エクスポート 4 組み合わせ）
- **ACTION**: 公開ルーム × 送信側 / 公開ルーム × 受信側 / パスワード保護 × 送信側 / パスワード保護 × 受信側 の 4 組み合わせで PNG エクスポートを踏む
- **IMPLEMENT**: 既知-1 は「公開ルーム × 受信側」で発覚。残り 3 組み合わせも踏み切ることで cross-origin か protected か anonymous か authenticated か の axis を切り分ける
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A7-3
- **GOTCHA**: 「保存された PNG を開いて元画像 + 注釈の焼き込みまで確認」が完了条件

#### Task B4: デバイス × OS マトリクス
- **ACTION**: 上記 B1 / B2 / B3 を Chrome / Safari / Firefox（デスクトップ）+ iOS Safari / Android Chrome（モバイル）+ タブレット（iPad / Android）の 6 環境で踏む
- **IMPLEMENT**: マトリクス表を `reports/phase-7.6-*.md` に作成。各セルに ✅ / ❌ / `issue #N` を記入
- **MIRROR**: PRD `## Implementation Phases` の Phase 7.6 Scope B
- **GOTCHA**: 物理端末がない場合は Chrome DevTools の Device emulation で代替（ただし「iOS Safari に固有な canvas 動作」など真の OS 依存バグは見逃す可能性 — その場合は Phase 8 で BrowserStack 等を検討する旨を report に記録）

#### Task B5: 観測項目の確認（A8 / A9）
- **ACTION**: B1〜B4 と並行して `pnpm wrangler tail snap-share-api --format=pretty` を流し、`[api] room created` / `[api] auth failed/success` / `[api] rate limit hit` / `[api] turnstile verify success/failed` 系のログが期待通り流れることを確認。Web Analytics でも 24h 後に PV / Top Referrers / Country / Device が反映されていることを確認
- **IMPLEMENT**: ターミナル + ダッシュボード手動確認
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A8
- **GOTCHA**: Web Analytics は 10 分〜1 時間の遅延あり

### Phase C — バグ全件 hotfix（既知 3 件 + 網羅 QA 検出分）

#### Task C1: 既知-1 の修正（tainted canvas / cross-origin PNG export）
- **ACTION**: `apps/web/src/components/canvas/ImageLayer.tsx` の `useImage(src)` を `useImage(src, 'anonymous')` に変更。commit `2e2d533` の差分をそのまま再適用
- **IMPLEMENT**:
  ```diff
  - const [image] = useImage(src);
  + // 'anonymous' marks the underlying <img> as a CORS-enabled fetch so the
  + // cross-origin image served by the API (Pages → Workers in production)
  + // does not taint the canvas and break PNG export via toBlob().
  + const [image] = useImage(src, 'anonymous');
  ```
- **MIRROR**: REACT_COMPONENT_TEST_STRUCTURE のテストパターン
- **IMPORTS**: 変更不要（`useImage` は既に import 済）
- **GOTCHA**: API 側の CORS allowlist が `*.snap-share.pages.dev` を吸収していることが前提（`apps/api/wrangler.toml:90` で確定済）。Pages の per-commit preview URL も対応する。**fork して別 Pages プロジェクトに deploy するユーザーは `CORS_ALLOWED_ORIGINS` を fork 側の `<project>.pages.dev` に書き換える必要がある** — README に注意書き追加を検討
- **VALIDATE**:
  1. unit test（C2）が緑
  2. 本番再デプロイ後の手動 QA（B3）で「公開ルーム × 受信側 PNG エクスポート」が成功

#### Task C2: 既知-1 の unit test 再投入
- **ACTION**: `apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` を新規作成。commit `2e2d533` の test ファイルをそのまま再現
- **IMPLEMENT**: `git show 2e2d533 -- apps/web/src/components/canvas/__tests__/ImageLayer.test.tsx` から復元
- **MIRROR**: REACT_COMPONENT_TEST_STRUCTURE
- **IMPORTS**: `act` from 'react' / `createRoot, type Root` from 'react-dom/client' / `vi` from 'vitest' / `useImage` from 'use-image'
- **GOTCHA**: `react-konva` を vi.mock しないと happy-dom で canvas backend がなくレンダリング失敗する
- **VALIDATE**: `pnpm -F @snap-share/web test -- src/components/canvas/__tests__/ImageLayer.test.tsx` が緑

#### Task C3: 既知-1 の API 側 CORS header 検証 spec 追加
- **ACTION**: `apps/api/src/__tests__/images.test.ts` に「`GET /rooms/:id/image` に `Origin: https://snap-share.pages.dev` ヘッダを付けて呼ぶと、レスポンスに `Access-Control-Allow-Origin: https://snap-share.pages.dev` + `Vary: Origin` が含まれる」spec を追加
- **IMPLEMENT**: `app.fetch(new Request('http://x/rooms/<id>/image', { headers: { Origin: '...' } }), env)` で叩く
- **MIRROR**: API_TEST_STRUCTURE
- **IMPORTS**: 既存 `app` / `buildEnv` / `vitest` のみ
- **GOTCHA**: `buildEnv()` の default `CORS_ALLOWED_ORIGINS` は `'https://snap-share.pages.dev,*.snap-share.pages.dev'`。テスト内で fixture room を 1 つ作ってから image fetch を叩く順序にする
- **VALIDATE**: `pnpm -F @snap-share/api test` が緑

#### Task C4: 既知-1 の E2E spec 追加（受信側 cross-origin PNG export）
- **ACTION**: `apps/web/e2e/room-export-receiver.spec.ts` を新規作成
- **IMPLEMENT**:
  - localhost ↔ localhost は same-origin なので、本来の cross-origin 経路を再現するには「web を `127.0.0.1:5173` で、api を `localhost:8787` で起動して Origin 違いを発生させる」「または `BrowserContext.route` で API レスポンスを別 origin に書き換える」のいずれか
  - 簡易な実装: `page.route` で API レスポンスに `Access-Control-Allow-Origin: <baseURL>` を付与しつつ、画像 binary を返す。これで `crossOrigin='anonymous'` 経路のみを検証
  - フル実装: `playwright.config.ts` の `webServer` で web を `127.0.0.1` で起動するよう変更し、API は `localhost` のままにすることで真に cross-origin な経路を作る
- **MIRROR**: E2E_SPEC_STRUCTURE
- **IMPORTS**: `expect, test` / `dropImage` from `./fixtures/upload`
- **GOTCHA**: PNG ダウンロード検証は `page.waitForEvent('download')` で取得 → `download.path()` で一時ファイル取得 → サイズが 0 でないことだけ確認（ピクセル一致は OS 依存で flaky）
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- -g "受信側"` が緑

#### Task C5: 既知-2 の原因切り分け
- **ACTION**: `pnpm dev` でローカル起動 → ランディング表示 → DevTools で password panel の DOM tree を確認
- **IMPLEMENT**: 観点:
  1. 要素は DOM にレンダリングされているか（`source === null` 条件は満たすか）
  2. `display: none` / `visibility: hidden` / `opacity: 0` になっていないか
  3. toolbar header の bounding box と panel の bounding box が重なっていないか（`getBoundingClientRect`）
  4. stacking context の親（`isolate` / `transform` / `position` 等）でどちらが上か
- **MIRROR**: HEADER_LAYOUT_AND_Z_INDEX
- **GOTCHA**: shadcn `<Checkbox>` は内部で Radix の Portal を使うことがあるが、本リポジトリ採用の `Checkbox` は inline rendering（`apps/web/src/components/ui/checkbox.tsx` 参照）— Portal は使っていないはず
- **VALIDATE**: 原因を特定して `reports/phase-7.6-*.md` の bug 表に書き出す

#### Task C6: 既知-2 の修正
- **ACTION**: C5 の原因に応じた最小修正
- **IMPLEMENT** 候補:
  - **(a) z-index 上げ**: `LocalEditor.tsx:79` の `z-10` を `z-20` に変更（panel を toolbar より上に）
  - **(b) panel 配置変更**: `top-4` を `top-16` に変更し、toolbar の下に配置
  - **(c) toolbar 構造変更**: `EditorShell.tsx:188` の header に `inset-x-0` を `right-0` 等に絞り、left side を panel に明け渡す
- **MIRROR**: CSS_TOKEN_USAGE
- **GOTCHA**: `room-protected.spec.ts:17-22` がキーボード経路でテストされているため、修正後はそのまま緑のはず。ただし「クリック経路でも反応する」を保証するには C7 の新 spec が必要
- **VALIDATE**: ローカルで「password チェック → input 出現 → 入力 → D&D」がマウス操作だけで完走

#### Task C7: 既知-2 の E2E spec 追加
- **ACTION**: `apps/web/e2e/landing-password-toggle.spec.ts` を新規作成
- **IMPLEMENT**:
  ```typescript
  test('画像未ロード時に password 保護パネルが見えてクリックできる', async ({ page }) => {
    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: /パスワードで保護する/ });
    await expect(checkbox).toBeVisible();
    await checkbox.click(); // ← keyboard 迂回ではなく直接 click
    await expect(page.getByLabel('ルームのパスワード')).toBeVisible();
  });
  ```
- **MIRROR**: E2E_SPEC_STRUCTURE
- **GOTCHA**: 既存 `room-protected.spec.ts` は `focus + Space` 経路。本 spec は **意図的に直接 click** することで pointer-events 通過を担保する
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- -g "password 保護パネル"` が緑

#### Task C8: 既知-3 の挙動方針確定（オーナー判断）
- **ACTION**: 以下 3 案からオーナーが (a) / (b) / (c) を選ぶ
  - **(a) ラベルを実挙動に合わせる**: 「画像をクリア」→「注釈をすべて削除」、`ImageMinus` → `Trash2`。最小差分。Toolbar 上の役割が「削除」が 2 つ並ぶことになるため、`Delete`（選択中の 1 個削除）と「注釈をすべて削除」のラベル区別を明示
  - **(b) 実挙動をラベルに合わせる**: クリアで画像も消えてランディングへ戻る。RoomEditor で `setRoomIdInUrl(null)` 相当の動きをして root path に push、room を抜ける
  - **(c) 別ボタンに分割**: 「画像をクリア」（=ランディングへ戻る） + 「注釈をすべて削除」を別ボタン化。UX 最も誠実だが UI 面積増
- **IMPLEMENT**: Plan 段階の推奨は (a)。理由は「最小差分 / MVP の方針 / Toolbar の UI 面積維持」
- **MIRROR**: なし
- **GOTCHA**: (b) を選ぶと R2 上の画像オブジェクトは TTL 任せで残る（即時削除 API は無い）。dogfood 中に「クリアしたつもりがアクセスログに残る」ことを許容するかオーナーに確認
- **VALIDATE**: 確定案を `reports/phase-7.6-*.md` の Decisions セクションに記録

#### Task C9: 既知-3 の修正（C8 の確定案を実装）
- **ACTION**: 確定案に応じた修正
- **IMPLEMENT**:
  - **(a) の場合**: `Toolbar.tsx:118-125` の `label`「画像をクリア」→「注釈をすべて削除」、`icon: ImageMinus` → `Trash2`。`ConfirmClearAllDialog.tsx` のタイトルは現状維持（既に「注釈をすべて削除」と一致している）
  - **(b) の場合**: `RoomEditor.tsx:113-116` の `handleConfirmClear` で `store.reset()` の後に `window.history.pushState(null, '', '/')` + `onRoomIdChange(null)` 相当の処理（onRoomIdChange は親 App から伝播必要）
- **MIRROR**: NAMING_CONVENTION
- **GOTCHA**: (b) の場合は `RoomEditor` が `roomId` を props で受け取るのみで親に通知する経路が無い → `onLeave?: () => void` props を追加して `App.tsx` が `setRoomId(null)` を渡す
- **VALIDATE**:
  - (a): toolbar に「注釈をすべて削除」と表示され、クリックで dialog → 確定で注釈消去 / 画像残存
  - (b): クリックで dialog → 確定で landing 表示 / URL が `/` に戻る

#### Task C10: 既知-3 の E2E spec 追加
- **ACTION**: `apps/web/e2e/room-clear-image.spec.ts` を新規作成
- **IMPLEMENT** (a の場合):
  ```typescript
  test('注釈削除ボタンで注釈は消えるが画像は残る', async ({ page }) => {
    await page.goto('/');
    await dropImage(page);
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/);
    // 矩形を 1 つ追加
    await page.getByRole('button', { name: '矩形' }).click();
    // mousedown→mousemove→mouseup で 1 つ作る
    // ...
    await page.getByRole('button', { name: '注釈をすべて削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    // 画像はまだ表示されている（ツールバーのツールが enabled のまま）
    await expect(page.getByRole('button', { name: '矩形' })).toBeEnabled();
    // 注釈は 0 件
    const count = await page.evaluate(() =>
      (window as any).__SNAP_SHARE_ANNOTATIONS__?.length ?? 0,
    );
    expect(count).toBe(0);
  });
  ```
- **MIRROR**: E2E_SPEC_STRUCTURE / `room-share.spec.ts` の矩形描画パターン
- **VALIDATE**: `pnpm -F @snap-share/web test:e2e -- -g "注釈削除"` が緑

#### Task C11: 網羅 QA 検出バグの hotfix
- **ACTION**: B 章で起票した issue を 1 件ずつ「再現 spec → 修正 → 緑」の TDD で潰す
- **IMPLEMENT**: バグごとに別 task として進める。Severity が低く Phase 8 へ送る判断のものは `reports/phase-7.6-*.md` に「Phase 8 へ送る理由」を明記
- **MIRROR**: 該当バグの領域に応じて適切な MIRROR を選択
- **VALIDATE**: 全 issue が close もしくは Phase 8 ラベル付き

### Phase D — E2E 強化（CI Linux で永続的にロック）

#### Task D1: room-mobile の Linux snapshot 整備
- **ACTION**: CI Linux 上で snapshot を 1 度 update して commit
- **IMPLEMENT**:
  1. ローカルで `apps/web/e2e/room-mobile.spec.ts:14-17` の `process.platform !== 'darwin'` skip を一時的にコメントアウト
  2. CI を 1 度走らせて `room-mobile` が「snapshot missing」で fail する
  3. failure artifact から Linux snapshot を取得 OR CI 上で `pnpm -F @snap-share/web test:e2e -- --update-snapshots --project=mobile-chrome` を一時的に実行する PR を作成
  4. 生成された `landing-mobile-mobile-chrome-linux.png` を commit
  5. `apps/web/e2e/room-mobile.spec.ts` の platform skip を削除し、`maxDiffPixelRatio: 0.02` で OS 差を吸収
- **MIRROR**: Phase 7.5 で確立された snapshot 戦略
- **GOTCHA**: GitHub Actions の Linux runner（ubuntu-latest）と `actions/setup-node@v4` + `pnpm/action-setup@v4` の組み合わせで snapshot がブレないか要確認。1 回目の生成後に「次回 run でぶれる」場合は `maxDiffPixelRatio` を 0.05 まで緩める判断
- **VALIDATE**: CI Linux で `room-mobile` spec が skip されずに緑

#### Task D2: Firefox / WebKit プロジェクト追加判断
- **ACTION**: B4（デバイス × OS マトリクス）の結果を見て、Firefox / WebKit 専用バグが出ていれば前倒しで Playwright project を追加。出ていなければ判断据え置き
- **IMPLEMENT**: 追加する場合は `apps/web/playwright.config.ts:projects` に以下を追記:
  ```typescript
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ```
  + CI workflow `.github/workflows/ci.yml:50` の `playwright install --with-deps chromium` を `chromium firefox webkit` に拡張
- **MIRROR**: `apps/web/playwright.config.ts:25-28`
- **GOTCHA**: WebKit は Linux runner で playwright バンドル提供のため動くが、CI 実行時間が伸びる（chromium の 2〜3 倍）。chromium 専用 spec（`test.skip(testInfo.project.name !== 'chromium')`）が複数あるため、追加プロジェクトでは大半 skip → 増分時間は限定的のはず
- **VALIDATE**: CI で全プロジェクトが緑（skip 判定 + 実行 spec 全て）

### Phase E — 検収ゲート

#### Task E1: 本番再デプロイ
- **ACTION**: `cd apps/api && pnpm wrangler deploy` で API を再デプロイ。Pages は main マージで自動 build
- **IMPLEMENT**: シェルコマンド + Pages Deployments の build status 確認
- **MIRROR**: `docs/.tmp/cloudflare-runbook.md` A6
- **GOTCHA**: deploy 直後の 10〜30 秒は CDN propagation 待ち。本番 URL を即叩くと古いバンドルが返る可能性

#### Task E2: 本番 URL での手動 QA 再走（clean run）
- **ACTION**: B 章のチェック表を最初から最後まで踏み直し、新たなバグが出ないことを確認
- **IMPLEMENT**: チェック表を 2 周目で全 ✅ になることを確認
- **MIRROR**: B 章
- **VALIDATE**: 検出バグが 0 件で 1 サイクル踏める状態

#### Task E3: CI E2E が緑
- **ACTION**: PR 上で CI が緑になることを確認
- **IMPLEMENT**: GitHub Actions の `Lint / Typecheck / Test / Build` + `Playwright E2E` 両方が緑
- **VALIDATE**: 全 spec / 全 project で pass

#### Task E4: `reports/phase-7.6-*.md` 作成
- **ACTION**: `.claude/PRPs/reports/phase-7.6-manual-qa-bug-recovery-report.md` を作成
- **IMPLEMENT**: 既存 `reports/phase-7.5-production-provisioning-report.md` の構造を踏襲。セクション:
  - Summary（実施したこと / 結果）
  - Assessment vs Reality（Plan 比 / 検出バグ件数 / E2E 件数）
  - Tasks Completed（A〜E の各 task の完了状況）
  - Files Changed（Created / Updated）
  - Deviations from Plan
  - Issues Encountered
  - **手動 QA チェック表**: A7-1 / A7-2 / A7-3 / A8 / A9 全項目 × デバイス × OS マトリクス
  - **検出バグ表**: issue # / severity / fix commit / 対応 E2E spec / Phase 8 送り判断
  - **E2E カバレッジ差分**: before（5 spec）→ after（N spec）
  - Tests Written
  - Phase 8 dogfood Go/No-Go 判断
- **MIRROR**: `.claude/PRPs/reports/phase-7.5-production-provisioning-report.md`
- **VALIDATE**: 全セクションが埋まっていて、Phase 8 開始可否が明確に書かれている

#### Task E5: PRD のステータス更新
- **ACTION**: `.claude/PRPs/prds/snap-share.prd.md` の Phase 7.6 行を `pending` → `in-progress`（plan 作成時）→ `complete`（PR マージ時）に更新。PRP Plan / report 列にリンク追加
- **IMPLEMENT**: マークダウンの行編集
- **VALIDATE**: PRD の status 列と PRP Plan 列が一致

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `ImageLayer.test.tsx` — passes crossOrigin="anonymous" | `<ImageLayer src="https://api/.../image" />` レンダリング | `useImage` が `(src, 'anonymous')` で呼ばれる | NO（基本確認） |
| `images.test.ts` — CORS header | `GET /rooms/:id/image` with `Origin: https://snap-share.pages.dev` | response に `Access-Control-Allow-Origin: <origin>` + `Vary: Origin` | YES（cache 段の正しさ） |

### E2E Tests

| Test | Scenario | Assertion |
|---|---|---|
| `room-export-receiver.spec.ts` | 別 origin から画像取得 → PNG export | `page.waitForEvent('download')` で download 取得 |
| `landing-password-toggle.spec.ts` | password チェックボックスを直接 click | input が `toBeVisible` |
| `room-clear-image.spec.ts` | 「注釈をすべて削除」ボタン → 確認 → 注釈削除 | 注釈数 0 / 画像 enabled 維持（案 a の場合） |
| `room-mobile.spec.ts` (更新) | Pixel 5 viewport で landing screenshot | Linux + darwin の両方で snapshot 一致 |

### Edge Cases Checklist

- [ ] 画像差し替え（既存画像を表示中に新画像 D&D）
- [ ] 大画像（10MB 上限ギリギリ）でクラッシュしない
- [ ] SVG 画像（XSS 攻撃ベクター）のエクスポート挙動
- [ ] ブラウザバック → /r/:id に戻る → ルーム残存
- [ ] ネットワーク不安定下での再接続（DevTools Offline → Online）
- [ ] 同時 3 ユーザー以上のリアルタイム同期
- [ ] Awareness（カーソル / 選択）の出退室
- [ ] パスワード保護ルームの token 期限切れ → ゲート再表示
- [ ] iOS Safari の touch event 経路（特に注釈描画）
- [ ] CSP 違反による silent failure（DevTools Console を必ず確認）

---

## Validation Commands

### Static Analysis
```sh
pnpm typecheck
pnpm lint
```
EXPECT: ゼロエラー

### Unit / Integration Tests
```sh
pnpm test
# scope 限定:
pnpm -F @snap-share/web test -- src/components/canvas/__tests__/ImageLayer.test.tsx
pnpm -F @snap-share/api test -- src/__tests__/images.test.ts
```
EXPECT: 全テスト pass

### E2E
```sh
pnpm test:e2e
# scope 限定:
pnpm -F @snap-share/web test:e2e -- -g "受信側"
pnpm -F @snap-share/web test:e2e -- -g "password 保護パネル"
pnpm -F @snap-share/web test:e2e -- -g "注釈削除"
```
EXPECT: chromium + mobile-chrome の 2 project で全 spec 緑

### Build
```sh
pnpm build
```
EXPECT: vite build + wrangler --dry-run 緑

### 本番デプロイ
```sh
cd apps/api
pnpm wrangler deploy
# Pages は main マージで Git 連携 build が自動実行
```
EXPECT: API デプロイ成功 → `curl https://snap-share-api.<account>.workers.dev/health` が 200

### 本番手動 QA
- B1〜B5 の手動 QA チェック表を踏み切る
- 検出バグはすべて `gh issue create` で起票

### Phase 完了確認
- `.claude/PRPs/prds/snap-share.prd.md` の Phase 7.6 行が `complete` で `[plan]` / `[report]` リンクが揃う
- `gh issue list --label phase-7.6` がすべて closed もしくは「phase-8」ラベルへ移行済

---

## Acceptance Criteria

- [ ] Phase A の Track A 実機オペが全て完了確認済（A1〜A4）
- [ ] Phase B の手動 QA がデバイス × OS マトリクスで踏み切られ、検出バグが GitHub issue で全件起票
- [ ] Phase C の hotfix が全件 close（既知 3 件 + 網羅 QA 検出分）
- [ ] Phase D の E2E spec 追加が CI Linux で緑
- [ ] Phase D の room-mobile Linux snapshot が commit され、CI Linux で実行可能
- [ ] 本番再デプロイ後の手動 QA が clean run で全緑
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` 全緑
- [ ] CI（Lint / Typecheck / Test / Build + Playwright E2E）全緑
- [ ] `reports/phase-7.6-manual-qa-bug-recovery-report.md` が完成
- [ ] PRD の Phase 7.6 status が `complete`
- [ ] Phase 8 dogfood Go/No-Go が report に記載されている

## Completion Checklist

- [ ] 既知-1 fix（`useImage(src, 'anonymous')` 再投入）+ unit test + API CORS spec
- [ ] 既知-2 fix（password panel の z-index / 配置調整）+ E2E spec
- [ ] 既知-3 fix（オーナー確定案 a/b/c のいずれか）+ E2E spec
- [ ] 網羅 QA 検出バグの全件 hotfix（または明示的に Phase 8 送り）
- [ ] room-mobile Linux snapshot 整備
- [ ] Firefox / WebKit プロジェクト追加判断（前倒し or 据え置き）
- [ ] 本番再デプロイ + clean run
- [ ] phase-7.6 report 作成
- [ ] PRD ステータス更新
- [ ] 自己レビュー（`/everything-claude-code:code-review`）

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 既知-1 fix で API が ACAO を返さず逆に画像が読めなくなる | L | H | C3 spec で本番デプロイ前に確認。`apps/api/wrangler.toml:90` の `CORS_ALLOWED_ORIGINS` が allowlist に含むことを wrangler dev 経由 + 本番で 2 度確認 |
| 既知-2 の z-index 修正で別の visual regression が出る | M | M | `room-mobile.spec.ts` の screenshot 回帰で landing 画面の見た目変化を検知。明らかな悪化があれば修正案 (a)/(b)/(c) を切り替える |
| 既知-3 (b) を選んだ場合、room を抜けた後にユーザーが「戻る」で戻れず混乱 | M | M | (a) を default 推奨。(b) 採用時は `confirm dialog` の文言を「ルームから退出します。よろしいですか？」に強化 |
| 網羅 QA で発見されるバグが 5 件超 → Phase スコープ膨張 | M | H | severity が低いものは Phase 8 follow-up へ送る判断を許容。`reports/phase-7.6-*.md` で「送った理由」を明記して Phase 8 の Go 判断材料にする |
| Linux snapshot が CI runner の rendering 変動で flaky | M | M | `maxDiffPixelRatio` を `0.02` → `0.05` に緩める。それでも揺れるなら `room-mobile` を専用 nightly job に分離 |
| 本番手動 QA に物理デバイス（iOS / Android 実機）が用意できない | M | M | Chrome DevTools Device emulation で代替し、「真の OS 依存バグは Phase 8 で BrowserStack を検討」を report に記録 |
| Cloudflare ダッシュボード操作で詰まる（Pages の build env 変更で 反映されない等） | L | M | `docs/.tmp/cloudflare-runbook.md` の A3 / A5 に手順 + 「再 build しないと反映されない」注意あり。詰まったら runbook の `困ったときの参照先` 表へ |

## Notes

- **Plan は探索的 QA を前提にした「枠組み」設計**: 既知 3 件は task として明示しているが、網羅 QA で発見されるバグは事前に列挙できないため、「issue 起票 → severity 判定 → hotfix or Phase 8 送り」の流れだけ規定して数量は決めない。Confidence 6/10 はこの不確実性を反映。
- **Phase 7.5 で carry over された宿題はすべて本フェーズで回収**: report の `## Carry-over to Phase 7.6` セクションに記載された 5 項目（Track A 実機オペ / 網羅手動 QA / 既知 3 件 / E2E 強化 / クロージング条件）に 1:1 対応している。
- **既知-4 (E2E 拡充中に発見)**: `apps/web/e2e/dropzone-validation.spec.ts` で「不正形式 / 10MB 超」の drop を踏んだところ、validation エラーが永久に表示されない事象を発見。原因: `apps/web/src/pages/LocalEditor.tsx:56-65` の `handleLoad` が **validation 失敗時にも無条件で `turnstile.reset()` を呼ぶ** ため、Turnstile state が `pending` に戻り、`onLoadFile` が `undefined` 化、DropZone が「画像を読み込んでいます…」のローディング hint に置換される。Cloudflare Turnstile invisible widget は外部から `widget.reset()` を呼ばない限り auto re-fire しないため、ユーザーは無限に固まる。dropzone-validation.spec.ts は **既知-4 の現状挙動を CI で固定する** spec として書いた（修正されたら spec が落ちるので書き換え必要）。修正方針候補は spec ファイルのコメントに 3 案 (a/b/c) 列挙済。
- **オーナー判断が必要な item**:
  - 既知-3 の挙動方針（C8 で a/b/c から選ぶ）
  - Firefox / WebKit 追加（D2 で QA 結果次第）
  - 網羅 QA で見つかったバグの Phase 8 送り判断
- **「最小限を最小限に」の方針継続**: バグ修正以外の機能追加（CI auto-deploy / 永続ストレージ / 認証）は本フェーズで触らない。NOT Building 参照。
- **Phase 8 への明示的な引き渡し**: 検収ゲート E4 で作成する report に「Phase 8 dogfood Go/No-Go」セクションを設け、本フェーズ完了時点で残った issue / 設計 TODO / 観測 follow-up を網羅して、次回 `/everything-claude-code:prp-plan` 実行時に Phase 8 が立ち上がる準備を整える。
