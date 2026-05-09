# ADR-0006: Konva Stage の Pointer Events 一本化と global 設定方針

**Date**: 2026-05-09
**Status**: Accepted
**Deciders**: imotako (PM/Dev)
**Related**:
- PRD: [`phase-10-i-touch-optimization.prd.md`](../../.claude/PRPs/prds/phase-10-i-touch-optimization.prd.md)
- Plan: [`phase-10-i-1-pointer-events-migration.plan.md`](../../.claude/PRPs/plans/phase-10-i-1-pointer-events-migration.plan.md) (Phase 10.I-1)
- 上流: [ADR-0003](./ADR-0003-web-vs-desktop-direction.md) (Web 単独方針) を継承
- 訂正対象: Phase 7.7 / 7.8 PRD の Won't「タッチ最適化はしない」(Phase 10.I で方針転換)

---

## Context

snap-share の Konva 描画レイヤー (`apps/web/src/components/canvas/CanvasStage.tsx` line 488-501) は、event handler を `onMouseDown` / `onMouseMove` / `onMouseUp` / `onMouseLeave` のみで配線していた。実機検証 (iPhone Safari + Pixel Chrome) で以下の破綻が確認された:

- 矩形 / 矢印 / ハイライトが指で描けない (drag 系描画が成立しない)
- 既存図形が指でドラッグ移動できない
- テキスト配置のみ動作 (`<Group draggable>` が click 1 発で確定するため例外的に通る)

原因は touch 環境では `mousemove` が発火せず、drag を必要とする経路がすべて死ぬことにある。Konva 側は内部で touch / mouse / pointer の 3 系統を正規化するが、JSX prop として `onMouseDown` のみを受け取っている限り pointer event 経路では呼ばれない。

並行して、競合 (Excalidraw / tldraw) は早期 (Excalidraw [PR #788](https://github.com/excalidraw/excalidraw/pull/788) 2020-02) に **Pointer Events 一本化** を採択しており、`pointerType === 'mouse' | 'pen' | 'touch'` の単一経路で multi-touch / pen / mouse を扱う成熟パターンが確立している。

---

## Decision

以下を採用する:

1. **Konva `<Stage>` の event prop を `onPointerDown / onPointerMove / onPointerUp / onPointerCancel / onPointerLeave` に一本化**する。`onMouseDown` 系は完全撤去。type 引数は `KonvaEventObject<PointerEvent>` に統一。
2. **`Konva.capturePointerEventsEnabled = true`** を `apps/web/src/main.tsx` で明示的に設定する (Konva default は `false`)。pointer capture を有効化することで、Stage 外に pointer が出ても drag が継続する (snap-share の useRef ベース drag ロジックと相性が良い)。
3. **`Konva.pointerEventsEnabled` は明示しない**。Konva default が `true` であり、本リポジトリは Konva バージョンを catalog で pin しているため冗長な明示を避ける。バージョン上げ時は `pnpm build` の bundle で挙動を確認する。
4. **Stage container (`konvajs-content` div) に `touch-action: none` を CSS で当てる** (`apps/web/src/styles/global.css` 末尾)。これにより iOS Safari / Android Chrome の native gesture (pan / pinch / double-tap zoom / 長押し選択) を抑止し、`pointercancel` の早期発火による `pointermove` 停止を防ぐ。
5. **既存 unit test は `fireEvent.mouseDown / mouseMove / mouseUp` を維持**する。jsdom (および happy-dom) の `PointerEvent` コンストラクタは `clientX` / `clientY` / `pointerType` を初期化オプションから落とす既知バグ ([dom-testing-library #1291](https://github.com/testing-library/dom-testing-library/issues/1291)) があり、`fireEvent.pointerDown` への書き換えはテスト品質をむしろ落とす。Konva 内部で mouse → pointer に集約されるため `<Stage onPointerDown={fn}>` に対して `fireEvent.mouseDown(stageEl, { clientX, clientY })` で `fn` は座標付きで発火する。pointer 固有挙動 (`pointerType` 分岐 / multi-touch) は Playwright `mobile-chrome` project に寄せる。
6. **`pointercancel` を `pointerup` 等価に扱う**。iOS Safari の system gesture 介入時 / browser tab 切替 / device sleep 等で発火し、ハンドリング漏れは drag-in-progress 状態のリークを生む。

---

## Alternatives Considered

| 案 | 採否 | 理由 |
|---|---|---|
| **A. `useEffect` で imperative に native `touchstart/move/end` listener を Stage container に追加し、既存 mouse handler に橋渡し** | rejected | 短期復旧には魅力的だが、(a) 2-finger pinch を別経路で書く必要が残る、(b) `pointerType` での pen 分岐が将来できない、(c) 経路が増え race condition の温床になる。Excalidraw / tldraw が辿った成熟経路 (Pointer Events 一本化) と乖離する |
| **B. Pointer Events に切り替えるが `Konva.capturePointerEventsEnabled = false` (default) のまま** | rejected | Stage 外に pointer が出た瞬間 drag が切れる。snap-share の useRef ベースの drag ロジック (`dragStartRef` / `draftRef` を mousedown→move→up で串刺し) は、Stage の境界を超えた drag に耐える前提で書かれている。capture 有効化の方が既存ロジックと整合 |
| **C. unit test を `fireEvent.pointerDown` 系に全面書き換え** | rejected | jsdom / happy-dom の `PointerEvent` 制限により座標 / pointerType が落ちる。書き換え工数の割に得るものがない。Konva の mouse → pointer 集約特性を利用して既存 mouse fireEvent を維持し、pointer 固有挙動は Playwright に寄せる方が信頼性が高い |
| **D. `body { touch-action: none }` で全画面に適用** | rejected | landing / 法務 page の通常スクロールを殺す。`.konvajs-content` セレクタで Stage container 限定にする |
| **E. ペンモード / palm rejection を v1 から実装** | rejected | tldraw でも完全には未解決 ([Issue #4086](https://github.com/tldraw/tldraw/issues/4086))。実装コスト >> v1 価値。Phase 11+ で必要なら別 ADR で再評価 |

---

## Consequences

### 期待される効果

- iPhone Safari / Android Chrome で矩形 / 矢印 / ハイライト / テキストの全描画系が PC 同等に動作する
- pointer capture により、Stage 境界を超えた drag (例: 矩形 drag 中に pointer が画面端まで動く) が途切れなくなる
- `pointerType` 分岐が将来 (Phase 10.I-2 以降) で可能になり、pen / mouse / touch のジェスチャ最適化を上乗せできる
- multi-touch (2-finger pinch zoom + pan) を Phase 10.I-2 で `stage.getPointersPositions()` または自前の `Map<pointerId, pos>` で実装する素地が整う

### 受容するコスト / 制約

- `KonvaEventObject<MouseEvent>` の型注釈を `KonvaEventObject<PointerEvent>` に書き換える grep 漏れリスク (validation で grep ベースに検証)
- `.konvajs-content` クラス名は Konva 内部実装に依存するため、Konva メジャーバージョン上げ時に touch-action 効果を実機確認する運用が必要
- unit test と Playwright のテスト責務分離: pointer 固有挙動は実 PointerEvent でしか正しく検証できないため、E2E (mobile-chrome project) のカバレッジが本 ADR 以降は必須となる

### 影響を受けるファイル (Phase 10.I-1 時点)

| File | 変更内容 |
|---|---|
| `apps/web/src/components/canvas/CanvasStage.tsx` | 4 ハンドラ rename + `onPointerCancel` 新規 + `<Stage>` prop 5 箇所差し替え |
| `apps/web/src/components/canvas/shapes/ArrowShape.tsx` | endpoint handle 2 箇所の `onMouseDown` → `onPointerDown` |
| `apps/web/src/styles/global.css` | `.konvajs-content { touch-action: none; }` 追加 |
| `apps/web/src/main.tsx` | `Konva.capturePointerEventsEnabled = true` 追加 |
| `apps/web/src/components/canvas/__tests__/ArrowShape.test.tsx` | capture key の rename (`onMouseDown` → `onPointerDown`)、fireEvent は mouseDown 維持 |
| `apps/web/e2e/touch-rectangle-draw.spec.ts` | mobile-chrome smoke spec 1 件 (新規) |

### 後続 Phase との関係

- **10.I-2 (multi-touch + hit area)**: 本 ADR の `capturePointerEventsEnabled = true` を前提に、`stage.getPointersPositions()` による 2-finger pinch を実装。hit area は `@media (pointer: coarse)` で adaptive 化
- **10.I-3 (Toolbar bottom)**: 本 ADR と直接関係なし、別ファイル群
- **10.I-4 (E2E + 実機検証)**: 本 ADR の「pointer 固有挙動は Playwright」方針に基づき、12 ケース (4 形状 × 3 操作) を mobile-chrome project で実装

---

## References

- [Konva `src/Stage.ts` — `EVENTS` 配列, `_pointerdown` 集約](https://github.com/konvajs/konva/blob/master/src/Stage.ts)
- [Konva `src/Global.ts` L48,82 — `pointerEventsEnabled` / `capturePointerEventsEnabled`](https://github.com/konvajs/konva/blob/master/src/Global.ts)
- [Konva `src/PointerEvents.ts` — `setPointerCapture`](https://github.com/konvajs/konva/blob/master/src/PointerEvents.ts)
- [Konva `src/Node.ts` — `KonvaEventObject<PointerEvent>` 型](https://github.com/konvajs/konva/blob/master/src/Node.ts)
- [react-konva `src/makeUpdates.ts` — on prefix → `instance.on()`](https://github.com/konvajs/react-konva/blob/master/src/makeUpdates.ts)
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [MDN PointerEvent.pointerType](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType)
- [dom-testing-library Issue #1291 — fireEvent.pointer{Down,Move,Up} jsdom 制限](https://github.com/testing-library/dom-testing-library/issues/1291)
- [Excalidraw PR #788 — Add touch support via Pointer Events](https://github.com/excalidraw/excalidraw/pull/788)
- [tldraw `useCanvasEvents.ts` — `pointerType` 分岐](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/hooks/useCanvasEvents.ts)
