import { segmentsOf } from "$representation/data/behavior/content/positions";
import type { Atom } from "$representation/data/types/content/content-block";
import type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";

/**
 * A hole is made, never found.
 *
 * Two things in a body can become one: a prompt, whose hole selects what it
 * reads, and a run of text, whose hole says what it says. Both are turned into
 * holes by the same gesture at the thing itself, and until somebody makes that
 * gesture there is no hole — a document full of prompts is a document, and a
 * template made from it asks nothing.
 *
 * A hole's default is simply whatever the thing already is: the prompt's own
 * scope, or the words that were selected. Nothing is judged portable or not.
 * A scope naming something the next project does not have selects nothing
 * there, which is what it means for that thing not to exist.
 */

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isPrompt = (value: unknown): value is Fields =>
  isRecord(value) && value.type === "prompt" && typeof value.id === "string";

const isTemplateAtom = (value: unknown): value is Fields =>
  isRecord(value) && value.kind === "template" && typeof value.name === "string";

const walkFor = (body: unknown, take: (value: Fields) => boolean): readonly Fields[] => {
  const found: Fields[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (!isRecord(value)) return;
    if (take(value)) found.push(value);
    for (const nested of Object.values(value)) walk(nested);
  };
  walk(body);
  return found;
};

const promptsIn = (body: unknown) => walkFor(body, isPrompt);
const atomsIn = (body: unknown) => walkFor(body, isTemplateAtom);

const named = (held: unknown): string => {
  if (!isRecord(held)) return "";
  return typeof held.name === "string" ? held.name.trim() : "";
};

/** Every hole this body already carries, whichever kind it is. */
export const holeNamesIn = (body: unknown): readonly string[] => {
  const names = new Set<string>();
  for (const prompt of promptsIn(body)) {
    const held = named(prompt.hole);
    if (held !== "") names.add(held);
  }
  for (const atom of atomsIn(body)) names.add(atom.name as string);
  return [...names];
};

export const offeredHoleName = (index: number): string => `Hole ${index + 1}`;

/**
 * The name the next hole is offered.
 *
 * Counted across everything the body already holds rather than per kind, so a
 * template's holes are numbered in one sequence however they were made.
 */
export const nextHoleName = (body: unknown): string => {
  const taken = new Set(holeNamesIn(body));
  for (let index = 0; ; index += 1) {
    const offer = offeredHoleName(index);
    if (!taken.has(offer)) return offer;
  }
};

/** What a hole selects when nobody says otherwise: whatever the prompt already read. */
export const defaultScopeOf = (scope: unknown): TemplatedResourceSet | undefined => {
  if (!isRecord(scope) || !Array.isArray(scope.include) || scope.include.length === 0) {
    return { include: [{ select: "project" }], exclude: [] };
  }
  return scope as unknown as TemplatedResourceSet;
};

export type PromptHoleDraft = {
  readonly blockId: string;
  readonly hole: TemplateHole;
};

/**
 * One hole per prompt somebody templated, and none for the rest.
 *
 * Read before the body is made portable, because the hole's default is the
 * scope as the prompt actually reads it.
 */
export const promptHolesOf = (body: unknown): readonly PromptHoleDraft[] =>
  promptsIn(body).flatMap((prompt) => {
    const name = named(prompt.hole);
    if (name === "") return [];
    const held = isRecord(prompt.hole) ? prompt.hole : {};
    const description = typeof held.description === "string" ? held.description.trim() : "";
    const fallback = defaultScopeOf(prompt.scope);
    return [
      {
        blockId: prompt.id as string,
        hole: {
          name,
          label: name,
          ...(description === "" ? {} : { description }),
          ...(fallback === undefined ? {} : { default: fallback })
        }
      }
    ];
  });

/** One hole per template atom somebody made, carrying the words it stands in for. */
export const textHolesOf = (body: unknown): readonly TemplateHole[] =>
  atomsIn(body).map((atom) => {
    const name = atom.name as string;
    const description = typeof atom.description === "string" ? atom.description.trim() : "";
    const words = typeof atom.text === "string" ? atom.text : "";
    return {
      name,
      label: name,
      kind: "text" as const,
      ...(description === "" ? {} : { description }),
      ...(words === "" ? {} : { text: words })
    };
  });

/**
 * The body with each templated prompt's scope replaced by the hole that stands
 * for it. A prompt nobody templated keeps the scope it has.
 */
export const withPromptHoles = <T>(body: T, drafts: readonly PromptHoleDraft[]): T => {
  const names = new Map(drafts.map((draft) => [draft.blockId, draft.hole.name]));
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;
    const next: Fields = {};
    for (const [field, nested] of Object.entries(value)) next[field] = walk(nested);
    if (!isPrompt(value)) return next;
    const name = names.get(value.id as string);
    if (name === undefined) return next;
    return { ...next, scope: { include: [{ select: "hole", name }], exclude: [] } };
  };
  return walk(body) as T;
};

/**
 * The body with each prompt's question written onto the prompt itself.
 *
 * A prompt reads its words from the derived output it is linked to, and a
 * template leaves the row behind — so the definition is copied onto the block
 * on the way in and a new one is made from it wherever the template lands.
 */
export const withAsks = <T>(body: T, asked: Readonly<Record<string, string>>): T => {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;
    const next: Fields = {};
    for (const [field, nested] of Object.entries(value)) next[field] = walk(nested);
    if (!isPrompt(value)) return next;
    const words = asked[value.id as string]?.trim() ?? "";
    if (words === "") return next;
    return { ...next, asks: words };
  };
  return walk(body) as T;
};

/** The holes a template keeps, with what the author already settled left alone. */
export const mergedPromptHoles = (
  known: readonly TemplateHole[],
  fresh: readonly TemplateHole[]
): readonly TemplateHole[] => {
  const held = new Map(known.map((hole) => [hole.name, hole]));
  const next = fresh.map((hole) => {
    const settled = held.get(hole.name);
    if (settled === undefined) return hole;
    const { description, ...rest } = hole;
    return {
      ...rest,
      ...(description === undefined
        ? settled.description === undefined
          ? {}
          : { description: settled.description }
        : { description })
    };
  });
  const taken = new Set(next.map((hole) => hole.name));
  return [...next, ...known.filter((hole) => !taken.has(hole.name))];
};

/** What each hole's prompt asks, so placing a template can show the question. */
export const promptWordsIn = (body: TemplateBody): Readonly<Record<string, string>> => {
  const words: Record<string, string> = {};
  for (const prompt of promptsIn(body)) {
    const asks = typeof prompt.asks === "string" ? prompt.asks.trim() : "";
    if (asks === "") continue;
    const scope = prompt.scope;
    if (!isRecord(scope) || !Array.isArray(scope.include)) continue;
    for (const term of scope.include) {
      if (isRecord(term) && term.select === "hole" && typeof term.name === "string") {
        words[term.name] ??= asks;
      }
    }
  }
  return words;
};

export type AtomSplice = {
  readonly remove: readonly string[];
  readonly after: string | null;
  readonly values: readonly Atom[];
};

/**
 * A run of text becoming a hole, as the atoms that replace it.
 *
 * Only the atoms the selection actually touches are rebuilt: what is left of
 * the first, the hole itself, and what is left of the last. Marks that reached
 * into those atoms go with them, which is the cost of turning words into a
 * question and is why the gesture is deliberate.
 */
export const holeSplice = (
  atoms: readonly Atom[],
  from: number,
  to: number,
  hole: { name: string; description?: string },
  mint: () => string
): AtomSplice | undefined => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (end <= start) return undefined;

  const segments = segmentsOf(atoms);
  const touched = segments.filter((segment) => segment.start < end && segment.end > start);
  if (touched.length === 0) return undefined;

  const first = touched[0];
  const last = touched[touched.length - 1];
  const at = segments.findIndex((segment) => segment.atom.id === first.atom.id);
  const before = at <= 0 ? null : segments[at - 1].atom.id;

  const wordsOf = (segment: (typeof segments)[number], sliceFrom: number, sliceTo: number): string =>
    segment.atom.kind === "literal" ? segment.atom.text.slice(sliceFrom, sliceTo) : "";

  const head = wordsOf(first, 0, start - first.start);
  const tail = wordsOf(last, end - last.start, last.end - last.start);
  const taken = touched
    .map((segment) =>
      segment.atom.kind === "literal"
        ? segment.atom.text.slice(
            Math.max(start - segment.start, 0),
            Math.min(end - segment.start, segment.end - segment.start)
          )
        : ""
    )
    .join("");

  const description = hole.description?.trim() ?? "";
  const values: Atom[] = [
    ...(head === "" ? [] : [{ id: mint(), kind: "literal" as const, text: head }]),
    {
      id: mint(),
      kind: "template" as const,
      name: hole.name,
      ...(description === "" ? {} : { description }),
      ...(taken === "" ? {} : { text: taken })
    },
    ...(tail === "" ? [] : [{ id: mint(), kind: "literal" as const, text: tail }])
  ];

  return { remove: touched.map((segment) => segment.atom.id), after: before, values };
};
