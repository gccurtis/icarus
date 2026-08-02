import { TemplateWireError } from "../domain/errors.js";
import type {
  ContextEntry,
  TemplateContextBinding,
  TemplateContextBindings
} from "../domain/model.js";

export const TEMPLATE_WIRE_LIMITS = {
  maxIdentifierBytes: 512,
  maxDescriptionBytes: 4_096,
  maxTitleBytes: 4_096,
  maxBindings: 256,
  maxBindingNameBytes: 512
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

const decodeContextEntry = (value: unknown, label: string): ContextEntry => {
  const entry = record(value, label);
  exactKeys(entry, ["id", "kind"], label);
  return {
    id: requireIdentifier(entry, "id", `${label} id`),
    kind: requireIdentifier(entry, "kind", `${label} kind`)
  };
};

const decodeBinding = (value: unknown, label: string): TemplateContextBinding => {
  const binding = record(value, label);
  exactKeys(binding, ["entry", "description"], label);

  const description = optionalText(
    binding,
    "description",
    `${label} description`,
    TEMPLATE_WIRE_LIMITS.maxDescriptionBytes
  );

  // An omitted `entry` is meaningful: it says "explicitly unbind". So `{}` is a
  // valid binding and must not be rejected as empty.
  const result: TemplateContextBinding = {
    ...(binding.entry !== undefined
      ? { entry: decodeContextEntry(binding.entry, `${label} entry`) }
      : {}),
    ...(description !== undefined ? { description } : {})
  };
  return result;
};

/**
 * Absent and `{}` mean the same thing, so an omitted field is normalised to an
 * empty record and nothing downstream branches on `undefined`.
 */
export const decodeContextBindings = (
  value: unknown,
  label: string
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
    result[name] = decodeBinding(bindings[name], `${label} '${name}'`);
  }
  return result;
};
