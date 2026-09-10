import type {
  ResourceOption,
  ResourceSetOption
} from "$capabilities/agents/index.remote";
import type { ResourceRef, ResourceSet, SetTerm } from "$app-views/categories/agents/procedures/vocabulary";

export type ScopeRow = {
  readonly key: string;
  readonly kind: "project" | "set" | "resource" | "kinds";
  readonly refKind: string;
  readonly title: string;
  readonly detail: string;
};

export const EVERYTHING: ResourceSet = { include: [{ select: "project" }], exclude: [] };

const refKey = (ref: ResourceRef): string => `resource:${ref.kind}:${ref.id}`;

const KIND_WORD: Record<string, string> = {
  document: "Document",
  slides: "Slide deck",
  spreadsheet: "Spreadsheet",
  finding: "Finding",
  "externalFile::text": "External text file",
  "externalFile::code": "External code file",
  "externalFile::data": "External data file",
  "externalFile::image": "External image",
  "externalFile::audio": "External audio",
  "externalFile::video": "External video",
  "externalFile::unknown": "External file"
};

export const scopeRows = (
  scope: ResourceSet | null,
  sets: readonly ResourceSetOption[],
  resources: readonly ResourceOption[]
): readonly ScopeRow[] => {
  if (scope === null) return [];
  const rows: ScopeRow[] = [];
  for (const term of scope.include) {
    if (term.select === "project") {
      rows.push({
        key: "project",
        kind: "project",
        refKind: "project",
        title: "Everything in this project",
        detail: "Including whatever is made tomorrow"
      });
    } else if (term.select === "set") {
      const named = sets.find((candidate) => candidate.id === term.setId);
      rows.push({
        key: `set:${term.setId}`,
        kind: "set",
        refKind: "set",
        title: named?.name ?? "A saved set",
        detail: "Saved set"
      });
    } else if (term.select === "kinds") {
      rows.push({
        key: `kinds:${term.kinds.join("+")}`,
        kind: "kinds",
        refKind: term.kinds[0] ?? "project",
        title: term.kinds.map((kind) => KIND_WORD[kind] ?? kind).join(", "),
        detail: "Every resource of that kind"
      });
    } else {
      for (const ref of term.refs) {
        const named = resources.find(
          (candidate) => candidate.ref.kind === ref.kind && candidate.ref.id === ref.id
        );
        rows.push({
          key: refKey(ref),
          kind: "resource",
          refKind: ref.kind,
          title: named?.name ?? "A resource",
          detail: named?.relativePath ?? KIND_WORD[ref.kind] ?? ref.kind
        });
      }
    }
  }
  return rows;
};

const refsOf = (scope: ResourceSet): readonly ResourceRef[] =>
  scope.include.flatMap((term) => (term.select === "resources" ? term.refs : []));

const rebuilt = (
  scope: ResourceSet,
  terms: readonly SetTerm[],
  refs: readonly ResourceRef[]
): ResourceSet => ({
  include: refs.length === 0 ? [...terms] : [...terms, { select: "resources", refs: [...refs] }],
  exclude: [...scope.exclude]
});

const withoutResources = (scope: ResourceSet): readonly SetTerm[] =>
  scope.include.filter((term) => term.select !== "resources");

const withoutProject = (terms: readonly SetTerm[]): readonly SetTerm[] =>
  terms.filter((term) => term.select !== "project");

export const withProject = (scope: ResourceSet | null): ResourceSet => {
  const from = scope ?? { include: [], exclude: [] };
  if (from.include.length === 1 && from.include[0]?.select === "project") return from;
  return { include: [{ select: "project" }], exclude: [...from.exclude] };
};

export const withSet = (scope: ResourceSet | null, setId: string): ResourceSet => {
  const from = scope ?? { include: [], exclude: [] };
  if (from.include.some((term) => term.select === "set" && term.setId === setId)) return from;
  return rebuilt(
    from,
    [...withoutProject(withoutResources(from)), { select: "set", setId: setId as never }],
    refsOf(from)
  );
};

export const withResource = (scope: ResourceSet | null, ref: ResourceRef): ResourceSet => {
  const from = scope ?? { include: [], exclude: [] };
  const refs = refsOf(from);
  if (refs.some((candidate) => candidate.kind === ref.kind && candidate.id === ref.id)) return from;
  return rebuilt(from, withoutProject(withoutResources(from)), [...refs, ref]);
};

export const withoutRow = (scope: ResourceSet | null, key: string): ResourceSet | null => {
  if (scope === null) return null;
  const terms = withoutResources(scope).filter((term) => {
    if (term.select === "project") return key !== "project";
    if (term.select === "set") return key !== `set:${term.setId}`;
    if (term.select === "kinds") return key !== `kinds:${term.kinds.join("+")}`;
    return true;
  });
  const refs = refsOf(scope).filter((ref) => refKey(ref) !== key);
  if (terms.length === 0 && refs.length === 0) return null;
  return rebuilt(scope, terms, refs);
};

export const isEverything = (scope: ResourceSet | null): boolean =>
  scope !== null && scope.include.length === 1 && scope.include[0].select === "project";
