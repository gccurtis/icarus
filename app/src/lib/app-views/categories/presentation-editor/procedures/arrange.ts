import type { Frame } from "$representation/data/types/presentations/body";

export type Framed = { readonly id: string; readonly frame: Frame };

export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

export type Axis = "x" | "y";

export type Match = "width" | "height" | "size";

export const bounds = (frames: readonly Frame[]): Frame => {
  if (frames.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const EPSILON = 1e-9;

const close = (left: number, right: number): boolean => Math.abs(left - right) <= EPSILON;

const canonical = (value: number): number => Math.round(value / EPSILON) * EPSILON;

const changed = (items: readonly Framed[], next: readonly Frame[]): Framed[] =>
  items
    .map((item, index) => ({ id: item.id, frame: next[index] }))
    .filter(({ id, frame }) => {
      const before = items.find((item) => item.id === id)?.frame;
      return before === undefined || !close(before.x, frame.x) || !close(before.y, frame.y) || !close(before.width, frame.width) || !close(before.height, frame.height);
    });

export const aligned = (items: readonly Framed[], edge: AlignEdge, to: Frame): Framed[] =>
  changed(
    items,
    items.map(({ frame }) => {
      switch (edge) {
        case "left":
          return { ...frame, x: to.x };
        case "center":
          return { ...frame, x: to.x + (to.width - frame.width) / 2 };
        case "right":
          return { ...frame, x: to.x + to.width - frame.width };
        case "top":
          return { ...frame, y: to.y };
        case "middle":
          return { ...frame, y: to.y + (to.height - frame.height) / 2 };
        case "bottom":
          return { ...frame, y: to.y + to.height - frame.height };
      }
    })
  );

export const distributed = (items: readonly Framed[], axis: Axis): Framed[] => {
  if (items.length < 3) return [];
  const size = axis === "x" ? "width" : "height";
  const centre = (item: Framed) => item.frame[axis] + item.frame[size] / 2;
  const sorted = [...items].sort((left, right) => centre(left) - centre(right) || left.id.localeCompare(right.id));
  const first = centre(sorted[0]);
  const last = centre(sorted[sorted.length - 1]);
  const step = (last - first) / (sorted.length - 1);
  const placed = sorted.map((item, index) => ({
    id: item.id,
    frame: { ...item.frame, [axis]: canonical(first + step * index - item.frame[size] / 2) }
  }));

  return changed(items, items.map((item) => placed.find((held) => held.id === item.id)?.frame ?? item.frame));
};

export const matched = (items: readonly Framed[], what: Match): Framed[] => {
  const model = items[0]?.frame;
  if (model === undefined) return [];
  return changed(
    items,
    items.map(({ frame }) => ({
      ...frame,
      width: what === "height" ? frame.width : model.width,
      height: what === "width" ? frame.height : model.height
    }))
  );
};

export type Restack = "front" | "forward" | "back" | "behind";

export const restacked = (order: readonly string[], chosen: readonly string[], way: Restack): string[] => {
  const picked = new Set(chosen.filter((id) => order.includes(id)));
  if (picked.size === 0) return [...order];

  if (way === "front" || way === "back") {
    const kept = order.filter((id) => !picked.has(id));
    const moving = order.filter((id) => picked.has(id));
    return way === "front" ? [...kept, ...moving] : [...moving, ...kept];
  }

  const next = [...order];
  if (way === "forward") {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      if (picked.has(next[index]) && !picked.has(next[index + 1])) {
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
      }
    }
    return next;
  }

  for (let index = 1; index < next.length; index += 1) {
    if (picked.has(next[index]) && !picked.has(next[index - 1])) {
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
    }
  }
  return next;
};

export const nudged = (frame: Frame, dx: number, dy: number): Frame => ({
  ...frame,
  x: frame.x + dx,
  y: frame.y + dy
});

export const clampedToSlide = (frame: Frame): Frame => ({
  ...frame,
  x: Math.min(Math.max(frame.x, -frame.width + 0.02), 0.98),
  y: Math.min(Math.max(frame.y, -frame.height + 0.02), 0.98)
});
