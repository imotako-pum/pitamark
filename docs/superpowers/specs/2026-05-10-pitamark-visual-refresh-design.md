# pitamark visual refresh — design spec

**Date**: 2026-05-10
**Status**: Draft (awaiting user review)
**Scope**: Logo replacement + Toolbar / Color palette / DropZone / Favicon polish

---

## Goal

左上ロゴが「主張のないテキスト」になっており、pitamark のブランド identity (画像にピン留めしてマーク) を視覚的に表現できていない。本 spec は **ロゴ刷新を中心に、UX への影響が小さい範囲でブランド整合の polish** を行う。

## Background

- Phase 10.D で `pitamark.app` 確定 (memory: `project_phase_10_d_naming_decision.md`)
- 現状の左上ロゴは `<h1 className="text-sm font-semibold opacity-70">{t('common.appName')}</h1>` (`apps/web/src/pages/EditorShell.tsx:668-670`) — 14px の opacity 70% で霞んでいる
- 現状 favicon (`apps/web/public/favicon.svg`) は青のオリジナルピンマーク、Y1 logo と無関係
- アプリの本質: 画像に `rect / arrow / text / highlight` で注釈を付けて共有 → ロゴ自体に「注釈の所作」を織り込みたい

## Brand direction (Y1 logo)

ブレストの結果、ロゴは以下の構成で確定:

- ワードマーク `pitamark` の **"i" を SVG で ↑ 矢印 + ●ドットに置換**
- shaft が text の上下を貫通 (上 = 矢じり / 下 = 画鋲針先の●)
- ワードマーク全体を **角丸 rect (赤実線) で囲む**
- 全体を **-5° tilt** (transform-origin 30% 50%)
- 色は **annotation red** = `oklch(60% 0.22 28)` (≈ #e74c3c)、`COLOR_PALETTE[0]` の `DEFAULT_SYNC_COLOR` と同色
- text は標準色 `oklch(18% 0 0)`

意味付け:
- 赤 = canvas 上の annotation (rect / arrow / text のデフォルト色)
- 角丸 rect = pitamark の rectangle tool そのもの
- 矢印 i = arrow tool の所作、↑ + ●で「画鋲を上から刺した」メタファ
- tilt = 手書きで急いで囲んだような勢い

## Decisions

### 1. Y1 Logo (`Logo.tsx` 新規)

新規コンポーネント `apps/web/src/components/app-shell/Logo.tsx` を作成し、EditorShell の h1 と置換する。

**スペック**:

```tsx
// 概略 (要 i18n: aria-label = t('common.appName'))
<h1
  aria-label={appName}
  className="pointer-events-auto hidden self-center md:block"
>
  <span className="relative inline-block px-2 py-0.5 rotate-[-5deg] origin-[30%_50%]">
    {/* word: "p" + arrow-i SVG + "tamark" */}
    <span className="relative z-[2] font-bold text-[16px] tracking-[-0.015em] text-[oklch(18%_0_0)]">
      p<svg
         className="inline-block align-[-0.05em] w-[0.32em] h-[1.05em] overflow-visible"
         viewBox="0 0 8 20"
         aria-hidden="true">
        <path
          d="M4 49 L4 -22 M0.4 -20 L4 -28 L7.6 -20"
          stroke="oklch(60% 0.22 28)"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="4" cy="49" r="2.2" fill="oklch(60% 0.22 28)" />
      </svg>tamark
    </span>
    {/* rect frame (text と軽く overlap) */}
    <span
      aria-hidden="true"
      className="absolute z-[1] pointer-events-none rounded-[8px]"
      style={{
        top: '1px', left: '-1px', right: '2px', bottom: '0',
        border: '2px solid oklch(60% 0.22 28)',
      }}
    />
  </span>
</h1>
```

**実装上の注意**:
- arrow SVG の `overflow: visible` は重要 (path が viewBox 外に描画される)
- `viewBox 0 0 8 20` 内で path が y=-22 〜 49 まで伸びる ≈ font-size 16px で上下 ~20px 突き抜け
- ヘッダ padding: 矢印が縦に飛び出すため、`EditorShell.tsx` の header `py-2` を `py-3` 以上に増やす
- mobile (`md` 未満) では現状通り hidden を維持
- mockup での font-size は 18px、実装は **16px** に縮める (header の他要素とバランスを取る) — 微調整は実機確認後

**置換箇所**: `apps/web/src/pages/EditorShell.tsx:668-670`

### 2. Toolbar — Active tool style

`apps/web/src/components/toolbar/ToolButton.tsx` の `TONE_CLASS.default` を改修:

```tsx
const TONE_CLASS: Record<NonNullable<ToolButtonProps['tone']>, string> = {
  default: [
    'aria-pressed:bg-[oklch(95%_0.06_28)]',
    'aria-pressed:text-[oklch(40%_0.2_28)]',
    'aria-pressed:border-[oklch(70%_0.18_28)]',
  ].join(' '),
  danger: 'text-destructive hover:bg-destructive/10',
};
```

**現状から変更**: 薄い青の `--accent` → 赤系 (Y1 logo と整合)
**維持**: rounded-md / 28x28 / hover:bg-accent (subtle gray) / aria-pressed semantics
**Tooltip / divider / surface**: 現状維持 (`bg-(--color-toolbar-bg)`, `rounded-xl`, `border-(--color-toolbar-border)`)

### 3. Color palette swatch (`ColorPalette.tsx`)

3 点改修:

1. **Shape**: 角丸 → **円形**
   - chip span: `rounded-[3px]` → `rounded-full`
   - button wrap: `rounded-md` → `rounded-full`

2. **Active indicator**: TM-B 二重 ring に変更
   - 現状: `boxShadow: pressed ? '0 0 0 2px ${OUTLINE_ACCENT} inset' : '0 0 0 1px rgba(0,0,0,0.12) inset'`
   - 新規:
     ```tsx
     boxShadow: pressed
       ? `inset 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 1.5px oklch(98% 0 0), 0 0 0 3.5px oklch(60% 0.22 28)`
       : 'inset 0 0 0 1px rgba(0,0,0,0.12)'
     ```

3. **OUTLINE_ACCENT 定数の取り扱い**: `apps/web/src/components/canvas/colors.ts` の `OUTLINE_ACCENT = '#5b6dff'` は ColorPalette からは参照されなくなる。Konva 内 (Transformer / handle) でまだ使うため定数自体は残す。ColorPalette からの import は削除。

**hit zone (touch)**: 現状の `min-w-11 min-h-11` を維持 (chip 16px + 二重 ring の最大半径 5px = 26px、button 44px の中心に収まる)

### 4. DropZone (`DropZone.tsx`)

5 点改修:

1. **Tilt 追加**: `<button>` に `transform: rotate(-1.2deg)` (transform-origin: 50% 50%) を恒常で適用
2. **Default border**: `border-(--color-toolbar-border)` (≈ light gray) → `border-[oklch(20%_0_0)]` (黒)
3. **Default icon color**: `text-(--color-accent)` (青) → `text-[oklch(20%_0_0)]` (黒)
4. **Drag-over (`isOver === true`) の振る舞い**: 現状 `border-(--color-accent) bg-[oklch(96%_0.05_250)]` は維持 (青 accent — 既に整合済)
   - icon を drag-over 時に `text-[oklch(50%_0.18_250)]` に切り替える分岐を追加
   - drag-over 時 `transform: rotate(-1.2deg) scale(1.02)`
5. **テキスト調整**:
   - **削除**: `<kbd>⌘V</kbd>` の inline 表示 (Windows 配慮 / OS 中立化)
   - i18n key 文言調整:
     - `dropzone.instructionPrefix` = "drop /" (既存)、`dropzone.instructionSuffix` = "paste / click" (新規) もしくは
     - 単一 key `dropzone.instruction` = "drop / paste / click" に統合 (推奨、ja/en 同一文字列)
   - 「ここに pita」のような annotation 注釈は **追加しない** (ブレスト過程で却下)

実装後の DropZone は ⌘V keyboard binding 自体は維持 (window paste listener が動く)。表示から削除するだけ。

**i18n key 整理** (`apps/web/src/i18n/`):
- `dropzone.instructionPrefix` / `dropzone.instructionSuffix` は 1 key に統合か、空文字に
- 文言: ja / en とも `drop / paste / click`

### 5. Favicon (`apps/web/public/favicon.svg`)

新 SVG 内容:

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

注: hex リテラルは `oklch(60% 0.22 28)` ≒ `#e74c3c` (`DEFAULT_SYNC_COLOR` と一致)。SVG 内では oklch を Safari < 16.4 が解釈しないため hex のまま記述。

**`apple-touch-icon.png` (PNG ラスター)**: 同じデザインの 180x180 PNG に差し替え。**本 spec では SVG のみ作成、PNG 生成は follow-up** (画像生成手順は別途検討)。

## Out of Scope (明示)

ブレストで列挙したが本 spec では扱わない:

- 3. Connection Badge polish — 中インパクトだが見送り
- 4. HelpModal cheatsheet polish — 中インパクトだが見送り
- 6. Awareness cursors / peer label polish — 小インパクト
- 7. Tooltips style — 小インパクト
- 8. Font web 化 — 中インパクトだが bundle/読み込み戦略要、別 spec
- 10. Ad slot placeholder visual — 小インパクト

ヘッダ全体の構図 (LangToggle / Help / spacing) は **L1 (現状) ベースで維持**、変更は Y1 logo 差し替えのみ。

## Implementation Order

依存少ない順:

1. **Favicon** (`apps/web/public/favicon.svg` 1 ファイル差し替え) — 独立、最小リスク
2. **Y1 Logo** (`Logo.tsx` 新規 → `EditorShell.tsx` 置換) — 視覚的に目立つ初手
3. **Toolbar active style** (`ToolButton.tsx` の TONE_CLASS) — 既存テスト影響なし
4. **ColorPalette circular swatch** (`ColorPalette.tsx`) — Touch hit zone 確認要
5. **DropZone** (`DropZone.tsx` + i18n) — i18n key 構造変更で landing E2E (`landing-shell.spec.ts` 等) が触る可能性あり、確認

## Testing notes

- **既存 E2E**: `aria-pressed` / `role="toolbar"` / `aria-labelledby` ベースの assertion は class 変更で壊れない (color / radius のみ変更のため)
- **i18n key 改名**: `dropzone.instructionPrefix` / `dropzone.instructionSuffix` を統合する場合、`apps/web/src/i18n/__tests__` 等の参照を grep で潰す
- **手動確認**:
  - dev (`pnpm dev`) → http://localhost:5173 で landing → image drop → editor の遷移を確認
  - logo / toolbar active / swatch active / DropZone default+drag / favicon (タブ表示) を 1 通り視認
- **Visual regression**: 現状なし。本 spec では追加しない (将来 Playwright screenshot を導入するなら別 spec)

## Visual references (brainstorm artifacts)

ブレスト中の mockup HTML はリポジトリに残してある:

- Y1 final form: `.superpowers/brainstorm/<session>/content/08-y1-locked.html`
- Toolbar final (TM-B): `.superpowers/brainstorm/<session>/content/12-toolbar-mix.html`
- DropZone final (F1): `.superpowers/brainstorm/<session>/content/15-dropzone-final.html`
- Favicon final (C): `.superpowers/brainstorm/<session>/content/16-favicon.html`

`.superpowers/` は `.gitignore` で除外済 — long-term reference にしたい mockup は別途 docs/ に move する余地あり (本 spec では未着手)。

## Open questions

- ロゴ font-size: mockup 18px / 実装 16px の妥当性は実機確認時に最終決定
- Header padding: 矢印突き抜け分の top padding を何 px にするか (16px? 20px?) は実装時に微調整
- `apple-touch-icon.png` の PNG 生成手段 (手動 export / vite-plugin / Inkscape) は follow-up
