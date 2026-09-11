import {
  scopeSlotNamesIn,
  templateAtomNamesIn
} from "$representation/data/behavior/templates/scopes";
import type { TemplateBody, TemplateSlot } from "$representation/data/types/templates/template";

/**
 * The slots a body asks for, found rather than authored.
 *
 * A prompt's scope naming one makes it a `scope` slot, answered with a group of
 * resources and defaulting to the whole project. A template atom in the prose
 * makes it a `text` one, answered with words and defaulting to nothing, which is
 * why placing a template has to ask for it.
 *
 * A name used both ways is a scope, because a scope always has an answer and
 * text never does: taking the other side would leave a template that cannot be
 * placed until somebody types into a slot they cannot see.
 */
export const declaredFor = (
  body: TemplateBody,
  known: readonly TemplateSlot[]
): TemplateSlot[] => {
  const declared = new Set(known.map((slot) => slot.name));
  const scopes = scopeSlotNamesIn(body);
  const asScope = new Set(scopes);
  const texts = templateAtomNamesIn(body).filter((name) => !asScope.has(name));

  return [
    ...known,
    ...scopes
      .filter((name) => !declared.has(name))
      .map((name) => ({ name, label: name, kind: "scope" as const })),
    ...texts
      .filter((name) => !declared.has(name))
      .map((name) => ({ name, label: name, kind: "text" as const }))
  ];
};

/** What a slot is answered with. */
export const kindOf = (slot: TemplateSlot): "scope" | "text" => slot.kind;
