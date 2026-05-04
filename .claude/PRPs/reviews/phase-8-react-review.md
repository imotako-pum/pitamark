# Local Code Review: Phase 8 — React ベストプラクティス (#3)

**Reviewed**: 2026-05-04
**Branch**: feat/phase-8-integration-review
**Scope**: hooks 規律 / useState vs useRef / useReducer 合成 / useEffect 依存配列 + cleanup / Konva `listening={false}` / React 19 idioms / event handler closure 鮮度 / test hatch パターン
**Hot files**: `EditorShell.tsx` (542 LOC) / `CanvasStage.tsx` (537 LOC) / `useKeyboardShortcuts.ts` (168 LOC) / `useStageTransform.ts` (155 LOC) / `useYjsAnnotationsStore.ts` (200 LOC) / `RoomEditor.tsx` / `LocalEditor.tsx` / `AnnotationLayer.tsx` / `ImageLayer.tsx` / `Toolbar.tsx` / `ColorPalette.tsx` / `FontSizeControl.tsx` / `HelpModal.tsx` / `DropZone.tsx` / `RoomGate.tsx`
**Decision**: APPROVE
  - CRITICAL / HIGH / MEDIUM の finding なし
  - LOW のみ 5 件、うち Human Friction = true 2 件

## Summary

#3 観点で対象ファイル全体を精査した結果、CLAUDE.md cross-cutting design rules 2/3/5 はすべて遵守されており、主要パターンの品質は高い。

**Design rules 準拠確認**:
- Rule 2 (single useReducer): `useAnnotationsStore` は `annotationsReducer` + `historyReducer` を `storeReducer` 1 本に合成し、`useReducer` に渡している。`state` を外部クロージャで閉じ込める wrapper は存在しない (確認: `useAnnotationsStore.ts:36-51`)。
- Rule 3 (useRef for drag-time mutable values): `CanvasStage` の `dragStartRef` / `draftRef` / `panActiveRef` / `panLastRef` / `spaceDownRef` はすべて `useRef`。`EditorShell` の `pendingAutoArrowRef` + `autoNextChainRef` も ref で保持し、render-trigger が必要な部分だけ state と明示的に二重管理している (`EditorShell.tsx:93-102` コメントで設計意図を文書化済)。
- Rule 5 (KonvaImage listening={false}): `ImageLayer.tsx:31` で `<Layer listening={false}>` + `<KonvaImage image={image} listening={false} />` の両方に適用済み。

**hooks 規律**: 全ファイルで hook 呼び出しは条件分岐の外。early-return はすべてレンダー結果を返す JSX 分岐であり、hook 呼び出しより後にある。Rules of Hooks の違反なし。

**Event handler closure 鮮度**: `useKeyboardShortcuts` は `ref.current = shortcuts` パターン (stable ref 経由) で全コールバックを毎レンダー最新化し、`useEffect([], [])` の空依存配列と組み合わせて closure staleness を完全回避している。`CanvasStage.handleMouseUp` も `store.stopUndoCapture` を直接依存させ `store` 全体の identity 問題を回避している。

**副次観察** (主観点外・reference only): `EditorShell.tsx:244-274` の window グローバル 4 件と `useYjsAnnotationsStore.ts:105-110` の 1 件は test hatch。`useYjsAnnotationsStore.ts` の 1 件は `import.meta.env.DEV` ガードで production bundle からは tree-shake されるが、`EditorShell.tsx` 側 4 件は dev/prod 無差別にグローバルを置く — これは **#5 band-aids** で主評価すべき finding (triage-review.md:246 でエスクロー済)。本レビューでは参照のみ。

**React 19 活用機会の指摘**: CanvasStage の `draftRef + setDraft` 二重管理は React 19 の `use()` hook では解消できないが、`useTransition` で draft 更新を低優先 UI スケジューラーに委ねれば高密度マウスムーブ時の annotation layer 再描画を非同期化できる機会がある (詳細は LOW L4)。

Finding は LOW 5 件。

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM
None.

### LOW

**L1: `DropZone` の `onFile` が `useEffect` の deps に入っているが、呼び出し元が毎レンダーで新しい関数参照を作りうる**

- **Location**: `apps/web/src/components/empty-state/DropZone.tsx:16-25`
- **Issue**:
  ```typescript
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) { onFile(file); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFile]);
  ```
  `onFile` が deps に含まれるため、親が `useCallback` 等で安定化していない場合は paste listener が毎レンダーで付け外しされる。`LocalEditor.tsx:66` の `handleLoad` は `useCallback` で安定化されているため現状は問題ないが、`onFile` の安定性を `DropZone` 自身が保証しない設計になっている。React 公式パターン (stable ref に格納) を使えば依存配列から外せる。
- **Suggested Fix**: `onFile` を ref で受け取るパターンに切り替える。
  ```typescript
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) onFileRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []); // 空配列で安定
  ```
  または props の `onFile` に `useCallback` を要求することを JSDoc で明示する。
- **Human Friction**: true
  - 改修時必読: yes — `DropZone` は LocalEditor の primary entry point、画像投入フローを触る際は必ず読む
  - 再発生コスト: med — `onFile` の呼び出し元が `useCallback` を外した場合に再発する（将来の refactor 時に無音で壊れる）
  - 認知負荷増: yes — なぜ `onFile` が deps に入っているかを読み解くには `useKeyboardShortcuts` との設計方針の差に気づく必要があり、一見すると「`useKeyboardShortcuts` は ref で安定化しているのにこちらはしていない」という不整合が認知摩擦を生む

---

**L2: `useStageTransform` の viewport 変化時 re-fit effect の deps 分解が viewportRef.current 更新と不整合を生む可能性**

- **Location**: `apps/web/src/hooks/useStageTransform.ts:148-152`
- **Issue**:
  ```typescript
  useEffect(() => {
    const img = imageSizeRef.current;
    if (!img) return;
    setTransform(computeFitTransform(img, { width: viewport.width, height: viewport.height }));
  }, [viewport.width, viewport.height]);
  ```
  `viewportRef.current = viewport;` はレンダーのたびに更新されるが、この effect は `viewport.width` / `viewport.height` が変わらない限り実行されない。effect 内で `viewportRef.current` ではなく `viewport.width/height` を直接使っているため実際の計算値は正しい。しかし `fitToViewport` / `setHundredPercent` / `zoomBy` / `panBy` の各 `useCallback` が `viewportRef.current` を読んでいることとの設計の非対称性が生まれており、「なぜ effect だけ viewport を props から直接読むのか」という認知負荷がある。コメントには「`viewport` オブジェクトが毎 render 新規作成されても再 fit ループに入らないよう」と書かれているが、別アプローチ (`viewportRef.current` を effect 内で読む) の方が他の callback と一貫性が高い。
- **Suggested Fix**: effect 内も `viewportRef.current` を使う。deps は `[viewport.width, viewport.height]` のままで良い (実質的には変わらないが設計の対称性が保たれる)。
  ```typescript
  useEffect(() => {
    const img = imageSizeRef.current;
    if (!img) return;
    setTransform(computeFitTransform(img, viewportRef.current));
  }, [viewport.width, viewport.height]);
  ```
- **Human Friction**: false
  - 改修時必読: yes — `useStageTransform` はズーム/パン機能触る際必読
  - 再発生コスト: low — 一行変更、既存 deps は変わらない
  - 認知負荷増: no — コメントで意図が説明されており、実害ゼロ（判定 rule: 2 軸が "yes/high" 未満のため false）

---

**L3: `RoomGate.handleSubmit` が `async` event handler で floating promise になっている**

- **Location**: `apps/web/src/components/room-gate/RoomGate.tsx:32-46`
- **Issue**:
  ```typescript
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    ...
    const result = await authenticateRoom(roomId, password);
    ...
  };
  ```
  `onSubmit={handleSubmit}` に渡すと React は `Promise` を受け取るが、React 18 以下の event handler では `void` を期待するため、rejection が unhandled promise になるリスクがある。`authenticateRoom` の実装で rejection が起きた場合（ネットワーク例外等）、`catch` が存在しないため silent failure になる。現状 `api-client.ts` の `authenticateRoom` は内部で `try/catch` して `{ ok: false, reason: 'network' }` を返しているため実害はないが、設計の堅牢性として `handleSubmit` 自身も `try/catch` を持つか、`void` を明示する wrapper を介すべき。
  なお React 19 では `<form action={async (formData) => {...}}>` の Actions パターンで async form handler を第一級でサポートしているため、この問題ごと解決できる機会でもある。
- **Suggested Fix**:
  ```typescript
  // Option A: try/catch を追加してエラーを握り潰さない
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      ...
    } catch {
      setError('unexpected');
      setSubmitting(false);
    }
  };

  // Option B (React 19 idiom): form Action への移行
  // <form action={async (formData) => { ... }}>
  ```
- **Human Friction**: true
  - 改修時必読: yes — `RoomGate` は認証フローの入口、セキュリティ改修時に必読
  - 再発生コスト: med — `api-client` の defensive coding で現在は吸収されているが、呼び出し先が変わると再発する
  - 認知負荷増: yes — `authenticateRoom` が全 rejection を `ok: false` で吸収していると知らないと「この async は安全か」と読み解くのに時間がかかる

---

**L4: React 19 活用機会 — `useDeferredValue` で draft 描画を非優先スケジュール化できる**

- **Location**: `apps/web/src/components/canvas/CanvasStage.tsx:133` / `apps/web/src/components/canvas/CanvasStage.tsx:482-484`
- **Issue**: 現在は `draftRef` (ref) + `setDraft(next)` (state) の二重管理で draft を保持している。コメントで意図が説明されており、設計として正しい。しかし `setDraft` は同期的に state を更新するため、高密度マウスムーブ時 (`handleMouseMove`) に Konva の annotation layer が毎フレーム同期的に再描画される。React 19 の `useDeferredValue` を `draft` に適用すると、マウス移動中の draft 更新を低優先 (transition 扱い) にスケジュールできる。ref は依然として最新値を保持し続けるため `handleMouseUp` での最終確定は影響を受けない。
  ```typescript
  const [draft, setDraft] = useState<Annotation | null>(null);
  const deferredDraft = useDeferredValue(draft);
  // visibleAnnotations には deferredDraft を使う
  const visibleAnnotations = deferredDraft ? [...annotations, deferredDraft] : annotations;
  ```
- **Suggested Fix**: Phase 9 dogfood でドラッグ時のコマ落ちが体感されるようであれば試験的に投入。現状は顕在化していないためバックログ相当。
- **Human Friction**: false
  - 改修時必読: yes — `CanvasStage` は annotation 描画の中核
  - 再発生コスト: low — 1 変数追加と 1 行変更、デグレリスクは最小
  - 認知負荷増: no — 現在の ref+state 二重管理コメントが設計意図を十分に説明している（判定 rule: 2 軸が "yes/high" 未満のため false）

---

**L5: `useYjsAnnotationsStore` の `useStateRef` 多用 — state と ref の二重管理が 4 セットある**

- **Location**: `apps/web/src/hooks/useYjsAnnotationsStore.ts:80-83`
- **Issue**:
  ```typescript
  const [tool, setTool] = useStateRef<Tool>('select');
  const [selectedId, setSelectedId, selectedIdRef] = useStateRef<string | null>(null);
  const [activeColor, setActiveColor] = useStateRef<string>(DEFAULT_SYNC_COLOR);
  const [activeFontSize, setActiveFontSize] = useStateRef<number>(DEFAULT_FONT_SIZE);
  ```
  `useStateRef` (value + setter + ref の 3-tuple) が 4 セット並ぶ。各 setter は `dispatch` callback 内で呼ばれるため ref 経由の最新値参照が必要になる設計は理解できる。ただしこのパターンが Yjs 版にしか存在せず、local 版 (`useAnnotationsStore`) は `useReducer` 1 本で対応できていることとの非対称性がある。Yjs 版は Yjs CRDT と `useReducer` を同時に使うことがアーキテクチャ上難しいため現時点では致し方ない選択だが、将来 Yjs 版がメインになった際にこの 4 セットが拡張に連れて増えるリスクがある。
  `dispatch` の `useCallback` deps にも `setSelectedId, setTool, setActiveColor, setActiveFontSize, selectedIdRef` が 5 つ並んでおり、新しいクライアントローカル state が増えるたびに deps が増える構造になっている。
- **Suggested Fix**: 即座の修正は不要。将来 Yjs 版の `dispatch` を拡張する際は、クライアントローカル state を 1 つの `useReducer` に集約してから ref bridge を 1 本にまとめる設計を検討する。
- **Human Friction**: false
  - 改修時必読: yes — `useYjsAnnotationsStore` は room モード全機能の中核
  - 再発生コスト: med — 新 state 追加の度に同パターンが繰り返される
  - 認知負荷増: no — `useStateRef` の JSDoc がパターンの意図を説明しており、4 セット並んでいることは一見して読み取れる（判定 rule: 2 軸が "yes/high" 未満のため false）

## Resolution Update

(Phase 8.x で修正された後、Phase 8.x 着手側の Plan/Implement で追記)

---
*Generated: 2026-05-04*
*Reviewer: Claude Sonnet 4.6*
