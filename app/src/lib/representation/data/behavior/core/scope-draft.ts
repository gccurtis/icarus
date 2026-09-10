import {
  isResourceRef,
  isResourceSelectorKind,
  kindMatches
} from "$representation/data/behavior/core/resource";
import type {
  ResourceRef,
  ResourceSelectorKind
} from "$representation/data/types/core/resource";
import type {
  ResourceSet,
  SetTerm,
  TemplatedResourceSet,
  TemplatedTerm
} from "$representation/data/types/core/resource-set";

/**
 * A scope while somebody is building it, and the words for the one they built.
 *
 * Every surface that offers a scope reads this: both editors' Templates panels
 * and the library inspector. Before it existed, the same arithmetic and the
 * same sentence were repeated across those consumers and had already drifted.
 *
 * A draft is the widest shape either union can hold, so one component can edit a
 * template's default and a project's own set without knowing which it has.
 * `narrowed` and `templated` are the two doors back out.
 */

export type AnyTerm = SetTerm | TemplatedTerm;

export type ScopeSide = "include" | "exclude";

export type ScopeDraft = {
  readonly include: readonly AnyTerm[];
  readonly exclude: readonly AnyTerm[];
};

export type KindOption = { readonly kind: ResourceSelectorKind; readonly label: string };

/**
 * The kinds a project's catalogue reports, with the words for them.
 *
 * Exact reference kinds are closed. The base `externalFile` selector is offered
 * here because it deliberately selects every current external-file subkind.
 */
export const PROJECT_KINDS: readonly KindOption[] = [
  { kind: "document", label: "Documents" },
  { kind: "slides", label: "Slide decks" },
  { kind: "spreadsheet", label: "Spreadsheets" },
  { kind: "finding", label: "Findings" },
  { kind: "research", label: "Research threads" },
  { kind: "connection", label: "Connections" },
  { kind: "externalFile", label: "External files" }
];

export const WHOLE_PROJECT: ResourceSet = { include: [{ select: "project" }], exclude: [] };

export const EMPTY_DRAFT: ScopeDraft = { include: [], exclude: [] };

/**
 * One term, one row.
 *
 * A stored rule may hold several kinds or several resources in one term, which
 * is the same selection either way. A row that says "Findings, Documents" is one
 * thing to remove and two things to read, so a draft splits them: what you can
 * take out is what you put in.
 */
const split = (term: AnyTerm): readonly AnyTerm[] => {
  if (term.select === "kinds" && term.kinds.length > 1) {
    return term.kinds.map((kind) => ({ select: "kinds", kinds: [kind] }));
  }
  if (term.select === "resources" && term.refs.length > 1) {
    return term.refs.map((ref) => ({ select: "resources", refs: [{ ...ref }] }));
  }
  return [term];
};

export const draftOf = (scope: ScopeDraft | undefined): ScopeDraft =>
  scope === undefined
    ? { include: [...WHOLE_PROJECT.include], exclude: [] }
    : { include: scope.include.flatMap(split), exclude: scope.exclude.flatMap(split) };

/** A stable identity for a term, so a draft can say whether it already holds one. */
export const termKey = (term: AnyTerm): string => {
  if (term.select === "project") return "project";
  if (term.select === "kinds") return `kinds:${[...term.kinds].sort().join(",")}`;
  if (term.select === "set") return `set:${term.setId}`;
  if (term.select === "hole") return `hole:${term.name}`;
  return `resources:${term.refs.map((ref) => `${ref.kind}/${ref.id}`).sort().join(",")}`;
};

export const isWholeProject = (scope: ScopeDraft): boolean =>
  scope.exclude.length === 0 &&
  scope.include.length === 1 &&
  scope.include[0].select === "project";

export const isEmpty = (scope: ScopeDraft): boolean => scope.include.length === 0;

export const holds = (scope: ScopeDraft, side: ScopeSide, term: AnyTerm): boolean =>
  scope[side].some((held) => termKey(held) === termKey(term));

/** Anywhere in the draft, which is what an offer list needs to grey a row out. */
export const heldAnywhere = (scope: ScopeDraft, term: AnyTerm): ScopeSide | undefined => {
  if (holds(scope, "include", term)) return "include";
  if (holds(scope, "exclude", term)) return "exclude";
  return undefined;
};

/**
 * Adding the whole project replaces the include list, because everything else on
 * that side is already inside it and leaving it there reads as a contradiction.
 */
export const withTerm = (scope: ScopeDraft, side: ScopeSide, term: AnyTerm): ScopeDraft => {
  if (holds(scope, side, term)) return scope;
  if (side === "include" && term.select === "project") return { include: [term], exclude: scope.exclude };
  const kept = side === "include" ? scope.include.filter((held) => held.select !== "project") : scope[side];
  return side === "include"
    ? { include: [...kept, term], exclude: scope.exclude }
    : { include: scope.include, exclude: [...scope.exclude, term] };
};

export const withoutTerm = (scope: ScopeDraft, side: ScopeSide, key: string): ScopeDraft => ({
  include: side === "include" ? scope.include.filter((term) => termKey(term) !== key) : scope.include,
  exclude: side === "exclude" ? scope.exclude.filter((term) => termKey(term) !== key) : scope.exclude
});

/** The draft with everything cleared back to the floor. */
export const withWholeProject = (): ScopeDraft => draftOf(undefined);

const isSetTerm = (term: AnyTerm): term is SetTerm => term.select !== "hole";

const isTemplatedTerm = (term: AnyTerm): term is TemplatedTerm => term.select !== "resources";

/** The draft as a concrete set, or undefined when it names a hole. */
export const narrowed = (scope: ScopeDraft): ResourceSet | undefined =>
  scope.include.every(isSetTerm) && scope.exclude.every(isSetTerm)
    ? {
        include: scope.include.filter(isSetTerm).map((term) => ({ ...term })),
        exclude: scope.exclude.filter(isSetTerm).map((term) => ({ ...term }))
      }
    : undefined;

/** The draft as a templated set, or undefined when it names particular resources. */
export const templated = (scope: ScopeDraft): TemplatedResourceSet | undefined =>
  scope.include.every(isTemplatedTerm) && scope.exclude.every(isTemplatedTerm)
    ? {
        include: scope.include.filter(isTemplatedTerm).map((term) => ({ ...term })),
        exclude: scope.exclude.filter(isTemplatedTerm).map((term) => ({ ...term }))
      }
    : undefined;

/**
 * Whether saying this rule needs a row of its own.
 *
 * A variable term is substituted for whatever fills it, and substituting one
 * term for a difference cannot be expressed on the excluding side. So a rule
 * that excludes anything, or that names particular resources, is stored once and
 * referred to by a single `set` term. Everything else is said inline, which is
 * the common case and keeps the table free of rows that say `project`.
 */
export const needsRow = (scope: ScopeDraft): boolean =>
  scope.exclude.length > 0 || scope.include.some((term) => term.select === "resources");

/** Which set ids a scope reaches, following stored sets, so a cycle can be refused. */
export const reaches = (
  scope: ScopeDraft,
  sets: ReadonlyMap<string, ResourceSet>,
  seen: ReadonlySet<string> = new Set()
): ReadonlySet<string> => {
  const found = new Set<string>(seen);
  for (const term of [...scope.include, ...scope.exclude]) {
    if (term.select !== "set" || found.has(term.setId)) continue;
    found.add(term.setId);
    const held = sets.get(term.setId);
    if (held === undefined) continue;
    for (const id of reaches(held, sets, found)) found.add(id);
  }
  return found;
};

/** Whether adding this set to that scope would close a loop, and which set closes it. */
export const closesLoop = (
  scope: ScopeDraft,
  setId: string,
  sets: ReadonlyMap<string, ResourceSet>,
  self?: string
): boolean => {
  if (self !== undefined && setId === self) return true;
  if (self === undefined) return false;
  const held = sets.get(setId);
  return held !== undefined && reaches(held, sets).has(self);
};

export type ScopeNames = {
  /** A stored set's name, by id. A bound row has none, and reads as its own rule. */
  readonly sets?: ReadonlyMap<string, string>;
  /** A resource's title, by id, for a term that names particular ones. */
  readonly resources?: ReadonlyMap<string, string>;
  /** An External resource's exact project-relative location, by id. */
  readonly relativePaths?: ReadonlyMap<string, string>;
};

const countWords = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const termWords = (term: AnyTerm, names: ScopeNames = {}): string => {
  if (term.select === "project") return "everything in the project";
  if (term.select === "kinds") {
    return term.kinds
      .map((kind) => PROJECT_KINDS.find((entry) => entry.kind === kind)?.label ?? kind)
      .join(", ");
  }
  if (term.select === "set") {
    return names.sets?.get(term.setId) ?? "a chosen group";
  }
  if (term.select === "hole") return `whatever ${term.name} holds`;
  if (term.refs.length === 1) {
    const held = names.resources?.get(term.refs[0].id);
    return held ?? "one chosen resource";
  }
  return countWords(term.refs.length, "chosen resource", "chosen resources");
};

const listWords = (terms: readonly AnyTerm[], names: ScopeNames): string => {
  const words = terms.map((term) => termWords(term, names));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
};

const capitalized = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1);

/** One rule, read as a sentence. Every surface that shows a scope shows this. */
export const ruleWords = (scope: ScopeDraft | undefined, names: ScopeNames = {}): string => {
  if (scope === undefined) return "Everything in the project";
  if (scope.include.length === 0) return "Nothing";
  const included = isWholeProject(scope)
    ? "Everything in the project"
    : capitalized(listWords(scope.include, names));
  if (scope.exclude.length === 0) return included;
  return `${included}, minus ${listWords(scope.exclude, names)}`;
};

/**
 * The draft as rows and offers, which is all a component may be handed.
 *
 * Nothing under `components/` may reach this tree, so the arithmetic and the
 * words are done here and the builder is given the result. That is also what
 * keeps the four surfaces saying the same thing: they all call these.
 */

export type ScopeRow = {
  readonly key: string;
  readonly kind: string;
  readonly words: string;
  readonly note: string | null;
};

export type ScopeOffer = {
  readonly key: string;
  readonly label: string;
  readonly note?: string;
  readonly held?: ScopeSide;
  readonly refused?: string;
};

export type NamedResourceRef = ResourceRef extends infer Ref
  ? Ref extends ResourceRef
    ? Ref & { readonly name: string; readonly relativePath: string | null }
    : never
  : never;

export type OfferSource = "kinds" | "sets" | "resources";

export const rowsOf = (
  scope: ScopeDraft,
  side: ScopeSide,
  names: ScopeNames = {}
): readonly ScopeRow[] =>
  scope[side].map((term) => ({
    key: termKey(term),
    kind: term.select,
    words: termWords(term, names),
    note: term.select === "resources" && term.refs.length === 1
      ? (names.relativePaths?.get(term.refs[0].id) ?? null)
      : null
  }));

/** A resource is offered under one key, because a term needs its kind as well. */
export const resourceKey = (ref: ResourceRef): string => `${ref.kind}/${ref.id}`;

/** The term an offer stands for, so a callback can name a key rather than a shape. */
export const termFor = (source: OfferSource, key: string): AnyTerm | undefined => {
  if (source === "kinds") {
    return isResourceSelectorKind(key) ? { select: "kinds", kinds: [key] } : undefined;
  }
  if (source === "sets") return { select: "set", setId: key as never };
  const cut = key.indexOf("/");
  if (cut <= 0) return undefined;
  const ref = { kind: key.slice(0, cut), id: key.slice(cut + 1) };
  return isResourceRef(ref) ? { select: "resources", refs: [ref] } : undefined;
};

const offer = (scope: ScopeDraft, key: string, label: string, note: string | undefined, term: AnyTerm, refused?: string): ScopeOffer => {
  const held = heldAnywhere(scope, term);
  return {
    key,
    label,
    ...(note === undefined ? {} : { note }),
    ...(held === undefined ? {} : { held }),
    ...(refused === undefined ? {} : { refused })
  };
};

export const kindOffers = (scope: ScopeDraft): readonly ScopeOffer[] =>
  PROJECT_KINDS.map((entry) =>
    offer(scope, entry.kind, entry.label, undefined, { select: "kinds", kinds: [entry.kind] })
  );

export const setOffers = (
  scope: ScopeDraft,
  sets: readonly { readonly id: string; readonly name: string }[],
  known: ReadonlyMap<string, ResourceSet>,
  self?: string
): readonly ScopeOffer[] =>
  sets.map((entry) =>
    offer(
      scope,
      entry.id,
      entry.name,
      "set",
      { select: "set", setId: entry.id as never },
      closesLoop(scope, entry.id, known, self) ? "This set already reaches the one being edited" : undefined
    )
  );

export const resourceOffers = (
  scope: ScopeDraft,
  resources: readonly NamedResourceRef[]
): readonly ScopeOffer[] =>
  resources.map((entry) => {
    const ref = admittedNamedReference(entry);
    return offer(scope, resourceKey(ref), entry.name, entry.relativePath ?? entry.kind, {
      select: "resources",
      refs: [ref]
    });
  });

const admittedNamedReference = (entry: NamedResourceRef): ResourceRef => {
  const ref = { kind: entry.kind, id: entry.id };
  if (!isResourceRef(ref)) throw new Error("scope offering contains an invalid resource ref");
  return ref;
};

export type ScopeOffering = {
  /** The project's own named sets. */
  readonly sets?: readonly { readonly id: string; readonly name: string; readonly set: ResourceSet }[];
  /** Everything the project holds, for the count and for naming one directly. */
  readonly resources?: readonly NamedResourceRef[];
  /** The set being edited, when one is, so it cannot be put inside itself. */
  readonly self?: string;
};

export type ScopeView = {
  readonly whole: boolean;
  readonly include: readonly ScopeRow[];
  readonly exclude: readonly ScopeRow[];
  readonly sentence: string;
  readonly count: number;
  readonly preview: readonly { readonly key: string; readonly label: string; readonly note: string }[];
  readonly sources: readonly {
    readonly key: OfferSource;
    readonly label: string;
    readonly placeholder?: string;
    readonly offers: readonly ScopeOffer[];
  }[];
};

/**
 * Everything the builder needs to draw, from a draft and what the project holds.
 *
 * The four surfaces that open a builder call this and pass the result straight
 * through, which is what keeps them saying the same words in the same order.
 */
export const builderView = (scope: ScopeDraft, offering: ScopeOffering = {}): ScopeView => {
  const sets = offering.sets ?? [];
  const resources = offering.resources ?? [];
  const known = new Map(sets.map((entry) => [entry.id, entry.set]));
  const names: ScopeNames = {
    sets: new Map(sets.map((entry) => [entry.id, entry.name])),
    resources: new Map(resources.map((entry) => [entry.id, entry.name])),
    relativePaths: new Map(
      resources.flatMap((entry) =>
        entry.relativePath === null ? [] : [[entry.id, entry.relativePath] as const]
      )
    )
  };
  const catalogue = resources.map(admittedNamedReference);
  const selected = selectedBy(scope, catalogue, known);
  const titles = new Map(resources.map((entry) => [entry.id, entry]));

  return {
    whole: isWholeProject(scope),
    include: rowsOf(scope, "include", names),
    exclude: rowsOf(scope, "exclude", names),
    sentence: ruleWords(scope, names),
    count: selected.length,
    preview: selected.slice(0, 40).map((ref) => ({
      key: resourceKey(ref),
      label: titles.get(ref.id)?.name ?? ref.id,
      note: titles.get(ref.id)?.relativePath ?? ref.kind
    })),
    sources: [
      { key: "kinds", label: "Kinds", offers: kindOffers(scope) },
      {
        key: "sets",
        label: "Sets",
        placeholder: "Search sets…",
        offers: setOffers(scope, sets, known, offering.self)
      },
      {
        key: "resources",
        label: "Resources",
        placeholder: "Search this project…",
        offers: resourceOffers(scope, resources)
      }
    ]
  };
};

/**
 * What a draft selects right now, resolved against the project's catalogue.
 *
 * A variable term contributes nothing, because what fills it is not known here.
 * The count is the point of the builder: a rule with no number beside it is a
 * guess.
 */
export const selectedBy = (
  scope: ScopeDraft,
  catalogue: readonly ResourceRef[],
  sets: ReadonlyMap<string, ResourceSet>
): readonly ResourceRef[] => {
  const keyOf = (ref: ResourceRef) => `${ref.kind} ${ref.id}`;
  const known = new Map(catalogue.map((ref) => [keyOf(ref), ref]));

  const ofTerm = (term: AnyTerm, seen: ReadonlySet<string>): readonly ResourceRef[] => {
    if (term.select === "project") return catalogue;
    if (term.select === "hole") return [];
    if (term.select === "kinds") {
      return catalogue.filter((ref) => term.kinds.some((kind) => kindMatches(kind, ref.kind)));
    }
    if (term.select === "resources") {
      return term.refs.flatMap((ref) => {
        const held = known.get(keyOf(ref));
        return held === undefined ? [] : [held];
      });
    }
    if (seen.has(term.setId)) return [];
    const held = sets.get(term.setId);
    return held === undefined ? [] : ofScope(held, new Set([...seen, term.setId]));
  };

  const union = (terms: readonly AnyTerm[], seen: ReadonlySet<string>): Map<string, ResourceRef> => {
    const found = new Map<string, ResourceRef>();
    for (const term of terms) {
      for (const ref of ofTerm(term, seen)) found.set(keyOf(ref), ref);
    }
    return found;
  };

  const ofScope = (held: ScopeDraft, seen: ReadonlySet<string>): readonly ResourceRef[] => {
    const included = union(held.include, seen);
    const excluded = union(held.exclude, seen);
    return [...included].filter(([key]) => !excluded.has(key)).map(([, ref]) => ref);
  };

  return ofScope(scope, new Set());
};
