import type {
  DerivedTemplateDefinition,
  DerivedVariableResolution
} from "$representation/data/types/semantic/derived-output";

const VARIABLE = /^[A-Za-z][A-Za-z0-9_]*$/;
const PLACEHOLDER = /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g;

const text = (value: unknown, message: string, max: number): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${message} (${max} characters maximum)`);
  return normalized;
};

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
};

/** Validates and copies the browser-authored variable/template definition. */
export const derivedTemplateDefinition = (value: unknown): DerivedTemplateDefinition => {
  const candidate = record(value, "derived output template must be an object");
  const unexpected = Object.keys(candidate).find(
    (key) => key !== "variables" && key !== "output" && key !== "exampleResponse"
  );
  if (unexpected !== undefined) {
    throw new Error(`derived output template has unexpected field '${unexpected}'`);
  }
  if (
    !Array.isArray(candidate.variables) ||
    candidate.variables.length < 1 ||
    candidate.variables.length > 32
  ) {
    throw new Error("derived output template requires 1 through 32 variables");
  }
  const variables = candidate.variables.map((value) => {
    const variable = record(value, "derived output variables must be objects");
    const extra = Object.keys(variable).find((key) => key !== "name" && key !== "prompt");
    if (extra !== undefined) {
      throw new Error(`derived output variable has unexpected field '${extra}'`);
    }
    const name = text(variable.name, "derived output variable name must not be blank", 80);
    if (!VARIABLE.test(name)) {
      throw new Error(
        "derived output variable names must begin with a letter and contain only letters, numbers, or underscores"
      );
    }
    return {
      name,
      prompt: text(variable.prompt, "derived output variable prompt must not be blank", 2_000)
    };
  });
  if (new Set(variables.map((variable) => variable.name)).size !== variables.length) {
    throw new Error("derived output variable names must be unique");
  }

  const output = text(candidate.output, "derived output template text must not be blank", 20_000);
  const names = [...output.matchAll(PLACEHOLDER)].map((match) => match[1]);
  const unmatched = output.replace(PLACEHOLDER, "");
  if (unmatched.includes("{{") || unmatched.includes("}}")) {
    throw new Error("derived output template contains a malformed variable placeholder");
  }
  const defined = new Set(variables.map((variable) => variable.name));
  const unknown = names.find((name) => !defined.has(name));
  if (unknown !== undefined) {
    throw new Error(`derived output template references unknown variable '${unknown}'`);
  }
  const unused = variables.find((variable) => !names.includes(variable.name));
  if (unused !== undefined) {
    throw new Error(`derived output template does not use variable '${unused.name}'`);
  }

  return {
    variables,
    output,
    ...(candidate.exampleResponse === undefined
      ? {}
      : {
          exampleResponse: text(
            candidate.exampleResponse,
            "derived output example response must not be blank",
            20_000
          )
        })
  };
};

/** Substitution is exact and total; unresolved or duplicate values are rejected. */
export const renderDerivedTemplate = (
  template: DerivedTemplateDefinition,
  resolutions: readonly DerivedVariableResolution[]
): string => {
  const values = new Map<string, string>();
  for (const resolution of resolutions) {
    if (values.has(resolution.name)) {
      throw new Error(`derived output resolved variable '${resolution.name}' more than once`);
    }
    values.set(resolution.name, resolution.value);
  }
  const missing = template.variables.find((variable) => !values.has(variable.name));
  if (missing !== undefined) {
    throw new Error(`derived output did not resolve variable '${missing.name}'`);
  }
  return template.output.replace(PLACEHOLDER, (_placeholder, name: string) => values.get(name)!);
};
