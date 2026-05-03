// Konva does not resolve CSS variables, so canvas color constants live here
// and are kept physically in sync with apps/web/src/styles/tokens.css.

export const OUTLINE_ACCENT = '#5b6dff';

// Default annotation color for the synchronized trio (rectangle / arrow /
// text). Highlight has its own default because semi-transparent markers do
// not share a meaningful color space with strokes.
export const DEFAULT_SYNC_COLOR = '#e74c3c';
export const DEFAULT_HIGHLIGHT_COLOR = '#f5d142';

// Fixed 7-color palette shown in the toolbar. Order is intentional: red is
// the default sync color, yellow the default highlight color, both are
// visually weight-balanced near the start of the row.
export const COLOR_PALETTE: ReadonlyArray<string> = [
  DEFAULT_SYNC_COLOR, // red
  '#ff8c42', // orange
  DEFAULT_HIGHLIGHT_COLOR, // yellow
  '#2ecc71', // green
  '#3a86ff', // blue
  '#9b59b6', // purple
  '#202020', // black
];

export const SELECTED_STROKE_BOOST = 1;
export const HIGHLIGHT_OPACITY = 0.35;

// Endpoint handle fill for Arrow resize (custom Circle handles, since Konva
// Transformer's bbox handles do not fit a free-angle Arrow naturally).
export const HANDLE_FILL = '#ffffff';
export const HANDLE_RADIUS = 6;
export const HANDLE_STROKE_WIDTH = 2;
// Minimum width/height enforced by Transformer's boundBoxFunc to keep tiny
// rectangles/highlights still visible and re-grabbable after a drag.
export const MIN_RESIZE_SIZE = 5;

export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 18;
export const ARROW_POINTER_LENGTH = 12;
export const ARROW_POINTER_WIDTH = 12;

// Awareness palette — the index into this list is chosen deterministically
// from `userId` (FNV-1a hash, see `apps/web/src/lib/local-user.ts`). Kept in
// physical sync with `--color-presence-1..8` in `apps/web/src/styles/tokens.css`.
export const AWARENESS_USER_PALETTE: ReadonlyArray<string> = [
  '#5b6dff',
  '#e74c3c',
  '#42a5f5',
  '#26a69a',
  '#ab47bc',
  '#ffa726',
  '#ec407a',
  '#66bb6a',
];
