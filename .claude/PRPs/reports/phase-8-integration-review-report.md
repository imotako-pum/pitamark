# Report: Phase 8 — 統合レビュー

**Date**: 2026-05-04
**Branch**: `feat/phase-8-integration-review`
**Scope**: 13 観点の横断レビュー (`reviews/phase-8-{triage,ssot,modernity,react,hono,band-aids,typesafety,extensibility,tests,a11y,perf,error-envelope,prp-hygiene,security}-review.md`)
**Decision (overall)**: **APPROVE-WITH-FOLLOWUPS** — Phase 9 dogfood は **Phase 8.x-1+2+3 完了後** に開始 (Conditional Go)

## TL;DR

snap-share MVP は Claude Code 主体で書かれた ~14k LOC のコードベースとして **構造的健全性が高い**: Zod 駆動の SSOT、discriminated union exhaustiveness、CLAUDE.md cross-cutting design rules 1〜8 への概ねの遵守、`as any` / `@ts-ignore` / TODO/FIXME/HACK ゼロ件、26 件の `biome-ignore` がすべて legitimate reason 付き。**人間の実装者が改修できる状態** には十分ある。

ただし「片務的 SSOT」(#1) — サーバ書き出し側だけが Zod 検証されており web 受信側は型アサート素通り — が **設計上の本質的弱点** として 5 観点に渡って flag されている (#1 H1 / #6 H1 / #6 L3 / #1 M1 / #6 M1)。加えて 2026 時点で **TypeScript 5.6 → 6.0 / lucide-react v0 → v1 の major 1 つ遅れ**、**bundle 283KB gz が 300KB 予算の 94.6%** で chunking ゼロ、**WebSocket JWT が URL query で wrangler tail に leak** する security HIGH 1 件。

合計 76 finding を **重複 merge して 73**、Severity 別: CRITICAL **0** / HIGH **7** / MEDIUM **21** / LOW **45** (HF=true **9** + HF=false **36**)。Phase 8.x で着手対象 = HIGH 7 + MEDIUM 21 + LOW HF=true 9 = **37 件**、推奨 PR 分割は **5 PR** (テーマ + Severity ハイブリッド)。

Phase 9 dogfood は **CRITICAL 0 のため緊急 No-Go ではない** が、**bundle (#10 H1)** と **JWT leak (#13 H1)** は dogfood 中に user 影響が出る順位で、Phase 8.x-2 (security) + Phase 8.x-3 (perf) を **Phase 9 開始前に必修** とする。SSOT 強化 (Phase 8.x-1) は Phase 9 中に並走可能だが推奨は前倒し。

---

## 件数サマリ (観点 × Severity)

| 観点 | CRITICAL | HIGH | MEDIUM | LOW (HF=true) | LOW (HF=false) | 計 (raw) | merge note |
|---|---|---|---|---|---|---|---|
| #1 SSOT | 0 | 1 | 2 | 0 | 3 | 6 | H1 master (web `as <Schema>`) |
| #2 modernity | 0 | 1 | 2 | 0 | 3 | 6 | |
| #3 React BP | 0 | 0 | 0 | 2 | 3 | 5 | L1, L3 = HF=true |
| #4 Hono BP | 0 | 0 | 2 | 1 | 1 | 4 | L1 = HF=true |
| #5 band-aids | 0 | 1 | 2 | 1 | 1 | 5 | L2 = HF=true (ToolButton inline OKLCH) |
| #6 typesafety | 0 | 2 | 3 | 1 | 2 | 8 | H1 = #1 H1 重複; L2 = HF=true; L3 = #1 M1 重複 |
| #7 extensibility | 0 | 0 | 1 | 1 | 3 | 5 | L3 = HF=true (CanvasStage draft) |
| #8 tests | 0 | 0 | 3 | 0 | 4 | 7 | |
| #9 a11y | 0 | 0 | 1 | 0 | 5 | 6 | |
| #10 perf | 0 | 1 | 3 | 0 | 3 | 7 | |
| #11 error envelope | 0 | 0 | 1 | 0 | 3 | 4 | M1 = #13 M1 重複 |
| #12 PRP hygiene | 0 | 0 | 1 | 0 | 5 | 6 | |
| #13 security | 0 | 2 | 1 | 1 | 2 | 6 | M1 master (#11 M1 cross-ref); L1 = HF=true |
| **合計 (raw)** | **0** | **8** | **22** | **7** | **38** | **75** | |
| **合計 (merge 後)** | **0** | **7** | **21** | **9** | **36** | **73** | #6 H1 → #1 H1 / #11 M1 → #13 M1 / #6 L3 → #1 M1 |

> HF=true 件数の補正: #3 L1+L3 (2) / #4 L1 (1) / #5 L2 (1) / #6 L2 (1) / #7 L3 (1) / #13 L1 (1) + 観点境界またぎで上昇したもの (#6 L3 → #1 M1 family) + 個別 review でフラグ化されていなかった LOW のうち統合段階で再判定して引き上げたもの 2 件 = 計 9 件 (詳細は LOW セクション参照)。

---

## CRITICAL 一覧

**該当なし** ✅

Phase 9 dogfood の即時 BLOCK 要因なし。

---

## HIGH 一覧 (Phase 9 開始前に Phase 8.x-1+2 で全件解消推奨)

### H1 (#1 SSOT / #6 H1 重複 master = #1): Web 側 API レスポンスが Zod parse なし

- **観点**: #1 SSOT (#6 H1 cross-reference)
- **Location**: `apps/web/src/lib/api-client.ts:65, 89, 117`
- **Issue**: `await res.json()` を `as RoomCreated` / `as RoomPublic` / `as { token: string }` で素通し。`packages/shared` の `RoomCreatedSchema` / `RoomPublicSchema` を **import すらしていない**。サーバの schema 違反 / 古い deployment / 中間 proxy 改竄が silent に UI 流入。`RoomCreated.refine` の `protected ↔ image` 排他制約も検証されない。
- **Fix scope**: ~50-100 LOC across 1 file (`api-client.ts`) + import 追加
- **担当 PR**: **8.x-1 (SSOT + typesafety)**

### H2 (#2 modernity): TypeScript 5.6.3 → 6.0.3 で major 1 つ遅れ

- **Location**: `pnpm-workspace.yaml:6`
- **Issue**: TS 6.0.3 が npm latest tag 配信中の stable major release。`noUncheckedIndexedAccess` 強化 / Variance 注釈 / decorators 標準化等の改善が入る一方、breaking changes も含む。
- **Fix scope**: workspace-wide upgrade、`pnpm typecheck` で出る新規エラーを修正
- **担当 PR**: **8.x-4 (modernity bumps)**、単独 PR で回帰時の切り戻しが楽
- **リスク**: TS 6 upgrade で型エラーが大量発生する可能性 — 段階的 (5.6 → 5.7 → 6.0) 経由も検討

### H3 (#5 band-aids): EditorShell の window globals 4 件に DEV ガード欠落

- **Location**: `apps/web/src/pages/EditorShell.tsx:244, 251, 257, 268`
- **Issue**: `(window as unknown as Record<string, unknown>).__SNAP_SHARE_*` を `useEffect` で **production bundle に常時 install**。`useYjsAnnotationsStore.ts:106` は同パターンで `import.meta.env.DEV` ガード済 → **非対称が明確**。`__SNAP_SHARE_TRANSFORM_ACTIONS__` は `fitToViewport` 等の関数を window 経由で外部から呼べる状態にする。
- **Fix scope**: 4 行 (`if (!import.meta.env.DEV) return;` を 4 useEffect の冒頭に追加) + production bundle で grep ゼロ確認
- **担当 PR**: **8.x-5 (quality cleanup)**

### H4 (#6 typesafety): `historyReducer.ts` の `as T` キャストが `noUncheckedIndexedAccess` を回避

- **Location**: `apps/web/src/hooks/historyReducer.ts:44, 55`
- **Issue**: undo/redo branch で長さチェック後に `array[n] as T` でコンパイラを欺く。将来 refactor でガード緩和すると型エラーが出ない。`!` non-null assertion + `biome-ignore` + 根拠コメントの方が誠実 (本リポジトリの password.ts 流の慣習)。
- **Fix scope**: 2 行 + コメント
- **担当 PR**: **8.x-1 (SSOT + typesafety)**

### H5 (#10 perf): 単一 bundle 283.82KB gz / 予算超過目前 + chunking ゼロ

- **Location**: `apps/web/vite.config.ts` (chunking 設定なし) / `apps/web/src/App.tsx` + `EditorPage.tsx` (`React.lazy()` ゼロ件)
- **Issue**: `pnpm -F @snap-share/web build` 実測で 918.65 kB raw / **283.82 kB gzip** = App page 予算 300 kB の **94.6%**。残余 16 kB のみ。Konva (~152 kB gz) と Yjs / y-websocket (room 専用) が local mode アクセス時でも全量同期ロード。Vite が `500 kB 超過` 警告出力。Decisions Log に「Phase 6 で dynamic import 必須タスク化」と明記されたまま Phase 8 まで未着手。
- **Fix scope**: `vite.config.ts` chunking 設定 + `RoomEditor` を `React.lazy()` boundary に + Konva の dynamic import = ~50-100 LOC
- **担当 PR**: **8.x-3 (bundle / perf)**
- **重要度**: dogfood で「LCP 遅い」と user 影響が出る最初の懸念点

### H6 (#13 security): WebSocket JWT が URL query param 経由で wrangler tail にログ漏洩

- **Location**: `apps/api/src/yjs.ts:90`
- **Issue**: ルームトークン (24h TTL の JWT) が `?token=JWT` として URL に含まれ、Cloudflare Workers のアクセスログ (`wrangler tail`) にフル URL ごと記録される。コード側で「Never log the token」と配慮されているが platform-level access log は別経路。JWT TTL が長いため奪取時の影響期間が大きい。
- **Fix scope**: 短命ワンタイムチケット発行エンドポイント追加 (~100-150 LOC across 2-3 files) または WebSocket subprotocol 経由で token を渡す方式
- **担当 PR**: **8.x-2 (security hardening)**
- **重要度**: dogfood で `wrangler tail` を操作監視に使う想定なら、ログから token を漏らさない措置が先

### H7 (#13 security): HSTS に `preload` ディレクティブ欠如

- **Location**: `apps/web/public/_headers:19`
- **Issue**: `web/security.md` ルールが `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` を要求。現状は `preload` なし。HSTS preload list 申請には preload 必須。
- **Fix scope**: 1 行追加
- **担当 PR**: **8.x-2 (security hardening)**

---

## MEDIUM 一覧 (Phase 8.x で全件解消推奨)

### #1 SSOT — 2 件
- **M1**: `authResponseSchema` が `packages/shared` ではなく `apps/api/src/routes/rooms.ts:40-42` 内ローカル定義 → 8.x-1
- **M2**: `tokens.css` の `--color-tool-rect/-arrow/-text/-highlight-yellow` が「activeColor 単一 SSOT」設計に取り残された stale token → 8.x-5

### #2 modernity — 2 件
- **M1**: lucide-react `^0.460` で v1 から major 1 つ遅れ → 8.x-4
- **M2**: `hono ^4.12` が catalog 外、apps/web + apps/api に直書き (cross-cutting rule 6 違反) → 8.x-4

### #4 Hono BP — 2 件
- **M1**: `syncRoute` (`apps/api/src/yjs.ts:73-133`) が `Hono` + `.use()` chain で Decisions Log policy 違反 → 8.x-5
- **M2**: `hc<AppType>` api オブジェクトが production で全く未使用 (`api-client.ts:18` で export されるが 3 ファイルで生 fetch) → 8.x-5 (削除 or 移行を judgement)

### #5 band-aids — 2 件
- **M1**: `logger.ts × 2` の biome-ignore-all コメントに stale Phase 番号 ("Phase 5+ で structured logger") → 8.x-5
- **M2**: `autoNextOffset.ts:5` / `autoArrowDefault.ts:4` の「Phase 5 で再評価する」が Phase 9 dogfood の意。Phase 番号混乱 → 8.x-5

### #6 typesafety — 3 件
- **M1**: `turnstile-service.ts` の `SiteverifyResponse` が Zod スキーマ外のローカル inline 型 → 8.x-1
- **M2**: `vite-env.d.ts` 不在 — `import.meta.env` を毎回 `as { ... }` でキャスト (3 箇所) → 8.x-1
- **M3**: `useYjsAnnotationsStore.ts` の `awareness as AwarenessLike | null` が structural 等価を型システムで検証しない → 8.x-1

### #7 extensibility — 1 件
- **M1**: 新規 annotation 種を追加するときの touch surface が 13 production + ~6 tests = 約 20 ファイル / 200-400 LOC drift。`yMapToAnnotation` の if-else exhaustiveness 抜け / `COMMITTING_ACTIONS` 平文 array / TOOL_KEY_MAP / TOOL_DEFS 手動同期 — 案 A+B+C 合計で 80-150 LOC 修正で「忘れたら気付かない場所」を 5 → 1 に削減 → 8.x-5

### #8 tests — 3 件
- **M1**: `@vitest/coverage-v8` 未インストールで 80% カバレッジ目標が計測不能 → 8.x-5
- **M2**: `annotation/set-font-size` non-text state identity テストが未追加 (Phase 7.8-3 review M1 の Suggested Fix で明示されたもの) → 8.x-5
- **M3**: `annotation-tools.spec.ts:163, 173` の `waitForTimeout(700)` が brittle (Y.UndoManager captureTimeout 分離のため)、deterministic 代替が必要 → 8.x-5

### #9 a11y — 1 件
- **M1**: `--muted-foreground = oklch(50% 0 0)` を `--color-surface = oklch(98% 0 0)` 上で本文用途 (HelpModal `DialogDescription`) に流用、contrast ratio ≈ 4.5:1 境界。OKLCH 値を 0.50 → 0.42 に下げる 1 行修正で AAA 達成 → 8.x-5

### #10 perf — 3 件
- **M1**: Konva が local mode でも全量ロード (room-only な dependency が landing でも load される) → 8.x-3
- **M2**: `useStageSize` と `EditorShell` が別々に `window.addEventListener('resize', ...)` 登録 → 8.x-3
- **M3**: `useStageSize` が viewport 全体サイズを返すが Konva Stage の実際の描画域と乖離、将来 layout 拡張で CLS リスク → 8.x-3

### #11 error envelope — 1 件 (= #13 M1)
- **M1 (= #13 M1)**: `assertValidTtlMs` の publicMessage が `ROOM_TTL_MS` をクライアントに露出 (`room-service.ts:81`) → 8.x-2 (security 主観点で扱う)

### #12 PRP hygiene — 1 件
- **M1**: umbrella report 必須化 policy 未確定 (Phase 7.7 / 7.8 で抜け) → 8.x-5 (CLAUDE.md or `.claude/rules/common/development-workflow.md` 更新で対応、retroactive 作成しない)

### #13 security — 1 件 (= #11 M1)
- **M1**: 上記 #11 M1 の master (security info leak 角度から)

---

## LOW (Human Friction = true) — 9 件 (Phase 8.x 候補)

| # | Finding | 観点 | Location | 着手 PR |
|---|---|---|---|---|
| 1 | DropZone の `onFile` が `useEffect` deps に入り呼び出し元の useCallback 有無に依存 | #3 L1 | `DropZone.tsx:16-25` | 8.x-5 |
| 2 | RoomGate の `async` event handler が floating promise | #3 L3 | `RoomGate.tsx:32-46` | 8.x-5 |
| 3 | `idParamSchema` が `rooms.ts` と `images.ts` で重複定義 | #4 L1 | `rooms.ts:21` / `images.ts:11` | 8.x-5 |
| 4 | ToolButton `danger` tone が `--destructive` を迂回して inline OKLCH | #5 L2 | `ToolButton.tsx:21` | 8.x-5 |
| 5 | `presence-context.ts` の awareness フィールド raw cast | #6 L2 | `presence-context.ts` | 8.x-1 |
| 6 | `CanvasStage` の `tool === 'text'` 特殊分岐 + buildDraft<X> 文字列分岐が 3 箇所散在 | #7 L3 | `CanvasStage.tsx:229-298` | 8.x-5 (M1 と同 PR) |
| 7 | (再判定) `RoomGate.handleSubmit` の floating promise + Toaster `aria-live` 不在で error が SR に届かない | #3 L3 + #9 L1 cross | RoomGate + Toaster | 8.x-5 |
| 8 | (再判定) Konva color hex ↔ tokens.css OKLCH の sync テスト不在 | #1 L3 | `colors.ts` ↔ `tokens.css` | 8.x-5 |
| 9 | CSP `unsafe-inline` (script-src + style-src) が常時有効で nonce 移行の障壁 | #13 L1 | `_headers` | 8.x-2 (設計変更要) |

---

## LOW (Human Friction = false) — 36 件 (Backlog)

Phase 8.x では着手せず、Phase 9 dogfood 後に再判断。代表的なもの:

- **#1**: COLOR_REGEX 重複 / Room=RoomStored alias / OKLCH↔hex sync テスト
- **#2**: Biome version sync / TS target ES2023 / catalog pin policy
- **#3**: useStageTransform deps / React 19 useDeferredValue 活用 / useStateRef 多用
- **#4**: buildRoomService 名前衝突
- **#5**: DropZone inline OKLCH (token 体系統一の一部)
- **#6**: yjs-mutations as number / api-client as { token: string } (= M1 family)
- **#7**: API endpoint boilerplate / Yjs migration prep / TOOLS = [select, ...]
- **#8**: missing unit tests (useAnnotationsStore / TextShape) / Firefox/WebKit / mobile snapshot
- **#9**: Toaster aria-live / DropZone role=alert nest / reduced-motion / HelpModal section order
- **#10**: LCP measurement / TurnstileWidget polling / setSelectedId throttle
- **#11**: CLAUDE.md envelope codes 未記載 / auth 二重ログ / test ErrorBody local def
- **#12**: subphase review 抜け / frozen archive / dogfood-checklist 命名
- **#13**: connect-src 過広 / ROOM_TOKEN_SECRET min length runtime check

---

## Phase 8.x 推奨着手順 (PR 分割の暫定提案)

> 1 Phase = 1 ブランチ = 1 PR の memory ルールに従い、各 PR を独立した branch + 個別 plan で進める

### Phase 8.x-1: SSOT + typesafety 強化 (HIGH 2 + MEDIUM 4 + LOW 2)
- **Theme**: API 境界の Zod parse 完全化、片務的 SSOT の解消
- **Findings**: H1 (#1) / H4 (#6) / #1 M1 / #6 M1+M2+M3 / #6 L2 / #1 L3
- **想定差分**: ~300-500 LOC across ~10 files (`api-client.ts` / `presence-context.ts` / `vite-env.d.ts` 新規 / `historyReducer.ts` / `packages/shared/src/room.ts` / `colors.ts` test 追加)
- **担当 agent**: typescript-reviewer 連動 with TDD (Plan で安全網)
- **ブランチ**: `fix/phase-8-x-1-ssot-typesafety`
- **想定 PR タイトル**: `fix(phase-8.x): API 境界の Zod parse 完全化 + 片務的 SSOT 解消 + historyReducer 安全網`

### Phase 8.x-2: Security hardening (HIGH 2 + MEDIUM 1 + LOW 1)
- **Theme**: WebSocket JWT leak 防止、HSTS preload、env var 名漏洩の解消
- **Findings**: H6 (#13 H1) / H7 (#13 H2) / #13 M1 (= #11 M1) / #13 L1 (CSP unsafe-inline 設計変更)
- **想定差分**: ~150-300 LOC across ~5-7 files (`apps/api/src/yjs.ts` ticket 化 + 関連 routes + `_headers` + `room-service.ts` + ある場合は web 側の認可 token 取得 path)
- **担当 agent**: security-reviewer 連動
- **ブランチ**: `fix/phase-8-x-2-security`
- **想定 PR タイトル**: `fix(phase-8.x): WebSocket JWT leak 防止 + HSTS preload + ROOM_TTL_MS 内部名漏洩 + CSP nonce 化`
- **Phase 9 開始前必修** ✅

### Phase 8.x-3: Bundle + perf optimization (HIGH 1 + MEDIUM 3 + LOW 0)
- **Theme**: chunking + lazy loading で 283KB gz から余裕を取り戻す
- **Findings**: H5 (#10) / #10 M1+M2+M3
- **想定差分**: ~150-300 LOC、主に `vite.config.ts` chunking + `RoomEditor.tsx` を `React.lazy()` boundary に + Konva の dynamic import
- **担当 agent**: performance-optimizer 連動
- **ブランチ**: `fix/phase-8-x-3-bundle-perf`
- **想定 PR タイトル**: `fix(phase-8.x): bundle chunking + lazy boundary で 283KB gz → 200KB gz 目標`
- **Phase 9 開始前必修** ✅ (LCP 遅延が dogfood の一次判断材料を曇らせる)

### Phase 8.x-4: Modernity bumps (HIGH 1 + MEDIUM 2 + LOW 3)
- **Theme**: TS 6 / lucide-react v1 / hono catalog 化
- **Findings**: H2 (#2) / #2 M1+M2 / #2 L1+L2+L3
- **想定差分**: workspace-level lockfile 更新 + 各 type 修正、TS 6 で出る新規型エラー対応で読めない
- **担当 agent**: typescript-reviewer + (TS 6 breaking changes 確認のため Context7)
- **ブランチ**: `chore/phase-8-x-4-modernity`
- **想定 PR タイトル**: `chore(phase-8.x): TypeScript 6 + lucide-react v1 + hono catalog 化`
- **リスク**: TS 6 で型エラー大量発生の可能性 → 段階 upgrade (5.7 経由) も検討
- **Phase 9 開始判断**: 並走可。dogfood 中に TS 6 upgrade を進めても良い

### Phase 8.x-5: Quality cleanup (HIGH 1 + MEDIUM 9 + LOW 6)
- **Theme**: band-aids 解消、a11y polish、tests 補強、extensibility friction reduction、PRP workflow 改善
- **Findings**: H3 (#5) / #5 M1+M2 / #1 M2 / #4 M1+M2 / #7 M1 / #8 M1+M2+M3 / #9 M1 / #12 M1 / #11 L1 / #11 L2 / #5 L1+L2 (HF=true) / #3 L1+L3 (HF=true) / #4 L1 (HF=true) / #7 L3 (HF=true)
- **想定差分**: ~600-1000 LOC + tests + CLAUDE.md 更新
- **担当 agent**: code-reviewer + a11y-architect (M1 contrast) 連動
- **ブランチ**: `chore/phase-8-x-5-quality-cleanup`
- **想定 PR タイトル**: `chore(phase-8.x): band-aids/tests/a11y/extensibility/PRP-workflow の網羅的整理`
- **重要度**: 中。Phase 9 中に並走可、ただし HF=true 8 件は dogfood 体験に直結するため早期推奨
- **大きい PR になる場合は Phase 8.x-5a / 8.x-5b に再分割可**

---

## Phase 9 dogfood Go/No-Go 判断

### Go condition (本 review 確定時の合意)

- **CRITICAL = 0**: 必修条件 ✅ **達成**
- **HIGH = 0** (Phase 8.x-1+2+3 完了後): 推奨条件 — **Phase 8.x-2 + 8.x-3 が完了すれば実質 Go**
- **MEDIUM = 0** (Phase 8.x-1+2+3+5 完了後): 推奨条件 (より厳格)
- LOW HF=true は Phase 8.x で着手するが Phase 9 着手の blocker ではない

### 判断結果: **Conditional Go**

**Phase 9 dogfood を「即座に開始」することは可能だが、推奨しない**:
- CRITICAL 0 のため緊急 BLOCK 要因なし
- ただし bundle 283KB / JWT URL leak は dogfood 中に user 影響が出やすい
- dogfood の本来目的は「仮説検証」(snap-share PRD: 「オーナーが日常的に使える」「月 3 回利用」) であり、コード品質課題が dogfood ノイズになると判断材料が曇る

### 推奨マイルストーン

```
Phase 8 完了 (本 PR マージ)
   ↓
Phase 8.x-2 (security) — 1-2 日 ← Phase 9 開始前必修
   ↓
Phase 8.x-3 (perf) — 1-2 日 ← Phase 9 開始前必修
   ↓
Phase 9 開始
   ↓
Phase 9 中に Phase 8.x-1 (SSOT/typesafety) を並走
   ↓
Phase 9 中に Phase 8.x-5 (cleanup) を並走 (HF=true 8 件 → backlog 残)
   ↓
Phase 8.x-4 (modernity bumps) は Phase 9 後でも可 (回帰リスク管理優先)
```

### No-Go の場合の解除条件

(Phase 9 を Phase 8.x-2 + 8.x-3 完了前に開始しないという意味で:)
- Phase 8.x-2 (security) merge & deploy
- Phase 8.x-3 (perf) merge、bundle gz 250KB 以下を CI で計測
- 上記 2 条件達成で Phase 9 dogfood 開始可能

---

## 観点間の重複・矛盾の merge 記録

| Master | Slave (cross-ref) | 理由 |
|---|---|---|
| #1 H1 (web side `as <Schema>`) | #6 H1 (api-client `as RoomCreated/RoomPublic`) | 同一 root cause、SSOT 角度を master に。`api-client.ts:65, 89` の specific lines は #6 で flag、broader narrative は #1 |
| #1 M1 (`authResponseSchema` SSOT 配置) | #6 L3 (`as { token: string }` Zod 外) | 同じ問題の異角度。`AuthResponseSchema` を `packages/shared` に追加すれば両方解消 |
| #13 M1 (ROOM_TTL_MS leak — security) | #11 M1 (envelope 内部情報露出) | Cross-referenced explicitly by #13 review。security 角度で master、envelope 角度で参照 |

矛盾はなし — 観点境界マップに従って各 review が自観点に集中していたため、conflict なし。

---

## Open Items (Phase 8.x にも Phase 9 にも送らない)

- **#3 L4** (React 19 `useDeferredValue` 活用機会): 性能ボトルネックが顕在化していない現時点では機会指摘のみ。Phase 9 dogfood で actual perf data を取って判断
- **#7 L2** (Yjs migration prep): Y.Doc 永続化 Phase が来るときに別 Plan で扱う、Phase 8.x スコープ外
- **#13 L1 を超えた CSP nonce 全面移行**: 設計レベル変更で Phase 8.x 単独 PR で扱うには重い。Phase 8.x-2 で `unsafe-inline` 明示文書化 + nonce 化検討は別 Phase に切り出し

---

## Resolution Update

(Phase 8.x 各 PR でこのセクションに「どの finding が close されたか」を追記)

---

## 引き渡し

このレポートを根拠に、オーナーは:

1. **`/everything-claude-code:prp-plan phase-8-x-2-security`** で security hardening Plan を生成 (Phase 9 開始前必修)
2. **`/everything-claude-code:prp-plan phase-8-x-3-bundle-perf`** で perf optimization Plan を生成 (Phase 9 開始前必修)
3. **8.x-2 + 8.x-3 merge 後、Phase 9 dogfood 開始可**
4. **8.x-1 / 8.x-5 / 8.x-4** は Phase 9 中に並走または完了後

各 Phase 8.x の Plan は本 report の「Phase 8.x 推奨着手順」セクションを起点として `/prp-plan` で詳細化される。

---
*Generated: 2026-05-04*
*Source reviews*: 14 ファイル in `.claude/PRPs/reviews/phase-8-{triage,ssot,modernity,react,hono,band-aids,typesafety,extensibility,tests,a11y,perf,error-envelope,prp-hygiene,security}-review.md`
*Reviewer (umbrella)*: Claude Opus 4.7 (1M context)
