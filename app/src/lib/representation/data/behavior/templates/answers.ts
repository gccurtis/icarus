import { ruleWords, type ScopeDraft, type ScopeNames } from "$representation/data/behavior/core/scope-draft";
import type { TemplateSlot } from "$representation/data/types/templates/template";

/**
 * What placing a template has to ask for, one row per slot.
 *
 * Every slot is listed, because the list is the shape of the thing about to be
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

export const kindOfSlot = (slot: TemplateSlot): "scope" | "text" => slot.kind;

export const answerRowsOf = (
  slots: readonly TemplateSlot[],
  chosen: Readonly<Record<string, ScopeDraft | undefined>>,
  texts: Readonly<Record<string, string | undefined>>,
  names: ScopeNames = {}
): readonly AnswerRow[] =>
  slots.map((slot) => {
    const kind = kindOfSlot(slot);
    if (kind === "text") {
      const typed = texts[slot.name];
      const words = typed ?? slot.text ?? "";
      return {
        key: slot.name,
        label: slot.label,
        ...(slot.description === undefined ? {} : { description: slot.description }),
        kind,
        value: words,
        answered: typed !== undefined && typed !== (slot.text ?? ""),
        missing: words.trim() === ""
      };
    }
    const held = chosen[slot.name];
    return {
      key: slot.name,
      label: slot.label,
      ...(slot.description === undefined ? {} : { description: slot.description }),
      kind,
      /** The rule alone; whether it is the template's or the caller's is said beside it. */
      value: ruleWords(held ?? slot.default, names),
      answered: held !== undefined,
      missing: false
    };
  });

/** The slots still holding a placement up. */
export const missingIn = (rows: readonly AnswerRow[]): readonly string[] =>
  rows.filter((row) => row.missing).map((row) => row.label);
