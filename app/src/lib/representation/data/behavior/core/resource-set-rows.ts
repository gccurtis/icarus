import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import {
  admitResourceRef,
  isResourceSelectorKind
} from "$representation/data/behavior/core/resource";
import {
  isStoredActor,
  isStoredIdentifier,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  isStoredTime
} from "$representation/data/behavior/core/stored";
import type {
  BoundTo,
  ResourceSet,
  SetTerm
} from "$representation/data/types/core/resource-set";
import type { TableRow } from "$representation/store/tables";

type Fields = Record<string, unknown>;

export type AdmittedReusableResourceSetRow = TableRow<"resourceSets"> & {
  readonly name: string;
  readonly boundTo?: undefined;
};

export type AdmittedPrivateResourceSetRow = TableRow<"resourceSets"> & {
  readonly name?: undefined;
  readonly boundTo: BoundTo;
};

export type AdmittedResourceSetRow =
  | AdmittedReusableResourceSetRow
  | AdmittedPrivateResourceSetRow;

const MAX_IDENTIFIER_LENGTH = 500;
const MAX_NAME_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 4_000;
const MAX_TERMS_PER_SIDE = 100;
const MAX_KINDS_PER_TERM = 100;
const MAX_REFS_PER_TERM = 1_000;
const MAX_KIND_LENGTH = 160;

const recordOf = (value: unknown, subject: string): Fields => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${subject} is an object`);
  }
  return value as Fields;
};

const exact = (fields: Fields, allowed: readonly string[]): boolean =>
  Object.keys(fields).every((field) => allowed.includes(field));

const canonicalText = (value: unknown, maximum: number): value is string =>
  typeof value === "string" &&
  value === value.trim() &&
  value.length > 0 &&
  value.length <= maximum;

const claimCountsOf = (rows: readonly unknown[]): ReadonlyMap<string, number> => {
  const claims = new Map<string, number>();
  for (const value of rows) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
    const id = (value as Fields)._id;
    if (typeof id === "string") claims.set(id, (claims.get(id) ?? 0) + 1);
  }
  return claims;
};

const rowIdOf = (value: unknown, subject: string): Id<"resourceSets"> => {
  if (!isStoredRowId(value, "resourceSets")) {
    throw new Error(`${subject} has one canonical resourceSets row id`);
  }
  return value as Id<"resourceSets">;
};

const actorOf = (value: unknown, subject: string): Actor => {
  if (isStoredActor(value)) return value;
  throw new Error(`${subject}.createdBy is a represented actor`);
};

const boundToOf = (value: unknown, subject: string): BoundTo => {
  const owner = recordOf(value, `${subject}.boundTo`);
  if (
    owner.kind === "hole" &&
    exact(owner, ["kind", "templateId", "hole"]) &&
    isStoredRowId(owner.templateId, "templates") &&
    canonicalText(owner.hole, MAX_KIND_LENGTH)
  ) {
    return {
      kind: "hole",
      templateId: owner.templateId as Id<"templates">,
      hole: owner.hole
    };
  }
  if (
    owner.kind === "resource" &&
    exact(owner, ["kind", "resourceId", "hole"]) &&
    isStoredIdentifier(owner.resourceId, MAX_IDENTIFIER_LENGTH) &&
    canonicalText(owner.hole, MAX_KIND_LENGTH)
  ) {
    return { kind: "resource", resourceId: owner.resourceId, hole: owner.hole };
  }
  throw new Error(`${subject}.boundTo names exactly one hole or resource`);
};

const termOf = (value: unknown, subject: string): SetTerm => {
  const term = recordOf(value, subject);
  if (term.select === "project" && exact(term, ["select"])) return { select: "project" };
  if (
    term.select === "kinds" &&
    exact(term, ["select", "kinds"]) &&
    Array.isArray(term.kinds) &&
    term.kinds.length > 0 &&
    term.kinds.length <= MAX_KINDS_PER_TERM &&
    term.kinds.every(isResourceSelectorKind) &&
    new Set(term.kinds.map((kind) => kind.toLocaleLowerCase())).size ===
      term.kinds.length
  ) {
    return { select: "kinds", kinds: [...term.kinds] };
  }
  if (
    term.select === "resources" &&
    exact(term, ["select", "refs"]) &&
    Array.isArray(term.refs) &&
    term.refs.length <= MAX_REFS_PER_TERM
  ) {
    return {
      select: "resources",
      refs: term.refs.map((ref, index) => admitResourceRef(ref, `${subject}.refs[${index}]`))
    };
  }
  if (term.select === "set" && exact(term, ["select", "setId"])) {
    return { select: "set", setId: rowIdOf(term.setId, `${subject}.setId`) };
  }
  throw new Error(`${subject} selects project, kinds, resources, or one reusable set`);
};

const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
  const set = recordOf(value, subject);
  if (
    !exact(set, ["include", "exclude"]) ||
    !Array.isArray(set.include) ||
    !Array.isArray(set.exclude) ||
    set.include.length > MAX_TERMS_PER_SIDE ||
    set.exclude.length > MAX_TERMS_PER_SIDE
  ) {
    throw new Error(`${subject} is an include list and an exclude list`);
  }
  return {
    include: set.include.map((term, index) => termOf(term, `${subject}.include[${index}]`)),
    exclude: set.exclude.map((term, index) => termOf(term, `${subject}.exclude[${index}]`))
  };
};

/** Re-admits one complete stored named or private Resource Set row. */
export const admitResourceSetRow = (value: unknown): AdmittedResourceSetRow => {
  if (!isStoredJson(value)) throw new Error("stored resource set is one exact storable object");
  const row = recordOf(value, "stored resource set");
  const id = rowIdOf(row._id, "stored resource set");
  const subject = `stored resource set '${id}'`;
  const fields = [
    "_id",
    "_creationTime",
    "projectId",
    "name",
    "description",
    "boundTo",
    "set",
    "createdBy",
    "revision",
    "updatedAt"
  ];
  const unknown = Object.keys(row).filter((field) => !fields.includes(field));
  if (unknown.length > 0) {
    throw new Error(`${subject} has unknown ${unknown.length === 1 ? "field" : "fields"} ${unknown.join(", ")}`);
  }
  if (!isStoredTime(row._creationTime)) {
    throw new Error(`${subject} has a finite creation time`);
  }
  if (!isStoredRowId(row.projectId, "projects")) {
    throw new Error(`${subject} has one project id`);
  }
  if ((row.name === undefined) === (row.boundTo === undefined)) {
    throw new Error(`${subject} is named reusable storage or owned private storage, never both or neither`);
  }
  if (
    row.description !== undefined &&
    (typeof row.description !== "string" ||
      row.description !== row.description.trim() ||
      row.description.length === 0 ||
      row.description.length > MAX_DESCRIPTION_LENGTH)
  ) {
    throw new Error(`${subject} has a canonical description when present`);
  }
  if (!isStoredNatural(row.revision) || row.revision < 1) {
    throw new Error(`${subject} has a safe positive revision`);
  }
  if (!isStoredTime(row.updatedAt)) {
    throw new Error(`${subject} has a finite updated time`);
  }
  const set = resourceSetOf(row.set, `${subject}.set`);
  const createdBy = actorOf(row.createdBy, subject);
  const common = {
    _id: id,
    _creationTime: row._creationTime as number,
    projectId: row.projectId as Id<"projects">,
    ...(row.description === undefined ? {} : { description: row.description }),
    set,
    createdBy,
    revision: row.revision as number,
    updatedAt: row.updatedAt as number
  };
  if (row.name !== undefined) {
    if (!canonicalText(row.name, MAX_NAME_LENGTH)) {
      throw new Error(`${subject} has one canonical name`);
    }
    return { ...common, name: row.name };
  }
  return { ...common, boundTo: boundToOf(row.boundTo, subject) };
};

/** Exact current resource-set row predicate for Store admission. */
export const isStoredResourceSetRow = (value: unknown): value is TableRow<"resourceSets"> => {
  try {
    admitResourceSetRow(value);
    return true;
  } catch {
    return false;
  }
};

/** Re-admits one stored project-level Resource Set before a generic consumer sees it. */
export const admitReusableResourceSetRow = (
  value: unknown
): AdmittedReusableResourceSetRow => {
  const row = admitResourceSetRow(value);
  if (row.name === undefined) {
    throw new Error(`stored resource set '${row._id}' is private storage, not a reusable set`);
  }
  return row;
};

/** One globally unique, structurally admitted row claiming an exact id. */
export const admittedResourceSetClaim = (
  rows: readonly unknown[],
  setId: string
): AdmittedResourceSetRow | undefined => {
  const matching = rows.filter((value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    return (value as Fields)._id === setId;
  });
  if (matching.length !== 1) return undefined;
  try {
    return admitResourceSetRow(matching[0]);
  } catch {
    return undefined;
  }
};

/** The globally unique, admitted private rows owned inside one project. */
export const admittedPrivateResourceSets = (
  rows: readonly unknown[],
  projectId: string
): ReadonlyMap<string, AdmittedPrivateResourceSetRow> => {
  const claims = claimCountsOf(rows);
  const admitted = new Map<string, AdmittedPrivateResourceSetRow>();
  for (const value of rows) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
    const fields = value as Fields;
    if (
      fields.projectId !== projectId ||
      typeof fields._id !== "string" ||
      claims.get(fields._id) !== 1
    ) continue;
    try {
      const row = admitResourceSetRow(value);
      if (row.name === undefined) admitted.set(row._id, row);
    } catch {
      // Private storage is usable only after its complete represented row is proved.
    }
  }
  return admitted;
};

/**
 * The only named sets generic consumers may index.
 *
 * Every id claimant is counted before admission, so a malformed or foreign
 * duplicate cannot win by row order. Invalid rows are quarantined by omission;
 * a scope that names one is then rejected by the normal missing-set boundary.
 */
export const admittedReusableResourceSets = (
  rows: readonly unknown[],
  projectId: string
): ReadonlyMap<string, AdmittedReusableResourceSetRow> => {
  const claims = claimCountsOf(rows);
  const admitted = new Map<string, AdmittedReusableResourceSetRow>();
  for (const value of rows) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
    const fields = value as Fields;
    if (fields.projectId !== projectId || typeof fields._id !== "string") continue;
    if (claims.get(fields._id) !== 1) continue;
    try {
      const row = admitReusableResourceSetRow(value);
      admitted.set(row._id, row);
    } catch {
      // A corrupt row is data to quarantine, not permission to weaken a query.
    }
  }
  return admitted;
};
