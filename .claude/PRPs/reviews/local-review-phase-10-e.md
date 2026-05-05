# Local Review: Phase 10.E — i18n 軽量実装 + CHANGELOG ロールバック

**Reviewed**: 2026-05-05
**Branch**: `feat/phase-10-launch-prep` (前回 review `ff7ad22` 以降の +10 commit)
**Mode**: Local review (PR 未作成、`git diff ff7ad22..HEAD` ベース)
**Decision**: **APPROVE with minor comments** — CRITICAL / HIGH 0 件、MEDIUM 1 件、LOW 4 件

## Summary

ADR-0004 Option B (軽量自作 dict + 日英 2 言語) を実装。`apps/web/src/i18n/` に core (ja.ts / en.ts / keys.ts / index.ts) + 13 production ファイルを `t()` / `errorKey` 経由に置換 + LangToggle UI を追加 + Playwright locale を `ja-JP` に pin。net +1,558 行 / -430 行。CHANGELOG はオーナー判断で取り下げ commit を別途整理 (Phase 10.F 後ろ倒し)。アプリ名 `pitamark.app` 確定の前回ブレスト分は別 commit (`2fdc17b`) として既に履歴に乗っている。

## Files Reviewed

| File | Change | Assessment |
|---|---|---|
| `apps/web/src/i18n/{ja,en,keys,index}.ts` | 新規 (~430 行 + ~80 keys) | OK + M1 |
| `apps/web/src/i18n/__tests__/i18n.test.tsx` | 新規 (13 件) | OK |
| `apps/web/src/components/lang-toggle/LangToggle.tsx` | 新規 | OK |
| `apps/web/src/components/{toolbar,dialogs,room-gate,connection,canvas,empty-state}/*.tsx` | 修正 (12 ファイル) | OK |
| `apps/web/src/hooks/{useImageSource,useExportPng}.ts` | tRef pattern で i18n 化 | OK |
| `apps/web/src/lib/imageValidation.ts` | error: string → errorKey: I18nKey | OK |
| `apps/web/src/lib/local-user.ts` | `translateSync('localUser.namePrefix')` | OK |
| `apps/web/src/pages/{LocalEditor,EditorShell}.tsx` | 文言 + errorKey 配線 | OK |
| `apps/web/src/components/{toolbar,dialogs,room-gate}/*/__tests__/*.tsx` | beforeEach で `setLang('ja')` pin | OK |
| `apps/web/src/lib/__tests__/imageValidation.test.ts` | errorKey 期待に変更 | OK |
| `apps/web/playwright.config.ts` | `use.locale = 'ja-JP'` 追加 | OK |
| `apps/web/e2e/i18n.spec.ts` | 新規 (4 件) | OK |
| `CHANGELOG.md` | 削除 (ロールバック) | OK |
| `.claude/PRPs/plans/phase-10-e-i18n.plan.md` | 新規 plan | OK |
| `.claude/PRPs/prds/phase-10-naming.md` | 新規 (`pitamark.app` ブレスト記録) | OK |
| PRD 反映 | Phase 10.B/10.E status complete | OK |

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

**M1: `apps/web/src/i18n/index.ts:17-18` — `ja` / `en` dict object を public export している**

```ts
export { en } from './en';
export { ja } from './ja';
```

dict オブジェクトを `index.ts` からそのまま re-export しているため、production コードからも直接 `ja['key']` でアクセスできる状態。テストでは `ja[key]` 経由のアサーションが多数あり (i18n.test.tsx, Toolbar.test.tsx 等) 必須だが、production code では `useTranslation()` 経由のみが正しい使い方で、dict 直接参照はリアクティビティを失う。

**Impact**: 微小。型システムでは止められない (named export の値は誰でも読める)。仮に production で `ja['key']` を呼ぶと lang 切替時に追従しないが、hidden bug にはなり得る。

**Suggested fix**: 短期的には現状維持 (テストでの利用に必要)。将来的には `i18n/__test-only__.ts` のような分離 entrypoint に dict re-export を逃がし、`i18n/index.ts` からは hook + setLang + getLangSync + interpolate のみに絞る。Phase 10.F or 後続レビュー時の検討事項。

### LOW

**L1: `i18n/__tests__/i18n.test.tsx:73-78` — `dropzone.instructionSuffix` の空値例外がハードコード**

```ts
const intentionalEmpties = new Set(['dropzone.instructionSuffix']);
const empties = Object.entries(en)
  .filter(([k, v]) => v.length === 0 && !intentionalEmpties.has(k))
  .map(([k]) => k);
```

EN dict で意図的に空値にしているキーを「除外リスト」で許す構造。今は 1 件だが、将来的に増やす場合のメンテ箇所。

**Suggested fix**: `en.ts` 側で空値のキーに専用 marker comment を埋めて、テストはそれを検出する形のほうが宣言的だが、現状 1 件なので noop で OK。

**L2: `LangToggle.tsx:38` — テンプレート文字列での i18n key 構築**

```tsx
aria-label={t(`common.langToggle.${l}` as const)}
```

`l: Lang` (= `'ja' | 'en'`) なので結果のキーは `common.langToggle.ja` / `common.langToggle.en` で、両方が `keys.ts` の `I18nKey` union に存在する → 型安全。`as const` で literal 化、`useTranslation()` の引数型と整合する。OK だが、将来 SUPPORTED_LANGS が増えたとき key も対応して増やさないと TS が静かに `string` に広がる可能性 (`common.langToggle.${string}`)。

**Suggested fix**: 現状 OK、3 言語拡張時に対応キーを `ja.ts` に追加することを `SUPPORTED_LANGS` 変更時の checklist として `keys.ts` の comment に明記してもよい。

**L3: `imageValidation.ts:29-31` — 型レベル assertion のパターン**

```ts
type _Assert = ImageValidationErrorKey extends I18nKey ? true : never;
const _check: _Assert = true;
void _check;
```

`ImageValidationErrorKey` が `I18nKey` のサブセットであることを compile time で保証する trick。動作は正しいが、初見の reader には意図が読みにくい。

**Suggested fix**: 後続 commit で `// Compile-time assertion: ImageValidationErrorKey ⊆ I18nKey` のコメントをもう少し explicit にしても可。現状のコメントでも OK。

**L4: `useImageSource.ts:45,53-54` — `useTranslation()` の戻り値が直接使われていない**

```ts
const t = useTranslation();
// ...
const tRef = useRef(t);
tRef.current = t;
```

`t` は ref 経由の async callback (line 101) でしか使われない。useTranslation 呼び出しの本来の効果は「lang 変更時の re-render を購読する」ことで、ref の最新化を保証している。意図は正しいが「`t` が使われていないように見える」混乱要因。

**Suggested fix**: コメントで「subscribe to lang changes via useTranslation()」と明示すれば誤解防止。現状の line 51-52 コメントでも近い説明があるので OK。

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check (`pnpm typecheck`) | Pass | 4/4 cached, FULL TURBO |
| Lint (`pnpm lint`) | Pass | biome ci, 202 files |
| Unit tests (`pnpm test`) | Pass | shared 70 + api 187 + web 305 = **562 件** (i18n 13 新規) |
| Build (`pnpm build`) | Pass | Vite + wrangler dry-run |
| E2E tests (`pnpm test:e2e --project=chromium`) | Pass | 73 件 (i18n.spec 4 新規) + 2 skipped |

## CLAUDE.md Compliance

- ✅ **Catalog-managed deps**: 新規依存ゼロ (i18n は自作)
- ✅ **TypeScript noUncheckedIndexedAccess**: `dicts[lang][key] ?? (key as string)` で undefined fallback
- ✅ **verbatimModuleSyntax**: type-only import を `import type` で分離
- ✅ **Biome `noConsole: warn`**: 新規コードに console 出現なし
- ✅ **API レスポンス schema は packages/shared に集約**: 本 PR は web 側 i18n のみで API には不影響
- ✅ **共通エラー envelope**: imageValidation の errorKey 化は client 側のみ、API 契約は無変更
- ✅ **コメント方針 (WHY を非自明な箇所のみ)**: i18n/index.ts に「Why useSyncExternalStore (vs Context)」の意思決定 comment、tRef パターンの理由など、判断の背景が記録されている

## Security Review

- ✅ **XSS**: `interpolate(template, params)` は `replace(/\{(\w+)\}/g, ...)` で plain string 出力。React は JSX 経由で escape する → 安全
- ✅ **localStorage 例外耐性**: `try/catch` で privacy mode / quota exceed を握りつぶし、in-memory state は保つ
- ✅ **SSR safety**: `typeof window === 'undefined'` / `typeof document === 'undefined'` ガード
- ✅ **Lang detection の untrusted input**: `navigator.language` を `slice(0,2)` 後 `isLang()` で type guard、未対応値は `'ja'` fallback
- ✅ **No new auth/secret surface**: i18n 化は文字列定数の置換のみ、認証経路の変更なし
- ✅ **CHANGELOG.md ロールバック**: 削除のみ、リーク等のリスクなし

## Performance Review

- ✅ Bundle インパクト: `EditorShell-*.js` が gzip 64.5kB → 67.98kB (+3.48kB, ja+en dict + i18n core 込み)。ADR-0004 の予算 ~2KB gz より少し膨らんだが、Phase 8 で web 全体が 85kB gz まで圧縮されており余裕は残る
- ✅ **useSyncExternalStore**: Context より軽量、lang 変更時に subscribe している component のみ再レンダ
- ✅ **`<html lang>` sync**: `setLang` 内で eager + `useTranslation` の useEffect で defense-in-depth、二重実行はあるが O(1)
- ⚠️ Bundle に dict 全体が含まれる: 100-200 keys × 2 lang ≒ ~10KB raw / ~3KB gz。3 言語以上で気になり始めたら i18next の lazy load に移行候補 (ADR-0004 で言及済)

## Recommendations

1. **APPROVE** — Phase 10.E 自走範囲は完了、ブロッカーなし
2. M1 (dict re-export) は Phase 10.F or 別 cleanup commit で `__test-only__.ts` 分離を検討
3. L1〜L4 はすべて noop で問題なし (コメント補強や explicit 化は任意)
4. **英訳の polish レビューがオーナー宿題** — `en.ts` ヘッダで draft 明示済、後続 commit で吸収
5. **アプリ名 `pitamark.app` へのリネーム** は別 task (ADR-0005 起票 + ドメイン取得 + リネーム実装)、Phase 10.D の続きとして次セッション

## Next Steps

- `feat/phase-10-launch-prep` ブランチを push して PR 作成
- もしくは Phase 10.D pitamark リネームを同 branch に積んでから PR
- もしくは英訳ポリッシュを先に commit してから PR
