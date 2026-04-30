export type Rect = Readonly<{
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}>;

export const addRect = (
  rects: ReadonlyArray<Rect>,
  rect: Rect,
): ReadonlyArray<Rect> => [...rects, rect];

export const moveRect = (
  rects: ReadonlyArray<Rect>,
  id: string,
  dx: number,
  dy: number,
): ReadonlyArray<Rect> =>
  rects.map((r) => (r.id === id ? { ...r, x: r.x + dx, y: r.y + dy } : r));

export const removeRect = (
  rects: ReadonlyArray<Rect>,
  id: string,
): ReadonlyArray<Rect> => rects.filter((r) => r.id !== id);
