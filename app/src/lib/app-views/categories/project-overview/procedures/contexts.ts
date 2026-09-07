import {
  createResourceSet as createResourceSetRemote,
  readResourceSets,
  removeResourceSet as removeResourceSetRemote,
  updateResourceSet as updateResourceSetRemote,
  type ReadResourceSetsResult,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type { ResourceSet } from "$representation/data/types/core/resource-set";

export const resourceSets = () => readResourceSets();

export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
  answer?.sets ?? [];

export const KINDS = [
  { kind: "document", label: "Documents" },
  { kind: "slides", label: "Slide decks" },
  { kind: "spreadsheet", label: "Spreadsheets" },
  { kind: "finding", label: "Findings" },
  { kind: "research", label: "Research threads" }
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  KINDS.map((entry) => [entry.kind, entry.label])
);

export const emptySet = (): ResourceSet => ({ include: [], exclude: [] });

export const kindsOf = (set: ResourceSet): readonly string[] =>
  set.include.flatMap((term) => (term.select === "kinds" ? term.kinds : []));

export const isWholeProject = (set: ResourceSet): boolean =>
  set.include.some((term) => term.select === "project");

const termWords = (
  terms: ResourceSet["include"],
  names: ReadonlyMap<string, string>
): readonly string[] =>
  terms.map((term) =>
    term.select === "project"
      ? "everything in the project"
      : term.select === "kinds"
        ? term.kinds.map((kind) => KIND_LABEL[kind] ?? kind).join(", ")
        : term.select === "resources"
          ? `${term.refs.length} named ${term.refs.length === 1 ? "resource" : "resources"}`
          : (names.get(term.setId) ?? "another set")
  );

export const ruleOf = (set: ResourceSet, names: ReadonlyMap<string, string> = new Map()): string => {
  const included = termWords(set.include, names);
  if (included.length === 0) return "Selects nothing";
  const sentence = included.join(" and ");
  const capitalised = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  const excluded = termWords(set.exclude, names);
  return excluded.length === 0 ? capitalised : `${capitalised}, minus ${excluded.join(", ")}`;
};

export const namesOf = (sets: readonly ResourceSetItem[]): ReadonlyMap<string, string> =>
  new Map(sets.map((set) => [set.id, set.name]));

export const withWholeProject = (set: ResourceSet, on: boolean): ResourceSet => {
  const kept = set.include.filter((term) => term.select !== "project");
  return { include: on ? [{ select: "project" }, ...kept] : kept, exclude: set.exclude };
};

export const withKind = (set: ResourceSet, kind: string, on: boolean): ResourceSet => {
  const kinds = kindsOf(set).filter((held) => held !== kind);
  if (on) kinds.push(kind);
  const others = set.include.filter((term) => term.select !== "kinds");
  return {
    include: kinds.length === 0 ? others : [...others, { select: "kinds", kinds }],
    exclude: set.exclude
  };
};

export const withExcludedKind = (set: ResourceSet, kind: string, on: boolean): ResourceSet => {
  const kinds = set.exclude
    .flatMap((term) => (term.select === "kinds" ? term.kinds : []))
    .filter((held) => held !== kind);
  if (on) kinds.push(kind);
  const others = set.exclude.filter((term) => term.select !== "kinds");
  return {
    include: set.include,
    exclude: kinds.length === 0 ? others : [...others, { select: "kinds", kinds }]
  };
};

export const excludedKindsOf = (set: ResourceSet): readonly string[] =>
  set.exclude.flatMap((term) => (term.select === "kinds" ? term.kinds : []));

export const nextSetName = (sets: readonly ResourceSetItem[]): string => {
  const taken = new Set(sets.map((set) => set.name.toLocaleLowerCase()));
  let suffix = 1;
  while (taken.has(`new set ${suffix}`)) suffix += 1;
  return `New set ${suffix}`;
};

export const createSet = (view: WorkspaceStateModel, name: string, set: ResourceSet) =>
  view.singleFlight(["resource-set", view.project, "create", name.trim(), JSON.stringify(set)], () =>
    createResourceSetRemote({ name: name.trim(), set }).updates(readResourceSets)
  );

export const renameSet = (view: WorkspaceStateModel, item: ResourceSetItem, name: string) =>
  view.singleFlight(["resource-set", view.project, item.id, "rename", item.revision, name.trim()], () =>
    updateResourceSetRemote({
      setId: item.id,
      baseRevision: item.revision,
      patch: { name: name.trim() }
    }).updates(readResourceSets)
  );

export const describeSet = (view: WorkspaceStateModel, item: ResourceSetItem, description: string) =>
  view.singleFlight(
    ["resource-set", view.project, item.id, "describe", item.revision, description.trim()],
    () =>
      updateResourceSetRemote({
        setId: item.id,
        baseRevision: item.revision,
        patch: { description: description.trim() === "" ? null : description.trim() }
      }).updates(readResourceSets)
  );

export const changeSet = (view: WorkspaceStateModel, item: ResourceSetItem, set: ResourceSet) =>
  view.singleFlight(
    ["resource-set", view.project, item.id, "set", item.revision, JSON.stringify(set)],
    () =>
      updateResourceSetRemote({ setId: item.id, baseRevision: item.revision, patch: { set } }).updates(
        readResourceSets
      )
  );

export const removeSet = (view: WorkspaceStateModel, item: ResourceSetItem) =>
  view.singleFlight(["resource-set", view.project, item.id, "remove", item.revision], () =>
    removeResourceSetRemote({ setId: item.id, baseRevision: item.revision }).updates(readResourceSets)
  );
