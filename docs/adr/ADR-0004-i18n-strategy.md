# ADR-0004: i18n 戦略 — 軽量自作 dict から段階拡張

**Date**: 2026-05-05
**Status**: proposed
**Deciders**: imotako (PM/Dev)
**Related**: `.claude/PRPs/prds/snap-share.prd.md` / `.claude/PRPs/prds/phase-10-direction.prd.md` / Phase 10.E (i18n 軽量実装) / ADR-0003 (形態方針)

---

## Context

snap-share PRD MoSCoW で **「英語 UI フォールバック」が Should** として記載されているが、Phase 0〜8 では未着手。Phase 10 で C スタンス（本気の事業化）を採用したため、TAM 拡大の観点で i18n を検討する必要が出た。

### 制約と前提

| 項目 | 状態 |
|---|---|
| 現状の言語 | 日本語のみ（hardcoded JP 文字列が UI 全体に散在） |
| プライマリユーザー | 日本企業のリモートワーカー（PRD 確定） |
| 差別化軸 | 「日本語ファースト」が競合（英語 UI 海外 SaaS）との根本差別化 |
| バンドル予算 | App page 300KB gz（Phase 8.x で 85KB gz まで圧縮済み、余裕大） |
| 開発リソース | 個人開発、週 ~15h |
| 形態方針 | ADR-0003 で確定予定（Web 単独 / Mac 主軸 / ハイブリッド） |

### 形態と i18n の関係

- **Web 単独**: ブラウザの `navigator.language` から OS 言語を検出、`<html lang>` 切替が自然
- **Mac 主軸**: macOS の `NSLocale.preferredLanguages` を Tauri Rust 側で取得、OS 言語自動切替が一級市民
- **ハイブリッド**: 両方対応、共通 dict が必須

### TAM 比較（粗い試算）

| 言語 | リモートワーカー人口（推定） | 競合 | snap-share 優位性 |
|---|---|---|---|
| 日本語 | ~500 万人 | 英語 SaaS (Markup.io 等) のみ、日本語ファースト不在 | **大** |
| 英語 | ~5000 万人（北米 + 欧州 + アジア） | Markup.io / Pastel / Webvizio Free 等多数、レッドオーシャン | **小** |
| 中国語簡体 | ~1 億人（中国国内 IT 人口） | 中国国内 SaaS、CFW Workers 課金/規制リスク | 不明 |
| 韓国語 | ~500 万人 | 韓国国内 SaaS（Naver 系） | 不明 |

→ **英語追加で TAM は 10x になるが、レッドオーシャンに入る**。日本語ファースト差別化の希薄化リスクと天秤。

---

## Decision

**現時点では実装方針を確定しない**（Status: proposed）。

Phase 10.E で以下のいずれかを Status: accepted で確定する:

### Option B（推奨）: 軽量自作 dict + 日英 2 言語のみ

```ts
// apps/web/src/i18n/index.ts
type Lang = 'ja' | 'en';
type Dict = Record<string, string>;

const ja: Dict = { 'editor.toolbar.rect': '矩形', ... };
const en: Dict = { 'editor.toolbar.rect': 'Rectangle', ... };

const dicts: Record<Lang, Dict> = { ja, en };

export function useTranslation() {
  const lang = useCurrentLang();  // navigator.language or localStorage
  return (key: string) => dicts[lang][key] ?? key;
}
```

- **追加バンドル**: 50-100 LOC、依存ゼロ、~2KB gz
- **対応言語**: 日本語（デフォルト）+ 英語のみ
- **切替**: ブラウザ言語自動検出 + 手動切替（localStorage 永続化）
- **欠落キー**: フォールバックとして key 文字列をそのまま表示（dev でアラート出す option）

---

## Alternatives Considered

### A. やらない（日本語ファースト徹底）

- **Pro**: 差別化軸最大化、開発工数ゼロ
- **Con**: C スタンスで TAM 上限が低い、海外マーケット完全放棄、Mac 主軸取った場合に OS 言語 fallback がないのは不自然
- **却下理由**: C スタンスと整合しない。ただし Mac spike 結果で Web 単独継続 + B スタンス修正なら復活候補

### B. 軽量自作 dict + 日英 2 言語（推奨）

- 上記 Decision 参照

### C. i18next + react-i18next

- **Pro**: 業界標準、エコシステム成熟、複数形 / interpolation / namespace / lazy load
- **Con**: 追加バンドル ~10KB gz、設定の学習コスト、現状 2 言語のみで overkill
- **却下候補理由**: 3 言語以上に拡張する判断が出てから移行で十分。snap-share の規模で先取りする意義が薄い

### D. Lingui (LinguiJS)

- **Pro**: TS 型安全、コンパイル時抽出、ICU MessageFormat
- **Con**: ビルド統合（Vite plugin）の摩擦、CLI 学習コスト、JSX マクロ前提
- **却下候補理由**: snap-share の規模で型安全性のメリットが効くほど文言数が多くない（推定 100-200 キー）

### E. FormatJS / react-intl

- **Pro**: ICU MessageFormat 標準準拠、複数形 / 日付フォーマット完備
- **Con**: 追加バンドル ~20KB gz、API 冗長、React 19 + RSC で API 変動中
- **却下候補理由**: Web 単独 SPA + 規模小では不要

### F. Wouter / Tolgee 等の SaaS i18n

- **Pro**: 翻訳管理 UI、外注可
- **Con**: 月額固定費、個人開発の月 $5 予算と整合しない
- **却下候補理由**: 個人開発で外注しないなら無価値

### G. Tauri Native Localization（Mac 主軸時）

- **Pro**: macOS の `Localizable.strings` 標準準拠、OS 言語切替に追従
- **Con**: webview 内の React UI と OS native UI（メニューバー等）で 2 系統運用
- **却下候補理由**: ADR-0003 で Mac 主軸採用時のみ検討、本 ADR では web 側 i18n が前提。Tauri 採用時は **本 ADR の Option B + Tauri 標準** を併用する形になる

---

## Consequences（Option B 採用時）

### Positive

- **依存追加ゼロ**: 自作 50-100 LOC、bundle インパクト微小（~2KB gz）
- **TS 型安全**: Dict のキーを `keyof typeof ja` で型化すれば key typo を compile time で検出
- **テスタビリティ**: 純 function、unit test 容易
- **Mac 主軸採用時の連携が綺麗**: Tauri Rust 側で `NSLocale.preferredLanguages` を取得して webview に渡すだけ
- **段階拡張可能**: 3 言語目以降を追加するときに i18next 等への移行ハードルが低い（dict object をそのまま JSON 化するだけ）

### Negative / Trade-offs

- **複数形対応なし**: 「1 件 / 2 件以上」の英語表現（item / items）を手動 if 分岐で実装する必要
- **interpolation 自前**: `${variable}` の埋め込みを自作（template literal で済む）
- **日付 / 数値フォーマット**: `Intl.DateTimeFormat` / `Intl.NumberFormat` を直接使う（標準 API なので問題なし）
- **3 言語以降に拡張する場合は移行が必要**: ただし dict object → JSON 化の工数は軽

### Neutral

- **日本語ファースト差別化の希薄化リスク**: 英語追加で「英語 UI 海外 SaaS と同じ俎上」になる懸念があるが、デフォルト言語 = 日本語、`<html lang="ja">` 維持、ランディングコピー「日本語ファースト」明記で緩和可能
- **SEO**: `<html lang>` 適切設定 + hreflang タグで日英別ページとして扱われる、SEO 上の問題なし

---

## Implementation Plan（Option B 採用時、Phase 10.E）

### スコープ

1. **`apps/web/src/i18n/` ディレクトリ新設**
   - `index.ts` — `useTranslation` hook + lang detection
   - `ja.ts` — 日本語 dict（デフォルト）
   - `en.ts` — 英語 dict
2. **既存 UI の文言を dict 化**
   - 全 hardcoded JP 文字列を grep で抽出
   - キー命名規約: `{component}.{element}.{purpose}` 例 `editor.toolbar.rect`
   - 推定 100-200 キー
3. **言語検出 + 切替**
   - 初回: `navigator.language` から `ja` / `en` 推定（未対応言語は `ja` フォールバック）
   - 手動切替: ヘッダ右上の言語切替ボタン（既存 UI に追加）
   - 永続化: `localStorage.snap-share-lang`
4. **`<html lang>` 動的更新**
   - lang 切替時に `document.documentElement.lang` を更新
5. **テスト**
   - `useTranslation` の unit test
   - lang 切替の E2E test 1 件（日↔英で UI 文言が切替わることを確認）

### Non-Scope（Phase 10.E では作らない）

- 3 言語目以降（中国語 / 韓国語）
- 翻訳管理 SaaS 連携
- 翻訳の外注
- Tauri Mac 版での OS 言語自動切替（ADR-0003 で Mac 主軸採用時に別途）

### 工数見積

- 1 週間（週 15h × 1）
  - dict 化: 3-4 日（grep + 既存文言の英訳）
  - hook 実装: 0.5 日
  - 言語切替 UI: 0.5 日
  - テスト: 1 日
  - 既存テストへの影響修正: 0.5 日

---

## Validation / Acceptance（Status: accepted へ昇格させる前に確認する事項）

- [ ] ADR-0003 の Decision が出ている（形態方針が i18n 戦略に影響する）
- [ ] Mac 主軸採用時の Tauri 標準 i18n との併用方針が明記されている
- [ ] 推定 100-200 キーの英訳がオーナー単独で対応可能か確認（DeepL / GPT 補助前提でも OK）
- [ ] 言語切替 UI のデザインが既存 UI を破壊しないか確認

---

## References

- Phase 10 PRD: `.claude/PRPs/prds/phase-10-direction.prd.md`
- ADR-0003 (Web vs Desktop): `./ADR-0003-web-vs-desktop-direction.md`
- snap-share PRD MoSCoW: `.claude/PRPs/prds/snap-share.prd.md` §Solution Detail
- i18next: https://www.i18next.com/
- Lingui: https://lingui.dev/
- FormatJS: https://formatjs.io/
- Intl (MDN): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
