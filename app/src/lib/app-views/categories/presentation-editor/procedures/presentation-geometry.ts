import type { Frame } from "$representation/data/types/presentations/body";

export const within = (outer: Frame, inner: Frame): Frame => ({
  x: outer.x + inner.x * outer.width,
  y: outer.y + inner.y * outer.height,
  width: inner.width * outer.width,
  height: inner.height * outer.height
});

export const relativeTo = (outer: Frame, absolute: Frame): Frame => ({
  x: outer.width === 0 ? 0 : (absolute.x - outer.x) / outer.width,
  y: outer.height === 0 ? 0 : (absolute.y - outer.y) / outer.height,
  width: outer.width === 0 ? 0 : absolute.width / outer.width,
  height: outer.height === 0 ? 0 : absolute.height / outer.height
});

export const boundsOf = (frames: readonly Frame[]): Frame => {
  if (frames.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};
