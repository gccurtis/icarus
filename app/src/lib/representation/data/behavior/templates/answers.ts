import { ruleWords, type ScopeDraft, type ScopeNames } from "$representation/data/behavior/core/scope-draft";
import type { TemplateHole } from "$representation/data/types/templates/template";

/**
 * What placing a template has to ask for, one row per hole.
 *
 * Every hole is listed, because the list is the shape of the thing about to be
 * made. A scope always has a value — what the caller chose, else what the
 * template suggests — so it is never missing. Text has none until somebody types
 * some, which is the only thing that can hold a placement up.
 */

export type AnswerRow = {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: "scope" | "text";
  readonly value: string;
  readonly answered: boolean;
  readonly missing: boolean;
};

export const kindOfHole = (hole: TemplateHole): "scope" | "text" => hole.kind;

export const answerRowsOf = (
  holes: readonly TemplateHole[],
  chosen: Readonly<Record<string, ScopeDraft | undefined>>,
  texts: Readonly<Record<string, string | undefined>>,
  names: ScopeNames = {}
): readonly AnswerRow[] =>
  holes.map((hole) => {
    const kind = kindOfHole(hole);
    if (kind === "text") {
      const typed = texts[hole.name];
      const words = typed ?? hole.text ?? "";
      return {
        key: hole.name,
        label: hole.label,
        ...(hole.description === undefined ? {} : { description: hole.description }),
        kind,
        value: words,
        answered: typed !== undefined && typed !== (hole.text ?? ""),
        missing: words.trim() === ""
      };
    }
    const held = chosen[hole.name];
    return {
      key: hole.name,
      label: hole.label,
      ...(hole.description === undefined ? {} : { description: hole.description }),
      kind,
      /** The rule alone; whether it is the template's or the caller's is said beside it. */
      value: ruleWords(held ?? hole.default, names),
      answered: held !== undefined,
      missing: false
    };
  });

/** The holes still holding a placement up. */
export const missingIn = (rows: readonly AnswerRow[]): readonly string[] =>
  rows.filter((row) => row.missing).map((row) => row.label);
