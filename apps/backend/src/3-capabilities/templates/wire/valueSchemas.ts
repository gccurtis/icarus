import { TemplateWireError } from "../domain/errors.js";
import type {
  ContextEntry,
  TemplateContextBinding,
  TemplateContextBindings
} from "../domain/model.js";

export const TEMPLATE_WIRE_LIMITS = {
  maxIdentifierBytes: 512,
  maxNameBytes: 512,
  maxDescriptionBytes: 4_096,
  maxBindings: 256,
  maxBindingNameBytes: 512,
  maxSearchBytes: 512,
  maxCursorBytes: 1_024,
  /** Filtering by more kinds than exist is a malformed request, not a broad one. */
  maxKinds: 64,
  maxPageLimit: 200
} as const;

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

export const record = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new TemplateWireError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new TemplateWireError(`${label} contains unexpected field '${unexpected[0]}'`);
  }
};

export const requireIdentifier = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string => {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new TemplateWireError(`${label} must be a non-empty string`);
  }
  if (byteLength(candidate) > TEMPLATE_WIRE_LIMITS.maxIdentifierBytes) {
    throw new TemplateWireError(`${label} exceeds the identifier size limit`);
  }
  return candidate;
};

export const optionalText = (
  value: Record<string, unknown>,
  key: string,
  label: string,
  maxBytes: number
): string | undefined => {
  const candidate = value[key];
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "string") {
    throw new TemplateWireError(`${label} must be a string`);
  }
  if (byteLength(candidate) > maxBytes) {
    throw new TemplateWireError(`${label} exceeds the size limit`);
  }
  return candidate;
};

/**
 * Trimmed at ingress so trailing whitespace cannot produce two catalog entries
 * that read identically. The command digest is taken over the decoded value, so
 * it sees the trimmed form and an exact retry still replays.
 */
export const requireName = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string => {
  const candidate = value[key];
  if (typeof candidate !== "string") {
    throw new TemplateWireError(`${label} must be a string`);
  }
  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    throw new TemplateWireError(`${label} must not be empty`);
  }
  if (byteLength(trimmed) > TEMPLATE_WIRE_LIMITS.maxNameBytes) {
    throw new TemplateWireError(`${label} exceeds the size limit`);
  }
  return trimmed;
};

const decodeContextEntry = (value: unknown, label: string): ContextEntry => {
  const entry = record(value, label);
  exactKeys(entry, ["id", "kind"], label);
  return {
    id: requireIdentifier(entry, "id", `${label} id`),
    kind: requireIdentifier(entry, "kind", `${label} kind`)
  };
};

const decodeTarget = (
  binding: Record<string, unknown>,
  label: string
): { target?: ContextEntry } =>
  // An omitted `target` is meaningful: it says "explicitly unbind". So `{}` is a
  // valid binding and must not be rejected as empty.
  binding.target !== undefined
    ? { target: decodeContextEntry(binding.target, `${label} target`) }
    : {};

/** Registration: declares a parameter, so a `description` belongs here. */
const decodeDeclaredBinding = (value: unknown, label: string): TemplateContextBinding => {
  const binding = record(value, label);
  exactKeys(binding, ["target", "description"], label);
  const description = optionalText(
    binding,
    "description",
    `${label} description`,
    TEMPLATE_WIRE_LIMITS.maxDescriptionBytes
  );
  return {
    ...decodeTarget(binding, label),
    ...(description !== undefined ? { description } : {})
  };
};

/**
 * Instantiation: supplies an argument, not a declaration. Two differences from
 * the declared form, both deliberate.
 *
 * A `description` is rejected rather than ignored — silently dropping an
 * accepted field is the class of bug this split exists to remove.
 *
 * A `target` is **required**. At registration an omitted target declares a
 * parameter with no default; here it would leave the instance holding an unbound
 * variable, which is the state the whole binding rule exists to prevent. An
 * instantiator names every parameter and says what each one points at.
 */
const decodeBindingArgument = (value: unknown, label: string): TemplateContextBinding => {
  const binding = record(value, label);
  exactKeys(binding, ["target"], label);
  if (binding.target === undefined) {
    throw new TemplateWireError(`${label} must supply a target`);
  }
  return { target: decodeContextEntry(binding.target, `${label} target`) };
};

const decodeBindings = (
  value: unknown,
  label: string,
  decodeOne: (value: unknown, label: string) => TemplateContextBinding
): TemplateContextBindings => {
  if (value === undefined) return {};
  const bindings = record(value, label);
  const names = Object.keys(bindings);
  if (names.length > TEMPLATE_WIRE_LIMITS.maxBindings) {
    throw new TemplateWireError(`${label} exceeds the binding limit`);
  }

  const result: Record<string, TemplateContextBinding> = {};
  for (const name of names) {
    if (name.trim().length === 0) {
      throw new TemplateWireError(`${label} contains an empty variable name`);
    }
    if (byteLength(name) > TEMPLATE_WIRE_LIMITS.maxBindingNameBytes) {
      throw new TemplateWireError(`${label} variable name exceeds the size limit`);
    }
    result[name] = decodeOne(bindings[name], `${label} '${name}'`);
  }
  return result;
};

/**
 * Absent and `{}` mean the same thing, so an omitted field is normalised to an
 * empty record and nothing downstream branches on `undefined`.
 */
export const decodeDeclaredBindings = (
  value: unknown,
  label: string
): TemplateContextBindings => decodeBindings(value, label, decodeDeclaredBinding);

export const decodeBindingArguments = (
  value: unknown,
  label: string
): TemplateContextBindings => decodeBindings(value, label, decodeBindingArgument);

/**
 * Duplicates are rejected rather than de-duplicated, on the same principle as
 * `exactKeys`: a request that asks for the same kind twice means something the
 * caller did not intend, and silently tidying it hides that.
 */
export const requireIdentifierList = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string[] => {
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    throw new TemplateWireError(`${label} must be an array`);
  }
  if (candidate.length > TEMPLATE_WIRE_LIMITS.maxKinds) {
    throw new TemplateWireError(`${label} exceeds the size limit`);
  }
  const items = candidate.map((entry, index) =>
    requireIdentifier({ entry }, "entry", `${label}[${index}]`)
  );
  if (new Set(items).size !== items.length) {
    throw new TemplateWireError(`${label} contains a duplicate`);
  }
  return items;
};

export const requirePageLimit = (
  value: Record<string, unknown>,
  key: string,
  label: string
): number => {
  const candidate = value[key];
  if (
    typeof candidate !== "number" ||
    !Number.isSafeInteger(candidate) ||
    candidate < 1 ||
    candidate > TEMPLATE_WIRE_LIMITS.maxPageLimit
  ) {
    throw new TemplateWireError(
      `${label} must be an integer between 1 and ${TEMPLATE_WIRE_LIMITS.maxPageLimit}`
    );
  }
  return candidate;
};

/**
 * Strict rather than `Number(...)`: an absent field would otherwise coerce to
 * NaN and fail a revision comparison as a misleading conflict instead of a 400.
 */
export const requireRevision = (
  value: Record<string, unknown>,
  key: string,
  label: string
): number => {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) {
    throw new TemplateWireError(`${label} must be a non-negative integer`);
  }
  return candidate;
};
