import type { MarkLink } from "$representation/data/types/content/content-block";
import {
  isStoredChoice,
  isStoredRowId
} from "$representation/data/behavior/core/stored";
import { isResourceSelectorKind } from "$representation/data/behavior/core/resource";
import {
  canonical,
  currentActor,
  currentFormulaValue,
  currentResourceRef,
  exact,
  identifier,
  natural,
  recordOf,
  text
} from "$representation/data/behavior/content/admission-values";

const currentSetTerm = (value: unknown): boolean => {
  const term = recordOf(value);
  if (term === undefined) return false;
  if (term.select === "project") return exact(term, ["select"]);
  if (term.select === "kinds") {
    return exact(term, ["select", "kinds"]) &&
      Array.isArray(term.kinds) &&
      term.kinds.length <= 1_000 &&
      term.kinds.every(isResourceSelectorKind);
  }
  if (term.select === "resources") {
    return exact(term, ["select", "refs"]) &&
      Array.isArray(term.refs) &&
      term.refs.length <= 10_000 &&
      term.refs.every(currentResourceRef);
  }
  if (term.select === "set") {
    return exact(term, ["select", "setId"]) && isStoredRowId(term.setId, "resourceSets");
  }
  return term.select === "hole" && exact(term, ["select", "name"]) && canonical(term.name, 160);
};

export const currentScope = (value: unknown): boolean => {
  const scope = recordOf(value);
  if (
    scope === undefined ||
    !exact(scope, ["include", "exclude"]) ||
    !Array.isArray(scope.include) ||
    !Array.isArray(scope.exclude) ||
    scope.include.length > 10_000 ||
    scope.exclude.length > 10_000 ||
    !scope.include.every(currentSetTerm) ||
    !scope.exclude.every(currentSetTerm)
  ) return false;
  const selections = [...scope.include, ...scope.exclude]
    .map((term) => recordOf(term)?.select);
  return !(selections.includes("hole") && selections.includes("resources"));
};

export const currentAtom = (value: unknown): boolean => {
  const atom = recordOf(value);
  if (atom === undefined || !identifier(atom.id)) return false;
  if (atom.kind === "literal") {
    return exact(atom, ["id", "kind", "text"]) && text(atom.text);
  }
  if (atom.kind === "template") {
    return exact(atom, ["id", "kind", "name"], ["description", "text"]) &&
      canonical(atom.name, 160) &&
      (atom.description === undefined || text(atom.description, 10_000)) &&
      (atom.text === undefined || text(atom.text));
  }
  return atom.kind === "formula" &&
    exact(
      atom,
      ["id", "kind", "expression", "lastResolvedValue", "lastResolvedDisplay", "state"],
      ["formulaId", "error"]
    ) &&
    text(atom.expression, 10_000) &&
    (atom.formulaId === undefined || isStoredRowId(atom.formulaId, "formulas")) &&
    currentFormulaValue(atom.lastResolvedValue) &&
    text(atom.lastResolvedDisplay) &&
    isStoredChoice(atom.state, ["fresh", "stale", "computing", "error"]) &&
    (atom.error === undefined || text(atom.error, 10_000));
};

export const currentMarkLink = (value: unknown): value is MarkLink => {
  const link = recordOf(value);
  if (link === undefined) return false;
  if (link.kind === "url") {
    return exact(link, ["kind", "url"], ["note"]) &&
      text(link.url, 10_000) &&
      (link.note === undefined || text(link.note, 10_000));
  }
  if (link.kind === "actor") {
    return exact(link, ["kind", "actor"]) && currentActor(link.actor);
  }
  if (link.kind === "persona") {
    return exact(link, ["kind", "personaId"]) && isStoredRowId(link.personaId, "personas");
  }
  return link.kind === "resource" &&
    exact(link, ["kind", "ref"]) &&
    currentResourceRef(link.ref);
};

const currentEnd = (value: unknown): boolean => {
  const end = recordOf(value);
  return end !== undefined &&
    exact(end, ["atom", "offset"]) &&
    identifier(end.atom) &&
    natural(end.offset);
};

export const currentHole = (value: unknown): boolean => {
  const hole = recordOf(value);
  return hole !== undefined &&
    exact(hole, ["name"], ["description"]) &&
    canonical(hole.name, 160) &&
    (hole.description === undefined || text(hole.description, 10_000));
};

export const currentMark = (value: unknown): boolean => {
  const mark = recordOf(value);
  if (
    mark === undefined ||
    !exact(mark, ["id", "from", "to"], ["style", "link", "color", "background", "hole"]) ||
    !identifier(mark.id) ||
    !currentEnd(mark.from) ||
    !currentEnd(mark.to)
  ) return false;
  if (
    mark.style !== undefined &&
    (!Array.isArray(mark.style) ||
      mark.style.length > 5 ||
      new Set(mark.style).size !== mark.style.length ||
      !mark.style.every((style) =>
        isStoredChoice(style, ["bold", "italic", "underline", "strikethrough", "code"])
      ))
  ) return false;
  return (mark.link === undefined || currentMarkLink(mark.link)) &&
    (mark.color === undefined || text(mark.color, 10_000)) &&
    (mark.background === undefined || text(mark.background, 10_000)) &&
    (mark.hole === undefined || currentHole(mark.hole));
};
