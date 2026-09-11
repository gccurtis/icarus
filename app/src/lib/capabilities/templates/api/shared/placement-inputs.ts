import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { TemplateSlot } from "$representation/data/types/templates/template";

import { kindOf } from "$capabilities/templates/api/shared/slots";
import { setReferencesIn } from "$capabilities/templates/api/shared/scopes";
import type { TemplateAnswers } from "$capabilities/templates/types/templates";

type PlacementInputs =
  | { readonly accepted: true; readonly texts: Record<string, string> }
  | { readonly accepted: false; readonly detail: string };

/** Matches placement input fields to declared slot kinds and fills text defaults. */
export const placementInputsOf = (
  slots: readonly TemplateSlot[],
  answers: TemplateAnswers,
  suppliedTexts: Readonly<Record<string, string>>
): PlacementInputs => {
  const scopeNames = new Set(
    slots.filter((slot) => kindOf(slot) === "scope").map((slot) => slot.name)
  );
  const textNames = new Set(
    slots.filter((slot) => kindOf(slot) === "text").map((slot) => slot.name)
  );
  const wrongAnswers = Object.keys(answers).filter((name) => !scopeNames.has(name));
  const wrongTexts = Object.keys(suppliedTexts).filter((name) => !textNames.has(name));
  if (wrongAnswers.length > 0 || wrongTexts.length > 0) {
    return {
      accepted: false,
      detail: `these answers do not match declared slots of their kind: ${[
        ...wrongAnswers.map((name) => `scope answer '${name}'`),
        ...wrongTexts.map((name) => `text answer '${name}'`)
      ].join(", ")}`
    };
  }

  const texts: Record<string, string> = { ...suppliedTexts };
  for (const slot of slots) {
    if (kindOf(slot) === "text" && slot.text !== undefined && texts[slot.name] === undefined) {
      texts[slot.name] = slot.text;
    }
  }
  const unfilled = [...textNames].filter(
    (name) => texts[name] === undefined || texts[name].trim() === ""
  );
  return unfilled.length === 0
    ? { accepted: true, texts }
    : {
        accepted: false,
        detail: `these need words before the template can be placed: ${unfilled.join(", ")}`
      };
};

/** Refuses absent set IDs and private implementation rows while preserving named reusable sets. */
export const placementSetRefusal = (
  store: StoreUnitOfWork,
  projectId: string,
  answers: TemplateAnswers
): string | undefined => {
  const references = Object.values(answers).map((rule) =>
    setReferencesIn(store, projectId, rule)
  );
  const missing = [...new Set(references.flatMap((found) => found.missing))].sort();
  if (missing.length > 0) return `this project holds no resource set ${missing.join(", ")}`;
  const privateSets = [...new Set(references.flatMap((found) => found.private))].sort();
  return privateSets.length === 0
    ? undefined
    : `scope answers may reference only named reusable resource sets; ${privateSets.join(", ")} is private`;
};
