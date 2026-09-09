import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Frame, SlideElement } from "$representation/data/types/slide-decks/body";

export const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

export const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must not be blank`);
  return value.trim();
};

export const integer = (value: unknown, label: string, minimum: number, maximum: number): number => {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value as number;
};

export const page = (value: unknown) => {
  const held = record(value, "pagination input must be an object");
  return {
    cursor: held.cursor === undefined ? 0 : integer(held.cursor, "cursor", 0, 1_000_000),
    limit: held.limit === undefined ? 50 : integer(held.limit, "limit", 1, 100)
  };
};

export const findBlock = (blocks: readonly ContentBlock[], id: string): ContentBlock | undefined => {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.type !== "table") continue;
    for (const row of block.rows) for (const cell of row.cells) {
      const found = findBlock(cell.blocks, id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

export const samePath = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((part, index) => part === right[index]);

export const flattenBlocks = (
  blocks: readonly ContentBlock[],
  parentPath: readonly string[] = []
): Array<{ block: ContentBlock; blockPath: string[] }> => blocks.flatMap((block) => {
  const blockPath = [...parentPath, block.id];
  if (block.type !== "table") return [{ block, blockPath }];
  return [
    { block, blockPath },
    ...block.rows.flatMap((row) => row.cells.flatMap((cell) =>
      flattenBlocks(cell.blocks, [...blockPath, row.id, cell.id])
    ))
  ];
});

export const findElement = (
  elements: readonly SlideElement[],
  path: readonly string[]
): SlideElement | undefined => {
  const [id, ...rest] = path;
  const element = elements.find((candidate) => candidate.id === id);
  if (element === undefined) return undefined;
  if (rest.length === 0) return element;
  return element.content.type === "group" ? findElement(element.content.children, rest) : undefined;
};

const within = (outer: Frame, inner: Frame): Frame => ({
  x: outer.x + inner.x * outer.width,
  y: outer.y + inner.y * outer.height,
  width: inner.width * outer.width,
  height: inner.height * outer.height
});

export const placedElements = (
  elements: readonly SlideElement[],
  parentPath: readonly string[] = [],
  outer?: Frame
): Array<{ element: SlideElement; elementPath: string[]; frame: Frame }> => elements.flatMap((element) => {
  const elementPath = [...parentPath, element.id];
  const frame = outer === undefined ? element.frame : within(outer, element.frame);
  return [
    { element, elementPath, frame },
    ...(element.content.type === "group"
      ? placedElements(element.content.children, elementPath, frame)
      : [])
  ];
});

export const canvasSize = (aspectRatio: string): { width: number; height: number } => {
  const [rawWidth, rawHeight] = aspectRatio.split(":").map(Number);
  const ratio = Number.isFinite(rawWidth) && Number.isFinite(rawHeight) && rawWidth > 0 && rawHeight > 0
    ? rawWidth / rawHeight
    : 16 / 9;
  return ratio >= 1
    ? { width: 1600, height: Math.round(1600 / ratio) }
    : { width: Math.round(1600 * ratio), height: 1600 };
};

export const schematicCoordinate = (value: number): number => Math.round(value * 10_000) / 10_000;

export const escaped = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export const boundedJson = (value: unknown, maximum = 60_000): unknown => {
  const serialized = JSON.stringify(value);
  if (serialized.length > maximum) throw new Error("native material exceeds the bounded read limit");
  return JSON.parse(serialized) as unknown;
};

const chartItemName = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const held = value as Record<string, unknown>;
  const name = held.name ?? held.label ?? held.key ?? held.id;
  return typeof name === "string" ? name : undefined;
};

export const chartSeriesSelection = (
  spec: Record<string, unknown>,
  selected: readonly string[],
  available: readonly string[]
): Record<string, unknown> => {
  if (selected.length === available.length && selected.every((name) => available.includes(name))) {
    return spec;
  }
  for (const key of ["series", "datasets", "data"] as const) {
    const values = spec[key];
    if (!Array.isArray(values)) continue;
    const named = values.filter((entry) => chartItemName(entry) !== undefined);
    if (named.length === 0) continue;
    return {
      ...spec,
      [key]: values.filter((entry) => {
        const name = chartItemName(entry);
        return name === undefined || selected.includes(name);
      })
    };
  }
  throw new Error("chart series cannot be isolated from its native specification");
};
