# Local Code Review: Phase 8 — モダン性 (#2)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: catalog version pin の鮮度 / 非推奨 API 利用 / TypeScript target / Biome version 整合 / cross-cutting rule 6 (catalog 集約) 遵守
**Decision**: NEEDS_FIX
  - HIGH 1 (TypeScript 5.6 → 6.0 の major 遅れ)
  - MEDIUM 2 (lucide-react v0 → v1 major / hono が catalog 外)
  - LOW 3

## Summary

`pnpm-workspace.yaml` の `catalog:` を 2026-05-04 時点の npm registry latest と突合した結果:

| package | catalog (現在) | npm latest | 差分種別 |
|---|---|---|---|
| **typescript** | `5.6.3` (固定) | `6.0.3` | **major 1 つ遅れ** |
| **lucide-react** | `^0.460` | `1.14.0` | **major 1 つ遅れ** (v1.0.0 は 2026-03-23 リリース) |
| `vitest` | `^4.1` | `4.1.5` | minor pin で OK (patch 自動追従) |
| `zod` | `^4.4` | `4.4.3` | minor pin で OK |
| `konva` | `^10.2` | `10.3.0` | minor pin で OK |
| `react` / `react-dom` | `^19.2` | `19.2.5` | minor pin で OK |
| `yjs` | `^13.6` | `13.6.30` | minor pin で OK |
| `@hono/zod-openapi` | `^1.3` | `1.3.0` | OK |
| `@scalar/hono-api-reference` | `^0.10` | `0.10.13` | OK |
| `@biomejs/biome` (root) | `^2.2` | `2.4.14` | 範囲 OK だが Decisions Log 記載と不一致 |
| `use-image` | `^1.1` | `1.1.4` | OK |

加えて **`hono` が catalog 外** で `apps/web/package.json` と `apps/api/package.json` の両方に `"hono": "^4.12"` で直書きされており、CLAUDE.md cross-cutting rule 6 「Catalog-managed deps」を逸脱している。

API 鮮度については、Phase 7.x までで一貫して `@hono/zod-openapi` の `createRoute` パターン / Hono v4.x の Workers binding / React 19 の関数コンポーネント中心 idiom / Konva 10 の Stage transform API / Yjs 13 の y-protocols は **2026 ベストプラクティス寄り** で、deprecated API 利用は本軸の grep 範囲では発見されず。深い API drift は #3 React BP / #4 Hono BP の所管。

件数: CRITICAL 0 / HIGH 1 / MEDIUM 2 / LOW 3、合計 6 件。

## Findings

### CRITICAL

None.

### HIGH

**H1: TypeScript catalog pin が `5.6.3` で TS 6.0 から major 1 つ遅れ**

- **Location**: `pnpm-workspace.yaml:6` — `typescript: 5.6.3`
- **Issue**:
  TypeScript 6.0.3 は npm `latest` tag 配信中の stable major release (npm dist-tags 確認済: `latest: 6.0.3`)。本リポジトリは 5.6.3 で固定 (caret なし、固定値) されており、major 1 つぶん遅れている。TS 6 では型推論精度向上 / `noUncheckedIndexedAccess` 強化 / Variance 注釈 / decorators の標準化等の改善が入る一方、breaking changes (lib types の削除、deprecated 構文除去) も含む。
  Phase 8 で「2026 ベストの選定」を観点とする場合、major 1 つ遅れは **upgrade 検討タスクとして明示** すべき優先度。本コードベースは `noUncheckedIndexedAccess` 等を既に有効化しており、6 へ進む前提条件は満たしている可能性が高い。
- **Suggested Fix**:
  Phase 8.x で **TS 6 upgrade 専用ブランチ** を切り、以下の手順:
  1. catalog の `typescript: 5.6.3` → `^6.0` (or `6.0.3` 固定) に更新
  2. `pnpm install` で workspace 全体を上げる
  3. `pnpm typecheck` を全 workspace で実行、新規エラーを 1 件ずつ修正
  4. `pnpm test` / `pnpm build` の green を確認
  5. release notes の breaking changes (とくに lib types / decorators) を読み、コードベースに該当箇所がないか目視確認
  6. Phase 8.x の単独 PR としてマージ (他の修正と混ぜない、回帰時の切り戻しが楽)
  事前に **5.7 系を経由する** 段階的 upgrade も検討可 (`5.6.3 → 5.7 → 6.0`)。

### MEDIUM

**M1: lucide-react catalog pin が `^0.460` で v1 から major 1 つ遅れ**

- **Location**: `pnpm-workspace.yaml:21` — `lucide-react: ^0.460`
- **Issue**:
  lucide-react `1.0.0` は **2026-03-23 リリース** (npm `time` 確認済、最新 1.14.0)。`^0.460` は 0.x 系での最新は取得するが **1.x へは自動 upgrade されない** (semver 0-major rule)。v1 release notes には icon 名の正規化 / TypeScript types の改善 / tree-shake 改善等が含まれる可能性が高い (詳細確認は upgrade 時)。
  本軸では「major 1 つ遅れ」を MEDIUM として扱う:
  - HIGH ではない理由: lucide-react は UI icon ライブラリで、API 互換性 break はあっても production 動作への影響は限定的 (icon 名の変更程度)
  - Phase 8.x で TS 6 upgrade と同じ PR にまとめても可
- **Suggested Fix**:
  catalog `lucide-react: ^0.460` → `^1.0` に更新、`pnpm install` で v1 化。`grep -r "from 'lucide-react'"` で全 import を洗い出し、icon 名が変わっていないか確認。Toolbar.tsx / DropZone.tsx / HelpModal.tsx 等の icon 利用箇所を視認確認。

**M2: `hono` が catalog 外、apps/web + apps/api に `^4.12` で直書き — cross-cutting rule 6 違反**

- **Location**:
  - `apps/web/package.json:?` (line 詳細は要 grep 確認、`"hono": "^4.12"`)
  - `apps/api/package.json:?` (`"hono": "^4.12"`)
- **Issue**:
  CLAUDE.md cross-cutting rule 6 「Catalog-managed deps. React, Konva, lucide-react, vitest, zod, etc. live in `pnpm-workspace.yaml` under `catalog:` and are referenced as `"pkg": "catalog:"`. Bumping a version means editing the catalog, not individual `package.json` files.」に明示的に違反している。`@hono/zod-openapi` / `@hono/zod-validator` / `@scalar/hono-api-reference` は catalog に集約されているのに、本体 `hono` だけ catalog から外れている。
  影響:
  1. Hono のバージョン bump が 2 ファイルの並走更新になり、片側 stale リスク
  2. version drift の早期検知が catalog 範囲では効かない
  3. 「rule 6 をどこまで適用するか」の line が ambiguous なまま、新規追加 dep が同じ運用にされない可能性
- **Suggested Fix**:
  Phase 8.x で 5 行修正:
  1. `pnpm-workspace.yaml` の `catalog:` に `hono: ^4.12` (or 4.12.16 固定) を追加
  2. `apps/web/package.json` の `"hono": "^4.12"` → `"hono": "catalog:"`
  3. `apps/api/package.json` も同様
  4. `pnpm install` で lockfile 更新
  5. `pnpm typecheck` / `pnpm test` で回帰なし確認
  ついでに「catalog に何を入れるか」の policy を CLAUDE.md cross-cutting rule 6 に追記 (例: 「2 つ以上の workspace で使う dep は必ず catalog 化、1 workspace 専用は workspace 内 OK」)。

### LOW

**L1: Biome version `^2.2` (root devDep) と Decisions Log 記載の `2.4.13` が不一致 (cosmetic)**

- **Location**:
  - `package.json:?` (root) — `"@biomejs/biome": "^2.2"`
  - `.claude/PRPs/prds/snap-share.prd.md` Decisions Log 「Biome バージョン / ルール — **2.4.13、`useConst` のみ (noVar 削除済)、`noConsole: warn`**」
- **Issue**:
  実際にインストールされているのは npm latest 解決で `2.4.14` (caret 範囲内) だが、Decisions Log には `2.4.13` と書かれており、また root `package.json` の pin 表記は `^2.2` という古い基準点で書かれている。動作上の問題は無いが「決定された version」と「pin 表記」と「実際の installed」が 3 点ずれている状態。
- **Suggested Fix**:
  以下のいずれかで整える:
  - 案 A: pin 表記を更新 — `^2.2` → `^2.4` に bump
  - 案 B: Decisions Log を最新化 — `2.4.13` → `2.4.14` (or `^2.4`)
  推奨は **案 A + Decisions Log の更新方針を「caret 表記で統一する」と書き換える** (具体 patch を log に書くと将来 stale になる)。
- **Human Friction**: false
  - 改修時必読: no — Biome 設定は通常触らない
  - 再発生コスト: low — 1 行修正
  - 認知負荷増: no — 動作上の不一致ではない
  - **判定**: 3/3 とも no/low → false (Phase 8.x backlog)

**L2: TypeScript `target: ES2022` で 2026 における ES2023+ への upgrade 余地**

- **Location**: `tsconfig.base.json:?` — `"target": "ES2022"`, `"lib": ["ES2022", "DOM", "DOM.Iterable"]`
- **Issue**:
  Cloudflare Workers / Node 22+ / モダンブラウザ全てが ES2023+ をサポートしている (Array.findLast / toSorted / Promise.withResolvers 等の便利 API が target 引き上げで型認識される)。`ES2022` 維持は保守的だが、本リポジトリの動作環境では ES2023+ にしてもデメリットはほぼ無い。
- **Suggested Fix**:
  `tsconfig.base.json` で `target: 'ES2023'`, `lib: ['ES2023', 'DOM', 'DOM.Iterable']` に bump。`pnpm typecheck` で新たに使えるようになった API の不正使用が無いか確認 (target 引き上げは通常 backward compatible)。
- **Human Friction**: false
  - 改修時必読: no — `tsconfig.base.json` は通常触らない
  - 再発生コスト: low — 1 行修正、breaking risk 低
  - 認知負荷増: no — モダン API 使用機会の拡大、認知負荷はむしろ減る
  - **判定**: 3/3 とも no/low → false (Phase 8.x backlog 候補)

**L3: catalog の minor pin (`^X.Y`) と固定 pin (`X.Y.Z`) の混在**

- **Location**: `pnpm-workspace.yaml:6` — `typescript: 5.6.3` (固定) / 他は `^X.Y` (caret)
- **Issue**:
  TypeScript だけ caret なし固定 pin。他の dep (vitest / zod / react 等) は caret 付き minor pin で patch 自動追従。policy が混在しており、なぜ TypeScript だけ固定なのか文脈不明。Phase 1 monorepo init plan に記載があれば理由が分かるが、catalog comment では明示されていない。
- **Suggested Fix**:
  H1 で TS 6 upgrade する際に同時に caret 化 (`typescript: ^6.0`)、または「TypeScript は major upgrade 時のみ手動更新する pin 戦略」と pnpm-workspace.yaml に YAML コメントで明記。
- **Human Friction**: false
  - 改修時必読: no
  - 再発生コスト: low
  - 認知負荷増: no — 「なんとなく」のままでも動作には影響なし
  - **判定**: 3/3 とも no/low → false (Phase 8.x H1 と同 PR でついで対応推奨)

## Resolution Update

(Phase 8.x で各 finding 対応後に追記)

---
*Generated: 2026-05-04*
*Reviewer: 手動 + npm registry direct query*
