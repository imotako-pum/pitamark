// ADR-0007 D2: Touch UX タイミング定数の SSOT
// 各定数の業界標準値の根拠は ADR-0007 を参照
// (Excalidraw / tldraw / iOS UIKit / Android ViewConfiguration で収束)

/** 長押し成立までの押下継続時間 (ms)。Excalidraw `TOUCH_CTX_MENU_TIMEOUT` /
 * tldraw `longPressDurationMs` / iOS UIKit `minimumPressDuration` (0.5s) /
 * Android `ViewConfiguration.getLongPressTimeout()` 全社一致 */
export const LONG_PRESS_DURATION_MS = 500;

/** ダブルタップ判定の最大間隔 (ms)。Excalidraw `TAP_TWICE_TIMEOUT` /
 * Android `getDoubleTapTimeout()` */
export const DOUBLE_TAP_INTERVAL_MS = 300;

/** ダブルタップの 1 回目と 2 回目の最大距離 (px)。
 * Excalidraw `DOUBLE_TAP_POSITION_THRESHOLD` */
export const DOUBLE_TAP_POSITION_THRESHOLD_PX = 35;

/** mouse / pen 入力での drag 開始しきい値 (px)。tldraw `dragDistanceSquared = 16` の sqrt */
export const DRAG_SLOP_PX_FINE = 4;

/** touch 入力での drag 開始しきい値 (px)。tldraw `coarseDragDistanceSquared = 36` の sqrt */
export const DRAG_SLOP_PX_COARSE = 6;

/** UI element の最小 tap target サイズ (px)。iOS HIG = 44pt、Material 3 推奨 48dp / 許容 44dp。
 * 共通公約数として 44px を採用。Tailwind の `min-w-11 min-h-11` (= 11 × 0.25rem = 44px) と整合。
 * DOM ボタン / interactive surface の最小サイズ規約 (Konva anchor は colors.ts 側で別途) */
export const MIN_TAP_TARGET_PX = 44;

/** Konva 描画オブジェクトに対する hit 余白 (px)。tldraw `hitTestMargin: 8` 業界標準。
 * 細い stroke shape (Arrow / Highlight) で、視覚 stroke 幅より広い hit zone を取る際の
 * 余白上限。本 plan の時点では消費箇所なし (定数化のみ)。10.J-4 以降で `hitFunc` 拡張時に消費 */
export const HIT_TEST_MARGIN_PX = 8;
