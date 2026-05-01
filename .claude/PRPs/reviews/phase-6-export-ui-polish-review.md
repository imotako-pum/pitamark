# Phase 6 Code Review — export & UI polish

**Reviewed**: 2026-05-02
**Branch**: `feat/phase-6-export-ui-polish` (uncommitted local changes)
**Decision**: APPROVE with comments — MED-1 / MED-2 / MED-3 はレビュー後に本実装へ反映済み

## Summary

PNG エクスポート、shadcn ベースの UI ポリッシュ (toolbar / dialog / toaster)、ConfirmClearAllDialog による破壊操作の確認動線が一貫した設計で組み込まれている。型安全性・テスト・lint はすべて pass。CRITICAL / HIGH 該当なし。MEDIUM 3 件・LOW 3 件のうち MED-1 / MED-2 / MED-3 は本コミットに直接反映済み (レビュー履歴として下記 finding を残す)。LOW 3 件は次フェーズで対応可。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

#### MED-1 `triggerDownload` で `URL.revokeObjectURL` を同期的に呼ぶと Safari で download が失敗し得る
- **File**: `apps/web/src/lib/exportPng.ts:26-38`
- **Issue**: `a.click()` の直後 (同期 `finally`) に `URL.revokeObjectURL(url)` を呼んでいる。Chromium / Firefox は click 時点で download URL を内部にキャプチャするため動くが、Safari の一部バージョンでは revoke が click より先に観測されてダウンロードが空ファイル化する既知の挙動がある。
- **Suggested fix**: 次の macrotask に回す。
  ```ts
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  ```
  または `requestIdleCallback` / 短い setTimeout (例 1000ms)。テストの `triggerDownload still revokes the URL even if anchor click throws` も `await Promise.resolve()` を挟むだけで通る。

#### MED-2 `AlertDialogAction` が `AlertDialog.Close` を render しないため、ダイアログを自動で閉じない
- **File**: `apps/web/src/components/ui/alert-dialog.tsx:125-127` / `apps/web/src/components/dialogs/ConfirmClearAllDialog.tsx:29-31`
- **Issue**: shadcn (Radix 版) の `AlertDialogAction` は内部で `AlertDialog.Action` をラップして自動 close するが、Base UI 版の本実装は単なる `<Button>` を返すだけ。現在は呼び出し側 (`RoomEditor.handleConfirmClear`) で `setConfirmClearOpen(false)` を手動で呼んでいるため動くが、ダイアログを別箇所で再利用する際に閉じ忘れる温床になる。
- **Suggested fix**: `AlertDialogAction` を `AlertDialogPrimitive.Close render={<Button />}` でラップするか、`ConfirmClearAllDialog` 側で `onConfirm` 後に `onOpenChange(false)` を確実に呼ぶよう内部化する。

#### MED-3 `useExportPng` の `awareness?.hide()` が `try` の外にあり、`finally` の `show()` 保証が崩れ得る
- **File**: `apps/web/src/hooks/useExportPng.ts:35-47`
- **Issue**: 実害はほぼないが、`awareness?.hide()` が throw した場合 (Konva ノードが detach 済みなど) `finally` が走らず、相手のカーソルが画面上に表示されないままになる。コメント上は「failure 時も restore される」と謳っているので、`hide()` も try 内に含める方が記述と整合する。
- **Suggested fix**:
  ```ts
  let hidden = false;
  try {
    awareness?.hide();
    hidden = true;
    const blob = await stageToBlob(stage, pixelRatio);
    triggerDownload(blob, buildExportFilename(new Date(), roomId));
    toast.success('PNG を保存しました');
  } catch (e: unknown) {
    /* ... */
  } finally {
    if (hidden) awareness?.show();
  }
  ```

### LOW

#### LOW-1 `CopyUrlButton` の `aria-label` が visible text を上書きし、コピー完了状態が SR に伝わらない
- **File**: `apps/web/src/components/toolbar/CopyUrlButton.tsx:44-55`
- **Issue**: `aria-label="ルームURLをコピー"` が固定文言のため、screen reader は `URL コピー` / `コピー完了` の状態変化を読み上げない。
- **Suggested fix**: `aria-label` を外して `<span>` の可視テキストを accessible name として使うか、`aria-live="polite"` 領域を別途用意してコピー完了を通知する。

#### LOW-2 `useExportPng` の `pixelRatio` 既定値 2 で巨大画像のメモリ消費が増える
- **File**: `apps/web/src/hooks/useExportPng.ts:28`
- **Issue**: 4K 画像で内部 canvas が 8K 相当となり、低スペック端末でメモリ圧迫の可能性。PRD の想定上限内なら許容範囲。
- **Suggested fix**: 画像サイズに応じて `Math.min(2, devicePixelRatio)` のような動的キャップを検討。今すぐは不要。

#### LOW-3 `useKeyboardShortcuts` の `useEffect` 依存配列が `[]` のまま
- **File**: `apps/web/src/hooks/useKeyboardShortcuts.ts:34-77`
- **Issue**: ref 経由で最新の callback を読むパターンは正しいが、`react-hooks/exhaustive-deps` 系のリンタを将来的に有効化した場合に警告が出る。
- **Suggested fix**: `// biome-ignore lint/correctness/useExhaustiveDependencies: ...` か明示コメントを追加して意図を残す。

## Validation Results

| Check | Result |
|---|---|
| Type check (`pnpm typecheck`) | Pass |
| Lint (`pnpm lint`, biome ci) | Pass |
| Tests (`pnpm -F @snap-share/web test`) | Pass — 148 / 148 |
| Tests (`pnpm -F @snap-share/api test`) | Pass — 95 / 95 |
| Tests (`pnpm -F @snap-share/shared test`) | Pass — 65 / 65 |
| Build | Skipped (typecheck + wrangler dry-run cached pass) |

## Files Reviewed

Modified:
- `apps/web/src/App.tsx`
- `apps/web/src/components/canvas/AwarenessLayer.tsx`
- `apps/web/src/components/canvas/CanvasStage.tsx`
- `apps/web/src/components/connection/ConnectionBadge.tsx`
- `apps/web/src/components/room-gate/RoomGate.tsx`
- `apps/web/src/components/toolbar/CopyUrlButton.tsx`
- `apps/web/src/components/toolbar/ToolButton.tsx`
- `apps/web/src/components/toolbar/Toolbar.tsx`
- `apps/web/src/hooks/useKeyboardShortcuts.ts`
- `apps/web/src/pages/EditorShell.tsx`
- `apps/web/src/pages/LocalEditor.tsx`
- `apps/web/src/pages/RoomEditor.tsx`
- `apps/web/src/styles/global.css`
- `apps/web/src/styles/tokens.css`
- `apps/web/index.html`
- `apps/web/package.json`
- `apps/web/e2e/landing.spec.ts`
- `biome.json`

Added:
- `apps/web/src/components/dialogs/ConfirmClearAllDialog.tsx`
- `apps/web/src/components/ui/{alert-dialog,button,checkbox,input,label,sonner,tooltip}.tsx`
- `apps/web/src/hooks/useExportPng.ts`
- `apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx`
- `apps/web/src/lib/exportPng.ts`
- `apps/web/src/lib/__tests__/exportPng.test.ts`
- `apps/web/public/favicon.svg`
