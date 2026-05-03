# Local Code Review: Phase 7.8-3 フォントサイズ変更 UI

**Reviewed**: 2026-05-04
**Branch**: feat/phase-7.8-predictive-ux
**Decision**: APPROVE(M1 / L1 修正後の再判定)— 全 issue 解決、validation 全緑。

## Resolution Update (2026-05-04, post-fix)

- ✅ **M1 修正済**: `EditorShell.handleSetFontSize` に `selected?.type === 'text'` ガードを追加し、コメントを「Yjs / reducer の type guard はあるが local reducer は新 array を作るため handler 側で gate する」に書き換え(`apps/web/src/pages/EditorShell.tsx:340-359`)。E2E に `rect 選択中の [ → Cmd+Z 1 回で矩形が消える` ケースを追加し、ユーザー可視挙動を担保。
- ✅ **L1 修正済**: FontSizeControl の値表示 `<span>` から重複 `aria-label` を削除し、`data-testid="font-size-value"` を追加(E2E selector の入れ替え)。SR は親 group ラベル「フォントサイズ」+ テキスト「18px」のみを読み、冗長読み上げが解消。
- ✅ **L3 修正済**: M1 のコメントが正確に書き直され、根拠の誤りが解消。
- ⚪ **L2 / L4**: 観測指摘のみ、未修正(意図的設計)。

Final validation:
- typecheck / lint / unit tests 275/275 / build / E2E 73 passed (regression なし)



## Summary

24 タスクが plan どおり実装され、275 unit tests + 6 E2E が全緑、typecheck / lint / build もクリーン。`activeColor` の SSOT パターンを `activeFontSize` に同型複製した実装は意図通り動く。ただし `handleSetFontSize` が text 以外の selectedId に対しても `annotation/set-font-size` を dispatch する設計が、**LocalEditor**(local mode)で空の undo step を past stack に積む UX バグを生む。修正は handler 側の type guard 追加で 5 行未満。Yjs(room mode)側は `setTextFontSizeY` の type guard で問題なし。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1: text 以外が選択中の `handleSetFontSize` が空 undo step を消費する(local mode)**

- **Location**: `apps/web/src/pages/EditorShell.tsx:345-354`(`handleSetFontSize`)
- **Issue**:
  ```typescript
  const handleSetFontSize = useCallback((size: number) => {
    const next = clampFontSize(size);
    store.dispatch({ type: 'active-font-size/set', fontSize: next });
    const id = store.state.selectedId;
    if (id) {
      store.dispatch({ type: 'annotation/set-font-size', id, fontSize: next });
    }
  }, [store]);
  ```
  rect / arrow / highlight が selectedId のとき、`annotation/set-font-size` が dispatch されると以下の連鎖:
  1. `setFontSize` (operations.ts:84) は `annotations.map(a => ...)` で **常に新しい配列** を返す(各要素は同一参照だが配列 identity は変わる)
  2. `annotationsReducer` は `{ ...state, annotations: newArray }` で新 state を返す
  3. `useAnnotationsStore.storeReducer` の早期 return `if (next === state.present) return state` は object identity チェックなので通過
  4. `isCommittingAction('annotation/set-font-size') === true` で `historyReducer.commit` 経由 → `past` stack に空ステップが積まれる
  5. ユーザーが Cmd+Z すると **視覚的変化のない 1 step が消費** され、もう 1 回 Cmd+Z しないと意図した取り消しに到達しない
  6. 連打すれば `HISTORY_LIMIT = 50` を侵食し、本物の履歴が失われる

- **Repro (local mode)**:
  1. `LocalEditor.tsx` 経由のローカル編集を開く(`useAnnotationsStore` を使う route)
  2. 矩形を 1 つ描く → 自動選択
  3. `[` を 5 回押す → activeFontSize は 18 → 8 に変化、矩形には何も起きない(視覚的に正常)
  4. Cmd+Z を 1 回押す → 何も起きない(空 step 消費)
  5. Cmd+Z をもう 1 回押す → ようやく矩形が消える

- **Yjs (room mode) 側**: `setTextFontSizeY` の `m.get('type') !== 'text'` ガードで Y.Doc に変化なし → UndoManager は無動作。Yjs mode は問題なし。

- **Plan のコメントとの矛盾**: plan の handler コメント「text 以外が選択中の場合は dispatch しても reducer の setFontSize と Yjs の setTextFontSizeY が type guard で no-op になるため、ここで型を見て分岐する必要はない」は半分間違い。Yjs は no-op だが local reducer は新 array を作るため state 等価性チェックが効かない。

- **Suggested Fix**: handler 側で type を見て gate する(同 PR のコメントも合わせて修正):
  ```typescript
  const handleSetFontSize = useCallback(
    (size: number) => {
      const next = clampFontSize(size);
      store.dispatch({ type: 'active-font-size/set', fontSize: next });
      const id = store.state.selectedId;
      if (id) {
        // text 注釈にだけ個別適用。reducer / Yjs 双方の setFontSize は type guard
        // を持つが、local reducer は新 array を作るため空 undo step が past に
        // 積まれる。ここで gate するのが最もシンプル。
        const selected = store.state.annotations.find((a) => a.id === id);
        if (selected?.type === 'text') {
          store.dispatch({ type: 'annotation/set-font-size', id, fontSize: next });
        }
      }
    },
    [store],
  );
  ```

- **Severity**: MEDIUM — local mode 限定だが LocalEditor は production に出ているコード。視覚バグではないが「Cmd+Z が効かない」と感じさせる UX 不整合。

- **Test gap**: 現状の reducer テスト(`annotationsReducer.test.ts:243`)は「rect に対する annotation/set-font-size が rect の参照を保持する」を検証しているが、**state 全体の参照保持(空 step 防止)は検証していない**。修正と合わせて以下のテストを追加推奨:
  ```typescript
  // EditorShell の handler テストか、reducer の参照同一性テスト
  it('returns same state when annotation/set-font-size targets non-text id', () => {
    const seeded = seedWith([rect]);
    const next = annotationsReducer(seeded, {
      type: 'annotation/set-font-size',
      id: 'r1',
      fontSize: 24,
    });
    // 修正後: state 全体が同一参照
    expect(next).toBe(seeded);
  });
  ```
  この場合 reducer 側で also fix する選択肢もあるが、handler 側 gate が plan の意図に近い(text-only な操作を text annotation だけに発火させる)。

### LOW

**L1: FontSizeControl の二重 aria-label による SR 冗長読み上げ**
- **Location**: `apps/web/src/components/toolbar/FontSizeControl.tsx:25, 49-52`
- **Issue**: 親 `<div role="group" aria-label="フォントサイズ">` と子 `<span role="status" aria-label="現在のフォントサイズ: 18px">`。SR は「フォントサイズグループ」+「現在のフォントサイズ: 18px」と読み、ユーザーには冗長に聞こえる可能性。
- **Suggested Fix**: 値表示の `aria-label` を削除し、role="status" + aria-live + textContent("18px") のみで自動アナウンス。SR は親 group ラベル「フォントサイズ」とテキスト「18px」だけを読む。
- **Severity**: LOW — 機能的問題なし、SR UX の細かいチューニング。

**L2: HelpModal の section 順序が Toolbar 物理配置と乖離**
- **Location**: `apps/web/src/components/dialogs/HelpModal.tsx:54-62` の `SECTIONS` 配列
- **Issue**: HelpModal は「ツール / 色 / テキスト / 編集 / ズーム / 出力 / ヘルプ」だが Toolbar の物理配置は「Tools / Undo・Redo・Del / Color / Font / Export / Help」。テキスト section が「編集」より前に置かれているのは Toolbar 上の隣接(色 → フォントサイズ)を反映しているが、既存 HelpModal は色を編集の前に置いていた(本フェーズ起因ではなく既存の慣習)。
- **Suggested Fix**: 不要(既存パターンと整合)。今後 HelpModal 全体の section 順序を Toolbar に合わせるなら別 phase で。
- **Severity**: LOW — 観測的指摘のみ、現状で許容。

**L3: Plan のコメント「type guard で no-op」が誤り**
- **Location**: `apps/web/src/pages/EditorShell.tsx:340-343`(handleSetFontSize の上のコメント)
- **Issue**: 「text 以外が選択中の場合は dispatch しても reducer の setFontSize と Yjs の setTextFontSizeY が type guard で no-op になる」は MEDIUM M1 の根拠が崩れているため誤り(local reducer は新 array を作る)。
- **Suggested Fix**: M1 の修正とセットで、コメントを「text 注釈にだけ dispatch する。Yjs / reducer 双方の type guard はあるが、local reducer は新 array を作って空 undo step が積まれるため handler 側で gate する」に書き換える。
- **Severity**: LOW — M1 修正で同時解決。

**L4: re-export の集約で MAX_FONT_SIZE の依存方向が薄まる**
- **Location**: `apps/web/src/lib/fontSize.ts:1, 6`
- **Issue**: `import { MAX_FONT_SIZE } from '@snap-share/shared'` → `export { MAX_FONT_SIZE }` で web 側に re-export。FontSizeControl / fontSize.test.ts はこの web 側経由で読む。意図は SSOT(全消費者が `lib/fontSize.ts` 経由で読む)、効果は OK だが、shared の MAX_FONT_SIZE が変わったとき web の expectation も追従する事を ESLint 等で気付けない構造。
- **Suggested Fix**: 不要(意図的設計)。
- **Severity**: LOW — design choice として明示的に意図しているならコメント 1 行追加で OK。

## Validation Results

| Check | Result |
|---|---|
| Type check (tsc --noEmit) | Pass |
| Lint (biome ci) | Pass |
| Tests (vitest) | Pass — 275 / 275 |
| Build (vite + wrangler dry-run) | Pass |
| E2E (playwright chromium) | Pass — 6 / 6 new + 全 134 regression なし |

## Files Reviewed

| File | Type | Note |
|---|---|---|
| `apps/web/src/lib/fontSize.ts` | Added | clamp/inc/dec の純関数。MIN/MAX/STEP も同モジュールで集約 |
| `apps/web/src/lib/__tests__/fontSize.test.ts` | Added | 8 tests、境界 / 通常 / 端値 |
| `apps/web/src/components/toolbar/FontSizeControl.tsx` | Added | UI コンポーネント。L1 で軽微 a11y 指摘 |
| `apps/web/src/components/toolbar/__tests__/FontSizeControl.test.tsx` | Added | 5 tests |
| `apps/web/e2e/font-size.spec.ts` | Added | 6 tests、shortcut / button / クランプ / text 編集中スルー |
| `apps/web/src/domain/annotation/operations.ts` | Modified | setFontSize 追加(text-only) |
| `apps/web/src/domain/annotation/__tests__/operations.test.ts` | Modified | +3 tests |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | Modified | setTextFontSizeY 追加(text-only + LOCAL_ORIGIN tx) |
| `apps/web/src/domain/annotation/__tests__/yjs-mutations.test.ts` | Modified | +3 tests |
| `apps/web/src/hooks/annotationsReducer.ts` | Modified | activeFontSize state + 2 actions + COMMITTING_ACTIONS |
| `apps/web/src/hooks/__tests__/annotationsReducer.test.ts` | Modified | +7 tests |
| `apps/web/src/hooks/yjs-annotations-context.ts` | Modified | applyDataAction switch 拡張 |
| `apps/web/src/hooks/__tests__/yjs-annotations-context.test.ts` | Modified | +2 tests |
| `apps/web/src/hooks/useYjsAnnotationsStore.ts` | Modified | activeFontSize 配線 |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | Modified | `[`/`]` shortcut |
| `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx` | Modified | +6 tests |
| `apps/web/src/components/canvas/CanvasStage.tsx` | Modified | 2 か所の text 作成で activeFontSize、依存配列更新 |
| `apps/web/src/pages/EditorShell.tsx` | Modified | handleSet/Inc/DecFontSize、Auto-next-B も追従。**M1 該当箇所** |
| `apps/web/src/components/toolbar/Toolbar.tsx` | Modified | FontSizeControl 組み込み |
| `apps/web/src/components/toolbar/__tests__/Toolbar.test.tsx` | Modified | +2 tests |
| `apps/web/src/components/dialogs/HelpModal.tsx` | Modified | TEXT_ROWS section |
| `apps/web/src/components/dialogs/__tests__/HelpModal.test.tsx` | Modified | +1 test |
| `.claude/PRPs/prds/phase-7.8-predictive-ux.prd.md` | Modified | Phase 3 status: pending → complete |
| `.claude/PRPs/plans/completed/phase-7.8-3-font-size-ui.plan.md` | Added (moved) | アーカイブ済 plan |
| `.claude/PRPs/reports/phase-7.8-3-font-size-ui-report.md` | Added | implementation report |

## Recommended Next Steps

1. **M1 を修正**: handler 側で text-only gate を追加(5 行未満)+ 関連コメント差し替え + reducer の参照同一性テスト追加
2. **L1 を修正**(任意): FontSizeControl の値表示 `aria-label` を削除
3. すべて green を確認後、Phase 単位で commit(memory 規約: ブランチ単位ではなく Phase 単位コミット)

## Decision Rationale

- **CRITICAL/HIGH なし** → APPROVE 候補
- **M1 が production code (LocalEditor) に影響** → REQUEST CHANGES 寄り
- **修正コストが極小(5 行)** → REQUEST CHANGES が妥当

---
*Generated: 2026-05-04*
*Reviewer: Claude Opus 4.7*
