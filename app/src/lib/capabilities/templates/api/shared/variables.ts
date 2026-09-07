import { variableNamesIn } from "$representation/data/behavior/templates/scopes";
import type { TemplateBody, TemplateVariable } from "$representation/data/types/templates/template";

export const declaredFor = (
  body: TemplateBody,
  known: readonly TemplateVariable[]
): TemplateVariable[] => {
  const declared = new Set(known.map((variable) => variable.name));
  return [
    ...known,
    ...variableNamesIn(body)
      .filter((name) => !declared.has(name))
      .map((name) => ({ name, label: name }))
  ];
};
