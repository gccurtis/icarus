import { defaultScopeOf } from "$representation/data/behavior/templates/prompt-holes";
import type { AnswerRow } from "$representation/data/behavior/templates/answers";

/**
 * What drives the interactive page.
 *
 * The rules are not restated here: `defaultScopeOf` is the same function the
 * capability calls. Only the shapes are local, because a page has three prompts
 * and no store.
 */

export type WalkScope = "project" | "kinds" | "set";

export type WalkPrompt = {
  readonly id: string;
  readonly prompt: string;
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

/** The scope carries over whatever it is, so the words are simply the words. */
export const scopeWords = (scope: WalkScope): string =>
  defaultScopeOf(SCOPES[scope]) === undefined ? WORDS.project : WORDS[scope];

export type WalkHole = {
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
  readonly fallback: string;
};

/** Only the prompts somebody templated become holes. */
export const holesFrom = (prompts: readonly WalkPrompt[]): readonly WalkHole[] =>
  prompts.flatMap((prompt) =>
    prompt.name.trim() === ""
      ? []
      : [
          {
            name: prompt.name.trim(),
            description: prompt.description.trim(),
            prompt: prompt.prompt,
            fallback: scopeWords(prompt.scope)
          }
        ]
  );

export const answerRowsFrom = (
  holes: readonly WalkHole[],
  chosen: Readonly<Record<string, string>>
): readonly AnswerRow[] =>
  holes.map((hole) => {
    const answered = chosen[hole.name] === "chosen";
    return {
      key: hole.name,
      label: hole.name,
      ...(hole.description === "" ? {} : { description: hole.description }),
      kind: "scope" as const,
      value: answered ? "Findings, minus one document" : hole.fallback,
      answered,
      missing: false
    };
  });

export const STAGES = [
  {
    title: "A prompt is written",
    what: "Somebody converts a block and types what it should derive. Nothing about templates has happened, and nothing has to.",
    runs: "The prompt-block inspector, then createDerivedOutput when they press Generate",
    leaves: "A prompt block reading whatever its Scope says, linked to a derived output"
  },
  {
    title: "Something is templateified",
    what: "A prompt, or a run of selected text. Nothing about the resource changes: the block gains a record, the words gain a mark. Until this, a template built from the document asks nothing at all.",
    runs: "promptHoleOps writes a hole record; markHoleOps writes a mark over the run",
    leaves: "A hole named Hole 1, whose default is what the thing already is, and prose that reads exactly as it did"
  },
  {
    title: "The resource is saved as a template",
    what: "On the copy — and only there — each marked run becomes the hole it was marked as. The prompt's question is copied onto the block as its link is left behind.",
    runs: "promptHolesOf · withPrompts · portableBodyOf · withPromptHoles · withMarkedHoles · textHolesOf",
    leaves: "templates.holes, a body whose templated prompt scopes are hole terms, and an untouched original"
  },
  {
    title: "Somebody places it",
    what: "One hole at a time: its name, what it stands for, the prompt it fills, and the control.",
    runs: "answerRowsOf · promptWordsIn · the scope builder · normalizeScope",
    leaves: "Answers keyed by hole name, and a bound resourceSets row for anything that excludes"
  },
  {
    title: "The copy reads what was chosen",
    what: "Every hole term is settled, and each prompt is given a derived output of its own from the question the template carried.",
    runs: "resolveTemplateScopes · fillTemplateAtoms · withFreshOutputs",
    leaves: "An ordinary document whose prompts are linked and ready to generate"
  }
];
