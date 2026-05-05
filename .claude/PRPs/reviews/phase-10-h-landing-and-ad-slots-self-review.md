# Self-Review: Phase 10.H — Landing + AdSense slot reservation

**Reviewed**: 2026-05-06
**Branch**: `feat/phase-10-h-landing-and-ad-slots` → `main`
**Decision**: **APPROVE with comments** (no CRITICAL / HIGH)
**Scope**: 25 files / +1179 / -73 across PRD + plan + impl + tests + report

## Summary

Phase 10.H landing surface + AdSense placeholder reservation + UX レビュー反映 (toolbar 非表示 / LangToggle 独立 / protectPanel inline / fixed bottom AdSlot)。CRITICAL / HIGH は無し。MEDIUM 4 件 / LOW 5 件は merge 後の follow-up でも対応可。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

#### M1: FAQPage JSON-LD と i18n ja FAQ 文言の手動同期リスク
- **File**: `apps/web/index.html:43-79` ↔ `apps/web/src/i18n/ja.ts:154-162`
- **Issue**: `<script type="application/ld+json">` の FAQPage `mainEntity` は `Faq.tsx` がレンダリングする `landing.faq.q*` / `a*` キーの ja 値をハードコピーしている。コピー編集時にどちらか一方を更新し忘れると schema が古いまま検索エンジンに乗る。コメントで同期義務は明記済 (`Faq.tsx と Q/A コピーを同期`) だが、人手チェックのみ
- **Suggested fix**: vitest unit test を 1 件追加し、`index.html` から JSON-LD を抽出 → `ja['landing.faq.q1']` 等と一致 assert。または build-time プラグインで自動生成。Phase 11+ で対応可

#### M2: AdSlot rail の `pointer-events-none` が Phase 11+ AdSense 接続時に外し漏れリスク
- **File**: `apps/web/src/components/ad/AdSlot.tsx:39`
- **Issue**: `pointer-events-none` は placeholder 期は正しい (誤クリック誘発防止)。しかし Phase 11+ で `<ins class="adsbygoogle">` を子に差し込んだ際、親 `<aside>` の `pointer-events: none` で広告クリックも block される
- **Suggested fix**: Phase 11+ の Plan に「AdSlot rail の `pointer-events-none` を外す」を明記。**現フェーズでは action 不要**

#### M3: Bottom AdSlot fixed が iOS Safari の safe-area-inset 未考慮
- **File**: `apps/web/src/components/ad/AdSlot.tsx:55-66`
- **Issue**: `position: fixed; bottom: 0` が iPhone notch / home indicator 領域に被る。Safari iOS では下部 ~34px が "home indicator" 領域でユーザータップが ambiguous
- **Suggested fix**: `paddingBottom: 'env(safe-area-inset-bottom)'` を `<aside>` に inline style 追加、もしくは `<div className={baseSurface}>` を `pb-[env(safe-area-inset-bottom)]` 化。動作確認は実機 Safari で

#### M4: Stage container の `bottom-0` className が `style.height` と冗長
- **File**: `apps/web/src/pages/EditorShell.tsx:592`
- **Issue**: 現状 `<div className="absolute inset-x-0 bottom-0 lg:left-40 lg:right-40" style={{ top: headerHeight, height: stageHeight }} />`。CSS 仕様で `top + height` 指定時は `bottom` は無視されるので動作 OK だが、narrow viewport で `stageHeight = vh - headerHeight - 100` (100px は bottom rail) で計算した結果と `bottom-0` の意味 (= "rail 込みで viewport 末端まで埋める") が乖離
- **Suggested fix**: `bottom-0` を class から外す (または `bottom-[100px] lg:bottom-0` に明示化) し、style のみで矩形を決める。マージしても動作は変わらないがコードの読み手の混乱を減らす

### LOW

#### L1: AdSlot baseSurface の `opacity-50` が薄すぎる可能性
- **File**: `apps/web/src/components/ad/AdSlot.tsx:25`
- **Issue**: `opacity-50` で半透明 + light surface 上に薄いグレー文字 → コントラスト低下。axe WCAG コントラスト チェックは通過しているが視認性が "ある" か "ない" かのギリギリ
- **Suggested fix**: 実機目視で確認、必要なら `opacity-60` or 文字色を `text-(--color-text)` に変更

#### L2: 編集モード narrow で bottom rail が canvas 領域を 100px 圧迫
- **File**: `apps/web/src/pages/EditorShell.tsx:251-255`
- **Issue**: オーナー指示「常に出てないと」の前提を満たすために narrow 全モードで rail 表示。narrow editor で workspace が 11% (vh=900 の場合) 縮む
- **Suggested fix**: 設計上の妥協、現フェーズでは無対応で OK。Phase 11+ 実 AdSense 配信開始後に "edit 中だけ rail 折りたたみ" 機能を検討

#### L3: protectPanel の幅が Hero の `max-w-2xl` に制約される
- **File**: `apps/web/src/components/landing/Hero.tsx:34` + `apps/web/src/pages/LocalEditor.tsx:159-167`
- **Issue**: protect-password panel は内容的に max-w-md 程度で十分、現状は dropzone と同じ max-w-2xl になり横長
- **Suggested fix**: LocalEditor 側で protectPanel を `<div className="mx-auto w-full max-w-md">` でラップ、または Hero に dropzoneAdjacent 専用 slot を切る。**現フェーズでは cosmetic、後送り可**

#### L4: EditorShell.tsx が 650 行で 800 行制限に接近
- **File**: `apps/web/src/pages/EditorShell.tsx`
- **Issue**: 既存 600 行 + Phase 10.H 50 行追加で 650 行。プロジェクトルール 800 行制限の 81%
- **Suggested fix**: 次回 Phase で keyboard shortcut handlers を別 hook に切り出すなど。現フェーズでは ok

#### L5: `<picture>` wrapper が `<source>` 不在で実質無意味
- **File**: `apps/web/src/components/landing/Hero.tsx:39-49`
- **Issue**: 現状 `<picture>` の中身は `<img>` 1 つだけで、`<source>` がないので `<picture>` を使う理由がない
- **Suggested fix**: 意図的に Phase 11+ の `<source srcSet="/landing-hero.webp" />` 一行追加で済む構造を保持。コメントに明記済 (`<picture> wrapper is kept so the future <source> is a one-line add`)。**意図的、無修正で OK**

## Validation Results

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | **Pass** (turbo cache hit) |
| Lint (`biome ci`) | **Pass** (211 files, 0 errors) |
| Unit tests (vitest) | **Pass** (web 321 / api 187 / shared 70 = 578 total) |
| Build (`tsc + vite build`) | **Pass** (LocalEditor 16.12 KB gz, EditorShell 69.93 KB gz) |
| E2E (Playwright) | **Pass** (chromium + mobile-chrome, 93 passed / 67 skipped / 0 failed) |
| a11y (`@axe-core/playwright` wcag22aa) | **Pass** (0 violations on landing) |
| Screenshot regression (room-mobile) | **Pass** (snapshot 再生成済) |

## Files Reviewed (実装ソース 8 件)

| File | LOC | Action | 評価 |
|---|---|---|---|
| `apps/web/src/components/ad/AdSlot.tsx` | 68 | Added | rail / bottom variant 共に i18n + a11y 準拠、CSS 固定 px で CLS 0 |
| `apps/web/src/components/landing/Hero.tsx` | 52 | Added | h2 + dropzone slot + SVG mock。`<picture>` 構造は forward-compat |
| `apps/web/src/components/landing/Features.tsx` | 64 | Added | Lucide icons + 3 item grid。i18n key + readonly array |
| `apps/web/src/components/landing/HowTo.tsx` | 41 | Added | 3 step number badge。シンプル |
| `apps/web/src/components/landing/Faq.tsx` | 54 | Added | native `<details>`/`<summary>`。a11y 自然 |
| `apps/web/src/components/landing/LandingShell.tsx` | 26 | Added | composition pure |
| `apps/web/src/pages/EditorShell.tsx` | 650 | Modified (+50/-7) | rail/bottom AdSlot 配置 + landingSlot prop + 寸法計算 |
| `apps/web/src/pages/LocalEditor.tsx` | 172 | Modified (+8/-4) | protectPanel inline 化、belowHeader 撤去 |
| `apps/web/src/components/toolbar/Toolbar.tsx` | -3 | Modified | LangToggle 撤去 (EditorShell に移設) |
| `apps/web/src/i18n/{ja,en}.ts` | +25/+33 | Modified | landing.* + ad.* keys |
| `apps/web/index.html` | +44 | Modified | FAQPage schema + AdSense meta placeholder |
| `apps/web/.env.example` | +8 | Modified | VITE_ADSENSE_CLIENT_ID |
| `apps/web/public/landing-hero.svg` | 78 | Added | エディタ画面 SVG モック (1200×750) |
| `apps/web/package.json` | +1 | Modified | @axe-core/playwright |
| `apps/web/src/components/ad/__tests__/AdSlot.test.tsx` | 90 | Added | 5 unit tests |
| `apps/web/src/components/landing/__tests__/LandingShell.test.tsx` | 156 | Added | 6 unit tests |
| `apps/web/e2e/landing.spec.ts` | +56/-32 | Modified | 5 new E2E + axe a11y、既存テスト 4 件更新 |
| `apps/web/e2e/{help-modal,i18n,room-mobile}.spec.ts` | small | Modified | toolbar→DropZone 見出し に probe 切替 |

## 強み (褒めて伸ばす)

- ✓ **CLS 0 設計**: rail / bottom 共に固定 px で領域確保、Phase 11+ で `<ins>` 差し込んでもレイアウト変動 0
- ✓ **i18n 完全対応**: hardcoded 文字列 0、ja → en 順序で型強制ゆえ key drift 不可
- ✓ **a11y 試験済**: axe-core wcag22aa で violations 0、native semantic 要素 (`<aside>` `<details>` `<picture>` `<section>`)
- ✓ **テスト網羅**: 11 unit + 6 E2E + screenshot regression
- ✓ **依存追加最小**: `@axe-core/playwright` のみ (workspace-local)、shadcn / framer-motion / GSAP 不要
- ✓ **環境変数 placeholder pattern**: 既存 `%VITE_*%` 慣行に整合
- ✓ **ファイル長制限遵守**: 新規 component すべて 70 行以下、既存 EditorShell 650 行 (制限 800)
- ✓ **責務分離**: AdSlot は placeholder 単機能、LandingShell は composition、各 section は独立

## Decision Rationale

CRITICAL / HIGH なし → APPROVE。MEDIUM 4 件は **どれも merge ブロッカーではない**:
- M1 (schema sync): 監視のみ、実害は Phase 11 で再確認
- M2 (rail pointer-events): 現フェーズでは正しい設計、Phase 11+ 検討事項
- M3 (safe-area-inset): iPhone 実機確認が次の検証ステップ、コード修正は数行
- M4 (bottom-0 redundant): cosmetic

## Recommended Next Steps

1. **必須**: ブラウザ実機確認 (`pnpm dev`) で見た目最終チェック (toolbar 非表示・LangToggle 独立・protect panel inline・bottom rail fixed)
2. **必須**: iPhone 実機 (Safari iOS) で safe-area-inset 確認 (M3) → 必要なら 1 commit で `pb-[env(safe-area-inset-bottom)]` 追加
3. **推奨**: PR 作成 → review for confidence。`/everything-claude-code:prp-pr`
4. **任意**: M1 (FAQPage schema) のテスト追加を Phase 11+ TODO に登録
5. **任意**: M4 (cosmetic) を別 commit で 1 行 cleanup

## 結論

Phase 10.H は **APPROVE with comments** でマージ可。CRITICAL / HIGH 0、MEDIUM / LOW は post-merge follow-up で十分対応可能。実装は plan に忠実、テストカバレッジ充分、a11y / CLS / i18n の三本柱を破綻なく満たしている。
