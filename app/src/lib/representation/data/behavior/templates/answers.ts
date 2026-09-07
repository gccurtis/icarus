import { ruleWords, type ScopeDraft, type ScopeNames } from "$representation/data/behavior/core/scope-draft";
import type { TemplateVariable } from "$representation/data/types/templates/template";

/**
 * What placing a template has to ask for, one row per parameter.
 *
 * Every parameter is listed, because the list is the shape of the thing about to
 * be made. A scope always has a value — what the caller chose, else what the
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

export const kindOfVariable = (variable: TemplateVariable): "scope" | "text" =>
  variable.kind === "text" ? "text" : "scope";

export const answerRowsOf = (
  variables: readonly TemplateVariable[],
  chosen: Readonly<Record<string, ScopeDraft | undefined>>,
  texts: Readonly<Record<string, string | undefined>>,
  names: ScopeNames = {}
): readonly AnswerRow[] =>
  variables.map((variable) => {
    const kind = kindOfVariable(variable);
    if (kind === "text") {
      const words = texts[variable.name] ?? "";
      return {
        key: variable.name,
        label: variable.label,
        ...(variable.description === undefined ? {} : { description: variable.description }),
        kind,
        value: words,
        answered: words.trim() !== "",
        missing: words.trim() === ""
      };
    }
    const held = chosen[variable.name];
    return {
      key: variable.name,
      label: variable.label,
      ...(variable.description === undefined ? {} : { description: variable.description }),
      kind,
      value: held === undefined ? `Default · ${ruleWords(variable.default, names)}` : ruleWords(held, names),
      answered: held !== undefined,
      missing: false
    };
  });

/** The parameters still holding a placement up. */
export const missingIn = (rows: readonly AnswerRow[]): readonly string[] =>
  rows.filter((row) => row.missing).map((row) => row.label);
