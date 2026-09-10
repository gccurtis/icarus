import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { TemplateHole } from "$representation/data/types/templates/template";

import { kindOf } from "$capabilities/templates/api/shared/holes";
import { setReferencesIn } from "$capabilities/templates/api/shared/scopes";
import type { TemplateAnswers } from "$capabilities/templates/types/templates";

type PlacementInputs =
  | { readonly accepted: true; readonly texts: Record<string, string> }
  | { readonly accepted: false; readonly detail: string };

/** Matches placement input fields to declared hole kinds and fills text defaults. */
export const placementInputsOf = (
  holes: readonly TemplateHole[],
  answers: TemplateAnswers,
  suppliedTexts: Readonly<Record<string, string>>
): PlacementInputs => {
  const scopeNames = new Set(
    holes.filter((hole) => kindOf(hole) === "scope").map((hole) => hole.name)
  );
  const textNames = new Set(
    holes.filter((hole) => kindOf(hole) === "text").map((hole) => hole.name)
  );
  const wrongAnswers = Object.keys(answers).filter((name) => !scopeNames.has(name));
  const wrongTexts = Object.keys(suppliedTexts).filter((name) => !textNames.has(name));
  if (wrongAnswers.length > 0 || wrongTexts.length > 0) {
    return {
      accepted: false,
      detail: `these answers do not match declared holes of their kind: ${[
        ...wrongAnswers.map((name) => `scope answer '${name}'`),
        ...wrongTexts.map((name) => `text answer '${name}'`)
      ].join(", ")}`
    };
  }

  const texts: Record<string, string> = { ...suppliedTexts };
  for (const hole of holes) {
    if (kindOf(hole) === "text" && hole.text !== undefined && texts[hole.name] === undefined) {
      texts[hole.name] = hole.text;
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
