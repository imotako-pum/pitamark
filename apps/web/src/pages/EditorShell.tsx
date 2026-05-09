import type { Annotation, Point, TextAnnotation } from '@pitamark/shared';
import type Konva from 'konva';
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { AdSlot, BOTTOM_HEIGHT_PX, RAIL_WIDTH_PX } from '../components/ad/AdSlot';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { DEFAULT_STROKE_WIDTH } from '../components/canvas/colors';
import { TextEditorOverlay } from '../components/canvas/TextEditorOverlay';
import { HelpModal } from '../components/dialogs/HelpModal';
import { DropZone } from '../components/empty-state/DropZone';
import { LangToggle } from '../components/lang-toggle/LangToggle';
import { Toolbar } from '../components/toolbar/Toolbar';
import type { Tool } from '../hooks/annotationsReducer';
import type { AnnotationsStore } from '../hooks/useAnnotationsStore';
import { useExportPng } from '../hooks/useExportPng';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useStageSize } from '../hooks/useStageSize';
import { applyPinch, useStageTransform } from '../hooks/useStageTransform';
import { useTouchDevice } from '../hooks/useTouchDevice';
import { useTranslation } from '../i18n';
import { computeAutoArrowDefault } from '../lib/autoArrowDefault';
import { AUTO_NEXT_TEXT_OFFSET_PX, computeAutoNextTextOffset } from '../lib/autoNextOffset';
import { nextColor, prevColor } from '../lib/colorCycle';
import { clampFontSize, decrementFontSize, incrementFontSize } from '../lib/fontSize';
import { generateId } from '../lib/id';

// Auto-next-B (矩形確定直後の既定矢印プレビュー) の pending 状態。
// CanvasStage の Layer 描画と useKeyboardShortcuts (Enter binding) 両方が触るため
// EditorShell に置く。ref + state の二重管理: ref は同 React event 内の同期参照
// (Enter 確定 callback が ref.current で最新を見る)、state は Konva 再描画をトリガする。
type PendingAutoArrow = Readonly<{
  from: Point;
  to: Point;
  color: string;
  strokeWidth: number;
}>;

const MIN_STAGE_HEIGHT = 200;
const FALLBACK_HEADER_HEIGHT = 56;

type ImageDescriptor = Readonly<{ url: string }>;

export type EditorShellProps = Readonly<{
  source: ImageDescriptor | null;
  imageError: string | null;
  /** undefined のとき DropZone は loading hint (room モード用) に置き換わる。 */
  onLoadFile?: (file: File) => void;
  onClearImage: () => void;
  store: AnnotationsStore;
  onCursorMove?: (point: { x: number; y: number } | null) => void;
  /** awareness Konva layer を構築する。CanvasStage 内から呼ばれる。
   *  awarenessLayerRef を受け取るので親が PNG export 時に hide/show できる。 */
  awarenessLayer?: (
    annotations: ReadonlyArray<Annotation>,
    layerRef: Ref<Konva.Layer>,
  ) => ReactNode;
  /** ローカル選択を presence (Yjs awareness) に mirror する。 */
  onSelectedIdChange?: (id: string | null) => void;
  /** toolbar 右上の slot (CopyUrlButton)。 */
  toolbarRight?: ReactNode;
  /** 右下の floating slot (ConnectionBadge)。 */
  floatingExtras?: ReactNode;
  /** header 直下 (`top: headerHeight`) の floating slot。Toolbar の動的高さに追従し、
   *  narrow viewport で wrap した toolbar が slot を隠さないようにする。LocalEditor の
   *  protect-password panel で使われていた経路で、現在は Hero との重なり回避のため
   *  inline 配置に切り替えている (将来 editor-mode の floating chrome 用に空けて残す)。 */
  belowHeader?: ReactNode;
  /** `source === null` のときに `<DropZone>` を landing UI (Hero / Features / HowTo /
   *  Faq) で wrap するための callback。配置済みの `<DropZone>` を子 slot として受け
   *  取るので、primary CTA の位置がブレない。RoomEditor は empty state を持たない
   *  ため渡さない。 */
  landingSlot?: (dropzone: ReactNode) => ReactNode;
  /** export filename 用の roomId。local モードでは null。 */
  roomId?: string | null;
}>;

export const EditorShell = ({
  source,
  imageError,
  onLoadFile,
  onClearImage,
  store,
  onCursorMove,
  awarenessLayer,
  onSelectedIdChange,
  toolbarRight,
  floatingExtras,
  belowHeader,
  landingSlot,
  roomId = null,
}: EditorShellProps) => {
  const t = useTranslation();
  const stageContainerRef = useRef<HTMLDivElement>(null);
  // `useStageSize` は `window.resize` listener を持たず、`document.documentElement`
  // を ResizeObserver で監視する。以前 `stageRect` 用に同居していた window.resize
  // listener は stage container 側の ResizeObserver (下の effect) に移したので、
  // viewport 変化で再レンダーは丁度 1 回。
  const stageSize = useStageSize();
  const headerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const awarenessLayerRef = useRef<Konva.Layer>(null);
  // CanvasStage が `onStartTextEditing(id, { autoNext: true })` で起動した text 編集が
  // commit / cancel どちらでも tool='select' に復帰するためのフラグ。state ではなく
  // ref で持つのは、連続 dispatch との同期参照が必要になり得るため (panActiveRef と同じ)。
  // 通常の text ツール経路 (autoNext 省略) では立たないので、連続 text 作成モードは壊れない。
  const autoNextChainRef = useRef(false);
  // pending Auto-arrow の ref + state 二重管理 (詳細は型宣言の上のコメント参照)。
  // `setPendingAutoArrow` 経由でのみ書き換えるので、ref と state が乖離しない。
  const pendingAutoArrowRef = useRef<PendingAutoArrow | null>(null);
  const [pendingAutoArrow, setPendingAutoArrowState] = useState<PendingAutoArrow | null>(null);
  const setPendingAutoArrow = useCallback((p: PendingAutoArrow | null) => {
    pendingAutoArrowRef.current = p;
    setPendingAutoArrowState(p);
  }, []);
  const [stageRect, setStageRect] = useState<DOMRect | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(FALLBACK_HEADER_HEIGHT);
  // Phase 10.I-3: touch 環境で Toolbar を画面下部固定に配置するときの高さ。
  // flex-wrap で 2-3 行になる可能性があるため ResizeObserver で動的追従し、
  // stageBottomInset に加算して画像が Toolbar に被らないようにする。
  const bottomToolbarRef = useRef<HTMLDivElement>(null);
  const [bottomToolbarHeight, setBottomToolbarHeight] = useState<number>(0);
  const isTouch = useTouchDevice();
  const [imageNaturalSize, setImageNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);

  // 旧 TOOLBAR_HEIGHT 定数を ResizeObserver に置き換える。narrow 画面で toolbar が
  // 2 行に wrap したときも stage が実 header 高さに追従する。
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.getBoundingClientRect().height);
    update();
    let raf = 0;
    const observer = new ResizeObserver(() => {
      // resize で即時 React re-render が走ると ResizeObserver の "loop completed"
      // 警告が出るため、rAF で defer する。
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // Phase 10.I-3: bottom 固定 Toolbar の高さを ResizeObserver で動的追従。
  // touch + source 両方が true のときだけ ref が attach されるため、依存配列で
  // mount/unmount を確実化する。Toolbar が flex-wrap で 2-3 行になっても画像が
  // Toolbar に被らないよう stageBottomInset に加算される。
  //
  // 不変条件: `isTouch === false` のとき bottom 固定 container は unmount されるため
  // `bottomToolbarRef.current === null` になり、本 effect で `setBottomToolbarHeight(0)`
  // が呼ばれる。`stageBottomInset` 計算 (line 251) では `isTouch ? bottomToolbarHeight
  // : 0` で参照されるため二重に 0 が保証される (effect 内 + 計算式)。
  useEffect(() => {
    const el = bottomToolbarRef.current;
    if (!el) {
      setBottomToolbarHeight(0);
      return;
    }
    const update = () => setBottomToolbarHeight(el.getBoundingClientRect().height);
    update();
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [isTouch, source]);

  // TextEditorOverlay は stage container の正確な rect に対して位置決めするため、
  // 同じ要素を ResizeObserver で監視する (`useStageSize` と同方針、`window.resize`
  // listener を二重に持たない)。`source` を deps に入れているのは、画像差し替えで
  // stage container が remount されたときに再観測するため。
  useLayoutEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const update = () => setStageRect(el.getBoundingClientRect());
    update();
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [source]);

  const editingAnnotation: TextAnnotation | null = (() => {
    if (!editingTextId) return null;
    const found = store.state.annotations.find((a) => a.id === editingTextId);
    return found && found.type === 'text' ? found : null;
  })();

  const handleSetTool = useCallback(
    (tool: Tool) => {
      // pending Auto-arrow があれば、別ツールキー押下でキャンセル。
      if (pendingAutoArrowRef.current) {
        setPendingAutoArrow(null);
      }
      store.dispatch({ type: 'tool/set', tool });
    },
    [store, setPendingAutoArrow],
  );

  const handleStartTextEditing = useCallback((id: string, options?: { autoNext?: boolean }) => {
    if (options?.autoNext) {
      autoNextChainRef.current = true;
    }
    setEditingTextId(id);
  }, []);

  const handleDelete = useCallback(() => {
    // pending Auto-arrow があるときは Backspace を pending クリアに優先で振る。
    // 通常の「選択中 annotation 削除」は pending クリア後の次の Backspace で復帰する。
    if (pendingAutoArrowRef.current) {
      setPendingAutoArrow(null);
      return;
    }
    const id = store.state.selectedId;
    if (!id) return;
    store.dispatch({ type: 'annotation/remove', id });
    if (editingTextId === id) {
      setEditingTextId(null);
    }
  }, [store, editingTextId, setPendingAutoArrow]);

  const handleEscape = useCallback(() => {
    // pending Auto-arrow があるときは Esc を最優先で pending クリアに振る。
    if (pendingAutoArrowRef.current) {
      setPendingAutoArrow(null);
      return;
    }
    if (editingTextId) {
      setEditingTextId(null);
      return;
    }
    if (store.state.selectedId) {
      store.dispatch({ type: 'select/set', id: null });
    }
  }, [editingTextId, store, setPendingAutoArrow]);

  // マウス mousedown 任意座標で pending をクリアするための callback。CanvasStage の
  // handleMouseDown 冒頭で呼ばれ、pending が null のときは no-op。
  const handleCancelAutoArrowIfAny = useCallback(() => {
    if (pendingAutoArrowRef.current) {
      setPendingAutoArrow(null);
    }
  }, [setPendingAutoArrow]);

  // `lg:` (>= 1024px) では page shell が 160px の ad rail を左右に確保する。Konva stage
  // には viewport から rail を差し引いた *inner* width を渡し、canvas が rail に被ら
  // ないようにする。stage container の CSS inset は `lg:left-40 lg:right-40` で
  // `RAIL_WIDTH_PX` と整合させる。`lg:` 未満では rail が display:none で stage が
  // viewport 全幅になるが、fixed 100px の bottom AdSlot が viewport 下端に被るので、
  // narrow では stage container 側でも `BOTTOM_HEIGHT_PX` を bottom inset として確保する。
  const isLgViewport = stageSize.width >= 1024;
  const stageInnerWidth = isLgViewport
    ? Math.max(stageSize.width - RAIL_WIDTH_PX * 2, 0)
    : stageSize.width;
  // Phase 10.I-3: touch + 非 lg のときは AdSlot bottom (100px) の上に Toolbar が
  // fixed bottom-[100px] で乗るため、bottomToolbarHeight 分も Stage から差し引く。
  const stageBottomInset = isLgViewport
    ? 0
    : BOTTOM_HEIGHT_PX + (isTouch ? bottomToolbarHeight : 0);
  const stageHeight = Math.max(
    stageSize.height - headerHeight - stageBottomInset,
    MIN_STAGE_HEIGHT,
  );
  // 1 回 destructure することで、各 handler / effect が `transformApi.X` (毎 render の
  // property access) ではなく安定した関数 reference に依存するようにする。
  // useStageTransform 内で対処した `[viewport]` identity バグと同じ脆弱性パターン。
  const {
    transform: stageTransform,
    setImageSize: setStageImageSize,
    fitToViewport,
    setHundredPercent,
    zoomBy,
    panBy,
    setTransformDirect,
  } = useStageTransform({ width: stageInnerWidth, height: stageHeight });

  // Phase 10.I-2: 2-finger pinch / pan を atomic に適用するための callback。
  // CanvasStage の onTouchMove ハンドラから center / distRatio / panDx / panDy を
  // 受け、`applyPinch` で transform を計算して clampPan 込みで 1 setState に集約する。
  // updater 形式 (`prev => next`) で stale state を防ぎ、毎 frame 最新の transform
  // を基準に pinch 計算する。
  const handlePinchPan = useCallback(
    (input: {
      center: { x: number; y: number };
      distRatio: number;
      panDx: number;
      panDy: number;
    }) => {
      setTransformDirect((prev) =>
        applyPinch(prev, input.center, input.distRatio, input.panDx, input.panDy),
      );
    },
    [setTransformDirect],
  );

  const handleImageLoaded = useCallback(
    (size: { width: number; height: number } | null) => {
      setStageImageSize(size);
      setImageNaturalSize(size);
    },
    [setStageImageSize],
  );

  const exportPng = useExportPng({
    stageRef,
    awarenessLayerRef,
    roomId,
    imageSize: imageNaturalSize,
  });
  const canExport = source !== null;
  const handleExport = useCallback(() => {
    if (!canExport) return;
    // raster 化前に in-flight な text 編集を確定させる。DOM overlay は Konva canvas
    // の一部ではないので、確定しないと打ちかけの text が失われる。
    setEditingTextId(null);
    void exportPng();
  }, [canExport, exportPng]);

  // transform を window に露出して、E2E が canvas DOM に結合せずに poll できるように
  // する (`__SNAP_SHARE_ANNOTATIONS__` と同 pattern)。`import.meta.env.DEV` で gate
  // しているので production bundle では Vite の tree-shaking で代入ごと除去される。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_STAGE_TRANSFORM__ = stageTransform;
  }, [stageTransform]);

  // Auto-next-A の検証で tool 状態を E2E から polling 確認するために公開する。
  // Toolbar の active 表示でも代替できるが、E2E の安定度は window expose の方が
  // 高いので既存 pattern に揃える。DEV-only。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_TOOL__ = store.state.tool;
  }, [store.state.tool]);

  // pending Auto-arrow を E2E から poll するため公開。null = pending なし、
  // object = プレビュー中。Toolbar に出ない情報なので window expose のみが現実的。
  // DEV-only。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_PENDING_AUTO_ARROW__ =
      pendingAutoArrow;
  }, [pendingAutoArrow]);

  // transform actions を E2E 用に露出する。Playwright の keyboard.press は Meta+0 /
  // Meta+1 を確実に発火できない (Chromium が browser shortcut として page に届く前に
  // 捕まえる) ため、E2E は transform pipeline をこれら関数経由で直接叩いて検証する。
  // keyboard binding 自体は小さく、既存の keyboard-shortcuts.spec.ts (V/R/A/T/H +
  // Cmd+S) で網羅済。DEV-only にしているのが重要 — function reference を露出する
  // ため、production で第三者 script から呼ばれないよう Vite tree-shaking で除去する。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SNAP_SHARE_TRANSFORM_ACTIONS__ = {
      fitToViewport,
      setHundredPercent,
      zoomBy,
      panBy,
    };
  }, [fitToViewport, setHundredPercent, zoomBy, panBy]);

  const handleTextCommit = useCallback(
    (text: string) => {
      if (!editingTextId) return;
      if (text === '') {
        store.dispatch({ type: 'annotation/remove', id: editingTextId });
      } else {
        store.dispatch({ type: 'annotation/set-text', id: editingTextId, text });
      }
      setEditingTextId(null);
      // Auto-next-A 連鎖中なら tool を select に戻す。通常の text ツール経路では
      // ref が立たないので、連続 text 作成モードは保たれる。
      if (autoNextChainRef.current) {
        autoNextChainRef.current = false;
        store.dispatch({ type: 'tool/set', tool: 'select' });
      }
    },
    [editingTextId, store],
  );

  const handleTextCancel = useCallback(() => {
    if (editingTextId && editingAnnotation && editingAnnotation.text === '') {
      store.dispatch({ type: 'annotation/remove', id: editingTextId });
    }
    setEditingTextId(null);
    if (autoNextChainRef.current) {
      autoNextChainRef.current = false;
      store.dispatch({ type: 'tool/set', tool: 'select' });
    }
  }, [editingTextId, editingAnnotation, store]);

  const handleClearImage = useCallback(() => {
    // 画像クリア時は pending Auto-arrow も消す (孤立した pending 状態を残さない)。
    setPendingAutoArrow(null);
    setStageImageSize(null);
    setImageNaturalSize(null);
    onClearImage();
    setEditingTextId(null);
  }, [onClearImage, setStageImageSize, setPendingAutoArrow]);

  // 1 クリックで「active color を更新 (= 次の描画に効く) + 選択中なら同色を適用」する
  // 単一 handler。旧 UX (pick + 2 つの apply ボタン) は 2 段階で重く感じる + sync/highlight
  // レーン分離で tool 切替時に swatch が飛ぶ問題があり dogfood で却下されたため。
  const handlePickColor = useCallback(
    (color: string) => {
      store.dispatch({ type: 'active-color/set', color });
      const id = store.state.selectedId;
      if (id) {
        store.dispatch({ type: 'annotation/set-color', id, color });
      }
    },
    [store],
  );

  // C / ⇧C — palette を巡回。selectedId があれば同じ color をその注釈にも適用
  // (handlePickColor と同じ規約)。実装重複は最小化のため、純関数で next/prev
  // を計算したうえで handlePickColor に委譲する。
  const handleCycleColorNext = useCallback(() => {
    handlePickColor(nextColor(store.state.activeColor));
  }, [handlePickColor, store.state.activeColor]);

  const handleCycleColorPrev = useCallback(() => {
    handlePickColor(prevColor(store.state.activeColor));
  }, [handlePickColor, store.state.activeColor]);

  // フォントサイズも color と同じく「常に active 更新 + 選択中 text なら適用」の
  // 1 操作モデル。Yjs / reducer 双方の setFontSize は text 以外を type guard で
  // 弾くが、local reducer は内部で `annotations.map(...)` を呼んで毎回新しい配列
  // を返すため、空の undo step が past stack に積まれてしまう (storeReducer の
  // `next === state.present` チェックが state object identity 比較で通過する)。
  // 視覚的変化のない 1 step が Cmd+Z で消費される UX 不整合を防ぐため、
  // handler 側で「選択中が text の時だけ dispatch する」ガードを置く。
  const handleSetFontSize = useCallback(
    (size: number) => {
      const next = clampFontSize(size);
      store.dispatch({ type: 'active-font-size/set', fontSize: next });
      const id = store.state.selectedId;
      if (!id) return;
      const selected = store.state.annotations.find((a) => a.id === id);
      if (selected?.type !== 'text') return;
      store.dispatch({ type: 'annotation/set-font-size', id, fontSize: next });
    },
    [store],
  );

  // [/] shortcut + Toolbar A-/A+ ボタン共通の経路。active から ±STEP したクランプ値で
  // handleSetFontSize に委譲し、選択中 text への適用ロジックを 1 か所に閉じる。
  const handleIncrementFontSize = useCallback(() => {
    handleSetFontSize(incrementFontSize(store.state.activeFontSize));
  }, [handleSetFontSize, store.state.activeFontSize]);

  const handleDecrementFontSize = useCallback(() => {
    handleSetFontSize(decrementFontSize(store.state.activeFontSize));
  }, [handleSetFontSize, store.state.activeFontSize]);

  // ? — Help cheatsheet を toggle。同キーで反転 (Excalidraw 互換) のため、
  // 引数なしの単純な setter で setState 関数形式を使う。
  const handleShowHelp = useCallback(() => {
    setHelpOpen((prev) => !prev);
  }, []);

  // 矩形 mouseup 時に呼ばれる callback。CanvasStage が rect 形状を渡す。矩形 add は
  // CanvasStage 側で既に dispatch 済 (handleMouseUp の committing dispatch)。ここでは
  // pending を立てるだけ。stopUndoCapture で矩形 step を確定させ、後続の arrow add
  // (Enter 経路) を別 step として独立させる。
  const handleAutoNextRectangle = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      store.stopUndoCapture();
      const { from, to } = computeAutoArrowDefault(rect);
      setPendingAutoArrow({
        from,
        to,
        color: store.state.activeColor,
        strokeWidth: DEFAULT_STROKE_WIDTH,
      });
    },
    [store, setPendingAutoArrow],
  );

  // Enter で pending Auto-arrow を確定: 矢印 add → step 区切り → text add → tool=text
  // + autoNextChainRef を立てて、Auto-next-A と同じ「commit/cancel 後に select 復帰」
  // フローに合流させる。pending が null のときは安全側で no-op。
  const handleConfirmAutoArrow = useCallback(() => {
    const p = pendingAutoArrowRef.current;
    if (!p) return;
    const arrowId = generateId();
    const arrowAnnotation: Annotation = {
      id: arrowId,
      type: 'arrow',
      createdAt: Date.now(),
      from: p.from,
      to: p.to,
      color: p.color,
      strokeWidth: p.strokeWidth,
    };
    store.dispatch({ type: 'annotation/add', annotation: arrowAnnotation });
    store.dispatch({ type: 'select/set', id: arrowId });
    // arrow → text を独立 undo step に分ける (Auto-next-A と同じ作法)。
    store.stopUndoCapture();
    const offset = computeAutoNextTextOffset(p.from, p.to, AUTO_NEXT_TEXT_OFFSET_PX);
    const textId = generateId();
    const textAnnotation: Annotation = {
      id: textId,
      type: 'text',
      createdAt: Date.now(),
      x: p.to.x + offset.x,
      y: p.to.y + offset.y,
      text: '',
      fontSize: store.state.activeFontSize,
      color: p.color,
    };
    store.dispatch({ type: 'annotation/add', annotation: textAnnotation });
    store.dispatch({ type: 'tool/set', tool: 'text' });
    store.dispatch({ type: 'select/set', id: textId });
    setPendingAutoArrow(null);
    // autoNextChainRef 設定 + setEditingTextId のペアを handleStartTextEditing に集約。
    // CanvasStage 経路 (Auto-next-A) と同じ関数を経由することで、Auto-next chain 起動の
    // 規約が 1 箇所に閉じる。
    handleStartTextEditing(textId, { autoNext: true });
  }, [store, setPendingAutoArrow, handleStartTextEditing]);

  useKeyboardShortcuts({
    onUndo: store.undo,
    onRedo: store.redo,
    onDelete: handleDelete,
    onSetTool: handleSetTool,
    onEscape: handleEscape,
    onExport: canExport ? handleExport : undefined,
    onFitToViewport: source ? fitToViewport : undefined,
    onSetHundredPercent: source ? setHundredPercent : undefined,
    // Help は画像未投入時も発火させる (キーボード discoverability の担保)。
    onShowHelp: handleShowHelp,
    onCycleColorNext: source ? handleCycleColorNext : undefined,
    onCycleColorPrev: source ? handleCycleColorPrev : undefined,
    onIncrementFontSize: source ? handleIncrementFontSize : undefined,
    onDecrementFontSize: source ? handleDecrementFontSize : undefined,
    // pending Auto-arrow があるときだけ Enter binding を provide する。
    // pending なし時は browser default の Enter (button focus 等) を温存。
    onConfirmAutoArrow: pendingAutoArrow ? handleConfirmAutoArrow : undefined,
  });

  const selectedId = store.state.selectedId;
  useLayoutEffect(() => {
    onSelectedIdChange?.(selectedId);
  }, [onSelectedIdChange, selectedId]);

  // Phase 10.I-3: Toolbar の props を一箇所にまとめ、配置 (header 内 / bottom 固定)
  // による重複定義を避ける。touch 時は <header> から外して bottom 固定 container に
  // 入れる。詳細は ADR-0006 / Phase 10.I PRD。
  const toolbarElement =
    source !== null ? (
      <Toolbar
        tool={store.state.tool}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        hasSelection={store.state.selectedId !== null}
        imageLoaded={source !== null}
        canExport={canExport}
        activeColor={store.state.activeColor}
        activeFontSize={store.state.activeFontSize}
        onSetTool={handleSetTool}
        onUndo={store.undo}
        onRedo={store.redo}
        onDelete={handleDelete}
        onClearImage={handleClearImage}
        onExport={handleExport}
        onPickColor={handlePickColor}
        onIncrementFontSize={handleIncrementFontSize}
        onDecrementFontSize={handleDecrementFontSize}
        onShowHelp={handleShowHelp}
      />
    ) : null;

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-(--color-surface) text-(--color-text)">
      {/* `lg:` viewport で 160px の rail 領域を確保しておき、将来の
          <ins class="adsbygoogle"> 配線で CLS が発生しないようにする。
          lg 未満では AdSlot 自身の className で hidden になる。 */}
      <AdSlot variant="rail" side="left" />
      <AdSlot variant="rail" side="right" />
      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 px-3 py-2 lg:left-40 lg:right-40"
      >
        <h1 className="pointer-events-auto hidden select-none self-center text-sm font-semibold tracking-wide opacity-70 md:block">
          {t('common.appName')}
        </h1>
        {/* landing (source === null) では editor Toolbar を非表示にする。画像未ロード
            状態の disabled tool ボタンは情報価値が無く、landing 面を圧迫していた
            (dogfood で確認済)。`source` が非 null になると即 Toolbar が mount され、
            それがユーザへの「ここから編集できる」signal を兼ねる。
            Phase 10.I-3: touch 環境では Toolbar を <header> から外し、画面下部に
            固定する (bottomToolbarRef の container 参照)。 */}
        {!isTouch && toolbarElement !== null ? (
          toolbarElement
        ) : (
          // spacer。`justify-between` flexbox を安定させ、右 slot (LangToggle) が
          // brand h1 にくっつかないようにする。touch 時の bottom 固定経路でも
          // header の右 slot 配置を保つために spacer を出す。
          <div aria-hidden="true" />
        )}
        {/* LangToggle を右 slot 横に置いて、editor toolbar 非表示の landing でも
            language 切替が触れる位置に保つ。以前は Toolbar 内にあり「image loaded」
            の裏に gate されていた。 */}
        <div className="pointer-events-auto flex min-w-0 items-center justify-end gap-2 self-center md:w-auto">
          <LangToggle />
          {toolbarRight ?? null}
        </div>
      </header>
      {/* Phase 10.I-3: touch + source で Toolbar を画面下部に固定。AdSlot bottom
          (BOTTOM_HEIGHT_PX = 100) の真上に乗せ、`paddingBottom: env(safe-area-inset-bottom)`
          で iPhone notch / home indicator を回避する。z-30 で AdSlot (z-20) より前面。
          wrapper は pointer-events-none、Toolbar 自身が pointer-events-auto を持つので
          stage の操作には干渉しない。 */}
      {isTouch && toolbarElement !== null && (
        <div
          ref={bottomToolbarRef}
          className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3"
          style={{
            bottom: BOTTOM_HEIGHT_PX,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {toolbarElement}
        </div>
      )}
      {belowHeader && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-3 lg:left-40 lg:right-40"
          style={{ top: headerHeight }}
        >
          {belowHeader}
        </div>
      )}
      <div
        ref={stageContainerRef}
        // stage container の縦方向は `style={{ top, height }}` で完全に決まる。
        // `bottom` は意図的に未設定で、inline 高さ (`vh - headerHeight - stageBottomInset`)
        // が勝つ。`lg:left-40 lg:right-40` で lg+ 用の 160px 横 gutter を確保する。
        className="absolute inset-x-0 lg:left-40 lg:right-40"
        style={{ top: headerHeight, height: stageHeight }}
      >
        {source ? (
          <CanvasStage
            src={source.url}
            width={stageInnerWidth}
            height={stageHeight}
            store={store}
            editingTextId={editingTextId}
            onTextDoubleClick={setEditingTextId}
            onStartTextEditing={handleStartTextEditing}
            onCursorMove={onCursorMove}
            extraLayers={awarenessLayer?.(store.state.annotations, awarenessLayerRef) ?? null}
            stageRef={stageRef}
            transform={stageTransform}
            onZoom={zoomBy}
            onPan={panBy}
            onPinchPan={handlePinchPan}
            onImageLoaded={handleImageLoaded}
            pendingAutoArrow={pendingAutoArrow}
            onAutoNextRectangle={handleAutoNextRectangle}
            onCancelAutoArrowIfAny={handleCancelAutoArrowIfAny}
          />
        ) : onLoadFile ? (
          // LocalEditor が `landingSlot` を渡したときは <DropZone> を landing UI
          // (Hero / Features / HowTo / Faq) で wrap する。渡さない consumer (room
          // モード等) は素の DropZone に fallback して従来挙動を保つ。
          landingSlot ? (
            landingSlot(<DropZone onFile={onLoadFile} error={imageError} />)
          ) : (
            <DropZone onFile={onLoadFile} error={imageError} />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm opacity-60">
            {t('dropzone.loading')}
          </div>
        )}
      </div>
      {editingAnnotation && stageRect && (
        <TextEditorOverlay
          annotation={editingAnnotation}
          stageContainerRect={stageRect}
          transform={stageTransform}
          onCommit={handleTextCommit}
          onCancel={handleTextCancel}
        />
      )}
      {floatingExtras}
      {/* bottom AdSlot は `position: fixed; bottom: 0` + `lg:hidden`。narrow viewport
          では scroll 位置に関わらず常時表示で、lg+ では rail が代替するため非表示。
          narrow 側の stage 高さは BOTTOM_HEIGHT_PX を既に差し引いてあり、canvas が
          隠れない設計。 */}
      <AdSlot variant="bottom" />
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </main>
  );
};
