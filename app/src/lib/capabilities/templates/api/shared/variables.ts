import {
  templateAtomNamesIn,
  variableNamesIn
} from "$representation/data/behavior/templates/scopes";
import type { TemplateBody, TemplateVariable } from "$representation/data/types/templates/template";

/**
 * The parameters a body asks for, found rather than authored.
 *
 * A prompt's scope naming one makes it a `scope` parameter, answered with a
 * group of resources and defaulting to the whole project. A template atom in the
 * prose makes it a `text` one, answered with words and defaulting to nothing,
 * which is why placing a template has to ask for it.
 *
 * A name used both ways is a scope, because a scope always has an answer and
 * text never does: taking the other side would leave a template that cannot be
 * placed until somebody types into a hole they cannot see.
 */
export const declaredFor = (
  body: TemplateBody,
  known: readonly TemplateVariable[]
): TemplateVariable[] => {
  const declared = new Set(known.map((variable) => variable.name));
  const scopes = variableNamesIn(body);
  const asScope = new Set(scopes);
  const texts = templateAtomNamesIn(body).filter((name) => !asScope.has(name));

  return [
    ...known,
    ...scopes.filter((name) => !declared.has(name)).map((name) => ({ name, label: name })),
    ...texts
      .filter((name) => !declared.has(name))
      .map((name) => ({ name, label: name, kind: "text" as const }))
  ];
};

/** What a parameter is answered with, treating an older one with no kind as a scope. */
export const kindOf = (variable: TemplateVariable): "scope" | "text" =>
  variable.kind === "text" ? "text" : "scope";
