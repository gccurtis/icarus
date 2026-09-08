type Fields = Record<string, unknown>;

export type Portable<T> = { readonly body: T; readonly dropped: readonly string[] };

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const WORDS: Record<string, [string, string]> = {
  formula: ["a formula's project binding", "formulas' project bindings"],
  output: ["a prompt's generated output", "prompts' generated outputs"],
  link: ["a link to something in the project", "links to things in the project"],
  image: ["an image stored in the project", "images stored in the project"],
  background: ["an image background", "image backgrounds"],
  scope: ["a scope term naming project resources", "scope terms naming project resources"],
  value: ["a value bound to the project", "values bound to the project"]
};

const sentence = (counts: ReadonlyMap<string, number>): readonly string[] =>
  [...counts].map(([kind, count]) => {
    const [one, many] = WORDS[kind];
    return count === 1 ? `Dropped ${one}.` : `Dropped ${count} ${many}.`;
  });

const without = (fields: Fields, gone: readonly string[]): Fields =>
  Object.fromEntries(Object.entries(fields).filter(([key]) => !gone.includes(key)));

export const portableBodyOf = <T>(body: T): Portable<T> => {
  const counts = new Map<string, number>();
  const drop = (kind: string): void => {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  };

  const scope = (held: Fields): Fields => {
    const keep = (terms: unknown): unknown[] => {
      if (!Array.isArray(terms)) return [];
      return terms.filter((term) => {
        const portable =
          isRecord(term) &&
          (term.select === "project" || term.select === "kinds" || term.select === "hole");
        if (!portable) drop("scope");
        return portable;
      });
    };
    return { include: keep(held.include), exclude: keep(held.exclude) };
  };

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;

    if (value.kind === "reference" && isRecord(value.target) && value.target.to === "resource") {
      drop("value");
      return { kind: "empty" };
    }
    if (value.kind === "range" && "resourceId" in value) {
      drop("value");
      return { kind: "empty" };
    }
    if (value.kind === "function" && "formulaId" in value) {
      drop("value");
      return { kind: "empty" };
    }
    if (value.kind === "image" && "fileId" in value && "fit" in value) {
      drop("background");
      return undefined;
    }

    let held: Fields = value;
    if ((held.kind === "formula" || held.type === "formula") && "formulaId" in held) {
      drop("formula");
      held = without(held, ["formulaId"]);
    }
    if (held.type === "prompt" && "derivedOutputId" in held) {
      drop("output");
      held = without(held, ["derivedOutputId"]);
    }
    if (
      isRecord(held.link) &&
      (held.link.kind === "actor" || held.link.kind === "persona" || held.link.kind === "resource")
    ) {
      drop("link");
      held = without(held, ["link"]);
    }
    if (
      held.type === "image" &&
      isRecord(held.source) &&
      (held.source.kind === "file" || held.source.kind === "storage")
    ) {
      drop("image");
      held = without(held, ["source"]);
    }

    const next: Fields = {};
    for (const [field, nested] of Object.entries(held)) {
      const walked =
        held.type === "prompt" && field === "scope" && isRecord(nested) ? scope(nested) : walk(nested);
      if (walked !== undefined) next[field] = walked;
    }
    return next;
  };

  return { body: walk(body) as T, dropped: sentence(counts) };
};
