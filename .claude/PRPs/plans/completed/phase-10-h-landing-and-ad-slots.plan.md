# Plan: Phase 10.H — ランディング条件付き拡張 + AdSense slot 予約

## Summary

`useImageSource.source === null` 状態の `LocalEditor` 内に Hero / Features / HowTo / FAQ(Could) を `<DropZone>` 周辺で条件付きレンダリングし、同時に page shell に `<aside>` 2 つで AdSense 配信用プレースホルダ枠 (`lg:` 以上 = 左右レール / `lg:` 未満 = 下部静的) を `min-height` 固定で予約する。AdSense script 実注入は Phase 11+、本 plan はプレースホルダ + 環境変数 placeholder pattern (`%VITE_ADSENSE_CLIENT_ID%`) のみ。1 ブランチ 1 PR で merge する umbrella plan。

## User Story

As a **Google 検索 / SNS 経由で初訪問した個人ユーザー**, I want **ランディングを 5〜10 秒読んで何ができるか把握 → D&D に手を伸ばす流れを違和感なく体験**, so that **画面右下/上に将来出る広告枠も含めて「最初から組み込まれていた家具」のように違和感がなく試用判断ができる**.

## Problem → Solution

**Current**: `LocalEditor` は画像未投入時に `<DropZone>` のみが表示され、初訪問者は文脈なしで判断する → 高 bounce 蓋然性 + AdSense 後付けで CLS 悪化リスク。

**Desired**: 画像未投入時にランディング (Hero + 機能 3 点 + 使い方 + FAQ) が `<DropZone>` を中央に保ったまま展開、page shell に固定サイズ ad slot が予約済 → bounce < 60% / first-upload > 30% / CLS p75 < 0.1、Phase 11 で AdSense 貼付時に追加レイアウト改修 0 行。

## Metadata

- **Complexity**: **Medium** (10〜15 ファイル / 400〜700 LOC、新規 component + i18n key + E2E + a11y、既存パターン踏襲のみで大規模リファクタ不要)
- **Source PRD**: [`phase-10-h-landing-and-ad-slots.prd.md`](../prds/phase-10-h-landing-and-ad-slots.prd.md)
- **PRD Phase**: umbrella (Plan 内に Phase 1〜5 を内包、PRD の Implementation Phases に対応)
- **Estimated Files**: 12 created / 6 modified
- **Branch**: `feat/phase-10-h-landing-and-ad-slots`

---

## UX Design

### Before

```
┌─────────────────────────────────────────────────────┐
│  pitamark              [LangToggle] [Help] [...]    │  ← header (absolute top-0)
├─────────────────────────────────────────────────────┤
│                                                      │
│                                                      │
│         ┌───────────────────────────────┐           │
│         │                                │           │
│         │    [画像をドロップしてください]    │           │   ← <DropZone>
│         │                                │           │
│         └───────────────────────────────┘           │
│                                                      │
│                                                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```
初訪問者は「これは何」「無料」「安全」を判断する材料が無いまま離脱判断する。

### After

**Wide viewport (`lg:` 以上, 1024px+)**:

```
┌────┬──────────────────────────────────────────┬────┐
│    │ pitamark      [LangToggle] [Help] [...]  │    │
│ Ad ├──────────────────────────────────────────┤ Ad │
│ □  │  画像URL一発で共同注釈 — pitamark         │ □  │
│    │  チャットで「ここ」と注釈を付けて共有      │    │
│    │  ┌───────────────────────────┐           │    │
│ pl │  │ 画像をドロップしてください  │           │ pl │
│ ac │  │   D&D / paste / pick      │           │ ac │
│ eh │  └───────────────────────────┘           │ eh │
│ ol │  [Hero UI スクショ WebP]                   │ ol │
│ de │                                           │ de │
│ r  │  ─ 機能 3 点 ─                            │ r  │
│    │  [URL一発] [共同編集] [ユルくTTL]          │    │
│    │                                           │    │
│    │  ─ 使い方 ─                              │    │
│    │  画像入れる → 注釈する → URLコピー         │    │
│    │                                           │    │
│    │  ─ FAQ (Could) ─                         │    │
│    │  画像はどこ保存？/ TTL? / 無料? / 権限?   │    │
└────┴──────────────────────────────────────────┴────┘
   ↑ 左右レール                              ↑ メインコンテンツ
   各 160px width × stage height (固定)
```

**Narrow viewport (`lg:` 未満, < 1024px)**:

```
┌─────────────────────────────────┐
│ pitamark   [Lang] [Help] [...]  │
├─────────────────────────────────┤
│ 画像URL一発で共同注釈            │
│ ┌─────────────────────────────┐ │
│ │ 画像をドロップしてください    │ │
│ └─────────────────────────────┘ │
│ [Hero UI スクショ]               │
│ ─ 機能 3 点 ─                   │
│ ─ 使い方 ─                     │
│ ─ FAQ ─                        │
├─────────────────────────────────┤
│ Ad placeholder (静的, 100px h)  │  ← bottom 固定 (NOT sticky)
└─────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `/` 着地直後 | `<DropZone>` のみ表示 | Hero (見出し+価値文+UI スクショ+`<DropZone>`) + 機能 + 使い方 + ad slot | ルート分割なし、条件付きレンダリング |
| 画像投入後 | `<CanvasStage>` 表示 | `<CanvasStage>` 表示 (変更なし) | エディタ動作は無変更 |
| viewport `lg:` 切替 | レイアウト無変化 | wide で左右レール / narrow で下部静的 | Tailwind v4 `lg:` breakpoint (1024px) |
| `/r/:roomId` 直接アクセス | RoomEditor 表示 | RoomEditor 表示 (変更なし) | 共同編集 URL は無影響 |
| LangToggle で en に切替 | UI 文言が en に | UI + landing 文言が en に | `landing.*` keys 追加 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **P0** | [`apps/web/src/pages/EditorShell.tsx`](../../../apps/web/src/pages/EditorShell.tsx) | 504-589 | page shell root layout + `<DropZone>` ↔ `<CanvasStage>` 条件分岐の本体。ad slot `<aside>` を差し込む正確な位置を確認 |
| **P0** | [`apps/web/src/pages/LocalEditor.tsx`](../../../apps/web/src/pages/LocalEditor.tsx) | 1-90 | landing section を差し込む component。`useImageSource.source === null` 判定でランディング表示 |
| **P0** | [`apps/web/src/i18n/keys.ts`](../../../apps/web/src/i18n/keys.ts) | 1-13 | `I18nKey` 型は `keyof typeof ja` で導出される → 新規 key 追加は **`ja.ts` を必ず先に**書く |
| **P0** | [`apps/web/src/i18n/ja.ts`](../../../apps/web/src/i18n/ja.ts) | 1-50 | dict 階層キー命名規約 (`surface.element.purpose`)。`landing.*` / `ad.*` 群を追加 |
| **P0** | [`apps/web/src/i18n/en.ts`](../../../apps/web/src/i18n/en.ts) | 1-50 | `Record<I18nKey, string>` で型強制 → ja に追加した key は en にも必須 |
| **P1** | [`apps/web/src/components/empty-state/DropZone.tsx`](../../../apps/web/src/components/empty-state/DropZone.tsx) | 1-50 | 既存 D&D component。Hero 内中央に **そのまま流用** (props は変更しない) |
| **P1** | [`apps/web/index.html`](../../../apps/web/index.html) | 1-80 | `%VITE_*%` placeholder pattern の既存使用箇所。`%VITE_ADSENSE_CLIENT_ID%` を `<head>` に仕込む位置を決める |
| **P1** | [`apps/web/vite.config.ts`](../../../apps/web/vite.config.ts) | 11-20 | `htmlEnvPlugin` の置換ロジック確認 (regex `%VITE_FOO%` → `env.VITE_FOO`) |
| **P1** | [`apps/web/src/styles/tokens.css`](../../../apps/web/src/styles/tokens.css) | 1-67 | 色 / spacing / radius CSS 変数。landing で参照する `--color-surface` `--color-text` `--color-accent` `--space-section` などを把握 |
| **P1** | [`apps/web/src/styles/global.css`](../../../apps/web/src/styles/global.css) | 4-39 | `@theme inline` で Tailwind 公開済の CSS 変数群。新規変数は tokens.css + global.css 両方に追加 |
| **P2** | [`apps/web/e2e/landing.spec.ts`](../../../apps/web/e2e/landing.spec.ts) | 1-59 | 既存 4 テストの構造。新規ケースは同パターンで追加 (viewport setup → goto → locator + expect) |
| **P2** | [`apps/web/playwright.config.ts`](../../../apps/web/playwright.config.ts) | 16-52 | `chromium + mobile-chrome` 2 project、`locale: 'ja-JP'`、webServer 2 process |
| **P2** | [`apps/web/src/pages/EditorPage.tsx`](../../../apps/web/src/pages/EditorPage.tsx) | 1-33 | `lazy(() => import(...))` + `<Suspense>` パターン。新規 landing components は landing 自体が初期ビュー → **lazy 不要** |
| **P2** | [`apps/web/src/components/toolbar/Toolbar.tsx`](../../../apps/web/src/components/toolbar/Toolbar.tsx) | 87-106 | `useTranslation()` 利用例。`const t = useTranslation(); t('key')` の呼び方 |
| **P2** | [`apps/web/src/i18n/index.ts`](../../../apps/web/src/i18n/index.ts) | 120-135 | `useTranslation()` の signature (`(key: I18nKey) => string`) |
| **P2** | [`pnpm-workspace.yaml`](../../../pnpm-workspace.yaml) | 1-50 | catalog 管理 dep 一覧。新規 `@axe-core/playwright` は **workspace-local** 推奨 (apps/web のみ使用) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| AdSense / CLS | [Google Publisher Tag — minimize layout shift](https://developers.google.com/publisher-tag/guides/minimize-layout-shift) | ad slot は CSS で **fixed/min-height** を先に確保。fluid は CLS 発生源 |
| AdSense / Web Vitals | [web.dev — CWV impact ad revenue](https://web.dev/articles/cwv-impact-ad-revenue) | 75th percentile CLS < 0.1 が "good" 基準。field data (CrUX) で検証 |
| Tailwind v4 sidebar | [Tailwind Docs — Responsive design](https://tailwindcss.com/docs/responsive-design) | `lg:` = 1024px+。`hidden lg:block` でレール出し分け、`grid lg:grid-cols-[160px_1fr_160px]` で 3 カラム化も可 |
| @axe-core/playwright | [Playwright — Accessibility testing](https://playwright.dev/docs/accessibility-testing) | `import AxeBuilder from '@axe-core/playwright'` → `new AxeBuilder({ page }).analyze()` で violations check。`expect(results.violations).toEqual([])` |

---

## Patterns to Mirror

### NAMING_CONVENTION (i18n key)
```
// SOURCE: apps/web/src/i18n/ja.ts:1-15
export const ja = {
  'common.appName': 'pitamark',
  'common.langToggle.label': '言語',
  'toolbar.group.label': '編集ツール',
  'toolbar.tool.select': '選択',
  // ...
};
```
新規 key は `landing.*` / `ad.*` prefix で同階層化:
```
'landing.hero.headline': '画像URL一発で共同注釈',
'landing.hero.subhead': 'チャットで「ここ」と注釈を付けて共有',
'landing.feature.urlShare.title': 'URL 一発共有',
'ad.placeholder.label': '広告枠 (将来配信)',
'ad.placeholder.aria': 'Sponsored placeholder',
```

### ERROR_HANDLING (i18n key 型強制)
```
// SOURCE: apps/web/src/i18n/keys.ts:1-13
import type { ja } from './ja';
export type I18nKey = keyof typeof ja;
```
**GOTCHA**: `ja.ts` に key を追加せずに `useTranslation()` で参照すると型エラー。**必ず ja → en の順で書く** (en は `Record<I18nKey, string>` で穴あけ不可)。

### LAYOUT_SHELL (page root)
```
// SOURCE: apps/web/src/pages/EditorShell.tsx:504-510
<main className="relative h-dvh w-dvw overflow-hidden bg-(--color-surface) text-(--color-text)">
  <header
    ref={headerRef}
    className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 px-3 py-2"
  >
```
**重要**: `h-dvh w-dvw` は landing でも維持。ad slot の `<aside>` は header の **隣接 sibling として `<main>` 直下に配置**。

### CONDITIONAL_RENDER (DropZone ↔ CanvasStage)
```
// SOURCE: apps/web/src/pages/EditorShell.tsx:544-565
<div
  ref={stageContainerRef}
  className="absolute inset-x-0 bottom-0"
  style={{ top: headerHeight, height: stageHeight }}
>
  {source ? (
    <CanvasStage src={source.url} ... />
  ) : onLoadFile ? (
    <DropZone onFile={onLoadFile} error={imageError} />
  ) : (
    <div className="flex h-full items-center justify-center text-sm opacity-60">
      {t('dropzone.loading')}
    </div>
  )}
</div>
```
**Phase 10.H 拡張方針**: `<DropZone onFile=... error=... />` の枝を **`<LandingShell>` でラップ**して、Hero / Features / HowTo / FAQ + 中央に `<DropZone>` を入れ子表示する。

### USE_TRANSLATION
```
// SOURCE: apps/web/src/components/toolbar/Toolbar.tsx:87-91
const t = useTranslation();
return (
  <TooltipProvider delay={150}>
    <div role="toolbar" aria-label={t('toolbar.group.label')} className={...}>
```
landing 内 component でも同じ呼び方。

### RESPONSIVE_BREAKPOINT
```
// SOURCE: apps/web/src/pages/EditorShell.tsx:509, 532
<h1 className="... hidden md:block">
<div className="... md:w-30">
```
**ad slot 用パターン**:
```tsx
<aside
  aria-label={t('ad.placeholder.aria')}
  className="hidden lg:block lg:w-40 lg:min-h-[600px] absolute inset-y-0 left-0 ..."
>
```
`lg:` = 1024px+。`hidden` で narrow では非表示、bottom rail は別 `<aside>` で `lg:hidden` を付与。

### ENV_PLACEHOLDER (index.html)
```html
<!-- SOURCE: apps/web/index.html (existing) -->
<link rel="canonical" href="%VITE_PUBLIC_URL%" />
<meta property="og:url" content="%VITE_PUBLIC_URL%" />
```
追加箇所:
```html
<!-- Phase 10.H: AdSense client ID placeholder (script は Phase 11+ で追加) -->
<meta name="google-adsense-account" content="%VITE_ADSENSE_CLIENT_ID%" />
```
**vite.config.ts の `htmlEnvPlugin` で自動置換** (env が未設定なら空文字 → meta tag は空 content で残る、無害)。

### LAZY_LOADING (使うべきか)
```
// SOURCE: apps/web/src/pages/EditorPage.tsx:1-33
const LocalEditor = lazy(() => import('./LocalEditor').then(...));
```
**判断**: landing は `LocalEditor` の **初期ビュー** で必ず通る path → lazy 不要。動画 (Could) を入れる場合のみその component だけ lazy 化検討。

### TEST_E2E
```typescript
// SOURCE: apps/web/e2e/landing.spec.ts:1-15
import { expect, test } from '@playwright/test';

test('landing page renders heading on desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('pitamark');
});
```
新規ケースは同形式。viewport を変えて narrow/wide 両方検証。

### A11Y_TEST
```typescript
// 新規パターン (axe 導入後)
import AxeBuilder from '@axe-core/playwright';
test('landing has no a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/components/landing/LandingShell.tsx` | **CREATE** | landing 全体の wrapper component (Hero + Features + HowTo + FAQ + 中央 `<DropZone>` を slot 化して受け取る) |
| `apps/web/src/components/landing/Hero.tsx` | **CREATE** | 見出し + 価値 1 行 + Hero UI スクショ + `<DropZone>` 配置 (children として受け取る) |
| `apps/web/src/components/landing/Features.tsx` | **CREATE** | 機能 3 点グリッド (URL 一発 / 共同編集 / TTL) |
| `apps/web/src/components/landing/HowTo.tsx` | **CREATE** | 使い方 1 行例 (3 step 横並び) |
| `apps/web/src/components/landing/Faq.tsx` | **CREATE** (Could) | アコーディオン FAQ 4 件。shadcn 未導入なので **`<details>` HTML 標準**で実装 (a11y 自然) |
| `apps/web/src/components/ad/AdSlot.tsx` | **CREATE** | placeholder div (固定 `min-height` + 単色 + ラベル)。`variant: 'rail' \| 'bottom'` で出し分け |
| `apps/web/src/components/landing/__tests__/Hero.test.tsx` | **CREATE** | vitest unit (見出し / dropzone slot 表示) |
| `apps/web/src/components/landing/__tests__/Features.test.tsx` | **CREATE** | vitest unit (3 機能 item 表示) |
| `apps/web/src/components/ad/__tests__/AdSlot.test.tsx` | **CREATE** | vitest unit (variant ごとの className / aria-label / min-height style) |
| `apps/web/public/landing-hero.webp` | **CREATE** (Should) | エディタ実 UI スクショ WebP。Playwright で `apps/web/e2e/snapshots/landing-hero/` に既存 snapshot があれば流用、なければ手動 generate |
| `apps/web/public/landing-hero.png` | **CREATE** (Should) | WebP fallback (古いブラウザ用、`<picture>` で出し分け) |
| `apps/web/e2e/landing.spec.ts` | **UPDATE** | 既存 4 ケースに +5 ケース (Hero 表示 / ad slot wide / ad slot narrow / a11y / cls measure) |
| `apps/web/src/pages/EditorShell.tsx` | **UPDATE** | `<main>` 直下に `<aside>` 2 つ追加、stage container の inset を `lg:left-40 lg:right-40` に修正 |
| `apps/web/src/pages/LocalEditor.tsx` | **UPDATE** | `<EditorShell>` の `onLoadFile` prop を渡す前に **`<LandingShell>` で `<DropZone>` をラップ**するよう変更 (※ EditorShell 側の signature 互換性に注意) |
| `apps/web/src/i18n/ja.ts` | **UPDATE** | `landing.*` (~15 keys) + `ad.*` (~3 keys) 追加 |
| `apps/web/src/i18n/en.ts` | **UPDATE** | ja に対応する en draft 追加 (英訳は ADR-0004 の "draft 体制" 適用) |
| `apps/web/index.html` | **UPDATE** | `<meta name="google-adsense-account" content="%VITE_ADSENSE_CLIENT_ID%" />` 追加 + JSON-LD 拡張 (`FAQPage` schema) |
| `apps/web/.env.example` | **UPDATE** | `VITE_ADSENSE_CLIENT_ID=` (空値) を追加、コメントで「Phase 11+ で実値設定」明記 |
| `apps/web/package.json` | **UPDATE** | `devDependencies` に `@axe-core/playwright: ^4.10` 追加 (workspace-local) |

## NOT Building

- **AdSense `<script src="https://pagead2.googlesyndication.com/...">` 注入** (Phase 11+)
- **`<ins class="adsbygoogle">` タグ + `adsbygoogle.push()`** (Phase 11+)
- **`/ads.txt` / `/app-ads.txt`** (実接続時)
- **Cookie 同意バナー / GDPR consent UI** (実接続時)
- **`react-router-dom` 導入によるルート分割** — 条件付きレンダリングで吸収
- **Loop 動画** (Could C1, 見送り)
- **`framer-motion` / GSAP 導入** — CSS transition で十分
- **i18n 3 言語以上** — 日英のみ (ADR-0004)
- **A/B テスト基盤**
- **Plausible / GA4 など新規 Analytics** — CF Web Analytics のみ (Phase 10.G)
- **OG image の WebP 化以外の素材変更** (favicon 再デザイン等は Phase 10.D で完了)

---

## Step-by-Step Tasks

### Task 1: i18n key を ja → en に追加
- **ACTION**: `landing.*` (15 keys 程度) + `ad.*` (3 keys) を `ja.ts` に追加 → そのまま en draft を `en.ts` に追加
- **IMPLEMENT**:
  ```typescript
  // ja.ts に追加
  'landing.hero.headline': '画像URL一発で共同注釈',
  'landing.hero.subhead': 'チャットで「ここ」と注釈を付けて、URLでそのまま共有・共同編集。',
  'landing.hero.previewAlt': 'pitamark エディタの利用イメージ',
  'landing.feature.urlShare.title': 'URL 一発共有',
  'landing.feature.urlShare.body': 'アップロード即発行。会員登録不要。',
  'landing.feature.collab.title': '共同編集',
  'landing.feature.collab.body': '同じ URL を開けば、相手も注釈を書ける。',
  'landing.feature.ttl.title': 'ゆるい TTL',
  'landing.feature.ttl.body': 'デフォルト 24h で自動消失。長期保管しません。',
  'landing.howto.heading': '使い方',
  'landing.howto.step1': '画像をドロップ',
  'landing.howto.step2': '注釈を書く',
  'landing.howto.step3': 'URL をコピーして送る',
  'landing.faq.q1': '画像はどこに保存される？',
  'landing.faq.a1': 'Cloudflare R2 に保存され、TTL 経過で自動削除されます。',
  'landing.faq.q2': '無料？',
  'landing.faq.a2': '基本機能は無料です。',
  'landing.faq.q3': '誰が編集できる？',
  'landing.faq.a3': 'URL を知っている人全員。パスワード保護も設定できます。',
  'landing.faq.q4': 'AdSense は出る？',
  'landing.faq.a4': '将来出る予定の領域を確保しています。現在は配信していません。',
  'ad.placeholder.label': '広告枠',
  'ad.placeholder.note': 'Phase 11+ で配信予定',
  'ad.placeholder.aria': 'Sponsored placeholder',
  ```
  英語版は `pitamark` ブランド名と meaning を維持して訳す (例: 'landing.hero.headline': 'Annotate any image. Share by URL.')。
- **MIRROR**: NAMING_CONVENTION (上掲)
- **IMPORTS**: なし (既存 ja.ts / en.ts への純粋追加)
- **GOTCHA**: `I18nKey = keyof typeof ja` なので **ja を必ず先に書いてから en を書く** (en は Record で型強制、key 漏れがビルドエラーになる)。"order matters"
- **VALIDATE**: `pnpm -F @pitamark/web typecheck` でエラーなし。`grep -r "landing\." apps/web/src/i18n/` で 18 keys × 2 言語 = 36 行確認

### Task 2: `<AdSlot>` component 作成 (variant 'rail' | 'bottom')
- **ACTION**: `apps/web/src/components/ad/AdSlot.tsx` を新規作成
- **IMPLEMENT**:
  ```tsx
  import { useTranslation } from '../../i18n';

  type Variant = 'rail' | 'bottom';

  type AdSlotProps = Readonly<{
    variant: Variant;
    side?: 'left' | 'right';  // variant === 'rail' でのみ使用
  }>;

  const RAIL_WIDTH_PX = 160;
  const RAIL_MIN_HEIGHT_PX = 600;
  const BOTTOM_HEIGHT_PX = 100;

  export const AdSlot = ({ variant, side }: AdSlotProps) => {
    const t = useTranslation();
    const baseClass =
      'flex items-center justify-center bg-(--color-toolbar-bg) text-xs uppercase tracking-wider opacity-50 select-none';

    if (variant === 'rail') {
      const sideClass = side === 'left' ? 'left-0' : 'right-0';
      return (
        <aside
          aria-label={t('ad.placeholder.aria')}
          className={`hidden lg:flex absolute inset-y-0 ${sideClass} z-0`}
          style={{ width: RAIL_WIDTH_PX, minHeight: RAIL_MIN_HEIGHT_PX }}
        >
          <div className={`${baseClass} h-full w-full`}>
            {t('ad.placeholder.label')}
          </div>
        </aside>
      );
    }
    // bottom variant
    return (
      <aside
        aria-label={t('ad.placeholder.aria')}
        className="lg:hidden relative w-full"
        style={{ minHeight: BOTTOM_HEIGHT_PX, height: BOTTOM_HEIGHT_PX }}
      >
        <div className={`${baseClass} h-full w-full`}>
          {t('ad.placeholder.label')}
        </div>
      </aside>
    );
  };
  ```
- **MIRROR**: USE_TRANSLATION + RESPONSIVE_BREAKPOINT
- **IMPORTS**: `import { useTranslation } from '../../i18n';`
- **GOTCHA**:
  - **min-height は固定 px 必須** (clamp / dvh 等は CLS 発生源、PRD Risk 表参照)
  - `aria-label` は **ja-JP locale でも英語固定** (AdSense ポリシーで "Sponsored" 表記が好まれるため、検査ツール向けは固定英文。日本語ラベルは visible 中身に表示)
  - `bg-(--color-toolbar-bg)` は Tailwind v4 の任意値 syntax で CSS 変数参照
- **VALIDATE**: `pnpm -F @pitamark/web typecheck` 緑、unit test (Task 3) で min-height style が文字列で含まれることを確認

### Task 3: `<AdSlot>` の vitest unit test
- **ACTION**: `apps/web/src/components/ad/__tests__/AdSlot.test.tsx` 新規作成
- **IMPLEMENT**:
  ```tsx
  import { describe, expect, it } from 'vitest';
  import { createRoot } from 'react-dom/client';
  import { act } from 'react';
  import { AdSlot } from '../AdSlot';

  describe('AdSlot', () => {
    it('rail variant has hidden lg:flex and fixed width/min-height', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      act(() => { root.render(<AdSlot variant="rail" side="left" />); });

      const aside = container.querySelector('aside');
      expect(aside).not.toBeNull();
      expect(aside?.className).toContain('hidden');
      expect(aside?.className).toContain('lg:flex');
      expect(aside?.getAttribute('style')).toContain('width: 160px');
      expect(aside?.getAttribute('style')).toContain('min-height: 600px');

      act(() => { root.unmount(); });
      document.body.removeChild(container);
    });

    it('bottom variant has lg:hidden and fixed height', () => {
      // 同様のパターンで variant="bottom" を検証
    });

    it('rail with side=right has right-0 className', () => {
      // side prop の検証
    });
  });
  ```
- **MIRROR**: TEST_STRUCTURE (`apps/web/src/hooks/__tests__/useKeyboardShortcuts.test.tsx:1-40` の React root + act() パターン)
- **IMPORTS**: `vitest`, `react-dom/client`, `react` (act)
- **GOTCHA**: vitest 設定 `globals: false` のため `import { describe, expect, it } from 'vitest'` 必須 (`apps/web/vite.config.ts:74-90`)
- **VALIDATE**: `pnpm -F @pitamark/web test -- src/components/ad/__tests__/AdSlot.test.tsx` 緑

### Task 4: `<Hero>` / `<Features>` / `<HowTo>` / `<Faq>` (Could) component 作成
- **ACTION**: `apps/web/src/components/landing/{Hero,Features,HowTo,Faq}.tsx` を新規作成
- **IMPLEMENT**: 例として Hero:
  ```tsx
  import type { ReactNode } from 'react';
  import { useTranslation } from '../../i18n';

  type HeroProps = Readonly<{
    /** `<DropZone>` を中央に slot 化して受け取る */
    dropzone: ReactNode;
  }>;

  export const Hero = ({ dropzone }: HeroProps) => {
    const t = useTranslation();
    return (
      <section
        aria-labelledby="landing-hero-heading"
        className="flex flex-col items-center gap-6 px-6 pt-20 pb-12 md:pt-24 lg:pt-28"
      >
        <h1
          id="landing-hero-heading"
          className="max-w-2xl text-center text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
        >
          {t('landing.hero.headline')}
        </h1>
        <p className="max-w-xl text-center text-base opacity-70 md:text-lg">
          {t('landing.hero.subhead')}
        </p>
        <div className="w-full max-w-2xl">
          {dropzone}
        </div>
        <picture>
          <source srcSet="/landing-hero.webp" type="image/webp" />
          <img
            src="/landing-hero.png"
            alt={t('landing.hero.previewAlt')}
            width={1200}
            height={750}
            loading="eager"
            fetchPriority="high"
            className="w-full max-w-3xl rounded-xl shadow-lg"
          />
        </picture>
      </section>
    );
  };
  ```
  Features は機能 3 点を `grid grid-cols-1 md:grid-cols-3 gap-6`、HowTo は使い方 3 step を横並び、Faq は `<details><summary>...</summary>...</details>` HTML 標準でアコーディオン化。
- **MIRROR**: USE_TRANSLATION + RESPONSIVE_BREAKPOINT (`md:` `lg:` 利用例)
- **IMPORTS**: `useTranslation` のみ。新規 lib なし
- **GOTCHA**:
  - `<picture>` + `<img loading="eager" fetchPriority="high">` は **hero のみ** (LCP 用)、それ以外の画像があれば `loading="lazy"`
  - `width` / `height` 属性必須 (CLS 防止)
  - `aria-labelledby` で h1 と section を結ぶ (a11y)
  - `<details>` ベース FAQ は `<summary>` の `cursor-pointer` を CSS で追加
- **VALIDATE**: 各 component の vitest unit (Hero / Features / HowTo) を作成、`pnpm -F @pitamark/web test` 緑。視覚は Task 9 の E2E で確認

### Task 5: `<LandingShell>` で landing 全体を組み立て
- **ACTION**: `apps/web/src/components/landing/LandingShell.tsx` 新規作成
- **IMPLEMENT**:
  ```tsx
  import type { ReactNode } from 'react';
  import { Hero } from './Hero';
  import { Features } from './Features';
  import { HowTo } from './HowTo';
  import { Faq } from './Faq';

  type LandingShellProps = Readonly<{
    dropzone: ReactNode;
  }>;

  export const LandingShell = ({ dropzone }: LandingShellProps) => (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-(--space-section) overflow-y-auto pb-24">
      <Hero dropzone={dropzone} />
      <Features />
      <HowTo />
      <Faq />
    </div>
  );
  ```
- **MIRROR**: 既存 component composition 慣行 (toolbar の Toolbar.tsx と同様、props で children 流す)
- **IMPORTS**: 4 つの新 component
- **GOTCHA**: `overflow-y-auto` が必須 (landing は h-dvh container 内なので、スクロール可にしないと FAQ まで届かない)
- **VALIDATE**: typecheck 緑、Task 9 の E2E で全 section が見える

### Task 6: `EditorShell.tsx` に ad slot を組込み
- **ACTION**: `<main>` 直下に `<AdSlot variant="rail" side="left">` `<AdSlot variant="rail" side="right">` `<AdSlot variant="bottom">` を追加、stage container の inset を `lg:left-40 lg:right-40` に修正
- **IMPLEMENT**: 該当箇所 (`apps/web/src/pages/EditorShell.tsx:504` 付近):
  ```tsx
  <main className="relative h-dvh w-dvw overflow-hidden bg-(--color-surface) text-(--color-text)">
    <AdSlot variant="rail" side="left" />
    <AdSlot variant="rail" side="right" />
    <header ref={headerRef} className="... lg:left-40 lg:right-40">
      ...
    </header>
    <div
      ref={stageContainerRef}
      className="absolute bottom-0 inset-x-0 lg:left-40 lg:right-40"
      style={{ top: headerHeight, height: stageHeight }}
    >
      {source ? <CanvasStage ... /> : ...}
    </div>
    {/* 下部 ad slot は narrow viewport 用、stage の下に flexbox 内で並ぶ */}
    <AdSlot variant="bottom" />
  </main>
  ```
  ※ 実装上の細かい配置調整 (z-index 含む) は実装時に確認
- **MIRROR**: LAYOUT_SHELL + CONDITIONAL_RENDER + RESPONSIVE_BREAKPOINT
- **IMPORTS**: `import { AdSlot } from '../components/ad/AdSlot';`
- **GOTCHA**:
  - rail variant は `absolute inset-y-0` で position 取るので **`<main className="relative">` の relative が前提** (既存で OK)
  - `lg:left-40` は 160px (Tailwind の `40` = 10rem = 160px、AdSlot RAIL_WIDTH_PX と一致させる)
  - bottom variant は narrow only、`lg:hidden` で wide では完全消滅 → CLS 発生せず
  - **既存 stage 高さ計算が `headerHeight` 依存** で `stageHeight = window.innerHeight - headerHeight` 系の場合、bottom rail 分を引かなくてはならない可能性あり (実装時に `useStageSize` を確認)
- **VALIDATE**: `pnpm -F @pitamark/web dev` 起動 → ブラウザで wide / narrow 切替えて目視確認 + Task 9 E2E

### Task 7: `LocalEditor.tsx` でランディング条件付きレンダリング
- **ACTION**: 画像未投入時に `<LandingShell>` を `<DropZone>` の代わりに `EditorShell` に渡す。`EditorShell` の API に大きな変更は加えず、`<LandingShell>` を `onLoadFile` 経由ではなく **新 prop `landingSlot`** で受け取れるようにするか、もしくは `<DropZone>` を `<LandingShell>` でラップした単一 component を `onLoadFile` から作って渡す
- **IMPLEMENT**: 一案 (LocalEditor 側で wrap):
  ```tsx
  // apps/web/src/pages/LocalEditor.tsx
  export const LocalEditor = ({ onRoomIdChange }: Props) => {
    const t = useTranslation();
    const { source, errorKey, loadFromFile, clear } = useImageSource({ ... });
    const error = errorKey ? t(errorKey) : null;

    // ↓ 既存の dropzone + EditorShell 連携
    return (
      <EditorShell
        source={source}
        error={error}
        onLoadFile={loadFromFile}
        onClearImage={clear}
        // 新 prop: landing は EditorShell 側で source===null かつ landingSlot がある時に DropZone の代わりに表示
        landingSlot={(dropzoneNode) => <LandingShell dropzone={dropzoneNode} />}
        ...
      />
    );
  };
  ```
  EditorShell 側は:
  ```tsx
  // apps/web/src/pages/EditorShell.tsx (条件分岐部分)
  {source ? (
    <CanvasStage ... />
  ) : onLoadFile ? (
    landingSlot ? (
      landingSlot(<DropZone onFile={onLoadFile} error={imageError} />)
    ) : (
      <DropZone onFile={onLoadFile} error={imageError} />
    )
  ) : (
    <div>{t('dropzone.loading')}</div>
  )}
  ```
- **MIRROR**: CONDITIONAL_RENDER (既存パターンを slot 関数受け渡しで拡張)
- **IMPORTS**: `import { LandingShell } from '../components/landing/LandingShell';`
- **GOTCHA**:
  - `RoomEditor` も `EditorShell` を使う場合、`landingSlot` は LocalEditor のみ渡す (RoomEditor では未投入状態が無いので不要)
  - `<DropZone>` の `onFile` 関数 reference は `useCallback` 化が望ましい (再描画ループ防止) — 既存実装を確認、未対応なら追加
  - **stage 領域の position 設定** (`absolute bottom-0 top-{headerHeight}`) を変更しないこと。landing は `<DropZone>` を含む div の中で `overflow-y-auto` を有効化して縦スクロール
- **VALIDATE**: dev で「画像未投入 → ランディング表示」「画像 D&D → エディタ表示」の往復が flicker なく動く

### Task 8: `index.html` の AdSense placeholder + JSON-LD 拡張 + `.env.example` 更新
- **ACTION**:
  - `index.html` に `<meta name="google-adsense-account" content="%VITE_ADSENSE_CLIENT_ID%" />` 追加 (head 末尾、analytics の上)
  - JSON-LD `<script type="application/ld+json">` に **`FAQPage` schema** を追記 (Faq の Q/A 4 件と同期)
  - `apps/web/.env.example` に `VITE_ADSENSE_CLIENT_ID=` (空値、コメントで Phase 11+ 設定明記)
- **IMPLEMENT**:
  ```html
  <!-- index.html, before <script src="...turnstile..."> -->
  <meta name="google-adsense-account" content="%VITE_ADSENSE_CLIENT_ID%" />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "画像はどこに保存される？", "acceptedAnswer": {"@type": "Answer", "text": "Cloudflare R2 に保存され..."}},
        ...
      ]
    }
  </script>
  ```
  ```ini
  # apps/web/.env.example に追加
  # Phase 10.H: AdSense placeholder。Phase 11+ で実 client ID に差し替える。
  VITE_ADSENSE_CLIENT_ID=
  ```
- **MIRROR**: ENV_PLACEHOLDER (既存 `%VITE_PUBLIC_URL%` パターン)
- **IMPORTS**: なし (HTML / env)
- **GOTCHA**:
  - JSON-LD は既存 `SoftwareApplication` schema **と別の `<script>` ブロック**で書く (混ぜないこと)
  - `VITE_ADSENSE_CLIENT_ID` が空文字の場合、`<meta>` の content も空 → 無害だが Lighthouse SEO で警告でないか念のため確認 (warning なら meta tag を `htmlEnvPlugin` で完全削除する分岐を追加)
- **VALIDATE**: `pnpm -F @pitamark/web build` 緑、`dist/index.html` を grep して `%VITE_ADSENSE_CLIENT_ID%` が残っていないこと、Google Rich Results Test で FAQPage schema が Valid

### Task 9: E2E (`landing.spec.ts`) を 5 ケース追加
- **ACTION**: 既存 4 ケースに以下 5 ケース追加:
  1. ランディングの Hero h1 文言が表示
  2. 機能 3 点が表示 (3 つの heading が見える)
  3. wide viewport (1280) で左右 ad slot が表示、narrow (600) で bottom ad slot 表示
  4. ad slot の `min-height` が固定 px で設定されている (CLS 確認)
  5. 画像 D&D したら landing が消えて canvas に切替 (golden path)
- **IMPLEMENT**: 例ケース 3:
  ```typescript
  test('rail ad slot is visible on wide viewport (lg+)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const railLeft = page.getByRole('complementary', { name: 'Sponsored placeholder' }).first();
    await expect(railLeft).toBeVisible();
    const styleAttr = await railLeft.getAttribute('style');
    expect(styleAttr).toContain('width: 160px');
    expect(styleAttr).toContain('min-height: 600px');
  });

  test('bottom ad slot is visible on narrow viewport (< lg)', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto('/');
    const bottom = page.getByRole('complementary', { name: 'Sponsored placeholder' });
    await expect(bottom.last()).toBeVisible();
  });
  ```
- **MIRROR**: TEST_E2E (`apps/web/e2e/landing.spec.ts:1-15` の viewport + goto + locator パターン)
- **IMPORTS**: `import { expect, test } from '@playwright/test';` (既存と同じ)
- **GOTCHA**:
  - `getByRole('complementary')` が `<aside>` を拾う。複数あるので `.first()` `.last()` で分離
  - `mobile-chrome` project (Pixel 5 / 393×851) は `lg:` 未満 → bottom rail テストは mobile-chrome 自動カバー、`chromium` project でも `setViewportSize(600, 800)` で narrow 検証
- **VALIDATE**: `pnpm -F @pitamark/web test:e2e` 緑、`pnpm -F @pitamark/web test:e2e -- -g "ad slot"` で対象 5 件のみ実行可能

### Task 10: a11y testing — `@axe-core/playwright` 導入 + landing.spec.ts 拡張
- **ACTION**:
  - `apps/web/package.json` の `devDependencies` に `"@axe-core/playwright": "^4.10"` 追加 (workspace-local、catalog 不要)
  - `pnpm install` で取込
  - `landing.spec.ts` に a11y ケース追加 (wcag2aa + wcag22aa tags)
- **IMPLEMENT**:
  ```typescript
  import AxeBuilder from '@axe-core/playwright';

  test('landing page has no a11y violations (wcag2aa + wcag22aa)', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
  ```
- **MIRROR**: A11Y_TEST (上掲)
- **IMPORTS**: `import AxeBuilder from '@axe-core/playwright';`
- **GOTCHA**:
  - Vitest 側は `vitest-axe` 別パッケージ。今回は **E2E 層のみで a11y 担保** (vitest は component prop / class 検証に絞る)
  - `withTags` で WCAG 2.2 AA を要求、それ以前の version も含める (重複は axe 内部で de-dup)
  - violations が出た場合は 1 件ずつ修正 (label 不足 / contrast 不足 / heading 階層飛び 等)
- **VALIDATE**: `pnpm -F @pitamark/web test:e2e -- -g "a11y"` 緑

### Task 11: Hero UI スクショ (WebP) 生成 (Should)
- **ACTION**: 実エディタ画面 (画像 1 枚 + 矩形/矢印/テキスト/ハイライト 4 注釈付き) を Playwright で 1200×750 で撮影 → WebP に変換 → `apps/web/public/landing-hero.{webp,png}` に配置
- **IMPLEMENT**: 一回限りの生成 script を `apps/web/scripts/generate-landing-hero.ts` に書く。または Playwright spec で snapshot 化 (CI で再生成可)
  ```typescript
  // 略式: e2e で 1 度撮影 → cwebp で webp 変換 → public/ にコピー
  ```
  詳細手順は実装時にオーナーと相談 (手動でも可)。
- **MIRROR**: なし (新規)
- **IMPORTS**: なし
- **GOTCHA**:
  - スクショに含む画像は **権利フリーの自前画像** を使う (Unsplash の license 確認、もしくは pitamark 自身のスクショなど)
  - WebP 生成は `cwebp` (libwebp) 必須。Mac は `brew install webp`
  - 1200×750 は OG image と異なる size (OG は 1200×630)、混同しない
- **VALIDATE**: `apps/web/public/landing-hero.webp` が < 80 KB、Lighthouse Performance スコア低下 < 2 pt

### Task 12: 動作確認 + Lighthouse spot check
- **ACTION**: ローカルで build → preview → Lighthouse 実行 (chromium dev tools or `npx lhci autorun --collect.url=http://localhost:4173`)
- **IMPLEMENT**:
  ```bash
  pnpm -F @pitamark/web build
  pnpm -F @pitamark/web preview &
  # 別ターミナル
  npx -y @lhci/cli@0.13 autorun --collect.url=http://localhost:4173 --collect.numberOfRuns=3 --upload.target=temporary-public-storage
  # もしくは Chrome DevTools の Lighthouse タブで手動
  ```
- **MIRROR**: なし
- **IMPORTS**: なし
- **GOTCHA**:
  - `preview` は production build を提供、dev mode は計測対象外
  - 4173 は vite preview のデフォルト
  - LHCI は本リリースには不要、spot check のみ
- **VALIDATE**: Performance / Accessibility / Best Practices / SEO すべて **90+**、CLS p75 **< 0.1**

---

## Testing Strategy

### Unit Tests (vitest)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `AdSlot rail left` | `<AdSlot variant="rail" side="left" />` | `aside` 要素、className に `hidden lg:flex` `left-0`、style に `width: 160px; min-height: 600px` | - |
| `AdSlot rail right` | `<AdSlot variant="rail" side="right" />` | className に `right-0` | - |
| `AdSlot bottom` | `<AdSlot variant="bottom" />` | className に `lg:hidden`、style に `min-height: 100px` | - |
| `Hero` | `<Hero dropzone={<div data-testid="dz" />} />` | h1 で landing.hero.headline 文言、subhead 表示、`<picture>` で WebP source、img alt あり、children dropzone DOM 含む | dropzone slot |
| `Features` | `<Features />` | 3 つの heading (URL一発 / 共同編集 / TTL)、grid layout | - |
| `HowTo` | `<HowTo />` | 3 step (画像入れる / 注釈する / URL コピー) | - |
| `Faq` (Could) | `<Faq />` | 4 つの details / summary | アコーディオン展開 |
| `LandingShell` | `<LandingShell dropzone={...} />` | Hero + Features + HowTo + Faq の順で render、dropzone は Hero に渡る | - |

### E2E Tests (Playwright)

| Test | Viewport | Expected | Edge Case? |
|---|---|---|---|
| Existing #1 (h1 desktop) | 1280×800 | h1 = 'pitamark' | - |
| Existing #2 (dropzone hint) | default | "画像をドロップしてください" 表示 | - |
| Existing #3 (toolbar disabled) | default | rectangle button disabled | - |
| Existing #4 (h1 hide narrow) | 480×800 | h1 hidden | viewport |
| **NEW #5** (Hero h1) | 1280×800 | landing.hero.headline 文言が h1 に | - |
| **NEW #6** (Features 3 items) | default | 3 つの feature heading 表示 | - |
| **NEW #7** (rail wide) | 1280×800 | 左右 aside (Sponsored placeholder) 可視、style 固定 px | width / min-height assert |
| **NEW #8** (bottom narrow) | 600×800 | bottom aside 可視 | viewport |
| **NEW #9** (a11y) | default | axe violations = 0 | wcag22aa |
| **NEW #10** (golden path) | default | landing 表示 → file input で image upload → canvas 表示 + landing 消失 | state transition |

### Edge Cases Checklist

- [x] `useImageSource.source === null` 状態 = ランディング表示
- [x] `useImageSource.source !== null` 状態 = 既存エディタ表示 (regression なし)
- [x] viewport 1024px 境界での切替 (lg breakpoint)
- [x] mobile-chrome project (393×851) で narrow rail のみ表示
- [x] LangToggle で en に切替後、landing 文言が en に
- [x] D&D の golden path (landing → drop → editor)
- [x] reduced-motion 設定 (prefers-reduced-motion: reduce で transition 停止) — Could 範囲のみ
- [x] flat color contrast (axe で wcag22aa 検証)

---

## Validation Commands

### Static Analysis
```bash
pnpm -F @pitamark/web typecheck
```
EXPECT: 0 errors. New i18n keys properly typed via `keyof typeof ja`.

```bash
pnpm lint
```
EXPECT: Biome errors / warnings = 0 (新規ファイルが既存設定に従う).

### Unit Tests
```bash
pnpm -F @pitamark/web test
```
EXPECT: All vitest tests pass, including 7+ new tests for landing/ad components.

### E2E Tests
```bash
pnpm -F @pitamark/web test:e2e
```
EXPECT: 既存 + 新 6 ケース合計 ~10 件 green、両 project (chromium / mobile-chrome) で実行。

### Build
```bash
pnpm -F @pitamark/web build
```
EXPECT: tsc + vite build 緑、dist/index.html に `%VITE_ADSENSE_CLIENT_ID%` 残らない。

### Manual Validation

- [ ] `pnpm -F @pitamark/web dev` 起動 → http://localhost:5173 でランディング表示確認
- [ ] viewport 1280 / 1024 / 768 / 600 / 393 で切替えて ad slot 配置を目視
- [ ] LangToggle で en に切替えて文言変化確認
- [ ] 画像を D&D してエディタに遷移、戻る (URL 操作) で landing に復帰
- [ ] preview build で Chrome DevTools Lighthouse → Performance / Accessibility / Best Practices / SEO すべて 90+
- [ ] preview build で Chrome DevTools Performance → CLS の `Layout Shift Regions` 数値 < 0.1
- [ ] [Google Rich Results Test](https://search.google.com/test/rich-results) で `FAQPage` schema が Valid
- [ ] [PageSpeed Insights](https://pagespeed.web.dev/) (本番デプロイ前なら preview の ngrok / cloudflared 経由) で field data 取れることを確認 (取得は Phase 10.G)

---

## Acceptance Criteria

- [ ] **Must M1**: 画像未投入時にランディング (Hero + Features + HowTo) が表示される
- [ ] **Must M2**: ad slot が `lg:` 以上で左右レール、`lg:` 未満で下部静的に表示、`min-height` 固定 px で CLS 0
- [ ] **Must M3**: i18n が ja / en 両方で完備、a11y violations 0、E2E 5 ケース新規追加 + 全 green
- [ ] Lighthouse Performance / Accessibility / Best Practices / SEO すべて 90+
- [ ] CLS p75 < 0.1 (Lighthouse / DevTools 計測)
- [ ] typecheck / lint / unit / e2e / build 全 緑
- [ ] FAQPage schema が Google Rich Results Test で Valid (Should S2)
- [ ] Hero に WebP UI スクショ配置 + width/height 属性 (Should S1)
- [ ] PRD の Open Questions Q1-Q5 のうち Q1 (ad slot を editor 状態でも表示するか) は本 Plan で **暫定: lg+ で editor でも表示** を採用、他は持ち越し

## Completion Checklist

- [ ] 新規 component が既存 component composition パターンに合致
- [ ] i18n key が `landing.*` / `ad.*` prefix で階層化、ja / en 両方更新
- [ ] error handling は不要 (純表示 component)、ただし `<DropZone>` の error prop は維持
- [ ] Logger 利用なし (landing は表示のみ)
- [ ] Tests follow existing test patterns (vitest = React root + act / playwright = page.goto + locator)
- [ ] No hardcoded strings — すべて i18n key 経由
- [ ] No magic numbers — RAIL_WIDTH_PX 等の named const で
- [ ] No new heavyweight deps (motion library / shadcn accordion 等は避ける)
- [ ] Self-contained — implementation 担当が plan のみで完遂可能

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| stage 領域の `headerHeight` 計算が ad bottom rail で破綻 | M | landing は OK でも editor で stage が見切れる | `useStageSize` を確認、必要なら `bottomAdHeight` を引く。bottom rail は narrow only なので影響は narrow viewport のみ |
| `min-height` が `dvh` 計算と相互作用して mobile で実 px 変動 | M | mobile narrow で CLS 微増 | mobile-chrome E2E で計測、必要なら `RAIL_MIN_HEIGHT_PX` を `clamp` ではなく純 px にし続ける |
| Hero 画像 (WebP) 生成が手動で時間取られる | M | Should の納期遅延 | v1 リリースは PNG プレースホルダ (グレースケール背景 + "preview" 文字) で先行 merge、本格 WebP は Phase 10.H 内 follow-up |
| `<details>` ベース FAQ が a11y で keyboard 操作不十分 | L | axe violation | `<details>` HTML 標準は a11y 自然、必要なら `cursor-pointer` のみ追加 |
| AdSense ポリシー違反な配置 (誤クリック誘発) | L | Phase 11 で AdSense 申請却下 | placeholder は静的 + 中央揃え + `<aside>` ロール、誘導 copy 不在で構造的に違反しにくい。ポリシー詳細は Phase 11+ で再確認 (PRD Open Q5) |
| i18n 英訳の品質不足 | L | en ユーザーに違和感 | ADR-0004 「日本語確定 + 英語 draft」体制を踏襲、ネイティブ修正は Phase 11+ |

## Notes

- **Plan 構成**: PRD 通り **umbrella plan 1 本** で 1 PR merge。sub-plan 分割しない (Phase 1 / Phase 2 が密結合)
- **Branch**: `feat/phase-10-h-landing-and-ad-slots`
- **Commit 区切り**: 1 PR 内で commit を機能単位で切る (i18n / AdSlot / landing components / EditorShell update / e2e / a11y / hero image)
- **Phase 11 への引継ぎ**: AdSense 実接続時は (1) `index.html` に `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-...">` 追加、(2) `<AdSlot>` の中身を `<ins class="adsbygoogle">` + `script: (adsbygoogle = window.adsbygoogle || []).push({})` に差し替え、(3) `/ads.txt` 配信、(4) cookie consent banner 追加、(5) ads.txt と GoogleSearchConsole 紐付け。AdSlot の **API は変更不要**で済む設計を維持する
- **TDD 推奨度**: Medium (i18n / component の単体テストは TDD 適用しやすい、ad slot の position は E2E でないと検証困難 → 後者は実装後 E2E で固める)
