# Local Code Review: Phase 8 — SSOT 遵守 (#1)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: `packages/shared/src/{index,annotation,room,presence}.ts` / `apps/web/src/hooks/{useAnnotationsStore,useYjsAnnotationsStore,annotationsReducer,historyReducer}.ts` / `apps/web/src/domain/annotation/{yjs-mutations,yjs-codec}.ts` / `apps/web/src/hooks/yjs-annotations-context.ts` / `apps/api/src/routes/rooms.ts` / `apps/api/src/services/room-service.ts` / `apps/api/src/storage/r2-meta-storage.ts` / `apps/api/src/lib/error.ts` / `apps/web/src/lib/api-client.ts` / `apps/web/src/components/canvas/colors.ts` ↔ `apps/web/src/styles/tokens.css` / `pnpm-workspace.yaml` (catalog)
**Decision**: NEEDS_FIX — HIGH 1 件 / MEDIUM 2 件 / LOW 3 件 を発見、Phase 8.x で着手推奨

## Summary

`packages/shared` は Zod 駆動の SSOT として概ね機能しており、`Annotation` / `Room` / `RoomPublic` / `RoomCreated` / `UserPresence` は **すべて `z.infer<typeof Schema>` 経由で型導出** されている。手書き型と Schema を二重定義している箇所は **ゼロ**。サーバ側の境界 (`r2-meta-storage.ts:46` / `@hono/zod-openapi` の自動 `.parse`) も `Schema.safeParse` で runtime 検証が機能している。`LOCAL_ORIGIN` の symbol identity も `lib/yjs-config.ts` re-export 経由で 1 箇所に集約され、CLAUDE.md cross-cutting rule 8 を遵守。

一方で **Web → Server レスポンス境界での非対称** が顕在化している。`apps/web/src/lib/api-client.ts` は `await res.json()` の戻りを `as RoomCreated` / `as RoomPublic` / `as { token: string }` で **型アサート** しているのみで、Zod parse による runtime 検証は行っていない。サーバが返した bytes が schema と乖離した場合 (例: 古い deployment、中間 proxy の改竄、互換性なき schema 変更) 静かに UI 内部に流入する。これが axis #1 の本質的問題: `packages/shared` の Schema が「web からも `parse` される」前提で設計されているのに、消費側が `as` で素通ししている **片務的 SSOT**。

加えて `authResponseSchema` (`apps/api/src/routes/rooms.ts:40-42`) は `RoomCreatedSchema` / `RoomPublicSchema` と性質が同じ「API レスポンス schema」だが `packages/shared` ではなく `routes/rooms.ts` 内ローカルで定義されており、SSOT の置き場所が **不統一**。tokens.css には `--color-tool-rect` / `-arrow` / `-text` / `--color-highlight-yellow` という per-tool 色トークンが残るが、`annotationsReducer.ts:25-30` で「`activeColor` 単一 SSOT に collapse 済」と明文化された設計と矛盾、いずれの component からも参照されていない vestigial token と推察される。LOW としては color-regex 重複、Room/RoomStored エイリアス重複、presence palette の OKLCH↔hex 手動 sync テスト不在。

件数: CRITICAL 0 / HIGH 1 / MEDIUM 2 / LOW 3、合計 6 件。

副次的観察 (本 review では finding 化しない):
- `hono` が `apps/{web,api}/package.json` に `^4.12` で **catalog 外** に書かれているのに `@hono/zod-openapi` 等は catalog 集約 → CLAUDE.md cross-cutting rule 6 の version SSOT 観点だが **#2 modernity** が主軸
- `DropZone.tsx:69, 85` の `bg-[oklch(96%_0.05_250)]` 等 inline OKLCH リテラルは token system からの逸脱だが **#5 band-aids / #9 a11y** 主軸

## Findings

### CRITICAL

None.

### HIGH

**H1: Web 側 API レスポンスが `as <Schema>` 型アサートのみで runtime parse を経由しない**

- **Location**:
  - `apps/web/src/lib/api-client.ts:65` — `const body = (await res.json()) as RoomCreated;`
  - `apps/web/src/lib/api-client.ts:89` — `return (await res.json()) as RoomPublic;`
  - `apps/web/src/lib/api-client.ts:117` — `const body = (await res.json()) as { token: string };`
- **Issue**:
  `packages/shared` は Zod 駆動の SSOT として `RoomCreatedSchema` / `RoomPublicSchema` を正本に据え、サーバ送信側 (`@hono/zod-openapi` で declared route) と meta storage 側 (`r2-meta-storage.ts:46` で `RoomSchema.safeParse`) では runtime 検証が走っている。一方 web 受信側では同じ Schema を **import せずに** 型としてだけ消費している。結果として:
  1. サーバを (例: 古い deployment) 巻き戻したとき新フィールド欠落が型としては silent に通過
  2. `RoomCreated` の `protected` と `image` の **refine** (`room.ts:78-82`: 「`protected: true` のとき `image` 不在 / `false` のとき `image` 存在」) が web では検証されず、ガード違反のレスポンスを下流に流す
  3. 中間 proxy の改竄 / 不正レスポンスを TypeScript の名目型のみが「妥当」と扱う
  4. `as { token: string }` (line 117) は **`packages/shared` にすら schema が無い** (M1) = web/api 双方で別管理されている任意 shape を直接消費

  これは axis #1 「API 境界で `Schema.parse` が runtime 検証として機能しているか — boundary なし direct cast はないか」に直接該当する。サーバ書き出し側だけが SSOT を守っている **片務的 SSOT**。

- **Suggested Fix**:
  すべての response 受信箇所を Zod parse 経由に置換する。`api-client.ts` 内で fail-soft (parse 失敗時は `network` reason に倒す) パターンを推奨:
  ```typescript
  import { RoomCreatedSchema, RoomPublicSchema } from '@snap-share/shared';
  // ...
  if (res.status === 201) {
    const json: unknown = await res.json();
    const parsed = RoomCreatedSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn('createRoom: schema mismatch', { issues: parsed.error.issues });
      return { ok: false, reason: 'network' };
    }
    const { token, ...room } = parsed.data;
    return token ? { ok: true, room, token } : { ok: true, room };
  }
  ```
  `authenticateRoom` の `{ token: string }` についても (M1 で示す通り) `AuthResponseSchema` を `packages/shared` に新設してから `safeParse`。`fetchRoom` も同様。
  `hc<AppType>` の RPC 型推論を活かす場合は `hc` client で fetch するルートに切り替える手も成立するが、その場合も runtime parse は別途必須 (`hc` は型推論のみで runtime 検証はしない)。

### MEDIUM

**M1: `authResponseSchema` が `packages/shared` ではなく `apps/api/src/routes/rooms.ts` 内ローカル定義 — SSOT 置き場の不統一**

- **Location**:
  - 定義: `apps/api/src/routes/rooms.ts:40-42`
    ```typescript
    const authResponseSchema = z.object({
      token: z.string(),
    });
    ```
  - 消費 (web 側): `apps/web/src/lib/api-client.ts:117` — `(await res.json()) as { token: string }`
- **Issue**:
  `RoomCreatedSchema` / `RoomPublicSchema` / `RoomImageSchema` は `packages/shared/src/room.ts` に集約され、web/api 双方が `@snap-share/shared` から import している。一方 **同じく API レスポンス schema** である `authResponseSchema` だけ api workspace 内 (`routes/rooms.ts` の private const) に置かれており、web 側は schema を import できないため `as { token: string }` という **手書き shape の直記述** に頼らざるを得ない。
  これは:
  1. 「API レスポンス schema の置き場ルール」を文書化していない (= 設計判断の SSOT 自体が曖昧)
  2. token の制約 (例: 長さ下限 `min(1)`) を api 側で強化したとき web 側に届かない
  3. H1 と複合して runtime parse の選択肢自体を web から奪っている (web は schema を import できない)
- **Suggested Fix**:
  `packages/shared/src/room.ts` 末尾に `AuthResponseSchema` を追加し、両 workspace から import する:
  ```typescript
  // packages/shared/src/room.ts
  export const AuthResponseSchema = z.object({
    token: z.string().min(1),
  }).readonly();
  export type AuthResponse = z.infer<typeof AuthResponseSchema>;
  ```
  `apps/api/src/routes/rooms.ts` の `authResponseSchema` を撤去して `AuthResponseSchema` を import、`apps/web/src/lib/api-client.ts:117` も `AuthResponseSchema.safeParse` を経由する。
  さらに「**API レスポンスの Zod schema は packages/shared に置く**」を CLAUDE.md の "API conventions" 節に追記して SSOT 配置を文書化。

**M2: tokens.css の `--color-tool-rect` / `-arrow` / `-text` / `--color-highlight-yellow` が「activeColor 単一 SSOT」設計に取り残された stale token**

- **Location**:
  - `apps/web/src/styles/tokens.css:7-10`:
    ```css
    --color-tool-rect: oklch(60% 0.18 250);
    --color-tool-arrow: oklch(60% 0.2 30);
    --color-tool-text: oklch(20% 0 0);
    --color-highlight-yellow: oklch(85% 0.18 95);
    ```
  - 設計 SSOT: `apps/web/src/hooks/annotationsReducer.ts:25-30` 「`activeColor` 単一 source of truth に collapse 済」
- **Issue**:
  Phase 7.7-2 で「per-tool 色 → 単一 activeColor」に collapse した際、Konva 用の hex 定数 (`colors.ts` の `DEFAULT_SYNC_COLOR` / `COLOR_PALETTE`) は更新されたが、tokens.css 側の **per-tool CSS 変数は残置** された。Toolbar.tsx / DropZone.tsx / global.css / 各 shape ファイルを目視確認した範囲ではこれら 4 トークンを参照する箇所が無く、**vestigial dead token** の疑い。
  これが SSOT 違反である理由:
  1. 「色の正本は colors.ts (Konva 用) と activeColor (state)」という現行設計と、tokens.css の per-tool 変数が **暗黙の代替正本** に見える形で残っている
  2. 将来「色の design token を直そう」と思った人間が tokens.css を直して、実コードには影響せず迷う (CLAUDE.md cross-cutting rule 4 = "Konva は CSS variable を解決しない、hex は手動 sync" の意図を読み違える)
- **Suggested Fix**:
  全 web ソースに対し `--color-tool-rect` / `--color-tool-arrow` / `--color-tool-text` / `--color-highlight-yellow` の grep で参照ゼロを確認 (vitest snapshot や CSS の cascade 経由も含めて要確認)、参照ゼロが確定したら 4 行とも tokens.css から削除。Phase 8.x では「観察 → 確認 → 削除」の小 PR で対応推奨。
  もし副次的に Konva 以外の DOM UI で参照していれば、削除ではなく **CLAUDE.md rule 4 と整合する形でコメント追記** ("Konva 用の hex は colors.ts、CSS UI 用の token は tokens.css") を SSOT 文脈で明記する。

### LOW

**L1: `COLOR_REGEX` と `PRESENCE_COLOR_REGEX` が同一パターンを別 const で重複定義**

- **Location**:
  - `packages/shared/src/annotation.ts:10` — `export const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;`
  - `packages/shared/src/presence.ts:4` — `export const PRESENCE_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;`
- **Issue**:
  両方とも完全に同じ正規表現 (`^#[0-9A-Fa-f]{6}$`) を定義している。`presence.ts` 側は既に `import { PointSchema } from './annotation'` で annotation module を参照しているのに、color regex だけ自前定義。`packages/shared` 内部での DRY 違反 = 軽微な SSOT 違反。
- **Suggested Fix**:
  `presence.ts:4` を削除し、`presence.ts:12` の `z.string().regex(PRESENCE_COLOR_REGEX)` を `z.string().regex(COLOR_REGEX)` に切り替え、`COLOR_REGEX` を `annotation.ts` から import:
  ```typescript
  import { COLOR_REGEX, PointSchema } from './annotation';
  ```
- **Human Friction**: false
  - 改修時必読: no — presence は CRDT awareness 経路のみ、annotation の中核 hot path ではない
  - 再発生コスト: low — 1 ファイル / 2 行の変更、自動 lint 化も容易
  - 認知負荷増: no — 文脈から「同じ規則を別名で書いている」のは自明、即理解可能
  - **判定**: 3/3 とも no/low → false (Phase 8.x backlog)

**L2: `RoomSchema` = `RoomStoredSchema` / `Room` = `RoomStored` の後方互換 alias が現役コードで両方使われている**

- **Location**:
  - `packages/shared/src/room.ts:64-65`:
    ```typescript
    export const RoomSchema = RoomStoredSchema;
    export type Room = RoomStored;
    ```
  - 消費例: `apps/api/src/services/room-service.ts:5` (`type Room`) / `apps/api/src/storage/r2-meta-storage.ts:1` (`type Room, RoomSchema`)
- **Issue**:
  Phase 5 で「stored vs public」を分離した際の遷移用 alias とコメントにあるが、Phase 7.8 完了時点でも api 側コードはほぼ `Room` / `RoomSchema` (alias 側) を使い続けている。`RoomStored` も `rooms.ts` の type 内では出現せず、結果として **同一 entity に 2 つの公的名前** が存在し、新規実装者が「`RoomStored` と `Room` は別物?」を毎回確認する必要がある。SSOT としての "1 つの概念に 1 つの名前" が崩れている。
- **Suggested Fix**:
  どちらかに統一する。Phase 8.x で:
  - 案 A (ガベコレ寄り): `RoomStored` / `RoomStoredSchema` を撤去し `Room` / `RoomSchema` 単一化
  - 案 B (明示寄り): `Room` / `RoomSchema` を撤去し `RoomStored` 単一化 (`RoomPublic` / `RoomCreated` との対比が読みやすい)

  既存呼び出しが `Room` 多数派なので案 A が低コスト。alias を残すなら少なくとも片方を **JSDoc `@deprecated`** にして lint で誘導。
- **Human Friction**: false
  - 改修時必読: yes — `room-service.ts` / `r2-meta-storage.ts` は中核ファイル
  - 再発生コスト: low — 単純 rename (bulk replace)、テスト影響限定
  - 認知負荷増: no — コメントが「Backwards-compatible alias」と明記済、誤解は起きにくい
  - **判定**: yes/low/no = 1 yes、再発生コスト=low → 1 軸のみ yes/high → false

**L3: presence palette の OKLCH (`tokens.css`) ↔ hex (`colors.ts`) 対応に sync テストが無い**

- **Location**:
  - `apps/web/src/components/canvas/colors.ts:45-54` (`AWARENESS_USER_PALETTE` 8 hex)
  - `apps/web/src/styles/tokens.css:16-23` (`--color-presence-1..8` 8 OKLCH)
  - `colors.ts:42` のコメント: 「Kept in physical sync with `--color-presence-1..8` ... in `tokens.css`」
- **Issue**:
  CLAUDE.md cross-cutting rule 4 「Konva は CSS variable を解決しない、color は手動同期」に従い `colors.ts` 側に hex を持つ運用は正しいが、**両者を比較する自動テストが無い**。手動 sync は将来必ず drift する (1 箇所だけ更新しがち)。
  軽微な SSOT 上の脆弱性。
- **Suggested Fix**:
  Vitest で OKLCH ↔ sRGB 変換 (例: `culori` の `formatHex(parse(oklch))`) を使い、各 index で許容差 (deltaE) 以内で一致するか snapshot test を追加:
  ```typescript
  // apps/web/src/components/canvas/__tests__/colors-presence-sync.test.ts
  import { differenceEuclidean, oklch, rgb } from 'culori';
  import { AWARENESS_USER_PALETTE } from '../colors';
  // tokens.css の各 --color-presence-N をパース…
  it('hex palette mirrors OKLCH tokens within deltaE 5', () => {
    /* … */
  });
  ```
  もしくは「colors.ts を SSOT として CSS を build-time 生成する」案も成立 (依存方向が一方通行になる)。
- **Human Friction**: false
  - 改修時必読: no — presence palette を手で触ることは稀 (8 色は固定運用)
  - 再発生コスト: low — drift は visual review で気付ける程度の軽微影響
  - 認知負荷増: no — コメントで sync 関係が明記済
  - **判定**: 3/3 とも no/low → false (Phase 8.x backlog or Phase 9 dogfood 後判断)

## Resolution Update

(Phase 8.x で各 finding 修正後に追記)

---
*Generated: 2026-05-04*
*Reviewer: everything-claude-code:architect agent*
