type Fields = Record<string, unknown>;

export type IdHint =
  | "row"
  | "block"
  | "atom"
  | "mark"
  | "slide"
  | "element"
  | "layout"
  | "section"
  | "cell";

export type Mint = (hint: IdHint, previous: string) => string;

const LIST_HINTS: Record<string, IdHint> = {
  rows: "row",
  blocks: "block",
  notes: "block",
  atoms: "atom",
  marks: "mark",
  slides: "slide",
  elements: "element",
  children: "element",
  locked: "element",
  layouts: "layout",
  sections: "section",
  cells: "cell"
};

const HELD_HINTS: Record<string, IdHint> = { caption: "block", block: "block" };

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const collect = (value: unknown, hint: IdHint | undefined, into: Map<string, IdHint>): void => {
  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, hint, into);
    return;
  }
  if (!isRecord(value)) return;
  if (hint !== undefined && typeof value.id === "string" && !into.has(value.id)) {
    into.set(value.id, hint);
  }
  for (const [field, nested] of Object.entries(value)) {
    const next = LIST_HINTS[field] ?? HELD_HINTS[field];
    collect(nested, next, into);
  }
};

const replace = (value: unknown, fresh: ReadonlyMap<string, string>): unknown => {
  if (Array.isArray(value)) return value.map((entry) => replace(entry, fresh));
  if (!isRecord(value)) return value;
  const next: Fields = {};
  for (const [field, nested] of Object.entries(value)) {
    const renamed =
      (field === "id" || field === "atom" || field === "firstSlideId") &&
      typeof nested === "string" &&
      fresh.has(nested);
    next[field] = renamed ? fresh.get(nested as string) : replace(nested, fresh);
  }
  return next;
};

export const withFreshIds = <T>(fragment: T, mint: Mint, hint?: IdHint): T => {
  const found = new Map<string, IdHint>();
  collect(fragment, hint, found);
  const fresh = new Map<string, string>();
  for (const [previous, hint] of found) fresh.set(previous, mint(hint, previous));
  return replace(fragment, fresh) as T;
};
