# pitamark visual refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 左上ロゴの主張不足を解消し、ブランド整合のとれた視覚リフレッシュを 5 surface (Logo / Toolbar active / ColorPalette swatch / DropZone / Favicon) に実装する。

**Architecture:** スタンドアロンの新規コンポーネント `Logo.tsx` を追加し、既存ファイル (`ToolButton.tsx` / `ColorPalette.tsx` / `DropZone.tsx` / `favicon.svg` + i18n) は最小差分で改修する。全変更は visual のみで behavior 不変、E2E への影響なし。

**Tech Stack:** React 19 / Tailwind v4 (catalog 管理) / Vitest + React Testing Library (act + createRoot) / Biome / lucide-react / shadcn-style Button・Tooltip。

**Spec:** `docs/superpowers/specs/2026-05-10-pitamark-visual-refresh-design.md`

---

## File Structure

**Create:**
- `apps/web/src/components/app-shell/Logo.tsx` — Y1 ワードマーク (i = ↑ 矢印 + ●、角丸赤枠 -5° tilt)
- `apps/web/src/components/app-shell/__tests__/Logo.test.tsx` — Logo の semantic test (aria-label / wordmark text / SVG arrow 存在)

**Modify:**
- `apps/web/public/favicon.svg` — 赤ベタ rounded rect + 白 ↑ + ● (反転デザイン)
- `apps/web/src/pages/EditorShell.tsx:668-670` — `<h1>{t('common.appName')}</h1>` を `<Logo />` に差し替え + header padding 調整
- `apps/web/src/components/toolbar/ToolButton.tsx:22-26` — `TONE_CLASS.default` を Y1 赤系に変更
- `apps/web/src/components/toolbar/ColorPalette.tsx:44-58` — chip / button を `rounded-full`、active 時 boxShadow を二重 ring に
- `apps/web/src/components/empty-state/DropZone.tsx:74-91` — tilt 追加 / border 黒 / drag-over icon 青 / `<kbd>⌘V</kbd>` 削除
- `apps/web/src/i18n/en.ts:63-64` および `apps/web/src/i18n/ja.ts:64-65` — `dropzone.instructionPrefix` / `instructionSuffix` の文言更新

**Branch & PR:**
- 想定ブランチ名: `phase-11-visual-refresh` (Phase 10.J merged 直後、命名は最終的にユーザに委ねる)
- PR は最後に 1 本 (5 task = 5 commit ぶらさげ)

---

## Task 1: Favicon

最も独立性が高く視覚インパクトのある変更から着手。

**Files:**
- Modify: `apps/web/public/favicon.svg`

- [ ] **Step 1.1: Branch を切る**

```bash
git checkout -b phase-11-visual-refresh
```

- [ ] **Step 1.2: 現状 favicon を確認 (差分の base にする)**

```bash
cat apps/web/public/favicon.svg
```

期待: 32x32 viewBox、青 (#5b6dff) 角丸 rect + 白の bookmark/pin 風 path 4 行。

- [ ] **Step 1.3: 新 favicon に差し替え**

`apps/web/public/favicon.svg` の中身を以下に置換:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect x="2" y="2" width="28" height="28" rx="6" fill="#e74c3c" />
  <g transform="rotate(-5 16 16)">
    <path
      d="M16 27 L16 6 M11 10 L16 4 L21 10"
      stroke="#ffffff"
      stroke-width="2.6"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="16" cy="27" r="2.4" fill="#ffffff" />
  </g>
</svg>
```

注: `#e74c3c` は `apps/web/src/components/canvas/colors.ts:9` の `DEFAULT_SYNC_COLOR` と同色 (Y1 赤)。Safari < 16.4 が `oklch()` を解釈できないため SVG 内は hex 固定。

- [ ] **Step 1.4: 手動で見栄え確認**

```bash
pnpm -F @snap-share/web dev
```

ブラウザで `http://localhost:5173` を開き、タブの favicon が **赤ベタ + 白矢印** に切り替わっていることを目視。Cmd+Shift+R で強制リロード推奨。

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/public/favicon.svg
git commit -m "$(cat <<'EOF'
feat(visual-refresh): favicon を Y1 整合の赤ベタ + 白矢印に差し替え

Y1 logo (赤・矢印 i・角丸枠) と整合する favicon に更新。
- 赤 (#e74c3c = DEFAULT_SYNC_COLOR) ベタ角丸 rect
- 白 ↑ + ● を -5° tilt で重ね、Y1 と同じ形状記号
- 旧: 青 (#5b6dff) ベタ + bookmark 風 path (Y1 と無関係)

Spec: docs/superpowers/specs/2026-05-10-pitamark-visual-refresh-design.md
EOF
)"
```

---

## Task 2: Y1 Logo component

**Files:**
- Create: `apps/web/src/components/app-shell/Logo.tsx`
- Create: `apps/web/src/components/app-shell/__tests__/Logo.test.tsx`
- Modify: `apps/web/src/pages/EditorShell.tsx:664-692` (header と h1 部分)

### 2A: テスト先行

- [ ] **Step 2.1: 失敗テストを書く**

`apps/web/src/components/app-shell/__tests__/Logo.test.tsx` を新規作成:

```tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetI18nForTesting, setLang } from '../../../i18n';
import { Logo } from '../Logo';

const renderLogo = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  act(() => {
    root?.render(<Logo />);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

describe('Logo', () => {
  beforeEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    window.localStorage.setItem('pitamark-lang', 'ja');
    __resetI18nForTesting();
    setLang('ja');
  });

  afterEach(() => {
    window.localStorage.clear();
    __resetI18nForTesting();
  });

  it('renders the wordmark with "p" + arrow + "tamark"', () => {
    const m = renderLogo();
    // word は "p" + SVG + "tamark" の構造。textContent では SVG を除いた "ptamark" になる。
    const text = m.container.textContent ?? '';
    expect(text).toContain('p');
    expect(text).toContain('tamark');
    m.unmount();
  });

  it('exposes appName as accessible label on the heading', () => {
    const m = renderLogo();
    const heading = m.container.querySelector('h1');
    expect(heading).not.toBeNull();
    expect(heading?.getAttribute('aria-label')).toBe('pitamark');
    m.unmount();
  });

  it('embeds an arrow SVG in place of the "i" glyph', () => {
    const m = renderLogo();
    const svg = m.container.querySelector('svg[aria-hidden="true"]');
    expect(svg).not.toBeNull();
    // ↑ 矢印の shaft は path の M…L で始まる (M4 49 L4 -22)
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toContain('M4');
    // ●ドット
    const circle = svg?.querySelector('circle');
    expect(circle).not.toBeNull();
    m.unmount();
  });
});
```

- [ ] **Step 2.2: テストを走らせて FAIL を確認**

```bash
pnpm -F @snap-share/web test -- src/components/app-shell/__tests__/Logo.test.tsx
```

期待: 全 3 テストが「Cannot find module '../Logo'」相当のエラーで FAIL。

### 2B: 最小実装

- [ ] **Step 2.3: Logo コンポーネントを作成**

`apps/web/src/components/app-shell/Logo.tsx` を新規作成:

```tsx
import { useTranslation } from '../../i18n';

// Y1 logo: pitamark の "i" を SVG ↑ 矢印 + ●ドットで置換。角丸赤枠で囲み、-5° に傾ける。
//
// 設計メモ:
// - SVG の `overflow: visible` により path が viewBox (0 0 8 20) を縦に超えて描画される。
//   path "M4 49 L4 -22" で shaft が text 上下にそれぞれ ~22 単位 (font-size の ~1.4 倍)
//   突き抜ける。font-size 16px なら ~22px ぶん上下にはみ出す。
// - ヘッダの py 設定 (EditorShell.tsx) で矢印の縦突き抜けぶんの padding を確保すること。
// - Konva の color 同期は無関係 (canvas 外の DOM)。Y1 赤は DEFAULT_SYNC_COLOR (#e74c3c)
//   と同じ oklch(60% 0.22 28) を使う。
export const Logo = () => {
  const t = useTranslation();
  return (
    <h1
      aria-label={t('common.appName')}
      className="pointer-events-auto hidden self-center md:block"
    >
      <span
        className="relative inline-block px-2 py-0.5"
        style={{ transform: 'rotate(-5deg)', transformOrigin: '30% 50%' }}
      >
        <span
          aria-hidden="true"
          className="relative z-[2] select-none whitespace-nowrap font-bold tracking-[-0.015em]"
          style={{ color: 'oklch(18% 0 0)', fontSize: '16px' }}
        >
          p
          <svg
            aria-hidden="true"
            viewBox="0 0 8 20"
            className="inline-block"
            style={{
              width: '0.32em',
              height: '1.05em',
              verticalAlign: '-0.05em',
              overflow: 'visible',
            }}
          >
            <path
              d="M4 49 L4 -22 M0.4 -20 L4 -28 L7.6 -20"
              stroke="oklch(60% 0.22 28)"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="4" cy="49" r="2.2" fill="oklch(60% 0.22 28)" />
          </svg>
          tamark
        </span>
        <span
          aria-hidden="true"
          className="absolute z-[1] pointer-events-none"
          style={{
            top: '1px',
            left: '-1px',
            right: '2px',
            bottom: '0',
            border: '2px solid oklch(60% 0.22 28)',
            borderRadius: '8px',
          }}
        />
      </span>
    </h1>
  );
};
```

注意点:
- 識別子は英語 (`Logo`) / コメントは日本語 (CLAUDE.md 規約)
- `select-none` は textContent の copy/paste を阻害しないが、Y1 logo は装飾なので意図的に
- Tailwind v4 の `bg-(--color-X)` 構文は使わず、color は inline style で oklch 直書き (catalog tokens に新規追加するほどではない)
- `aria-label` を h1 に置くことで、SVG を含む内部構造が SR で読まれず、appName 1 つだけが読み上げられる

- [ ] **Step 2.4: テストを走らせて PASS を確認**

```bash
pnpm -F @snap-share/web test -- src/components/app-shell/__tests__/Logo.test.tsx
```

期待: 3/3 PASS。

### 2C: EditorShell 側で差し替え

- [ ] **Step 2.5: EditorShell.tsx の h1 を Logo に置換**

`apps/web/src/pages/EditorShell.tsx:668-670` の以下を:

```tsx
<h1 className="pointer-events-auto hidden select-none self-center text-sm font-semibold tracking-wide opacity-70 md:block">
  {t('common.appName')}
</h1>
```

これに置換:

```tsx
<Logo />
```

ファイル先頭に import を追加 (line 19 付近の他 component import の並びに):

```tsx
import { Logo } from '../components/app-shell/Logo';
```

- [ ] **Step 2.6: header の縦 padding を 矢印突き抜け分だけ広げる**

`apps/web/src/pages/EditorShell.tsx:665-667` の header className の `py-2` を `py-3` に変更:

変更前:
```tsx
className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 px-3 py-2 lg:left-40 lg:right-40"
```

変更後:
```tsx
className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 px-3 py-3 lg:left-40 lg:right-40"
```

理由: Logo の矢印は font-size 16px に対し ~22px 上下に突き抜ける。`py-2` (8px) では上に突き出る矢じり頂点がヘッダ領域からはみ出して clip される可能性。`py-3` (12px) で確保。

- [ ] **Step 2.7: 既存テスト・型・lint を回す**

```bash
pnpm -F @snap-share/web test -- src/pages
pnpm typecheck
pnpm lint
```

期待: 全部 PASS。EditorShell の既存テストが Logo に関する snapshot/textContent 期待を持っていないか確認、もし壊れたら test 側を Logo の構造に合わせて更新。

- [ ] **Step 2.8: 手動確認 (dev server)**

```bash
pnpm -F @snap-share/web dev
```

`http://localhost:5173` を開き:
- 左上に Y1 Logo (`pitamark` + 矢印 i + 赤枠 + tilt) が表示されるか
- 矢印が上下にちゃんと突き抜けて見えるか (clip されてないか)
- mobile 幅 (devtools で 375x800 等) で hidden になっているか
- 画像をドロップして editor に入った状態でも左上 Logo が変わらず表示されるか

- [ ] **Step 2.9: Commit**

```bash
git add apps/web/src/components/app-shell/Logo.tsx \
        apps/web/src/components/app-shell/__tests__/Logo.test.tsx \
        apps/web/src/pages/EditorShell.tsx
git commit -m "$(cat <<'EOF'
feat(visual-refresh): Y1 Logo component を導入し EditorShell h1 を差し替え

左上ヘッダの主張不足を解消。pitamark のブランド identity (画像にピン留めしてマーク) を
ロゴ自身で表現する。

- Logo.tsx 新規: "p" + SVG ↑ 矢印 + ● + "tamark" + 角丸赤枠 -5° tilt
- 矢印 SVG は overflow:visible で text の上下に ~22px 突き抜け
- EditorShell の header py-2 → py-3 に拡張し、矢印 clip を防止
- mobile (md 未満) では hidden を維持

Spec: docs/superpowers/specs/2026-05-10-pitamark-visual-refresh-design.md
EOF
)"
```

---

## Task 3: Toolbar — Active tool style

**Files:**
- Modify: `apps/web/src/components/toolbar/ToolButton.tsx:22-26`

このタスクは class 文字列の置換のみで、既存テスト (`Toolbar.test.tsx`) は `aria-pressed` ベースで通る。視覚変化は手動確認。

- [ ] **Step 3.1: TONE_CLASS.default を改修**

`apps/web/src/components/toolbar/ToolButton.tsx` の line 22-26 を:

変更前:
```tsx
const TONE_CLASS: Record<NonNullable<ToolButtonProps['tone']>, string> = {
  default:
    'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:border-(--color-accent)',
  danger: 'text-destructive hover:bg-destructive/10',
};
```

変更後:
```tsx
// Active tool は Y1 logo の赤と整合させる: 薄赤 bg + 中赤 border + 濃赤 icon。
// 値は oklch (token を新設するほどでもないので Tailwind 任意値構文で直書き)。
const TONE_CLASS: Record<NonNullable<ToolButtonProps['tone']>, string> = {
  default: [
    'aria-pressed:bg-[oklch(95%_0.06_28)]',
    'aria-pressed:text-[oklch(40%_0.2_28)]',
    'aria-pressed:border-[oklch(70%_0.18_28)]',
  ].join(' '),
  danger: 'text-destructive hover:bg-destructive/10',
};
```

- [ ] **Step 3.2: 既存 Toolbar test を実行**

```bash
pnpm -F @snap-search/web test -- src/components/toolbar/__tests__/Toolbar.test.tsx
```

期待: PASS。`aria-pressed` ベースの assertion なので class 変更で壊れない。
(コマンドの workspace 名タイポに注意: `@snap-share/web` が正)

```bash
pnpm -F @snap-share/web test -- src/components/toolbar/__tests__/Toolbar.test.tsx
```

- [ ] **Step 3.3: 型 / lint チェック**

```bash
pnpm typecheck && pnpm lint
```

期待: PASS。

- [ ] **Step 3.4: 手動確認 (dev server)**

```bash
pnpm -F @snap-share/web dev
```

editor 画面で各 tool button (V/R/A/T/H) を順にクリックし、active 時に **薄赤 bg + 赤 border + 赤 icon** に変わることを確認。disabled 時は変更前と同じ振る舞いか (画像未投入時 disabled になり、active style が出ないこと) も確認。

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/components/toolbar/ToolButton.tsx
git commit -m "$(cat <<'EOF'
feat(visual-refresh): Toolbar active tool を Y1 赤系に変更

ToolButton の TONE_CLASS.default を改修し、aria-pressed 状態の bg/border/icon を
Y1 logo (oklch(60% 0.22 28)) と整合する赤系トーンに揃える。

- bg:     oklch(95% 0.06 28)  (薄赤)
- border: oklch(70% 0.18 28)  (中赤)
- icon:   oklch(40% 0.2 28)   (濃赤)

旧 --accent (青系) からの切り替え。aria-pressed semantics は不変なので E2E 影響なし。
EOF
)"
```

---

## Task 4: ColorPalette — 円形 swatch + 二重 ring

**Files:**
- Modify: `apps/web/src/components/toolbar/ColorPalette.tsx:44-58`
- (Optional) Modify: `apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` — class assertion を 1 件追加

- [ ] **Step 4.1: ColorPalette test に circular shape の assertion を追加**

`apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx` の `describe('ColorPalette')` ブロック末尾 (line 102 直前) に追加:

```tsx
  it('renders chips as circles (rounded-full)', () => {
    const m = renderPalette({});
    // chip は button > span (aria-hidden) の構造。
    const chips = m.container.querySelectorAll<HTMLSpanElement>(
      'button[aria-label^="色:"] > span[aria-hidden="true"]',
    );
    expect(chips.length).toBe(COLOR_PALETTE.length);
    for (const chip of chips) {
      expect(chip.className).toContain('rounded-full');
    }
    m.unmount();
  });
```

- [ ] **Step 4.2: テスト実行 (FAIL を確認)**

```bash
pnpm -F @snap-share/web test -- src/components/toolbar/__tests__/ColorPalette.test.tsx
```

期待: 既存 4 テスト PASS、新規 1 テスト FAIL (chip className が `rounded-[3px]` を含む `rounded-full` が無い)。

- [ ] **Step 4.3: ColorPalette.tsx を改修**

`apps/web/src/components/toolbar/ColorPalette.tsx` の line 44-58 を:

変更前:
```tsx
                  className={cn(
                    'rounded-md border border-transparent p-0',
                    pressed && 'border-(--color-accent)',
                    isTouch && 'min-w-11 min-h-11',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="block size-4 rounded-[3px]"
                    style={{
                      background: color,
                      boxShadow: pressed
                        ? `0 0 0 2px ${OUTLINE_ACCENT} inset`
                        : '0 0 0 1px rgba(0,0,0,0.12) inset',
                    }}
                  />
```

変更後:
```tsx
                  className={cn(
                    'rounded-full border border-transparent p-0',
                    isTouch && 'min-w-11 min-h-11',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="block size-4 rounded-full"
                    style={{
                      background: color,
                      // TM-B 二重 ring: 内側 1px chip border + 1.5px white gap + 3.5px Y1 赤。
                      // pressed 以外は現状通り 1px の inset border のみ。
                      boxShadow: pressed
                        ? 'inset 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 1.5px oklch(98% 0 0), 0 0 0 3.5px oklch(60% 0.22 28)'
                        : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                    }}
                  />
```

差分まとめ:
- button wrap: `rounded-md` → `rounded-full`、`pressed && 'border-(--color-accent)'` 削除 (二重 ring が代替表現)
- chip: `rounded-[3px]` → `rounded-full`
- pressed boxShadow: `OUTLINE_ACCENT` (青 #5b6dff) inset 単一 → 三重 (chip border + white gap + Y1 赤 outer ring)
- normal boxShadow: 構文を `inset 0 0 0 1px ...` 形式に統一 (機能変化なし)

- [ ] **Step 4.4: 不要な `OUTLINE_ACCENT` import を削除**

`apps/web/src/components/toolbar/ColorPalette.tsx:6` を確認:

```tsx
import { COLOR_PALETTE, OUTLINE_ACCENT } from '../canvas/colors';
```

`OUTLINE_ACCENT` を削除し:
```tsx
import { COLOR_PALETTE } from '../canvas/colors';
```

`OUTLINE_ACCENT` 定数は `colors.ts` 側に残す (Konva Transformer / handle が使っている可能性)。grep で他参照を確認:

```bash
grep -rn 'OUTLINE_ACCENT' apps/web/src/
```

- [ ] **Step 4.5: テスト実行 (PASS を確認)**

```bash
pnpm -F @snap-share/web test -- src/components/toolbar/__tests__/ColorPalette.test.tsx
```

期待: 5/5 PASS。

- [ ] **Step 4.6: 型 / lint チェック**

```bash
pnpm typecheck && pnpm lint
```

期待: PASS。

- [ ] **Step 4.7: 手動確認 (dev server)**

editor 画面で各 swatch をクリックし:
- 円形に変わっているか
- active swatch の周りに **白 gap + 赤 ring** の二重 ring が出ているか
- 赤 swatch (1 番目) を active にしても、白 gap で chip 自体と区別がつくか
- 黒 swatch (最後) を active にしても ring がきちんと見えるか
- touch device (devtools で User-Agent を iPhone 等にし `pointer:coarse` を有効) で `min-w-11 min-h-11` の hit zone が壊れていないか

- [ ] **Step 4.8: Commit**

```bash
git add apps/web/src/components/toolbar/ColorPalette.tsx \
        apps/web/src/components/toolbar/__tests__/ColorPalette.test.tsx
git commit -m "$(cat <<'EOF'
feat(visual-refresh): ColorPalette を円形 + 二重 ring active に

- chip / button を rounded-full に変更
- active 時 boxShadow を内側 1px border + 1.5px white gap + 3.5px Y1 赤の三重に
- 旧 OUTLINE_ACCENT (青) inset 表示を撤去 (Konva 側の使用は保持)
- 円形 chip 化の class assertion を ColorPalette.test.tsx に追加 (5/5 PASS)

赤・黒など濃色 swatch を active にしても white gap で視認できるよう
TM-B 案 (二重 ring) を採用。
EOF
)"
```

---

## Task 5: DropZone — tilt + 黒枠 + 青 accent + ⌘V 削除

**Files:**
- Modify: `apps/web/src/i18n/en.ts:62-65`
- Modify: `apps/web/src/i18n/ja.ts:63-66`
- Modify: `apps/web/src/components/empty-state/DropZone.tsx:74-92`

### 5A: i18n 文言を更新

- [ ] **Step 5.1: ja.ts の文言更新**

`apps/web/src/i18n/ja.ts:63-66` を:

変更前:
```ts
  'dropzone.headline': '画像をドロップしてください',
  'dropzone.instructionPrefix': 'クリックで選択、または',
  'dropzone.instructionSuffix': 'で貼り付け',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (10MB まで)',
```

変更後:
```ts
  'dropzone.headline': '画像をドロップ',
  'dropzone.instructionPrefix': 'drop / paste / click',
  'dropzone.instructionSuffix': '',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (10MB まで)',
```

注: `instructionPrefix` を OS 中立な英語 dictionary 風文字列に変更、`instructionSuffix` を空に。`headline` も短縮。

- [ ] **Step 5.2: en.ts の文言更新**

`apps/web/src/i18n/en.ts:62-65` を:

変更前:
```ts
  'dropzone.headline': 'Drop an image here',
  'dropzone.instructionPrefix': 'Click to choose, or paste with',
  'dropzone.instructionSuffix': '',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (up to 10MB)',
```

変更後:
```ts
  'dropzone.headline': 'Drop an image',
  'dropzone.instructionPrefix': 'drop / paste / click',
  'dropzone.instructionSuffix': '',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (up to 10MB)',
```

ja/en で `instructionPrefix` が同一文字列になる (記号と英単語のみ) のは意図通り。

### 5B: DropZone.tsx の改修

- [ ] **Step 5.3: instruction 行の kbd 削除**

`apps/web/src/components/empty-state/DropZone.tsx:87-91` を:

変更前:
```tsx
          <p className="text-sm opacity-75">
            {t('dropzone.instructionPrefix')}{' '}
            <kbd className="rounded border px-1.5 py-0.5 text-xs">⌘V</kbd>
            {t('dropzone.instructionSuffix') ? ` ${t('dropzone.instructionSuffix')}` : ''}
          </p>
```

変更後:
```tsx
          <p className="text-sm opacity-75">{t('dropzone.instructionPrefix')}</p>
```

`instructionSuffix` は空 keyword として残るが render しない。Windows 配慮で OS 固有の `⌘V` 表記を消し、`drop / paste / click` だけで十分情報伝達できる前提。

- [ ] **Step 5.4: button の className に tilt + 黒枠 + drag-over icon 色を反映**

`apps/web/src/components/empty-state/DropZone.tsx:73-82` の className 構築を:

変更前:
```tsx
          className={[
            'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-12 py-16',
            'transition-colors duration-(--duration-normal) ease-(--ease-out-expo)',
            'focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:outline-none',
            isOver
              ? 'border-(--color-accent) bg-[oklch(96%_0.05_250)]'
              : 'border-(--color-toolbar-border) bg-(--color-surface)',
          ].join(' ')}
```

変更後:
```tsx
          className={[
            'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-12 py-16',
            'transition-all duration-(--duration-normal) ease-(--ease-out-expo)',
            'focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:outline-none',
            // -1.2° tilt は default / drag-over 共通。drag-over で軽く scale up。
            isOver
              ? 'border-(--color-accent) bg-[oklch(96%_0.05_250)] [transform:rotate(-1.2deg)_scale(1.02)]'
              : 'border-[oklch(20%_0_0)] bg-(--color-surface) [transform:rotate(-1.2deg)]',
          ].join(' ')}
```

差分:
- `transition-colors` → `transition-all` (transform 変化を含めるため)
- default の border: `border-(--color-toolbar-border)` (gray) → `border-[oklch(20%_0_0)]` (黒)
- default に `[transform:rotate(-1.2deg)]` 追加
- isOver に `[transform:rotate(-1.2deg)_scale(1.02)]` 追加 (空白を `_` でエスケープ)

- [ ] **Step 5.5: ImagePlus icon の色を default 黒 / drag-over 青 に切り替え**

`apps/web/src/components/empty-state/DropZone.tsx:83` を:

変更前:
```tsx
          <ImagePlus size={48} strokeWidth={1.25} className="text-(--color-accent)" />
```

変更後:
```tsx
          <ImagePlus
            size={48}
            strokeWidth={1.25}
            className={isOver ? 'text-[oklch(50%_0.18_250)]' : 'text-[oklch(20%_0_0)]'}
          />
```

注: `text-(--color-accent)` (青) は drag-over 時に近い色だったので、常時青 → 状態依存 (default 黒 / drag-over 青) に分岐。

- [ ] **Step 5.6: 既存 DropZone test (もしあれば) を確認**

```bash
ls apps/web/src/components/empty-state/__tests__ 2>/dev/null && \
  pnpm -F @snap-share/web test -- src/components/empty-state || \
  echo "no DropZone unit test"
```

`__tests__/` ディレクトリがなければ skip して 5.7 へ。あれば PASS を確認。
landing/E2E (`apps/web/e2e/`) に `dropzone.instruction*` 文言を直接 assert している箇所がないか確認:

```bash
grep -rn "instructionPrefix\|instructionSuffix\|⌘V\|dropzone.headline" apps/web/e2e apps/web/src
```

ヒット箇所があれば、新文言 (`drop / paste / click` / `画像をドロップ` 等) に追従するよう調整。

- [ ] **Step 5.7: i18n test を実行 (key 数は不変なので PASS が基本)**

```bash
pnpm -F @snap-share/web test -- src/i18n/__tests__/i18n.test.tsx
```

期待: PASS。文言変更のみで key set / type 不変。

- [ ] **Step 5.8: 型 / lint チェック**

```bash
pnpm typecheck && pnpm lint
```

期待: PASS。

- [ ] **Step 5.9: 手動確認 (dev server)**

`http://localhost:5173` (画像未投入の landing 状態):
- DropZone が **-1.2° に傾いている** か
- default の border が **黒 dashed**、icon が黒か
- 画像ファイルを drag したときに border が青 + bg 薄青 + icon 青 + 微 scale up に切り替わるか
- drag-leave で元に戻るか
- click で file picker が開くか
- ⌘V (Mac) / Ctrl+V (Windows) で paste が動くか (kbd 表記なくても手動で打って確認)
- text 行に「drop / paste / click」が表示されるか
- 旧 `⌘V` kbd が表示されていないか

- [ ] **Step 5.10: Commit**

```bash
git add apps/web/src/i18n/ja.ts \
        apps/web/src/i18n/en.ts \
        apps/web/src/components/empty-state/DropZone.tsx
git commit -m "$(cat <<'EOF'
feat(visual-refresh): DropZone を黒枠 tilt + 青 accent + ⌘V 削除に

- 角丸 dashed border、default 黒 (oklch(20% 0 0)) / drag-over で青 (--color-accent)
- 全状態で transform: rotate(-1.2deg) を適用、drag-over で scale(1.02)
- ImagePlus icon の色も default 黒 / drag-over 青 に分岐
- ⌘V kbd 表示を削除 (Windows 配慮 / OS 中立化)、文言を "drop / paste / click" に
- i18n: ja/en の dropzone.headline を短縮、instructionPrefix を統一文字列に

paste 機能自体は window paste listener で維持、kbd 表記のみ削除。
EOF
)"
```

---

## Task 6: 統合チェック + PR

**Files:** なし (検証 + Git 操作のみ)

- [ ] **Step 6.1: フル test suite を回す**

```bash
pnpm test
```

期待: 全 workspace で PASS。回帰がないことを確認。

- [ ] **Step 6.2: フル lint + typecheck**

```bash
pnpm typecheck
pnpm lint
```

- [ ] **Step 6.3: ビルドが通ることを確認**

```bash
pnpm build
```

期待: web (vite build) と api (wrangler dry-run) 両方 success。

- [ ] **Step 6.4: dev server で 5 surface を一気に視覚確認**

```bash
pnpm -F @snap-share/web dev
```

`http://localhost:5173` で:
1. **Favicon** (タブ): 赤ベタ + 白矢印
2. **Logo** (左上): pitamark + 矢印 i + 角丸赤枠 -5° tilt
3. **DropZone** (画像未投入時): 黒枠 dashed -1.2°、drag で青に
4. 画像をドロップ → editor へ
5. **Toolbar active** (R / A / T 等を選択): 薄赤 bg + 赤 border + 赤 icon
6. **ColorPalette swatch** (各色をクリック): 円形 + 二重 ring (white gap + 赤)

- [ ] **Step 6.5: Push + PR**

```bash
git push -u origin phase-11-visual-refresh
gh pr create --title "feat(visual-refresh): pitamark logo + chrome polish (phase 11)" \
  --body "$(cat <<'EOF'
## Summary
- Y1 Logo (赤・矢印 i + ●・角丸赤枠 -5° tilt) を新 component として導入し、左上 h1 を差し替え
- Toolbar active tool を Y1 赤系トーンに変更 (薄赤 bg + 赤 border + 赤 icon)
- ColorPalette swatch を円形 + 二重 ring active (white gap + 赤) に
- DropZone を黒枠 + tilt + drag-over で青 accent + ⌘V 削除 (Windows 配慮)
- favicon.svg を Y1 整合の赤ベタ + 白矢印に差し替え

## Spec
docs/superpowers/specs/2026-05-10-pitamark-visual-refresh-design.md

## Plan
docs/superpowers/plans/2026-05-10-pitamark-visual-refresh.md

## Test plan
- [ ] 全 workspace `pnpm test` PASS
- [ ] `pnpm typecheck` / `pnpm lint` PASS
- [ ] `pnpm build` PASS
- [ ] dev server で 5 surface (favicon / logo / toolbar active / palette swatch / DropZone) を視認
- [ ] mobile (md 未満) で logo hidden が維持
- [ ] Touch device 想定で palette swatch hit zone (`min-w-11 min-h-11`) が壊れていない

## Out of Scope
- HelpModal cheatsheet polish
- Connection Badge polish
- Awareness cursors / peer label
- Tooltips style
- Font web 化
- apple-touch-icon.png の差し替え (follow-up)
EOF
)"
```

---

## Notes for the implementer

- **identifier は英語 / コメントは日本語** (CLAUDE.md 規約)
- **catalog 管理依存**: 新 dep 追加なし (本 plan は React + Tailwind + lucide のみ使用、catalog 変更なし)
- **Konva-side colors.ts**: 触らない (Y1 logo は DOM 側、Konva は無関係)
- **i18n key 追加なし**: 既存 4 key (`headline` / `instructionPrefix` / `instructionSuffix` / `formats`) の文言変更のみ。型定義は不変
- **既存 E2E への影響**: `aria-label` / `aria-pressed` / `role="toolbar"` ベース assertion は壊れない。文字列を直接 assert している箇所だけ追従要 (Step 5.6 で grep)

---

## Self-review

**Spec coverage:**
- Y1 Logo → Task 2 ✓
- Toolbar active style → Task 3 ✓
- ColorPalette circular + 二重 ring → Task 4 ✓
- DropZone polish (tilt / 黒枠 / 青 accent / kbd 削除) → Task 5 ✓
- Favicon → Task 1 ✓
- Spec の Open Questions (font-size 16px / header padding py-3 / apple-touch-icon は follow-up) → Task 2 / 6 で扱い済 ✓

**Placeholder scan:** 全タスクに完全な code block / 具体 path / 期待結果あり。`TBD` / `TODO` / 「適切に handle」表現なし ✓

**Type consistency:**
- `TONE_CLASS.default` 改修は ColorPalette のロジック変更と独立 ✓
- `OUTLINE_ACCENT` を ColorPalette 側で削除する点は Step 4.4 に明記 ✓
- DropZone の i18n key (`instructionPrefix` / `instructionSuffix`) は既存型に合わせる、新 key 追加なし ✓

問題なし。
