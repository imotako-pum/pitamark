# Local Code Review: Phase 10.D — リネーム + 公開準備 (ドメイン非依存)

**Reviewed**: 2026-05-05
**Branch**: `feat/phase-10-d-rename-launch-prep` (15 commits ahead of `main`)
**Scope**: `git diff main...HEAD` (101 files, +1750 / -159)
**Decision**: **APPROVE** (no CRITICAL/HIGH issues)

---

## Summary

Phase 10.D の umbrella ブランチを review。15 commit が step 単位に綺麗に分かれており、各 step が機能横断的に独立。CRITICAL / HIGH 級の問題は見つからず、LOW 5 件の小所見のみ。すべての validation が green (typecheck / lint / unit / e2e / build)。Cloudflare 側リソース recreate を意図的に Phase 10.F に残置している点も plan / report で明示済。

## Findings

### CRITICAL

なし。

### HIGH

なし。

### MEDIUM

なし。

### LOW

#### LOW-1 — canonical href が trailing slash なし
**File**: `apps/web/index.html:13`
```html
<link rel="canonical" href="%VITE_PUBLIC_URL%" />
```
- 本番 (Phase 10.F) で `VITE_PUBLIC_URL=https://pitamark.app` が substitute されると `<link rel="canonical" href="https://pitamark.app" />` になり、trailing slash がない。
- root URL の canonical は `https://example.com/` (末尾スラッシュあり) が SEO best practice として推奨されることが多い。
- 但し Google は両表記を等価とみなす (root の場合のみ)。実害は限定的。
- 当初 trailing slash 込みで実装したが Vite が public/ asset URL として処理しようとして EISDIR で build fail したため除去 (plan に経緯記録済)。
- **推奨**: Phase 10.F でドメイン確定時に `<link rel="canonical" href="https://pitamark.app/" />` (hard-code + trailing slash) に置換することを 10.F の Acceptance に追加。または Vite plugin の transformIndexHtml で動的注入。

#### LOW-2 — i18n migration: 不正な current key が cleanup されない
**File**: `apps/web/src/i18n/index.ts:30-46` (`readPersistedLang`)
```ts
const current = window.localStorage.getItem(STORAGE_KEY);
if (isLang(current)) return current;
// Migrate legacy → current key, then drop the legacy entry.
const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
if (legacy !== null) {
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  if (isLang(legacy)) {
    window.localStorage.setItem(STORAGE_KEY, legacy);
    return legacy;
  }
}
```
- `pitamark-lang` に invalid 値 (`'fr'` 等) が入っていた場合、`isLang(current)` で false → fall through → legacy 経路に入る。current の invalid 値は削除されないので localStorage に永続化される。
- 実害: `detectInitialLang` のフォールバックで毎回 `nav` or `'ja'` に解決されるため UX 影響なし。ストレージに残ること自体は害ではないが、defensive にきれい。
- 真にこのケースに到達するのは「ユーザーが手動で localStorage を編集した」場合のみ (本コードからは invalid 値を書き込まない)。
- **推奨 (オプショナル)**: invalid current 検出時に `removeItem(STORAGE_KEY)` を追加。または「現実に踏まれない pathway」として現状維持。

#### LOW-3 — local-user migration: setItem 成功 / removeItem 失敗時に両キー残存
**File**: `apps/web/src/lib/local-user.ts:42-55` (`readPersistedRaw`)
```ts
if (legacy !== null) {
  try {
    storage.setItem(STORAGE_KEY, legacy);
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch { /* ... */ }
  return legacy;
}
```
- `setItem` が成功して `removeItem` が throw した場合、新キーと旧キー両方が残る。次回起動時は新キーが先に読まれて legacy ブランチには入らないため、旧キーは orphan として永続。
- 実害: ストレージ容量の重複のみ (数百 byte)。
- localStorage の `removeItem` が throw するケースは仕様上ほぼなく (privacy mode で `setItem` が throw するパスとは異なる)、実踏可能性は極めて低い。
- **推奨 (オプショナル)**: `setItem` と `removeItem` を別々の try/catch にする、または現状維持。

#### LOW-4 — AppShell.tsx は使用されていないコンポーネント
**File**: `apps/web/src/components/app-shell/AppShell.tsx`
- `grep -rn AppShell apps/web` の結果、`AppShell.tsx` 内 (定義と Props 型) のみ。`import { AppShell }` が他のソース・テストに見当たらない。
- 本 PR では h1 を `t('common.appName')` 経由に置換したが、現役で render されていない可能性。
- ただし、Phase 10.D の plan の Acceptance は「`AppShell.tsx` h1 / `EditorShell.tsx` h1 が `t('common.appName')` 経由」を要求しており、それは満たしている。
- **推奨 (別 phase 検討)**: refactor-cleaner で dead code 検証 + 未使用なら削除を Phase 11+ で別 PR に。今回は plan の Acceptance を満たすため触る判断は妥当。

#### LOW-5 — terms-en / privacy-en の DRAFT 表示が非可視
**File**: `docs/legal/terms-en.md:1-3` / `docs/legal/privacy-en.md:1-3`
```md
# Terms of Service (pitamark)

> **DRAFT — machine-translated from `terms-ja.md` (Phase 10.D, 2026-05-05).**
> ...
```
- 冒頭に blockquote で DRAFT 警告は明記済 (見える)。一方で日本語 (`docs/legal/terms-ja.md`) には DRAFT marker が「冒頭の "本文書は draft です" ブロック」のみで、英訳側のように "**DRAFT — machine-translated**" のような visibility-emphasized banner はない。
- 但し ja は人手で書いた draft、en は機械翻訳 draft で性質が異なるため警告強度の差は妥当。
- 公開ルーティング (`/legal/*`) は Phase 10.F で追加予定で、その時点で web 経由の表示確認が必要。
- **推奨**: 10.F で web routing 追加時、両言語の "DRAFT" バナーが画面で目立つかを確認。現状は markdown raw のみなのでこのままで OK。

---

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check (`pnpm typecheck`) | ✅ Pass | 全 4 workspace green、FULL TURBO cached |
| Lint (`pnpm lint` = biome ci) | ✅ Pass | 203 files, 0 error / 0 warning |
| Unit tests (`pnpm test`) | ✅ Pass | shared / api 187 / web 310 = 全 PASS、5 新規 migration test 含む |
| Build (`pnpm build`) | ✅ Pass | vite 86KB gz + wrangler dry-run 181KB gz |
| E2E (`pnpm test:e2e` Playwright chromium) | ✅ Pass | 85 PASS / 67 skipped (auth-required spec はローカル env 未整備でスキップ、想定通り) |

## Files Reviewed (重点)

| File | Change | Note |
|---|---|---|
| `apps/web/src/i18n/index.ts` | Modified | localStorage migration logic、3 new test ケース |
| `apps/web/src/lib/local-user.ts` | Modified | localStorage migration logic、2 new test ケース |
| `apps/web/src/lib/exportPng.ts` | Modified | filename prefix、関連 e2e 4 spec も同期 |
| `apps/web/src/components/app-shell/AppShell.tsx` | Modified | i18n 化、※未使用の可能性 (LOW-4) |
| `apps/web/src/pages/EditorShell.tsx` | Modified | h1 を `t('common.appName')` 経由に |
| `apps/web/index.html` | Modified | title / og: / twitter:* / canonical / JSON-LD / apple-touch-icon |
| `apps/web/scripts/build-og-assets.mjs` | Added | Playwright chromium での HTML→PNG 生成、再現可能 |
| `apps/web/public/og-image.png` | Added | 1200×630, 21KB binary |
| `apps/web/public/apple-touch-icon.png` | Added | 180×180, 2.6KB binary |
| `apps/web/public/robots.txt` | Added | `Disallow: /r/` + sitemap 参照、TBD コメントあり |
| `apps/web/public/sitemap.xml` | Added | `/` のみ最小 sitemap、TBD コメントあり |
| `docs/adr/ADR-0005-app-naming-and-domain.md` | Added | accepted、ADR-0004 フォーマット mirror |
| `docs/legal/terms-en.md` / `privacy-en.md` | Added | machine-translated draft、ja authoritative 明記 |
| `package.json` 全 4 件 + 全 import path | Modified | workspace rename `@snap-share/*` → `@pitamark/*` |
| `apps/api/src/index.ts` / `lib/openapi.ts` / `vitest.config.ts` | Modified | 内部識別子 (health.service / OpenAPI title / vitest project) |
| `apps/web/src/domain/annotation/yjs-mutations.ts` | Modified | Symbol description |
| `README.md` | Modified | title / commands / GitHub URL + リネーム移行 note |
| 各種 `__tests__/*.test.tsx` (5+ ファイル) | Modified | localStorage key を新キーに |

## Pattern / Convention Compliance

✅ 既存パターンに整合:
- ADR フォーマット: ADR-0004 (Date / Status / Deciders / Related / Context / Decision / Alternatives Considered / Consequences / References) を mirror
- i18n key 命名: `common.appName` は既存 `{surface}.{element}.{purpose}` 命名規則に整合
- Symbol identity: `Symbol('pitamark/local')` は既存 `LOCAL_ORIGIN` の identity-sensitive 制約 (`trackedOrigins`) と整合 (description が変わっても Symbol identity は import 元 1 箇所で集約済のため安全)
- localStorage migration: ja パターン (try/catch で privacy mode 対応) を踏襲
- biome-ignore コメント: 既存 `// biome-ignore-all lint/suspicious/noConsole: ...` (e.g. logger.ts) と同形式
- 法務 ja/en: 章番号 + 見出し構造を mirror、ja が authoritative である旨を en 冒頭で明示

## Security Considerations

✅ 全クリア:
- ハードコード credentials / API keys なし
- ユーザー入力検証は localStorage migration で `isLang()` / JSON.parse try-catch で適切
- XSS リスクなし (JSON-LD はビルド時 inline、ユーザー入力なし)
- CSP は既存 `_headers` のまま、新規アセット (PNG / robots.txt / sitemap.xml) はすべて self-origin
- Path traversal なし (build-og-assets.mjs の `resolve(PUBLIC_DIR, '...')` は固定 basename)

## Intentional Deferrals (Phase 10.F)

明示的に touch せず後続に残置:
- `apps/api/wrangler.toml` の `name = "snap-share-api"` / R2 binding `bucket_name = "snap-share-images"` / `CORS_ALLOWED_ORIGINS` の `snap-share.pages.dev` 系
- `apps/web/src/lib/bindings.ts` / `apps/api/src/lib/cors.ts` のコメント内 example URL
- `apps/api/src/__tests__/lib/cors.test.ts` / `apps/api/src/__tests__/images.test.ts` のテスト fixture
- `apps/api/src/__tests__/helpers/build-env.ts` の CORS env
- `apps/api/.dev.vars.example` / `apps/web/.env.example` の operational example URLs
- `apps/web/e2e/room-export-receiver.spec.ts:12` のコメント `snap-share.pages.dev ↔ snap-share-api.workers.dev`
- `SnapShareYDO` Durable Object クラス名 + DO migration
- `CHANGELOG.md` ファイル新設

これらはすべて plan / report の NOT Building と Implementation Approach に明記されており、10.F の Acceptance で網羅される。

## Decision

**APPROVE** with 5 LOW notes.

ブランチは clean、step ごと commit が綺麗、validation 全 green、plan と report と ADR が揃っている。LOW 級の所見はすべて (1) 実害が限定的、(2) Phase 10.F or 別 phase で対処可能、または (3) plan で意図的に残置済の項目。

## Next Steps

- [ ] **オーナー作業**: GitHub repo rename `imotako-pum/snap-share` → `imotako-pum/pitamark` (Settings、PR merge 前後の任意)
- [ ] `/everything-claude-code:prp-pr` で umbrella PR 作成 (15 commit)
- [ ] PR merge 後、Phase 10.F に着手:
  - LOW-1 に従い canonical の trailing slash も hard-code 値置換
  - LOW-2 / LOW-3 は影響軽微につき 10.F では touch 不要、Phase 11+ で品質向上 round に含める判断
  - LOW-4 (AppShell 未使用) は別 phase で refactor-cleaner で dead code audit
  - LOW-5 は web routing 追加時に DRAFT 表示の visibility 確認
