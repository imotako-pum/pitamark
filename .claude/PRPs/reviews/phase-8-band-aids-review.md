# Local Code Review: Phase 8 — その場しのぎ実装 (#5)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: #5 band-aids / workarounds / stale comments — production code 内の「とりあえず実装」「コメント腐敗」「inline リテラル逸脱」「テストハッチの production 汚染」を観察のみで記録。コード変更ゼロ。
**Decision**: NEEDS_FIX
  - HIGH 1 件（production bundle に E2E 観測 globals が DEV ガードなしで焼き込まれる）
  - MEDIUM 2 件（stale Phase コメント × 2 カテゴリ）
  - LOW 2 件（inline OKLCH リテラル token 逸脱）

## Summary

5 つの観点を横断的に確認した。`logger.ts` × 2 の stale biome-ignore コメント（triage エスクロー済）は当初の予想どおり LOW だが、`EditorShell.tsx` の 4 つの window globals が `import.meta.env.DEV` ガードを一切持たず production bundle に確定的に含まれることが HIGH として浮上。`useYjsAnnotationsStore.ts` の同パターンは `import.meta.env.DEV` ガード付きで Vite の tree-shaking で除去される設計を採用しており、明確な非対称が存在する。また `autoNextOffset.ts` と `autoArrowDefault.ts` の 2 ファイルに「Phase 5 で再評価する」という相互矛盾するコメント（実際には Phase 9 dogfood が対象）が残っている。DropZone / ToolButton の inline OKLCH リテラルは tokens.css / shadcn の `--destructive` 系 CSS 変数に対応するトークンが存在するため、コメントなし逸脱と判定する。ImageLayer の revert→re-apply→hotfix チェーン（d139a06 → 57bcc1a）は Phase 7.6 で `'anonymous'` crossOrigin の根本解決として再実装・再テストされており、現在の状態は band-aid ではなく **complete fix** である。

commit history（`git log --oneline -50`）で `revert / hotfix` の連鎖を精査したが、`d139a06 Revert → 57bcc1a re-fix + E2E` の 1 チェーンのみで、その後の 7.7/7.8 ではリグレッションなし。「回避策の固定化」に該当するものは検出されなかった。

---

## Findings

### CRITICAL
None.

---

### HIGH

**H1: EditorShell.tsx の window globals 4 件に `import.meta.env.DEV` ガードが欠落しており production bundle に残存**

- **Location**: `apps/web/src/pages/EditorShell.tsx:243-274`（4 つの `useEffect` ブロック）
- **Issue**: 以下の 4 グローバルが production ビルドに含まれる:
  - `__SNAP_SHARE_STAGE_TRANSFORM__` (line 244)
  - ``__SNAP_SHARE_TOOL__` (line 251)
  - `__SNAP_SHARE_PENDING_AUTO_ARROW__` (line 257-259)
  - `__SNAP_SHARE_TRANSFORM_ACTIONS__` (line 268-273)

  `useYjsAnnotationsStore.ts:106` は `if (!import.meta.env.DEV) return;` ガードを明示し、コメントで「production では定数 false になり Vite の tree-shaking で副作用ごと除去される」と説明している。EditorShell の 4 件にはこのガードが一切なく、**production ビルドで `window.__SNAP_SHARE_TOOL__` 等が常に公開される**。

  副作用:
  1. エンドユーザーが DevTools で内部状態を読める（情報開示）
  2. `__SNAP_SHARE_TRANSFORM_ACTIONS__` は `fitToViewport` / `setHundredPercent` / `zoomBy` / `panBy` 関数を window 経由で呼び出せる状態 — UI のズーム/パン操作を外部スクリプトが悪用できるサーフェスになる
  3. bundle サイズのわずかな増加（`useEffect` 4 本分のクロージャ + window への書き込みコスト）
  4. `useYjsAnnotationsStore` との設計非対称がコードを読む人間を混乱させる（なぜここだけガードがないのか）

  上位 2 点は `#13 security` に副次的に関係するが、主観点は **#5 band-aids**（E2E hatch が production を汚染している）。

- **Suggested Fix**:
  ```typescript
  // EditorShell.tsx:243 の useEffect を useYjsAnnotationsStore パターンに統一
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_STAGE_TRANSFORM__ = stageTransform;
  }, [stageTransform]);

  // 他 3 件も同様に if (!import.meta.env.DEV) return; を先頭に追加
  ```
  修正は 1 行 × 4 箇所で完結。Vite は `import.meta.env.DEV` を本番ビルドで `false` に置換し、`if (false) return;` を dead code elimination する。

---

### MEDIUM

**M1: `logger.ts` × 2 の biome-ignore-all コメントに stale Phase 番号**

- **Location**:
  - `apps/web/src/lib/logger.ts:1`
  - `apps/api/src/lib/logger.ts:1`
- **Issue**: 両ファイルの `biome-ignore-all` コメントに `replace with a structured logger in Phase 5+` と書かれているが、Phase 5（パスワード保護 + TTL）は完了済（commit `6a9b890` 等）。「Phase 5+」は最初に書かれた時点での将来フェーズを指していたと思われるが、現在 Phase 8 に達しており、このコメントを読む人間は「Phase 5 に何か関係があるのか」と誤解する可能性がある。

  実態は「console ラッパーを structured logger に置き換えるつもりだったが、当面はこのまま継続する」という意思決定が Phase 5 以降も更新されていない。triage で「stale comment 型」と escrowed 済み。

- **Suggested Fix**:
  ```typescript
  // apps/web/src/lib/logger.ts:1
  // biome-ignore-all lint/suspicious/noConsole: console ラッパー。structured logger
  // (pino / Workers 向け) への移行は Phase 9 dogfood 後に必要性を判断する。
  ```
  コメントを「Phase 5+」→「Phase 9 dogfood 後に判断」に更新するだけでよい。実装変更は不要。

---

**M2: `autoNextOffset.ts` / `autoArrowDefault.ts` の「Phase 5 で再評価する」コメントが Phase 番号混乱**

- **Location**:
  - `apps/web/src/lib/autoNextOffset.ts:5`
  - `apps/web/src/lib/autoArrowDefault.ts:4`
- **Issue**:
  ```
  // dogfood で 8/12/16 のどれが快適かは Phase 5 で再評価する。   (autoNextOffset.ts:5)
  // dogfood で長すぎ/短すぎが出れば Phase 5 で再評価。           (autoArrowDefault.ts:4)
  ```
  Phase 5 は「パスワード保護 + TTL」の実装フェーズで、dogfood 評価とは無関係に完了している。コメントが書かれた Phase 7.8 の時点で「Phase 5」を指定するのは明らかなタイポまたは混乱。dogfood 評価は PRD 上は **Phase 9** に予定されているため、正しくは「Phase 9 dogfood で再評価」。

  ただし、実装動作への影響はなく（`AUTO_NEXT_TEXT_OFFSET_PX = 8` / `AUTO_ARROW_DEFAULT_LENGTH_PX = 100` の値は機能している）、人間の実装者が Phase 9 で「Phase 5 のコメントが意味不明」とつまずくレベル。

- **Suggested Fix**:
  ```typescript
  // apps/web/src/lib/autoNextOffset.ts:5 — "Phase 5" → "Phase 9 dogfood"
  // dogfood で 8/12/16 のどれが快適かは Phase 9 dogfood で再評価する。

  // apps/web/src/lib/autoArrowDefault.ts:4 — 同上
  // dogfood で長すぎ/短すぎが出れば Phase 9 dogfood で再評価。
  ```

---

### LOW

**L1: `DropZone.tsx` の inline OKLCH リテラル 2 種が tokens.css / shadcn CSS 変数体系から逸脱**

- **Location**:
  - `apps/web/src/components/empty-state/DropZone.tsx:69` — `bg-[oklch(96%_0.05_250)]`（drag-over 時のアクセントティント）
  - `apps/web/src/components/empty-state/DropZone.tsx:85` — `bg-[oklch(96%_0.05_27)] text-[oklch(40%_0.22_27)]`（エラーメッセージ背景と文字）
- **Issue**:
  `tokens.css:51` に `--accent: oklch(94% 0.04 250)` が定義されている（drag-over ティントに近い lightness/hue）が、line 69 は直接リテラル `oklch(96%_0.05_250)` を書いている（chroma も微妙に異なる）。line 85 のエラー色は `tokens.css:53` の `--destructive: oklch(54% 0.22 27)` と同 hue だが、`bg-[oklch(96%_0.05_27)]` は `--destructive` の light variant として token 化されていない独立リテラル。将来 accent/destructive hue を変更した場合、DropZone だけ追従しない。

  対応する Tailwind クラスが `bg-accent` / `bg-destructive/10` 等で表現できるかどうかは token bridge の粒度次第だが、少なくともコメントで「意図的な inline 使用」と明示すべき。

- **Suggested Fix**: 既存トークンで表現可能な場合は置換。難しい場合はインライン理由コメントを 1 行追加:
  ```tsx
  // drag-over tint: --accent (oklch 94% 0.04 250) の lightness-up variant。
  // tokens.css に light variant トークンを追加するか bg-accent/20 等で統一検討。
  isOver
    ? 'border-(--color-accent) bg-[oklch(96%_0.05_250)]'
  ```
- **Human Friction**:
  - 改修時必読: no — DropZone は機能完成後に基本触らない
  - 再発生コスト: low — 1 ファイル内の 2 箇所、色変更時に気付く
  - 認知負荷増: yes — 「なぜここだけ inline」が文脈なしでは不明
  - **Human Friction = false** (2 軸中 yes/high は 1 のみ)

---

**L2: `ToolButton.tsx:21` の `danger` tone が shadcn `--destructive` CSS 変数を迂回して inline OKLCH リテラルを使用**

- **Location**: `apps/web/src/components/toolbar/ToolButton.tsx:21`
- **Issue**:
  ```typescript
  danger: 'text-[color:oklch(54%_0.22_27)] hover:bg-[color:oklch(96%_0.05_27)]',
  ```
  `tokens.css:53` に `--destructive: oklch(54% 0.22 27)` が存在する。`text-[color:oklch(54%_0.22_27)]` は `text-destructive`（shadcn bridge variable）で置換できる可能性がある。`hover:bg-[color:oklch(96%_0.05_27)]` も `hover:bg-destructive/10` 相当。shadcn の `--destructive` 体系が整備されているにもかかわらず inline リテラルで書かれており、トークン体系の一貫性が崩れている。

  ToolButton 自体は Toolbar のツールボタンという中核コンポーネント — ここのスタイル定義は Toolbar 全体の改修時に参照される。

- **Suggested Fix**: shadcn CSS 変数へ移行:
  ```typescript
  danger: 'text-destructive hover:bg-destructive/10',
  ```
  ただし Tailwind v4 + shadcn の destructive opacity utility が設定されているか確認要。不可なら `text-(--destructive) hover:bg-[color:oklch(96%_0.05_27)]` の片方だけでも変数化する価値あり。
- **Human Friction**:
  - 改修時必読: yes — Toolbar / ToolButton は中核コンポーネント
  - 再発生コスト: low — 1 行 1 ファイル、Tailwind クラス置換のみ
  - 認知負荷増: yes — `--destructive` がある中でなぜ inline か、文脈なしで分からない
  - **Human Friction = true** (改修時必読=yes, 認知負荷増=yes → 2 軸)

---

## band-aids 観点外の副次的観察

以下は他観点の担当範囲のため finding としては出さず、参照のみ:

| 観察 | 主観点 |
|---|---|
| EditorShell の window globals の `as unknown as Record<string, unknown>` 型キャスト | #6 typesafety（triage で deliberate confirmed） |
| `__SNAP_SHARE_TRANSFORM_ACTIONS__` が関数群を expose — 悪意ある JS から呼べる | #13 security（副次的観察。本 finding H1 で帰結を記述） |
| DropZone の `bg-accent` / `bg-destructive` 置換の Tailwind v4 互換性確認 | #10 perf / #9 a11y（色コントラスト） |

---

## CLAUDE.md Design Rules チェック（#5 観点）

| Rule | 状態 |
|---|---|
| Rule 4: Konva color は `colors.ts` 由来の hex リテラル — Konva 内に OKLCH は使われていない | PASS |
| Rule 5: `<KonvaImage listening={false}>` と wrapping Layer の `listening={false}` | PASS（`ImageLayer.tsx:31` で確認） |
| Rule 8: Yjs mutators は `doc.transact(fn, LOCAL_ORIGIN)` — band-aids との交差なし | PASS |

---

## ImageLayer revert → re-apply チェーン（既知-1）

`d139a06 Revert` → `57bcc1a feat(phase-7.6) re-fix` のチェーンを精査:

- Phase 7.5 で `useImage(src, 'anonymous')` を追加（2e2d533）
- crossOrigin mode による既存キャッシュとの競合で revert（d139a06）
- Phase 7.6「既知-1 fix」として CORS + crossOrigin の根本解決を行い再実装（57bcc1a）、E2E test (`ImageLayer.test.tsx:65`) も追加
- 現時点の `ImageLayer.tsx:16` は `useImage(src, 'anonymous')` + 説明コメント + 専用テスト付き

**判定: 根本解決済、band-aid ではない**。

---

## Validation Results

| Check | Result |
|---|---|
| `TODO / FIXME / HACK / XXX` | 0 件（triage 確認済） |
| 「とりあえず / 暫定 / あとで / 一旦 / 再考 / TBD」 | 0 件（grep 確認） |
| revert → re-apply → hotfix 連鎖 | 1 件（d139a06 → 57bcc1a）、根本解決済 |
| biome-ignore stale comment | 2 件（logger.ts × 2）→ M1 |
| window globals production 焼き込み | 4 件（EditorShell.tsx）→ H1 |
| Phase 番号混乱コメント | 2 件（autoNextOffset.ts, autoArrowDefault.ts）→ M2 |
| inline OKLCH リテラル逸脱 | 3 件（DropZone × 2, ToolButton × 1）→ L1 + L2 |

---

## Review Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH | 1 | warn |
| MEDIUM | 2 | info |
| LOW | 2 | note |

**LOW Human Friction 内訳**:
- L1 (DropZone inline OKLCH): false — Phase 9 backlog
- L2 (ToolButton danger inline): **true** → Phase 8.x 対応候補

Verdict: NEEDS_FIX — H1（EditorShell window globals の DEV ガード欠落）は production bundle にテスト用 globals + 関数 expose を含み、`useYjsAnnotationsStore` パターンと明確な非対称がある。1 行 × 4 箇所の修正で解消できるため、Phase 8.x 最高優先で着手を推奨。M1/M2 はコメント編集のみで完了。L2 は Human Friction = true のため Phase 8.x 候補に含める。

---

## Resolution Update

### Phase 8.x branch `fix/phase-8-x-fixes` (theme 4: quality cleanup)

| Finding | Resolution | Files touched |
|---|---|---|
| **H1** EditorShell window globals 4 件に DEV ガード欠落 | 4 useEffect 全てに `if (!import.meta.env.DEV) return;` 追加。production bundle で `__SNAP_SHARE_*` grep ゼロ確認 | `apps/web/src/pages/EditorShell.tsx` |
| **M1** logger.ts × 2 stale Phase コメント | 「Phase 5+ で structured logger」→「Phase 9 dogfood 後に判断」 + 移行候補 (pino) を明示 | `apps/web/src/lib/logger.ts` / `apps/api/src/lib/logger.ts` |
| **M2** autoNextOffset / autoArrowDefault の Phase 番号混乱 | 「Phase 5 で再評価」→「Phase 9 dogfood で再評価」 | `apps/web/src/lib/autoNextOffset.ts` / `apps/web/src/lib/autoArrowDefault.ts` |
| **L2** ToolButton danger inline OKLCH | shadcn `--destructive` 経由 (`text-destructive hover:bg-destructive/10`) | `apps/web/src/components/toolbar/ToolButton.tsx` |
| L1 (HF=false) | Backlog (Phase 9 後) | — |

(Phase 8.B 観察のみ — 未修正)
