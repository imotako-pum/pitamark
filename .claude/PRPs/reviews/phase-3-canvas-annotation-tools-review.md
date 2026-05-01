# Code Review: Phase 3 — キャンバス & 注釈ツール

**Reviewed**: 2026-04-30
**Branch**: `feat/phase-3-canvas-annotation-tools` → `main`
**Scope**: branch diff (41 files, +4,095 / -8 lines)
**Decision**: **APPROVE with comments**（CRITICAL / HIGH 0 件、MEDIUM 2 件、LOW 2 件）

## Summary

Phase 3 の Konva キャンバス + 4 種注釈ツール実装は、プラン通りの SSOT (Zod discriminated union) と Phase 4 移行を見据えた pure functions + thin hook の構造で十分に整っている。security / correctness / pattern compliance すべて問題なし。指摘は「設計上残しただけで現状未使用な API が 2 箇所ある」のみ。Phase 4 で意味を持つ可能性があるが、明示せずに残すと dead code 扱いになるため、コメント追加 or 削除のいずれかを推奨。

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

#### 1. `AnnotationsStore.replace` API が未使用（dead code 扱い）

- **Location**: `apps/web/src/hooks/useAnnotationsStore.ts:16, 39-47, 58`
- **Issue**: `replace: (action: AnnotationsAction) => void` を export しているが、`apps/web/src/components/canvas/CanvasStage.tsx` / `apps/web/src/pages/EditorPage.tsx` どこからも呼ばれていない。プランでは「ドラッグ中の中間更新（commit せず）」用に用意した想定だが、実装では draft annotation を `CanvasStage.tsx:79` の `useState<Annotation|null>` でローカル管理する設計に切り替えたため、`replace` 経路が不要になった。
- **Risk**: dead code は将来の reader を混乱させる + maintenance cost。
- **Suggested fix**:
  - **A) 削除する** — `AnnotationsStore` 型から `replace` を外し、useAnnotationsStore の return から消す。
  - **B) 残すならコメントで意図を明示** — 「Phase 4 で Yjs observe 経由の中間 sync に使う予定」など。

#### 2. `annotationsReducer` の `state/replace` action が現実装では未使用

- **Location**: `apps/web/src/hooks/annotationsReducer.ts:31, 81-82` + 対応テスト `annotationsReducer.test.ts:131-145`
- **Issue**: プラン Task 11 の GOTCHA に「`state/replace` action で `useHistory.undo/redo` の結果を反映」と書かれているが、現実装では `useHistory` 内部の `useReducer` が React state を直接保持し、`history.state.present` を `useAnnotationsStore.state` として直接 return しているので、`state/replace` を外から dispatch する経路がない。テストはあるが production code path で hit しない。
- **Risk**: Issue #1 と同根。リーダーが「いつ呼ばれるんだろう？」と探して時間を浪費する可能性。
- **Suggested fix**:
  - **A) 削除する** — Action union から外し、reducer の case と対応テストを削除。プラン記述との乖離は report の Deviations セクションに既に記載済（reducer 構造の見直し）。
  - **B) 残すなら**: コメントで「Phase 4 で外部システム（Yjs / WebSocket）からスナップショット流入を受ける際に再利用」と明示。

### LOW

#### 1. `EditorPage` の useCallback deps `[store]` が実質効いていない

- **Location**: `apps/web/src/pages/EditorPage.tsx:39-44, 46-53, 55-63, 73-84, 86-91, 93-97`
- **Issue**: `useAnnotationsStore` の return オブジェクトが毎レンダ新規生成されるため、`useCallback(..., [store])` の deps は毎回異なる参照。React の warning は出ないが意味的には不要。
- **Risk**: ほぼなし。`useKeyboardShortcuts` が内部で `useRef` を使い最新 callback を保持するので、callback 不安定の影響は出ない（プラン Task 12 GOTCHA の選択肢どおり）。
- **Suggested fix**: optional。`useAnnotationsStore` の return を `useMemo` で wrap すれば本来の `useCallback` 効果が得られるが、現状の挙動に問題はない。

#### 2. `TextShape` の選択枠が文字数 × 近似比率で算出されている

- **Location**: `apps/web/src/components/canvas/shapes/TextShape.tsx:17-21, 38-39`
- **Issue**: 選択枠の幅は `visibleChars * fontSize * 0.6` の近似で、実際の Konva.Text のレンダ幅と数 px ズレる可能性。コードコメントで「Konva.Text#getClientRect でちゃんとした矩形を計算するまでの近似」と既に明記されている。
- **Risk**: 視覚的な微差のみ、機能・テストには影響なし。
- **Suggested fix**: Phase 6 の Should スコープで `getClientRect()` を使った正確な計算に置き換え（既にコメントで言及済）。

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check | ✅ Pass | turbo run typecheck (shared/api/web) 全ゼロエラー |
| Lint (biome) | ✅ Pass | 80 files, 0 errors |
| Tests (unit) | ✅ Pass | shared 45 + web 70 = **115 tests passing** |
| Build (vite) | ✅ Pass | gz 177.91 KB（プラン許容 150-200 KB 範囲内） |
| E2E (playwright) | ✅ Pass | chromium 4/4 |

## Security Audit

| Vector | Status | Notes |
|---|---|---|
| Hardcoded secrets | ✅ None | grep for `api_key|password|token|secret` clean |
| SQL injection | N/A | このフェーズで DB 操作なし |
| XSS | ✅ Safe | TextAnnotation は Konva canvas 上にレンダ（HTML escape 不要）。textarea overlay も `defaultValue` 属性経由 |
| Path traversal | N/A | fs / file system 操作なし |
| File upload | ✅ Safe | `validateImageFile` で MIME 4 種 + 10MB 上限。SVG は `<img>` 経由でロードされるので script 実行されない（browser の SVG-as-image 制約） |
| Resource leak | ✅ Safe | ObjectURL は `useRef` + `useEffect` cleanup でペア管理。再ロード時も revoke 済 |
| Console exposure | ✅ Safe | logger.ts のみで `console.*` 使用、`biome-ignore-all` 適用済 |

## Pattern Compliance

| Rule | Status |
|---|---|
| Immutability (.claude/rules/typescript/coding-style.md) | ✅ All operations use spread/map/filter, never mutate |
| Type safety (no `any`) | ✅ `grep ":\s*any"` clean、unknown narrow + Zod 境界検証のみ |
| Naming (camelCase / PascalCase / kebab-case) | ✅ 全ファイル準拠 |
| File size (<800 lines) | ✅ 最大 264 行 (operations.test.ts) |
| Function size (<50 lines) | ✅ 最大 ~40 行 (CanvasStage の handleMouseDown) |
| Nesting (<4 levels) | ✅ 最大 3 段 |
| AAA test pattern | ✅ vitest tests follow describe/it + Arrange/Act/Assert |
| Zod SSOT | ✅ packages/shared に discriminated union 集約 |
| Konva CSS変数の非解釈 | ✅ colors.ts に hex 集約 (Task 16 GOTCHA 遵守) |
| `e.cancelBubble = true` | ✅ 各 shape の onClick で実装 |
| INPUT/TEXTAREA ガード | ✅ useKeyboardShortcuts で実装 |

## Files Reviewed

### Source (28 added, 3 modified)

- packages/shared/src/annotation.ts (Added)
- packages/shared/src/index.ts (Modified)
- apps/web/src/lib/{id,imageValidation,logger}.ts (Added)
- apps/web/src/domain/annotation/operations.ts (Added)
- apps/web/src/hooks/{annotationsReducer,historyReducer,useAnnotationsStore,useHistory,useImageSource,useKeyboardShortcuts,useStageSize}.ts (Added)
- apps/web/src/components/canvas/{AnnotationLayer,CanvasStage,ImageLayer,TextEditorOverlay,colors}.{ts,tsx} (Added)
- apps/web/src/components/canvas/shapes/{Arrow,Highlight,Rectangle,Text}Shape.tsx (Added)
- apps/web/src/components/toolbar/{Toolbar,ToolButton}.tsx (Added)
- apps/web/src/components/empty-state/DropZone.tsx (Added)
- apps/web/src/pages/EditorPage.tsx (Added)
- apps/web/src/App.tsx (Modified)
- apps/web/src/styles/tokens.css (Modified)

### Tests (6 added, 1 modified)

- packages/shared/src/__tests__/annotation.test.ts (Added)
- apps/web/src/lib/__tests__/{id,imageValidation}.test.ts (Added)
- apps/web/src/domain/annotation/__tests__/operations.test.ts (Added)
- apps/web/src/hooks/__tests__/{annotationsReducer,historyReducer}.test.ts (Added)
- apps/web/e2e/landing.spec.ts (Modified)

### Config / Docs (4 modified, 2 added)

- pnpm-workspace.yaml, pnpm-lock.yaml, apps/web/package.json (Modified)
- .claude/PRPs/prds/snap-share.prd.md (Modified)
- .claude/PRPs/plans/completed/phase-3-canvas-annotation-tools.plan.md (Renamed from .claude/PRPs/plans/)
- .claude/PRPs/reports/phase-3-canvas-annotation-tools-report.md (Added)

## Recommendation

**APPROVE with comments** — マージ可能。MEDIUM 2 件は merge を block する性質のものではないが、PR 投稿前に下記いずれかで処理を推奨：

- **オプション A（最小修正）**: `replace` API と `state/replace` action を削除（テスト含めて）。Phase 4 で必要になったタイミングで再導入。
- **オプション B（コメント追加）**: 両方を「Phase 4 Yjs 統合のために用意した将来用 API」と明示するコメントを 2 行追加。

LOW 2 件は optional、Phase 6 で UI 仕上げと一緒に。

## Next Steps

- [ ] MEDIUM 2 件をオプション A or B で処理
- [ ] `pnpm -F @snap-share/web dev` で手動 smoke (Manual Validation Checklist)
- [ ] `gh pr create` で main 向け PR 作成
- [ ] Phase 4（Yjs/CRDT 同期）プラン作成
