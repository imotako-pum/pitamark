# Local Code Review: Phase 8 — Triage 先行 pass

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: 静的シグナルの raw collection + categorize、観点境界マップ確定、Human Friction 3 軸スコア運用定義
**Decision**: APPROVE
  - Triage は finding 検出フェーズではないため Decision = APPROVE 固定
  - 後続 8.B 13 観点 deep review の前提整備

## Summary

`snap-share` リポジトリ全体の静的シグナルを scan し、Phase 8.B deep review に必要な 3 つの前提を確定した:

1. **Signal categorization**: 「raw 447 件」と概算していた yellow markers の内訳精査
   - `as <Type>` 363 件 → 自然言語混入の偽陽性 ~120 件を除くと **真の TS キャスト ~240 件**
   - そのうち `as const` 13 / `as unknown` 58 / `as <UserType>` ~170
   - production code の `as <UserType>` は **e2e + __tests__ を除くと ~50 件**
   - **deep review 対象 (= #6 typesafety で扱う)**: production の review-worthy `as <UserType>` ~30-50 件 + `as unknown` production 5 件
   - `biome-ignore` 26 件は **全て legitimate reason 付き** (24/26 が `noNonNullAssertion` with bounded-data 系の根拠、残り 2 が `useSemanticElements` for `role="group"`、1 が `noControlCharactersInRegex` for deliberate ASCII stripping)。**観点 #5 band-aids では文面 sanity check のみ、深掘りは不要**
2. **観点境界マップ**: 13 観点間のオーバーラップ領域を明文化、各 hot file がどの観点で deep review されるかを確定
3. **Human Friction 3 軸スコア**: LOW finding に対する「改修時必読 / 再発生コスト / 認知負荷増」の判定 rule を運用化

これにより 8.B 各 review が **重複なく、判定ブレなく** 進められる前提が整った。なお triage 段階で **stale comment 1 件** (`logger.ts` の "Phase 5+ で structured logger に置き換える" の事前合意 → Phase 5 通過済) を発見、観点 #5 band-aids にエスクロー。

## Findings

Triage は finding 検出フェーズではないため、ここには finding を記載しない。後続 8.B 各観点 review に振り分ける。

### CRITICAL
None.

### HIGH
None.

### MEDIUM
None.

### LOW
None.

---

## Signal Categorization

### `as <Type>` 全体 (raw: 363 hits)

raw 363 件の内訳を「自然言語混入 (偽陽性)」「safe TS パターン」「review-worthy」「deliberate boundary」「未確定」の 5 カテゴリに分離:

| Pattern | Count (raw) | Category | Phase 8.B 担当観点 |
|---|---|---|---|
| `as is` | 70 | **偽陽性** (English in JSDoc / strings, e.g., `// use as is for raw bytes`) | (excluded) |
| `as a` | 45 | **偽陽性** (English) | (excluded) |
| `as the` | 6 | **偽陽性** (English) | (excluded) |
| `as React` | 5 | **偽陽性** (`import * as React`) | (excluded) |
| `as warn` / `as Sonner` / `as TooltipPrimitive` etc. | ~6 | **偽陽性** (`import * as <ns>`) | (excluded) |
| `as Record` | 42 | **deliberate** (大半が E2E `window as unknown as Record<string, unknown>`、production も window globals 5 件) | (#6 typesafety で 5 件 sanity check) |
| `as Y` | 25 | **deliberate** (Yjs Map / Array の typed boundary cast) | #1 SSOT + #6 typesafety で boundary 妥当性確認 |
| `as ErrorBody` | 25 | **review-worthy** (API client error response narrowing) | #6 typesafety + #11 error envelope |
| `as const` | 13 | **safe** (型 narrowing) | (excluded) |
| `as RectangleAnnotation` / `as TextAnnotation` / `as HighlightAnnotation` / `as ArrowAnnotation` | 22 | **review-worthy** (discriminated union narrowing) | #6 typesafety + #1 SSOT (exhaustive switch との整合) |
| `as PublicRoom` / `as RoomCreated` / `as RoomPublic` / `as room` | 13 | **review-worthy** (Zod parse 経由でなく直接キャスト?) | #6 typesafety + #1 SSOT |
| `as CapturedProps` | 6 | **deliberate** (test 専用 prop capture) | (#8 tests でテスト code 品質) |
| `as Bindings` | 5 | **deliberate** (Hono `c.env` の型注入) | #4 Hono BP |
| `as KVNamespace` / `as KonvaRect` / `as KonvaArrow` / `as ImportMetaEnv` | 11 | **deliberate** (型推論ギャップ補填) | #6 typesafety で sanity check |
| `as TokenPayload` / `as SiteverifyResponse` | 2 | **review-worthy** (API response narrowing) | #6 typesafety + #11 |
| `as AnnotationSnapshot` | 3 | **deliberate** (history snapshot) | #1 SSOT + #6 typesafety |
| `as <Builtin DOM/lib>` (`as Element`, `as never`, `as Partial`, `as ReadonlyArray`, etc.) | ~30 | **safe** (TS/DOM 型推論ギャップ) | (excluded) |
| `as number` / `as string` | 11 | **未確定** (生プリミティブ casting は要 case-by-case) | #6 typesafety |
| `as T` (generic) | 2 | **deliberate** (generic 関数の型橋渡し) | #6 typesafety で sanity check |
| `as readonly` | 2 | **safe** (readonly tuple assertion) | (excluded) |

**真の review-worthy `as <UserType>` 累計**:
- production code (excluding e2e + __tests__): **~30-50 件** (`as ErrorBody` のうち non-E2E + `as <Annotation>` + `as <Room>` + `as TokenPayload` + `as SiteverifyResponse` + `as number` / `as string`)
- これが **#6 typesafety review の主戦場**。1 件ずつ「Zod parse で代替可能か」「discriminated union narrowing は正しいか」「不要な assertion か」を判定

### `as unknown` (raw: 58 hits)

raw 58 件中:
- **E2E (`apps/web/e2e/`): 41 件** — すべて `window as unknown as Record<string, ...>` 系の **deliberate な test hatch** (Playwright が production code 内の window globals を inspect する用途)
- **__tests__ + lib test: 12 件** — test 用 type assertion、deliberate
- **Production (non-test): 5 件**:
  - `apps/web/src/hooks/useYjsAnnotationsStore.ts:108` — `window as unknown as { __SNAP_SHARE_ANNOTATIONS__?: ReadonlyArray<Annotation> }` → E2E 観察用 hatch、deliberate
  - `apps/web/src/pages/EditorShell.tsx:244, 251, 257, 268` — `(window as unknown as Record<string, unknown>).__SNAP_SHARE_*` → 同上、E2E 観察用 hatch 4 件

| Category | Count | 担当観点 |
|---|---|---|
| E2E test hatch (deliberate) | 41 + 4 + 1 = 46 | (excluded — test instrumentation) |
| __tests__ unit test boundary | 12 | (excluded — test code) |

**結論**: `as unknown` 58 件は **すべて deliberate**。後続 deep review でも追加 finding は基本出ない見込みだが、production code 5 件の **「test hatch 自体が #5 band-aids に該当しないか」** だけ #5 で sanity check (production code に E2E inspection globals を installing するパターンの是非)。

### `biome-ignore` (raw: 26 hits)

| File | Count | Lint Rule | Reason 付与 | Category |
|---|---|---|---|---|
| `apps/api/src/lib/password.ts` | 8 | `noNonNullAssertion` | ✅ 全件 (`bounded loop` / `rem === N` / `index bounded by a.length`) | **deliberate / 数学的根拠** |
| `apps/web/e2e/fixtures/upload.ts` | 5 | `noNonNullAssertion` | ✅ 全件 (`hardcoded tuple` / `index in [0,255] always defined`) | **deliberate / E2E fixture** |
| `apps/web/src/lib/__tests__/colorCycle.test.ts` | 4 | `noNonNullAssertion` | ✅ 全件 (`palette has fixed length > 1` / 2) | **deliberate / test** |
| `apps/web/src/lib/colorCycle.ts` | 2 | `noNonNullAssertion` | ✅ 全件 (`COLOR_PALETTE.length > 0 で next は必ず有効` / `同上`) | **deliberate / 数学的根拠** |
| `apps/web/src/components/toolbar/ColorPalette.tsx` | 1 | `useSemanticElements` | ✅ (`fieldset would inherit unwanted form semantics; role="group" + aria-label cleanly groups`) | **deliberate / a11y 設計判断** |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | 1 | `useSemanticElements` | ✅ (`ColorPalette と同じく role="group" でグルーピング`) | **deliberate / a11y 設計判断** |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | 1 | `noNonNullAssertion` | ✅ (`palette has fixed length > 0`) | **deliberate / test** |
| `apps/api/src/services/room-service.ts:141` | 1 | `noNonNullAssertion` | ✅ (`isProtectingPassword narrows`) | **deliberate / 制御フロー narrowing** |
| `apps/web/src/lib/logger.ts:1` | 1 | `noConsole` (file-level) | ⚠️ (`replace with a structured logger in Phase 5+`) | **stale comment** (Phase 5 を過ぎている) |
| `apps/api/src/lib/logger.ts:1` | 1 | `noConsole` (file-level) | ⚠️ (`replace with structured logger in Phase 5+`) | **stale comment** (同上) |
| `apps/api/src/lib/error.ts:48` | 1 | `noControlCharactersInRegex` | ✅ (`deliberate stripping of ASCII control bytes`) | **deliberate** |

**結論**: 26/26 すべて reason 付き、24 件は完全に legitimate。**残る 2 件は「stale comment」型の band-aid 候補** で観点 #5 にエスクロー (実害なし、ただし Plan の意思決定 ledger としては "Phase 5+ → 当面据え置き" にアップデートすべき)。

---

## 観点境界マップ

13 観点間のオーバーラップ領域を明文化。各トピックは「主観点」で deep review し、「副次観点」では re-flag せず参照のみとする。

| Topic | 主観点 | 副次的に拾う観点 | 観点境界の引き方 |
|---|---|---|---|
| `packages/shared` Zod スキーマ設計 | **#1 SSOT** | #6 typesafety, #7 拡張性 | 型と Schema の対応 / `z.infer` 駆動 / API 境界の `parse` は #1 主観点。`z.infer` 後の **キャスト** は #6 |
| Yjs ドキュメント管理 (`yjs-mutations.ts`, `useYjsAnnotationsStore.ts`) | **#1 SSOT** | #3 React, #6 typesafety, #7 拡張性 | LWW 戦略 / `LOCAL_ORIGIN` 対称性 / Y.Doc ↔ Annotation array 同期 = #1 主観点。hooks 規律 = #3、`as Y` = #6 |
| AnnotationSchema discriminated union 拡張 | **#7 拡張性** | #1 SSOT, #6 typesafety | 「新 annotation 種を追加するときの触る箇所一覧」が #7 主観点。Zod schema 設計は #1、exhaustiveness `const _: never = a` は #6 |
| エラー envelope (`{ ok, error: { code, message } }`) | **#11 error envelope** | #4 Hono, #13 security | レスポンス形式 / コード体系 / message の統一は #11 主観点。Hono middleware 経由配線は #4、message 内情報漏洩は #13 |
| Hono middleware 配線 (`createRoute({ middleware })`) | **#4 Hono BP** | #11 error envelope, #13 security | `.use()` chain vs `createRoute` の policy 遵守は #4 主観点。エラー伝搬は #11、認可は #13 |
| `hc<AppType>` 型推論 | **#4 Hono BP** | #1 SSOT, #6 typesafety | RPC 型推論が壊れていないかは #4 主観点。Schema 駆動性は #1、response narrowing は #6 |
| ColorPalette / FontSizeControl / Toolbar | **#3 React BP** | #9 a11y, #1 SSOT | hooks 規律 / 状態管理 / `useState` vs `useRef` は #3 主観点。`role="group"` + `aria-label` の妥当性は #9、`activeColor` SSOT は #1 |
| `EditorShell.tsx` (542 LOC) の構造 | **#3 React BP** | #1 SSOT, #5 band-aids, #7 拡張性 | hooks 規律 / dispatch flow / handlers は #3 主観点。State 設計は #1、巨大化要因は #7、コメント rot や stale 部分は #5 |
| `CanvasStage.tsx` (537 LOC) の構造 | **#3 React BP** | #6 typesafety, #10 perf | Konva 連携 hooks / refs / event handler は #3 主観点。Konva 型キャスト (`as KonvaRect` 等) は #6、render 頻度は #10 |
| `useKeyboardShortcuts.ts` (168 LOC) | **#3 React BP** | #9 a11y | 状態管理 / event listener は #3 主観点。a11y 観点 (キー bindings の発見可能性 / focus order) は #9 |
| Konva ↔ DOM 連携 (`<KonvaImage listening={false} />`) | **#3 React BP** | (CLAUDE.md design rule 5 を遵守確認) | CLAUDE.md design rule 5 (`listening={false}` 必須) を deep review check |
| Bundle 構成 / dynamic import | **#10 perf** | #3 React, #2 modernity | `lazy()` / `Suspense` / chunking は #10 主観点。React idiom は #3、library 選定は #2 |
| CSP / HSTS / Headers | **#13 security** | #2 modernity (CF 仕様鮮度) | `_headers` / Worker response headers は #13 主観点 |
| Turnstile / Rate Limit / 入力検証 | **#13 security** | #4 Hono, #11 error envelope | spam 対策三層 / Zod 入力 validation は #13 主観点。Hono middleware 順序は #4、エラーで内部情報を漏らさないかは #11 |
| パスワードハッシュ (`apps/api/src/lib/password.ts`) | **#13 security** | #5 band-aids | Argon2 vs PBKDF2 政策 / iteration count は #13 主観点。8 件の `biome-ignore` 妥当性は #5 (triage で legitimate 確認済) |
| R2 / KV / DO の binding と権限境界 | **#13 security** | #4 Hono | wrangler.toml の binding 定義と最小権限は #13 主観点。Hono `c.env` 経由アクセスは #4 |
| API client (`apps/web/src/lib/api-client.ts`) | **#4 Hono BP** | #6 typesafety, #11 error envelope | `hc<AppType>` 型推論維持は #4 主観点。`as ErrorBody` 25 件の処理は #6、envelope 解釈は #11 |
| logger.ts の structured logger 移行 (stale Phase 5+ comment) | **#5 band-aids** | #11 error envelope | comment rot は #5 主観点。本気で structured logger を入れるかは #11 で議論 |
| `apps/web/e2e/*` (Playwright spec) | **#8 tests** | #3 React (test instrumentation hatch), #9 a11y | E2E カバレッジ / golden path は #8 主観点。production code に test hatch を installing するパターンは #3 で band-aid 観点で評価、a11y test は #9 |
| `apps/web/src/components/canvas/*__tests__*` | **#8 tests** | #3 React | unit test 設計は #8 主観点 |
| Konva color hex sync (`colors.ts` ↔ `tokens.css`) | **#1 SSOT** | (CLAUDE.md design rule 4 を遵守確認) | CLAUDE.md design rule 4 (Konva は CSS variable 解決不可、hex 同期必須) を deep review check |
| catalog version pin の鮮度 (TypeScript / React / Konva / Yjs / Hono / Vitest / Biome) | **#2 modernity** | #4 Hono (zod-openapi 鮮度) | catalog 主体の version 政策は #2 主観点。idiom 規律は #3 / #4 |
| Biome 2.2 (root) vs 2.4.13 (Decisions Log) 不一致 | **#2 modernity** | #5 band-aids | version pin 不一致は #2 主観点。設定 lock の document rot は #5 |
| サブフェーズの review 抜け (7.7-1/-2/-3, 7.8-5) | **#12 PRP hygiene** | (frozen archive 扱い) | process miss として #12 で記録、retroactive review は作成しない |
| 命名揺れ (`local-review-phase-*`, `phase-7.6-partial-implementation-review`) | **#12 PRP hygiene** | (frozen archive 扱い) | 触らない方針で記録のみ |
| umbrella report 不在 (7.7, 7.8) | **#12 PRP hygiene** | - | 「pattern として umbrella を必須化するか」を #12 で議論 |
| Phase 8.0 で実施した PRD desync fix | **#12 PRP hygiene** | - | 修正済 (commits `9748246` `1012c29` `96f5f66`) として記録 |

### 観点境界の使い方

各 deep review で **finding を発見した時の振り分けルール**:

1. その finding がどの観点に主に属すかを上の表で確認
2. 主観点でなければ「副次観点に該当するが当 review では取り上げない、副次観点側で観察対象として記録のみ」と明記
3. **重複 flag は禁止** — 主観点で finding を出し、副次観点では参照のみ
4. 観点境界に明記がないトピックを deep review 中に発見したら、Plan を amend して境界マップに追記してから進める (急ぎなら `Open Items` セクションに先送り)

---

## Human Friction 3 軸スコア運用定義

LOW finding **にのみ** 適用 (CRITICAL / HIGH / MEDIUM はどのみち Phase 8.x で着手するのでフラグ不要)。

### 3 軸の定義と境界例

#### 軸 1: 改修時必読 (yes / no)

「その finding が出ている箇所のコードを、関連機能を改修するときに **必ず読むか?**」

- **yes** 例:
  - 中核ファイル: `EditorShell.tsx`, `CanvasStage.tsx`, `rooms.ts`, `room-service.ts`, `useAnnotationsStore.ts`, `useYjsAnnotationsStore.ts`, `annotationsReducer.ts`, `historyReducer.ts`, `yjs-mutations.ts`, `api-client.ts`
  - SSOT スキーマ周辺: `packages/shared/src/index.ts`, AnnotationSchema 関連
  - エラー envelope 中心: `apps/api/src/lib/error.ts`
  - ホットな共通モジュール: `colors.ts`, `tokens.css`, `colorCycle.ts`, `useKeyboardShortcuts.ts`
- **no** 例:
  - E2E fixture: `apps/web/e2e/fixtures/*`
  - test helper: `apps/api/src/__tests__/helpers/*`
  - archive 扱いの module: 一度書いたら基本触らない (例: `apps/web/src/components/ui/*` の shadcn 自動生成)
  - 静的設定ファイル: `*.config.ts` の boilerplate 部分

#### 軸 2: 再発生コスト (high / med / low)

「同じパターンが将来再発するとき、どのくらいの修正/リワークが必要か?」

- **high**: 設計レベルの直し / 複数ファイルに波及 / API 境界を変える / Schema を変える / migrate が必要
- **med**: 1 ファイル内の局所修正 / 関連 test の更新 / リファクタ時に同時に直せば足りる
- **low**: cosmetic / エディタ内置換 1 回 / 対象箇所が固定 / 自動 lint で潰せる

#### 軸 3: 認知負荷増 (yes / no)

「その finding を残したまま改修すると、人間の実装者が『なぜこうなっているのか』を理解するのに時間がかかるか?」

- **yes** 例:
  - 不要な `as unknown` キャスト (なぜここで boundary が必要なのか文脈を読まないと分からない)
  - 命名揺れ (同じ概念に複数の名前)
  - コメントなしの workaround
  - 過度の抽象化 (使い回さないのに hook / utility を分離している)
  - inline literal が複数箇所に重複 (定数化されていない)
- **no** 例:
  - 標準パターンの軽微な逸脱
  - 数値リテラルの定数化漏れだが、文脈から自明
  - import 順の乱れ
  - 末尾改行の有無

### 判定 rule

3 軸のうち **2 つ以上が "yes/high"** なら `Human Friction = true`、そうでなければ `false`。

| 3 軸の組合せ | yes/no count | Human Friction |
|---|---|---|
| 改修時必読=yes / 再発生コスト=high / 認知負荷=yes | 3 | **true** |
| 改修時必読=yes / 再発生コスト=med / 認知負荷=yes | 2 | **true** |
| 改修時必読=yes / 再発生コスト=high / 認知負荷=no | 2 | **true** |
| 改修時必読=no / 再発生コスト=high / 認知負荷=yes | 2 | **true** |
| 改修時必読=yes / 再発生コスト=low / 認知負荷=no | 1 | **false** |
| 改修時必読=no / 再発生コスト=med / 認知負荷=no | 0 | **false** |
| 改修時必読=no / 再発生コスト=low / 認知負荷=yes | 1 | **false** |

### 各 review file 内での記述形式

LOW finding に対して以下を必ず付与:

```markdown
- **Human Friction**: true / false
  - 改修時必読: yes / no — [簡潔な根拠]
  - 再発生コスト: high / med / low — [簡潔な根拠]
  - 認知負荷増: yes / no — [簡潔な根拠]
```

`true` のみ Phase 8.x で着手、`false` は backlog (Phase 9 dogfood 後に再判断)。

---

## 8.A の deviations from plan

| # | What changed | Why |
|---|---|---|
| 1 | `.claude/.tmp/` への raw signal materialize を **省略** | summary が直接 review file (本ファイル) に乗れば audit trail として十分。intermediate file は `.gitignore` 配慮も含め overhead。Plan の意図 (raw → categorize → review file) は維持、中間 step を merge |
| 2 | `as <Type>` 363 件のうち **~120 件が自然言語の偽陽性** と判明 | grep の正規表現が natural language ("as is" / "as a" / "as the") を拾っていた。triage で除外、真の TS キャスト = ~240 件に下方修正 |
| 3 | `biome-ignore` 26 件中 **24 件が完全 legitimate**、残り 2 件 (`logger.ts` の "Phase 5+" コメント) を **観点 #5 band-aids にエスクロー** | Plan は「無理由 / 弱い理由」を要 review としていたが、reason 付与の慣習が機能している。stale comment は "弱い理由" ではなく「時系列上 outdated」型なので #5 が適切 |

---

## Open Items (Plan 実行中に発生、後続観点に振り分け)

| Item | 振り分け先 |
|---|---|
| logger.ts の "Phase 5+ で structured logger" コメントが stale になっている件 (web + api 両方) | **#5 band-aids review** で 1 finding として記録 |
| EditorShell.tsx の window globals (4 箇所) と useYjsAnnotationsStore.ts の 1 箇所 = 計 5 箇所の **production code に E2E test hatch を installing するパターン** | **#3 React BP review** + **#5 band-aids review** で評価。test hatch は production を汚染するので Plan で扱う方針を確定すべき |
| `apps/web/src/components/ui/*` の shadcn 自動生成コードを review 対象に含めるか | **#3 React BP review** の冒頭で方針確定 (推奨: shadcn 自動生成は触らない方針なので review 対象外) |

---

## 後続 8.B への引き継ぎ

| 観点 | 想定 finding 件数の上限 (triage 後) | 主戦場ファイル |
|---|---|---|
| #1 SSOT | 5-10 | `packages/shared/src/index.ts`, `useYjsAnnotationsStore.ts`, `yjs-mutations.ts`, `colors.ts` ↔ `tokens.css` |
| #2 modernity | 3-7 | `pnpm-workspace.yaml` (catalog), `tsconfig.base.json`, `biome.json`, root `package.json` |
| #3 React BP | 10-20 | `EditorShell.tsx` (542), `CanvasStage.tsx` (537), `RoomEditor.tsx`, `LocalEditor.tsx`, `useKeyboardShortcuts.ts` (168), `Toolbar.tsx`, `ColorPalette.tsx`, `FontSizeControl.tsx`, `HelpModal.tsx`, `DropZone.tsx`, `RoomGate.tsx` |
| #4 Hono BP | 5-10 | `apps/api/src/routes/rooms.ts` (249), `apps/api/src/index.ts`, `apps/api/src/middleware/*`, `apps/api/src/lib/zod-openapi-helpers.ts`, `apps/web/src/lib/api-client.ts` (171) |
| #5 band-aids | 3-5 | logger.ts × 2, test hatch in EditorShell.tsx, commit history 確認 |
| #6 typesafety | 30-50 candidates → fix list | `as ErrorBody` 25 件 / `as <Annotation>` 22 件 / `as <Room>` 13 件 / `as TokenPayload` / `as SiteverifyResponse` 等 |
| #7 拡張性 | 3-7 | `packages/shared/src/index.ts` (AnnotationSchema), `annotationsReducer.ts` (161), `AnnotationLayer.tsx`, `yjs-mutations.ts` (152), `apps/api/src/routes/rooms.ts` |
| #8 tests | 5-10 | `apps/web/e2e/*` 全, `__tests__/*` 全, coverage 計測 |
| #9 a11y | 5-10 | `HelpModal.tsx`, `Toolbar.tsx`, `ColorPalette.tsx`, `FontSizeControl.tsx`, `RoomGate.tsx`, `useKeyboardShortcuts.ts`, styles |
| #10 bundle・perf | 3-7 | `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, Konva / Yjs / lucide-react import 粒度 |
| #11 error envelope | 3-7 | `apps/api/src/lib/error.ts`, all routes / services error paths, `apps/web/src/lib/api-client.ts` |
| #12 PRP hygiene | 3-5 | `.claude/PRPs/` 全 (process 観察) |
| #13 security | 5-10 | `apps/web/_headers`, `apps/api/src/middleware/*`, `apps/api/wrangler.toml`, `apps/api/src/lib/password.ts`, `apps/api/src/storage/*` |
| **合計上限** | **~85-150** | (これが 8.C で merge 後の最終 finding 数の見込み) |

このうち **CRITICAL / HIGH は経験則上 5% 以下 = 5-10 件**、**MEDIUM は 20% = 17-30 件**、**LOW = 60-80 件** と予想される。LOW のうち Human Friction = true は経験則上 30-50%、つまり **Phase 8.x 候補は 30-50 件、3-5 PR で消化** の見込み。

---

## Resolution Update

(Triage は finding 検出ではないため空)
