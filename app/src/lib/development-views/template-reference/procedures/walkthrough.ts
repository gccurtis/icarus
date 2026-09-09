import {
  defaultScopeOf,
  offeredHoleName
} from "$representation/data/behavior/templates/prompt-holes";
import type { AnswerRow } from "$representation/data/behavior/templates/answers";

/**
 * What drives the interactive page.
 *
 * The rules are not restated here: `defaultScopeOf` is the same function the
 * capability calls, so a scope that would not carry over in the application
 * does not carry over on the page either. Only the shapes are local, because a
 * page has three prompts and no store.
 */

export type WalkScope = "project" | "kinds" | "set";

export type WalkPrompt = {
  readonly id: string;
  readonly asks: string;
  readonly name: string;
  readonly description: string;
  readonly scope: WalkScope;
};

const SCOPES: Record<WalkScope, unknown> = {
  project: { include: [{ select: "project" }], exclude: [] },
  kinds: { include: [{ select: "kinds", kinds: ["research"] }], exclude: [] },
  set: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
};

const WORDS: Record<WalkScope, string> = {
  project: "Everything in the project",
  kinds: "Research threads",
  set: "Winter filings"
};

export const scopeWords = (scope: WalkScope): string | undefined =>
  defaultScopeOf(SCOPES[scope]) === undefined ? undefined : WORDS[scope];

export type WalkHole = {
  readonly name: string;
  readonly description: string;
  readonly asks: string;
  readonly fallback?: string;
};

export const holesFrom = (prompts: readonly WalkPrompt[]): readonly WalkHole[] =>
  prompts.map((prompt, index) => {
    const fallback = defaultScopeOf(SCOPES[prompt.scope]);
    return {
      name: prompt.name.trim() === "" ? offeredHoleName(index) : prompt.name.trim(),
      description: prompt.description.trim(),
      asks: prompt.asks,
      ...(fallback === undefined ? {} : { fallback: WORDS[prompt.scope] })
    };
  });

export const answerRowsFrom = (
  holes: readonly WalkHole[],
  chosen: Readonly<Record<string, string>>,
  words: Readonly<Record<string, string>>
): readonly AnswerRow[] =>
  holes.map((hole) => {
    const answered = chosen[hole.name] === "chosen";
    const typed = words[hole.name] ?? "";
    if (hole.fallback === undefined && !answered) {
      return {
        key: hole.name,
        label: hole.name,
        ...(hole.description === "" ? {} : { description: hole.description }),
        kind: "text" as const,
        value: typed,
        answered: typed !== "",
        missing: typed.trim() === ""
      };
    }
    return {
      key: hole.name,
      label: hole.name,
      ...(hole.description === "" ? {} : { description: hole.description }),
      kind: "scope" as const,
      value: answered ? "Findings, minus one document" : (hole.fallback ?? "Everything in the project"),
      answered,
      missing: false
    };
  });

export const STAGES = [
  {
    title: "A prompt is written",
    what: "Somebody converts a block and types what it should derive. Nothing about templates has happened.",
    runs: "The prompt-block inspector, then createDerivedOutput when they press Generate",
    leaves: "A prompt block reading the whole project, linked to a derived output"
  },
  {
    title: "It is named, or it is not",
    what: "The Template section offers Prompt 1 and takes a description. Skipping it costs nothing.",
    runs: "promptHoleOps writes { name, description } onto the block",
    leaves: "A block that knows what its hole will be called"
  },
  {
    title: "The resource is saved as a template",
    what: "Every prompt becomes a hole. The scope becomes the default when it means the same thing anywhere.",
    runs: "promptHolesOf · withAsks · portableBodyOf · withPromptHoles · mergedPromptHoles",
    leaves: "templates.holes, and a body whose prompt scopes are hole terms"
  },
  {
    title: "Somebody places it",
    what: "One hole at a time: its name, what it stands for, the prompt itself, and the control.",
    runs: "answerRowsOf · promptWordsIn · the scope builder · normalizeScope",
    leaves: "Answers keyed by hole name, and a bound resourceSets row for anything that excludes"
  },
  {
    title: "The copy reads what was chosen",
    what: "Every prompt scope is settled before the resource is written, and the copy knows nothing of the template.",
    runs: "resolveTemplateScopes · fillTemplateAtoms",
    leaves: "An ordinary document or deck whose prompts are ready to generate"
  }
];
