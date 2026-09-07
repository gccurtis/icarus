import type {
  ResourceSet,
  SetTerm,
  TemplatedResourceSet,
  TemplatedTerm
} from "$representation/data/types/core/resource-set";
import type {
  TemplateBody,
  TemplateVariable
} from "$representation/data/types/templates/template";

type Term = SetTerm | TemplatedTerm;
type Scope = { readonly include: readonly Term[]; readonly exclude: readonly Term[] };
type Sides = { readonly same: readonly Term[]; readonly opposite: readonly Term[] };

export type ScopeAnswers = Readonly<Record<string, ResourceSet>>;

export type ResolvedScopes =
  | { readonly accepted: true; readonly body: TemplateBody; readonly undeclared: readonly string[] }
  | { readonly accepted: false; readonly reason: "unsupported-body"; readonly detail: string };

const MAX_TERMS = 10_000;
const OVERFLOW = "template-scope-resolution-overflow";
const DIFFERENCE = "template-scope-difference-is-not-flattenable";
const WHOLE_PROJECT: Scope = { include: [{ select: "project" }], exclude: [] };

const cloneTerm = (term: Term): Term =>
  term.select === "kinds"
    ? { ...term, kinds: [...term.kinds] }
    : term.select === "resources"
      ? { ...term, refs: term.refs.map((ref) => ({ ...ref })) }
      : { ...term };

const cloneScope = (scope: Scope): Scope => ({
  include: scope.include.map(cloneTerm),
  exclude: scope.exclude.map(cloneTerm)
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const variableNamesIn = (body: TemplateBody): readonly string[] => {
  const names = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (!isRecord(value)) return;
    if (value.type === "prompt" && isRecord(value.scope)) {
      for (const side of ["include", "exclude"]) {
        const terms = value.scope[side];
        if (!Array.isArray(terms)) continue;
        for (const term of terms) {
          if (isRecord(term) && term.select === "variable" && typeof term.name === "string") {
            names.add(term.name);
          }
        }
      }
    }
    for (const nested of Object.values(value)) walk(nested);
  };
  walk(body);
  return [...names].sort();
};

export const resolveTemplateScopes = (
  body: TemplateBody,
  variables: readonly TemplateVariable[],
  answers: ScopeAnswers = {}
): ResolvedScopes => {
  const definitions = new Map(variables.map((variable) => [variable.name, variable]));
  const memo = new Map<string, Scope>();
  const undeclared = new Set<string>();
  let emitted = 0;

  const append = (target: Term[], terms: readonly Term[]): void => {
    for (const term of terms) {
      emitted += 1;
      if (emitted > MAX_TERMS) throw new RangeError(OVERFLOW);
      target.push(cloneTerm(term));
    }
  };

  let resolveScope: (scope: Scope, stack: readonly string[]) => Scope;

  const expand = (terms: readonly Term[], stack: readonly string[]): Sides => {
    const same: Term[] = [];
    const opposite: Term[] = [];
    for (const term of terms) {
      if (term.select !== "variable") {
        append(same, [term]);
        continue;
      }
      const answer = answers[term.name];
      if (answer !== undefined) {
        if (answer.exclude.length > 0) throw new Error(DIFFERENCE);
        append(same, answer.include);
        continue;
      }
      const definition = definitions.get(term.name);
      if (definition === undefined) {
        undeclared.add(term.name);
        append(same, [term]);
        continue;
      }
      const rule = definition.default;
      if (rule === undefined || stack.includes(term.name)) {
        append(same, WHOLE_PROJECT.include);
        continue;
      }
      if (rule.exclude.length > 0) throw new Error(DIFFERENCE);
      const cached = memo.get(term.name);
      const resolved =
        cached === undefined ? resolveScope(rule, [...stack, term.name]) : cloneScope(cached);
      if (cached === undefined) memo.set(term.name, cloneScope(resolved));
      append(same, resolved.include);
      append(opposite, resolved.exclude);
    }
    return { same, opposite };
  };

  resolveScope = (scope, stack) => {
    const included = expand(scope.include, stack);
    const excluded = expand(scope.exclude, stack);
    const include: Term[] = [];
    const exclude: Term[] = [];
    append(include, included.same);
    append(include, excluded.opposite);
    append(exclude, included.opposite);
    append(exclude, excluded.same);
    return { include, exclude };
  };

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([field, nested]) => [
        field,
        value.type === "prompt" && field === "scope" && isRecord(nested)
          ? resolveScope(nested as unknown as TemplatedResourceSet, [])
          : walk(nested)
      ])
    );
  };

  try {
    const resolved = walk(body) as TemplateBody;
    return { accepted: true, body: resolved, undeclared: [...undeclared].sort() };
  } catch (error) {
    if (error instanceof Error && error.message === DIFFERENCE) {
      return {
        accepted: false,
        reason: "unsupported-body",
        detail: "a variable answered with exclusions cannot be flattened without changing scope"
      };
    }
    if (error instanceof RangeError && error.message === OVERFLOW) {
      return {
        accepted: false,
        reason: "unsupported-body",
        detail: `template scopes expand beyond ${MAX_TERMS} terms`
      };
    }
    throw error;
  }
};
