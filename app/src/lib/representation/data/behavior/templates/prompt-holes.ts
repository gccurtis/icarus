import { displayOfAtom, endAt, linearOf, segmentsOf } from "$representation/data/behavior/content/positions";
import type { Atom, Mark } from "$representation/data/types/content/content-block";
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
const holeMarksIn = (body: unknown) =>
  walkFor(body, (value) => isRecord(value.hole) && typeof value.hole.name === "string" && isRecord(value.from));

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
  for (const mark of holeMarksIn(body)) names.add((mark.hole as Fields).name as string);
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
 * The body with each prompt written onto the block that asks it.
 *
 * A block reads its prompt from the derived output it is linked to, and a
 * template leaves the row behind — so the definition is copied onto the block
 * on the way in and a new one is made from it wherever the template lands.
 */
export const withPrompts = <T>(body: T, asked: Readonly<Record<string, string>>): T => {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;
    const next: Fields = {};
    for (const [field, nested] of Object.entries(value)) next[field] = walk(nested);
    if (!isPrompt(value)) return next;
    const words = asked[value.id as string]?.trim() ?? "";
    if (words === "") return next;
    return { ...next, prompt: words };
  };
  return walk(body) as T;
};

/**
 * Each prompt's scope, put back on the block that asks for it.
 *
 * A linked prompt keeps no scope of its own: the derived output owns it, so
 * there is one place to read and one place to write. A template leaves that row
 * behind, so the scope comes back onto the block on the way in — the same
 * moment, and for the same reason, as the question does.
 */
export const withScopes = <T>(body: T, scoped: Readonly<Record<string, unknown>>): T => {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;
    const next: Fields = {};
    for (const [field, nested] of Object.entries(value)) next[field] = walk(nested);
    if (!isPrompt(value)) return next;
    const held = scoped[value.id as string];
    if (!isRecord(held)) return next;
    return { ...next, scope: held };
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
    const asked = typeof prompt.prompt === "string" ? prompt.prompt.trim() : "";
    if (asked === "") continue;
    const scope = prompt.scope;
    if (!isRecord(scope) || !Array.isArray(scope.include)) continue;
    for (const term of scope.include) {
      if (isRecord(term) && term.select === "hole" && typeof term.name === "string") {
        words[term.name] ??= asked;
      }
    }
  }
  return words;
};

/** The mark that says a run is a hole, addressed the way every other mark is. */
export const holeMarkOver = (
  atoms: readonly Atom[],
  from: number,
  to: number,
  name: string,
  mint: () => string
): Mark | undefined => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (end <= start || name === "" || atoms.length === 0) return undefined;
  return {
    id: mint(),
    from: endAt(atoms, start, "from"),
    to: endAt(atoms, end, "to"),
    hole: { name }
  };
};

/** The hole already covering this run, if one does. */
export const holeNameOver = (
  atoms: readonly Atom[],
  marks: readonly Mark[],
  from: number,
  to: number
): string | undefined => {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  for (const run of markedRunsIn(atoms, marks)) {
    if (run.start < end && run.end > start) return run.hole.name as string;
  }
  return undefined;
};

type Marked = { readonly start: number; readonly end: number; readonly hole: Fields };

/** Where each hole mark sits on the block's display, sorted and non-overlapping. */
const markedRunsIn = (atoms: readonly Atom[], marks: readonly Mark[]): readonly Marked[] => {
  const runs: Marked[] = [];
  for (const mark of marks) {
    if (!isRecord(mark.hole) || typeof mark.hole.name !== "string") continue;
    const from = linearOf(atoms, mark.from);
    const to = linearOf(atoms, mark.to);
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    if (end <= start) continue;
    runs.push({ start, end, hole: mark.hole });
  }
  runs.sort((a, b) => a.start - b.start);
  /** An overlap would make two holes claim the same words, so the later one is not a hole. */
  return runs.filter((run, index) => index === 0 || run.start >= runs[index - 1].end);
};

const holeAtom = (hole: Fields, words: string, id: string): Atom => {
  const description = typeof hole.description === "string" ? hole.description.trim() : "";
  return {
    id,
    kind: "template",
    name: (hole.name as string).trim(),
    ...(description === "" ? {} : { description }),
    ...(words === "" ? {} : { text: words })
  };
};

/**
 * The marked runs, as the atoms and marks that replace them.
 *
 * Every mark that does not reach into a hole keeps the exact words it covered,
 * because the ends are remapped by position rather than by atom. A mark that
 * does reach into one goes: those words are a question now, and formatting a
 * question is not a thing this vocabulary can mean.
 */
export const withHolesAt = (
  atoms: readonly Atom[],
  marks: readonly Mark[],
  mint: () => string
): { readonly atoms: readonly Atom[]; readonly marks: readonly Mark[] } => {
  const runs = markedRunsIn(atoms, marks);
  if (runs.length === 0) {
    return { atoms, marks: marks.filter((mark) => mark.hole === undefined) };
  }

  const segments = segmentsOf(atoms);
  const total = segments.at(-1)?.end ?? 0;
  const next: Atom[] = [];
  /** Which stretch of the old display each new literal atom carries, for remapping the marks. */
  const carried: { readonly from: number; readonly to: number; readonly atom: string }[] = [];

  const carry = (from: number, to: number): void => {
    for (const segment of segments) {
      const start = Math.max(segment.start, from);
      const end = Math.min(segment.end, to);
      if (end <= start) continue;
      if (segment.atom.kind !== "literal") {
        next.push({ ...segment.atom, id: mint() });
        continue;
      }
      const atom: Atom = {
        id: mint(),
        kind: "literal",
        text: segment.atom.text.slice(start - segment.start, end - segment.start)
      };
      next.push(atom);
      carried.push({ from: start, to: end, atom: atom.id });
    }
  };

  let at = 0;
  for (const run of runs) {
    carry(at, run.start);
    const words = segments
      .map((segment) => {
        const start = Math.max(segment.start, run.start);
        const end = Math.min(segment.end, run.end);
        if (end <= start || segment.atom.kind !== "literal") return "";
        return segment.atom.text.slice(start - segment.start, end - segment.start);
      })
      .join("");
    next.push(holeAtom(run.hole, words, mint()));
    at = run.end;
  }
  carry(at, total);

  /**
   * A mark's end, put back where it was.
   *
   * A start prefers the stretch that begins at it and an end prefers the one
   * that finishes there, so a mark butting up against a hole keeps its words
   * rather than reaching across the boundary.
   */
  const endAtLanding = (position: number, prefer: "start" | "end"): Mark["from"] | undefined => {
    const holding = carried.filter((entry) => entry.from <= position && position <= entry.to);
    if (holding.length === 0) return undefined;
    const chosen = prefer === "start" ? holding[holding.length - 1] : holding[0];
    return { atom: chosen.atom, offset: position - chosen.from };
  };

  const kept: Mark[] = [];
  for (const mark of marks) {
    if (mark.hole !== undefined) continue;
    const from = linearOf(atoms, mark.from);
    const to = linearOf(atoms, mark.to);
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    if (runs.some((run) => run.start < end && run.end > start)) continue;
    const head = endAtLanding(start, "start");
    const tail = endAtLanding(end, "end");
    if (head === undefined || tail === undefined) continue;
    kept.push({
      ...mark,
      from: { atom: head.atom, offset: head.offset },
      to: { atom: tail.atom, offset: tail.offset }
    });
  }

  return { atoms: next, marks: kept };
};

/**
 * Every marked run in the body, as a hole in the prose.
 *
 * This runs on the copy a template is made from, never on the resource itself:
 * marking a run changes nothing about the document, and only the template ends
 * up with a hole where the words were.
 */
export const withMarkedHoles = <T>(body: T, mint: () => string): T => {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;
    const next: Fields = {};
    for (const [field, nested] of Object.entries(value)) next[field] = walk(nested);
    if (!Array.isArray(next.atoms) || !Array.isArray(next.marks)) return next;
    const held = withHolesAt(next.atoms as Atom[], next.marks as Mark[], mint);
    if (held.atoms === next.atoms && held.marks.length === (next.marks as Mark[]).length) return next;
    return {
      ...next,
      atoms: [...held.atoms],
      marks: [...held.marks],
      ...(typeof next.display === "string"
        ? { display: held.atoms.map(displayOfAtom).join("") }
        : {})
    };
  };
  return walk(body) as T;
};
