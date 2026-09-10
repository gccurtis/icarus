import { isStoredRowId } from "$representation/data/behavior/core/stored";
import type {
  ExternalFileResourceKind,
  ResourceKind,
  ResourceRef,
  ResourceSelectorKind,
  ExternalFileSubkind
} from "$representation/data/types/core/resource";
import type { TableName } from "$representation/store/tables";

/** A resource kind's subkind separator. `externalFile::image` is under `externalFile`. */
const SUBKIND = "::";

/**
 * Whether `kind` falls under `pattern`, comparing segments rather than raw
 * string prefixes — `externalFile::doc` must not match `externalFile::document`.
 */
export const kindMatches = (pattern: ResourceSelectorKind, kind: ResourceKind): boolean => {
  const patternSegments = pattern.split(SUBKIND);
  const kindSegments = kind.split(SUBKIND);

  return (
    patternSegments.length <= kindSegments.length &&
    patternSegments.every((segment, index) => segment === kindSegments[index])
  );
};

export const RESOURCE_KINDS = [
  "document",
  "slides",
  "spreadsheet",
  "research",
  "finding",
  "connection",
  "externalFile::text",
  "externalFile::code",
  "externalFile::data",
  "externalFile::image",
  "externalFile::audio",
  "externalFile::video",
  "externalFile::unknown"
] as const satisfies readonly ResourceKind[];

export const EXTERNAL_FILE_SUBKINDS = [
  "text",
  "code",
  "data",
  "image",
  "audio",
  "video",
  "unknown"
] as const satisfies readonly ExternalFileSubkind[];

export const RESOURCE_SELECTOR_KINDS = [
  "document",
  "slides",
  "spreadsheet",
  "research",
  "finding",
  "connection",
  "externalFile",
  "externalFile::text",
  "externalFile::code",
  "externalFile::data",
  "externalFile::image",
  "externalFile::audio",
  "externalFile::video",
  "externalFile::unknown"
] as const satisfies readonly ResourceSelectorKind[];

const RESOURCE_TABLES = {
  "document": "documents",
  slides: "slideDecks",
  spreadsheet: "spreadsheets",
  research: "researchThreads",
  finding: "findings",
  connection: "connectors",
  "externalFile::text": "externalFiles",
  "externalFile::code": "externalFiles",
  "externalFile::data": "externalFiles",
  "externalFile::image": "externalFiles",
  "externalFile::audio": "externalFiles",
  "externalFile::video": "externalFiles",
  "externalFile::unknown": "externalFiles"
} as const satisfies Record<ResourceKind, TableName>;

export const isResourceKind = (value: unknown): value is ResourceKind =>
  typeof value === "string" && (RESOURCE_KINDS as readonly string[]).includes(value);

export const isResourceSelectorKind = (value: unknown): value is ResourceSelectorKind =>
  typeof value === "string" && (RESOURCE_SELECTOR_KINDS as readonly string[]).includes(value);

export const isExternalFileSubkind = (value: unknown): value is ExternalFileSubkind =>
  typeof value === "string" && (EXTERNAL_FILE_SUBKINDS as readonly string[]).includes(value);

export const externalFileResourceKind = (subkind: ExternalFileSubkind): ExternalFileResourceKind => {
  if (!isExternalFileSubkind(subkind)) throw new Error("external file subkind is not current");
  return `externalFile::${subkind}`;
};

export const isExternalFileResourceKind = (
  kind: unknown
): kind is ExternalFileResourceKind =>
  isResourceKind(kind) && kind.startsWith("externalFile::");

const fieldsOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    ? value as Record<string, unknown>
    : undefined;

/** Exact current reference admission: closed kind, exact fields, and coherent row namespace. */
export const isResourceRef = (value: unknown): value is ResourceRef => {
  const ref = fieldsOf(value);
  const keys = ref === undefined ? [] : Reflect.ownKeys(ref);
  if (
    ref === undefined ||
    keys.length !== 2 ||
    !keys.every((key): key is string => typeof key === "string") ||
    !keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(ref, key);
      return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
    }) ||
    !Object.hasOwn(ref, "kind") ||
    !Object.hasOwn(ref, "id") ||
    !isResourceKind(ref.kind)
  ) return false;
  return isStoredRowId(ref.id, RESOURCE_TABLES[ref.kind]);
};

export const admitResourceRef = (value: unknown, subject = "resource reference"): ResourceRef => {
  if (!isResourceRef(value)) {
    throw new Error(`${subject} must have exactly one current resource kind and matching row id`);
  }
  return value;
};

export const sameResourceRef = (left: ResourceRef, right: ResourceRef): boolean =>
  left.kind === right.kind && left.id === right.id;
