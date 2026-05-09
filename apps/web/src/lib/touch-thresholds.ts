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
