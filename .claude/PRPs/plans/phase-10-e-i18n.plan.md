# Plan: Phase 10.E — i18n 軽量実装 (日英 2 言語)

## Summary

ADR-0004 (Status: accepted) で確定した **Option B: 軽量自作 dict + 日英 2 言語** を `apps/web/` に実装する。`apps/web/src/i18n/` ディレクトリを新設し、`useTranslation` hook + `ja.ts` (デフォルト) + `en.ts` を提供。既存の hardcoded JP 文字列 (production 計 ~106 箇所、13 ファイル分散) を dict キーに置換し、ヘッダの language toggle で日↔英を切替可能にする。`<html lang>` を hook 経由で動的更新し、`navigator.language` 自動検出 + `localStorage` 永続化を組み込む。Phase 10.B と同 branch (`feat/phase-10-launch-prep`) に commit を積む (1 PRD = 1 ブランチ feedback memory に従う)。

## User Story

As 海外マーケットの TAM 拡大を狙う snap-share オーナー (Phase 10 で C スタンス採用),
I want 既存の日本語 UI を破壊せずに、英語フォールバックを最小依存で導入したい,
So that ランディング → エディタ → 共有の各サーフェスで日英ユーザー双方が違和感なく完結し、`<html lang>` も SEO 観点で適切に切替わる。

## Problem → Solution

### Current（Phase 10.B 完了直後の `feat/phase-10-launch-prep` ブランチ）

- **言語**: 日本語のみ。`navigator.language` 関係なく必ず JA 文字列が出る
- **`<html lang>`**: `index.html` で `lang="ja"` 静的固定
- **文言の散在**: 13 production ファイルに ~106 箇所の hardcoded JP 文字列 (toolbar / dialogs / room-gate / DropZone / connection / image validation / 各 toast)
- **i18n インフラ**: 不在
- **言語切替 UI**: 不在
- **依存**: i18next / Lingui / FormatJS は ADR-0004 で却下、自作 dict 路線が accepted

### Desired（Phase 10.E 完了時点）

- **`apps/web/src/i18n/` 新設**:
  - `index.ts` — `useTranslation()` hook + `useCurrentLang()` + `setLang()`、key fallback、`<html lang>` 同期
  - `ja.ts` — Japanese dict (existing strings をキー化)
  - `en.ts` — English dict (オーナーがレビューしやすいよう "draft" とコメント)
  - `keys.ts` — TS 型安全な key union (key typo を compile time で検出)
  - `__tests__/i18n.test.ts` — useTranslation の unit test
- **language detection**:
  - 初回: `localStorage['snap-share-lang']` → `navigator.language` 先頭 → `'ja'` フォールバック
  - 永続化: `setLang(...)` で localStorage 保存
- **`<html lang>` 反映**:
  - `useCurrentLang()` 内で `document.documentElement.lang` 同期
- **言語切替 UI**:
  - ヘッダの右 (Toolbar の右側 or DropZone のすぐ右上) に小さな `JA / EN` セグメントボタン
  - クリックで lang 切替、即座に UI 全体が再レンダ
- **既存文言 dict 化**:
  - 13 ファイル × 計 ~106 箇所を key 参照に置換
  - キー命名: `{component}.{element}.{purpose}` (例 `toolbar.tool.rectangle`、`gate.error.wrongPassword`)
- **テスト**:
  - `useTranslation` unit test (5+ ケース)
  - language toggle E2E 1 件 (日↔英で UI 文言が切替わる)
  - 既存 unit test の JP 文字列 assert を `t('key')` ベースまたは `ja['key']` 直接参照に更新

### Acceptance（受け入れ条件）

- [ ] `apps/web/src/i18n/{index.ts,ja.ts,en.ts,keys.ts,__tests__/i18n.test.ts}` 新設
- [ ] `useTranslation()` hook が `(key) => string` を返す、未知 key は dev mode で `console.warn` + key string を返す
- [ ] `<html lang>` が `useCurrentLang` の現在値を反映 (lang 切替時に同期更新)
- [ ] 13 production ファイルの hardcoded JP 文字列がすべて `t('...')` 経由になっている
- [ ] 言語切替 UI (`<LangToggle />`) が EditorShell の Toolbar 右端 + DropZone (画像未読込状態) に配置
- [ ] `localStorage['snap-share-lang']` 永続化 + 初回は `navigator.language` 先頭で推定
- [ ] 新規テスト: `useTranslation` unit (5+ ケース) + lang toggle E2E (1 件)
- [ ] 既存 unit test (toolbar / dialogs / room-gate / FontSizeControl / Help / etc.) を `ja` dict 値ベースに更新済 = 緑
- [ ] `pnpm test` / `typecheck` / `lint` / `build` 緑
- [ ] 英語訳は draft フラグ (`/* TODO: i18n review */`) を `en.ts` ファイル冒頭に明示、オーナーレビューを後続の commit で吸収

## Metadata

- **Complexity**: **Medium-Large** (~106 文字列の置換 + i18n インフラ + 言語切替 UI + テスト更新)
- **Source PRD**: `phase-10-direction.prd.md` (Phase 10.E)
- **Source ADR**: [ADR-0004 (accepted)](../../../docs/adr/ADR-0004-i18n-strategy.md) Option B
- **Branch**: `feat/phase-10-launch-prep` (Phase 10.B から継続、push 前)
- **Depends on**: Phase 10.B (TTL/CHANGELOG/法務/通報/OGP) 完了済
- **Estimated Files**:
  - 新規 5 (`i18n/index.ts` / `ja.ts` / `en.ts` / `keys.ts` / `__tests__/i18n.test.ts`)
  - 新規 1 (`components/lang-toggle/LangToggle.tsx`)
  - 更新 13 production (Toolbar / HelpModal / RoomGate / ConnectionBadge / CopyUrlButton / FontSizeControl / ColorPalette / TextEditorOverlay / DropZone / ConfirmClearAllDialog / LocalEditor / imageValidation / useImageSource / useExportPng / local-user)
  - 更新 ~10 既存テスト (assert を `ja` dict 経由に切替)
  - 更新 1 (`apps/web/index.html`: `lang="ja"` のまま、起動時 hook が同期するので静的値は維持)
  - 新規 1 e2e (`apps/web/e2e/i18n.spec.ts`)
- **Estimated Time**: 4-6 時間 (dict 化が機械的だが量が多い、E2E 30 分)

---

## Implementation Steps

### Step 1: i18n core 実装 (TDD)

`apps/web/src/i18n/keys.ts` (キー型を先に定義):

```ts
// Phase 10.E: Top-level i18n key union. Adding a new string anywhere in the
// app means adding a key here AND in every dict (ja/en). The `keyof typeof ja`
// alternative was rejected because it couples the type to JA dict shape.
export type I18nKey =
  | 'toolbar.tool.select'
  | 'toolbar.tool.rectangle'
  // ... ~100+ keys
```

`apps/web/src/i18n/ja.ts` + `en.ts`:

```ts
import type { I18nKey } from './keys';
export const ja: Record<I18nKey, string> = {
  'toolbar.tool.select': '選択',
  'toolbar.tool.rectangle': '矩形',
  // ...
};
```

`apps/web/src/i18n/index.ts`:

```ts
import { useEffect, useSyncExternalStore } from 'react';
import { ja } from './ja';
import { en } from './en';
import type { I18nKey } from './keys';

export type Lang = 'ja' | 'en';
const SUPPORTED: readonly Lang[] = ['ja', 'en'] as const;
const STORAGE_KEY = 'snap-share-lang';
const dicts: Record<Lang, Record<I18nKey, string>> = { ja, en };

const detectInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'ja';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'ja' || stored === 'en') return stored;
  const nav = window.navigator.language?.slice(0, 2);
  return SUPPORTED.includes(nav as Lang) ? (nav as Lang) : 'ja';
};

// External store so any component subscribing via `useSyncExternalStore`
// re-renders when lang changes — much lighter than React Context for a single
// global with infrequent updates.
let currentLang: Lang = detectInitialLang();
const listeners = new Set<() => void>();

export const setLang = (next: Lang): void => {
  if (currentLang === next) return;
  currentLang = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }
  for (const l of listeners) l();
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => currentLang;
const getServerSnapshot = () => 'ja' as const;

export const useCurrentLang = (): Lang =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const useTranslation = () => {
  const lang = useCurrentLang();
  // `useEffect` keeps `<html lang>` in sync with the actual `<html>` element.
  // We also set it eagerly inside `setLang` so initial mount + lang switch
  // both work; the effect catches the SSR / hydration boundary edge case.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);
  return (key: I18nKey): string => dicts[lang][key] ?? key;
};
```

Tests in `apps/web/src/i18n/__tests__/i18n.test.ts`:

```ts
describe('i18n', () => {
  it('resolves a JA key by default', () => { ... });
  it('falls back to JA when navigator.language is not supported', () => { ... });
  it('switches to EN via setLang and persists to localStorage', () => { ... });
  it('reads localStorage on init when present', () => { ... });
  it('returns the key string when the dict is missing the entry', () => { ... });
  it('keeps ja and en dicts complete (no missing keys in either)', () => {
    // 自動 audit: 両 dict が同じキー集合を持つことを確認
  });
});
```

**Commit**: `feat(phase-10-e): i18n core — useTranslation + ja/en dicts + key union (TDD)`

### Step 2: 既存文言を dict 化 (機械置換 + 手動レビュー)

13 ファイルを順番に書き換える。1 commit で全部やると diff が読みにくいため、機能ドメイン単位で 2-3 commit に分ける。

**Step 2a: toolbar 系** (Toolbar / ColorPalette / FontSizeControl / CopyUrlButton):
- キー: `toolbar.tool.select` / `toolbar.tool.rectangle` / `toolbar.action.undo` / `toolbar.colorPalette.label` / `toolbar.fontSize.increase` / `toolbar.copyUrl.label` / `toolbar.copyUrl.success` 等

**Step 2b: dialogs / overlays** (HelpModal / ConfirmClearAllDialog / TextEditorOverlay / DropZone):
- キー: `help.section.tools` / `help.row.select` / `dialog.clearAll.title` / `editor.text.editLabel` / `dropzone.headline` 等

**Step 2c: gate / connection / errors** (RoomGate / ConnectionBadge / LocalEditor toast / useImageSource / useExportPng / imageValidation / local-user):
- キー: `gate.title` / `gate.error.wrongPassword` / `connection.connecting` / `error.image.unsupported` / `toast.export.success` / `localUser.namePrefix` 等

各 commit で test を走らせて緑を維持する。

**Commits** (3 つ):
- `refactor(phase-10-e): toolbar 系の文言を i18n key 経由に切替`
- `refactor(phase-10-e): dialogs / overlays の文言を i18n key 経由に切替`
- `refactor(phase-10-e): gate / connection / errors の文言を i18n key 経由に切替`

### Step 3: 言語切替 UI

`apps/web/src/components/lang-toggle/LangToggle.tsx` 新設 (~50 LOC):

```tsx
import { useCurrentLang, setLang, type Lang } from '@/i18n';
import { useTranslation } from '@/i18n';

export const LangToggle = () => {
  const lang = useCurrentLang();
  const t = useTranslation();
  return (
    <div role="group" aria-label={t('common.langToggle.label')} className="...">
      {(['ja', 'en'] as const).map((l) => (
        <button
          key={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={...}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
```

配置場所:
- Toolbar の右端 (CopyUrlButton の右隣)
- DropZone (画像未読込時) の右上 (Toolbar が出ないため別途)

**Commit**: `feat(phase-10-e): LangToggle UI + Toolbar/DropZone へ配置`

### Step 4: 既存テスト更新

JP 文字列を直接 assert している既存テストを `ja` dict 経由に切替:

```ts
// before
expect(screen.getByLabelText('元に戻す')).toBeInTheDocument();
// after
import { ja } from '@/i18n/ja';
expect(screen.getByLabelText(ja['toolbar.action.undo'])).toBeInTheDocument();
```

**Commit**: `test(phase-10-e): 既存 unit test を ja dict 値ベースに更新`

### Step 5: E2E

`apps/web/e2e/i18n.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('lang toggle switches UI between JA and EN', async ({ page }) => {
  await page.goto('/');
  // 初期状態: JA (デフォルト or navigator)
  await expect(page.getByRole('button', { name: /選択|Select/ })).toBeVisible();
  // EN へ切替
  await page.getByRole('button', { name: 'EN', pressed: false }).click();
  await expect(page.getByRole('button', { name: 'Select' })).toBeVisible();
  // <html lang> が反映
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // localStorage 永続化
  expect(await page.evaluate(() => localStorage.getItem('snap-share-lang'))).toBe('en');
});
```

**Commit**: `test(phase-10-e): lang toggle e2e を追加`

### Step 6: CI 緑

```sh
pnpm -F @snap-share/web test
pnpm -F @snap-share/web test:e2e -- -g "lang toggle"
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

### Step 7: snap-share.prd.md 反映

- Phase 10 status: 既に `in-progress` なので Phase 10.B + 10.E 完了済 + 10.D/10.F/10.G 残として更新
- Decisions Log: なし (ADR-0004 で確定済、PRD 側は status update のみ)

**Commit**: `docs(phase-10-e): PRD 反映 — Phase 10.E 完了`

---

## What's NOT in This Plan

- **3 言語目以降 (中国語 / 韓国語)** — ADR-0004 で「3 言語以上で i18next 移行」と明示
- **複数形 / 日付フォーマットの自動化** — 自前 if 分岐 + `Intl.*` を直接呼ぶ方針
- **翻訳 SaaS 連携 (Tolgee / Crowdin 等)** — 個人開発の月 $5 予算と整合しない
- **オーナーレビュー前提の英訳の polish** — `en.ts` 冒頭で "draft" と明示し、後続 commit で吸収
- **アプリ名の英訳 (例: snap-share → ?)** — Phase 10.D アプリ名再考と統合し、確定後に `common.appName` キーへ反映
- **OGP / meta description の英語化** — Phase 10.F (公開リリース実走) で再評価。今は `<html lang="ja">` 静的、build-time replace は Phase 10.D ドメイン確定後

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 既存 unit test の JP 文字列 assert が大量にあり修正コスト膨張 | M | `ja` dict 経由 (`ja['key']`) の参照に統一、grep + sed で一括置換可能。手作業より regex の方が安全 |
| 英訳の品質が悪く UX を壊す | M | "draft" フラグ + オーナー後続レビュー前提。Phase 10.E では構造完成を優先、文言 polish は別 commit で |
| `useSyncExternalStore` がテスト env (jsdom) で動かない | L | React 18+ 公式 API で jsdom 互換、Vitest で実績多数 |
| `localStorage` 不在環境 (SSR / Worker) でクラッシュ | L | `typeof window === 'undefined'` ガードを hook 入口に置く、`getServerSnapshot` を実装済 |
| 100+ 文字列の置換漏れ | M | grep `/[ぁ-んァ-ヶ一-龯]/` で残存検出、最終 step で 0 件確認 |
| Toolbar の右端に LangToggle 追加で layout 壊れ | L | 既存の Toolbar SCSS / Tailwind を尊重し、`<LangToggle />` は flex 末尾に追加 |
| E2E が JA / EN の両 navigator.language 環境を仮定 | L | Playwright で `await page.evaluate(() => localStorage.setItem('snap-share-lang', 'ja'))` で初期化 |

## Validation Steps

```sh
# Step 1 完了時
pnpm -F @snap-share/web test -- i18n

# Step 2a/2b/2c 各完了時
pnpm -F @snap-share/web test
pnpm -F @snap-share/web typecheck

# Step 3 完了時
pnpm -F @snap-share/web build && open http://localhost:5173/  # 手動確認

# 全 step 完了時
grep -rn "[ぁ-んァ-ヶ一-龯]" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "// " | grep -v "__tests__" | grep -v "/\*" | grep -v "^apps/web/src/.*: \*"
# → 0 行 (または `i18n/ja.ts` 内のみ) を確認

pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm -F @snap-share/web test:e2e -- -g "lang toggle"
```

---

*Generated: 2026-05-05*
*Source: phase-10-direction.prd.md (Phase 10.E) + ADR-0004 (Option B)*
