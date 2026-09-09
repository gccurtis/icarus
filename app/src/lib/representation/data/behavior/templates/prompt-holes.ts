import type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";

/**
 * Every prompt is a hole.
 *
 * A prompt asks the project a question, and a template is a question asked
 * again somewhere else — so the thing a template has to be told is what each of
 * its prompts should read this time. There is no declaring and no opting in:
 * making a template turns every prompt it holds into one hole, named by what
 * the author called it and otherwise by where it sits.
 *
 * Two prompts may share a name, and then they share a hole and one answer
 * fills both. Nothing enforces it either way, because a name is the whole of a
 * hole's identity and the resolver already substitutes by name.
 */

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isPrompt = (value: unknown): value is Fields =>
  isRecord(value) && value.type === "prompt" && typeof value.id === "string";

/** Every prompt in the body, in the order it is written. */
const promptsIn = (body: unknown): readonly Fields[] => {
  const found: Fields[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (!isRecord(value)) return;
    if (isPrompt(value)) found.push(value);
    for (const nested of Object.values(value)) walk(nested);
  };
  walk(body);
  return found;
};

/** What a prompt's hole is called before anybody names it. */
export const offeredHoleName = (index: number): string => `Prompt ${index + 1}`;

/**
 * The name a prompt's hole carries: what it was called, else where it sits.
 *
 * Ordinal rather than stable, because it is only ever a suggestion — the moment
 * somebody types a name it stops mattering where the prompt moved to.
 */
export const offeredNameIn = (body: unknown, blockId: string): string => {
  const at = promptsIn(body).findIndex((prompt) => prompt.id === blockId);
  return offeredHoleName(at < 0 ? 0 : at);
};

export const holeNameIn = (body: unknown, blockId: string): string => {
  const prompts = promptsIn(body);
  const at = prompts.findIndex((prompt) => prompt.id === blockId);
  if (at < 0) return offeredHoleName(0);
  const held = prompts[at].hole;
  const named = isRecord(held) && typeof held.name === "string" ? held.name.trim() : "";
  return named === "" ? offeredHoleName(at) : named;
};

/**
 * What a hole selects when nobody says otherwise.
 *
 * A scope anybody could have meant — the whole project, or whole kinds of
 * thing — carries over as the default, so a template made without a thought
 * still places without one. A prompt that was never scoped counts as the whole
 * project, because that is what it reads and what its inspector says it reads.
 * A scope naming particular sets or particular resources does not carry over:
 * it was true of the project it was written in and saying it again somewhere
 * else would be a guess, so the hole arrives empty and has to be answered.
 */
export const WHOLE_PROJECT: TemplatedResourceSet = { include: [{ select: "project" }], exclude: [] };

export const defaultScopeOf = (scope: unknown): TemplatedResourceSet | undefined => {
  if (!isRecord(scope)) return WHOLE_PROJECT;
  const { include, exclude } = scope;
  if (!Array.isArray(include) || include.length === 0) return WHOLE_PROJECT;
  if (Array.isArray(exclude) && exclude.length > 0) return undefined;
  const general = include.every(
    (term) => isRecord(term) && (term.select === "project" || term.select === "kinds")
  );
  if (!general) return undefined;
  const terms = include.map((term) => ({ ...(term as object) })) as unknown as TemplatedResourceSet["include"];
  return { include: terms, exclude: [] };
};

/**
 * The hole a prompt already answers to, when it is already asking for one.
 *
 * A working copy is full of prompts whose scopes are hole terms, because
 * inserting a template into one keeps the terms rather than resolving them.
 * Saving that copy must not rename them: the name in the term is the name
 * somebody already wrote, and the answers given elsewhere are keyed to it.
 */
const standingHoleName = (scope: unknown): string | undefined => {
  if (!isRecord(scope) || !Array.isArray(scope.include)) return undefined;
  for (const term of scope.include) {
    if (isRecord(term) && term.select === "hole" && typeof term.name === "string") return term.name;
  }
  return undefined;
};

export type PromptHoleDraft = {
  readonly blockId: string;
  readonly hole: TemplateHole;
};

/**
 * One hole per prompt, read off the body before it is made portable.
 *
 * Before, because portability drops the scope terms that name particular things
 * — and whether those were there is exactly what decides if the hole gets a
 * default.
 */
export const promptHolesOf = (body: unknown): readonly PromptHoleDraft[] =>
  promptsIn(body).map((prompt, index) => {
    const held = isRecord(prompt.hole) ? prompt.hole : {};
    const named = typeof held.name === "string" ? held.name.trim() : "";
    const name = named === "" ? (standingHoleName(prompt.scope) ?? offeredHoleName(index)) : named;
    const description = typeof held.description === "string" ? held.description.trim() : "";
    const fallback = defaultScopeOf(prompt.scope);
    return {
      blockId: prompt.id as string,
      hole: {
        name,
        label: name,
        ...(description === "" ? {} : { description }),
        ...(fallback === undefined ? {} : { default: fallback })
      }
    };
  });

/**
 * The body with each prompt's question written onto the prompt itself.
 *
 * A prompt reads its words from the derived output it is linked to, and a
 * template leaves that output behind — so the words are copied onto the block
 * on the way in, or the copy a template makes would ask nothing.
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

/**
 * The holes a template keeps, with what the author already settled left alone.
 *
 * A prompt owns its hole's name and what it stands for, because that is where
 * they are written. A default may have been built in the Holes band since, and
 * that is not something a save should quietly undo.
 */
export const mergedPromptHoles = (
  known: readonly TemplateHole[],
  drafts: readonly PromptHoleDraft[]
): readonly TemplateHole[] => {
  const held = new Map(known.map((hole) => [hole.name, hole]));
  const fresh = drafts.map((draft) => {
    const settled = held.get(draft.hole.name);
    if (settled === undefined) return draft.hole;
    const { default: fallback, ...rest } = draft.hole;
    return {
      ...rest,
      ...(settled.default === undefined ? (fallback === undefined ? {} : { default: fallback }) : { default: settled.default })
    };
  });
  const taken = new Set(fresh.map((hole) => hole.name));
  return [...fresh, ...known.filter((hole) => !taken.has(hole.name))];
};

/** The body with every prompt's scope replaced by the hole term that stands for it. */
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
