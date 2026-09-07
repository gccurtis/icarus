import type { Scope } from "$runtime/server/scope.server";
import type { StoreModel } from "$model/server/store/index.server";
import type {
  ProjectedFound,
  ProjectedRow,
  ReadableTable
} from "$capabilities/store/types/read";

type Fields = Record<string, unknown>;
type AnyRow = Fields & { readonly _id: string; readonly _creationTime: number };

const INVALID = Symbol("invalid projected value");
const MAX_IDENTIFIER_LENGTH = 500;
const MAX_TEXT_LENGTH = 100_000;
const MAX_COMPOSITE_DEPTH = 30;
const MAX_COMPOSITE_VALUES = 50_000;

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const exact = (value: Fields, fields: readonly string[]): boolean =>
  Object.keys(value).every((field) => fields.includes(field));

const identifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value === value.trim() &&
  value.length > 0 &&
  value.length <= MAX_IDENTIFIER_LENGTH &&
  !/[.\s]/.test(value);

const text = (value: unknown): value is string =>
  typeof value === "string" && value.length <= MAX_TEXT_LENGTH;

const actor = (value: unknown): Fields | typeof INVALID => {
  if (!isRecord(value)) return INVALID;
  if (value.kind === "system" && exact(value, ["kind"])) return { kind: "system" };
  if (
    value.kind === "user" &&
    exact(value, ["kind", "userId"]) &&
    identifier(value.userId)
  ) {
    return { kind: "user", userId: value.userId };
  }
  if (
    value.kind === "connector" &&
    exact(value, ["kind", "connectorId"]) &&
    identifier(value.connectorId)
  ) {
    return { kind: "connector", connectorId: value.connectorId };
  }
  if (
    value.kind === "agent" &&
    exact(value, ["kind", "taskId"]) &&
    identifier(value.taskId)
  ) {
    return { kind: "agent", taskId: value.taskId };
  }
  return INVALID;
};

const resourceRef = (value: unknown): Fields | typeof INVALID => {
  if (
    !isRecord(value) ||
    !exact(value, ["kind", "id"]) ||
    !text(value.kind) ||
    value.kind.length === 0 ||
    !identifier(value.id)
  ) {
    return INVALID;
  }
  return { kind: value.kind, id: value.id };
};

const activityTarget = (value: unknown): Fields | typeof INVALID => {
  if (
    !isRecord(value) ||
    !exact(value, ["kind", "id", "label"]) ||
    !text(value.kind) ||
    value.kind.length === 0 ||
    !identifier(value.id) ||
    !text(value.label)
  ) {
    return INVALID;
  }
  return { kind: value.kind, id: value.id, label: value.label };
};

const nonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const anchorEnd = (value: unknown): Fields | typeof INVALID => {
  if (
    !isRecord(value) ||
    !exact(value, ["atom", "offset"]) ||
    !identifier(value.atom) ||
    !Number.isInteger(value.offset) ||
    Number(value.offset) < 0
  ) {
    return INVALID;
  }
  return { atom: value.atom, offset: value.offset };
};

const textAnchorSpan = (value: unknown): Fields | typeof INVALID => {
  if (!isRecord(value) || !exact(value, ["blockId", "from", "to"]) || !identifier(value.blockId)) {
    return INVALID;
  }
  const from = anchorEnd(value.from);
  const to = anchorEnd(value.to);
  if (from === INVALID || to === INVALID) return INVALID;
  return { blockId: value.blockId, from, to };
};

const anchorWithin = (value: unknown): Fields | typeof INVALID => {
  if (!isRecord(value) || !text(value.kind)) return INVALID;

  if (value.kind === "text" && "spans" in value) {
    if (!exact(value, ["kind", "spans"]) || !Array.isArray(value.spans)) return INVALID;
    const spans: Fields[] = [];
    for (const entry of value.spans) {
      const span = textAnchorSpan(entry);
      if (span === INVALID) return INVALID;
      spans.push(span);
    }
    return { kind: "text", spans };
  }
  if (value.kind === "text") {
    if (!exact(value, ["kind", "blockId", "from", "to"])) return INVALID;
    const span = textAnchorSpan({ blockId: value.blockId, from: value.from, to: value.to });
    return span === INVALID ? INVALID : { kind: "text", ...span };
  }
  if (value.kind === "slide") {
    return exact(value, ["kind", "slideId"]) && identifier(value.slideId)
      ? { kind: "slide", slideId: value.slideId }
      : INVALID;
  }
  if (value.kind === "element") {
    return exact(value, ["kind", "elementId"]) && identifier(value.elementId)
      ? { kind: "element", elementId: value.elementId }
      : INVALID;
  }
  if (value.kind === "cell") {
    return exact(value, ["kind", "rowId", "columnId"]) &&
      identifier(value.rowId) &&
      identifier(value.columnId)
      ? { kind: "cell", rowId: value.rowId, columnId: value.columnId }
      : INVALID;
  }
  return INVALID;
};

const resolution = (value: unknown): Fields | typeof INVALID => {
  if (
    !isRecord(value) ||
    !exact(value, ["by", "at"]) ||
    !identifier(value.by) ||
    !nonNegativeNumber(value.at)
  ) {
    return INVALID;
  }
  return { by: value.by, at: value.at };
};

/**
 * Compatibility consumers still need represented content/value objects. Copy
 * those values rather than forwarding store-owned objects, and fail the whole
 * row if a nested actor or resource link carries fields its represented shape
 * does not own. That is the place credentials hidden under an allowed root field
 * would otherwise cross the projection.
 */
const composite = (value: unknown): unknown | typeof INVALID => {
  let values = 0;
  const walk = (step: unknown, depth: number): unknown | typeof INVALID => {
    values += 1;
    if (values > MAX_COMPOSITE_VALUES || depth > MAX_COMPOSITE_DEPTH) return INVALID;
    if (
      step === null ||
      typeof step === "boolean" ||
      (typeof step === "number" && Number.isFinite(step))
    ) {
      return step;
    }
    if (typeof step === "string") return text(step) ? step : INVALID;
    if (Array.isArray(step)) {
      const projected: unknown[] = [];
      for (const entry of step) {
        const next = walk(entry, depth + 1);
        if (next === INVALID) return INVALID;
        projected.push(next);
      }
      return projected;
    }
    if (!isRecord(step)) return INVALID;

    if (
      step.kind === "system" ||
      ((step.kind === "user" || step.kind === "connector" || step.kind === "agent") &&
        ("userId" in step || "connectorId" in step || "taskId" in step))
    ) {
      return actor(step);
    }
    if (step.kind === "actor" && "actor" in step) {
      if (!exact(step, ["kind", "actor"])) return INVALID;
      const projected = actor(step.actor);
      return projected === INVALID ? INVALID : { kind: "actor", actor: projected };
    }
    if (step.kind === "resource" && "ref" in step) {
      if (!exact(step, ["kind", "ref"])) return INVALID;
      const projected = resourceRef(step.ref);
      return projected === INVALID ? INVALID : { kind: "resource", ref: projected };
    }
    if (step.to === "resource" && "ref" in step) {
      if (!exact(step, ["to", "ref"])) return INVALID;
      const projected = resourceRef(step.ref);
      return projected === INVALID ? INVALID : { to: "resource", ref: projected };
    }

    const projected: [string, unknown][] = [];
    for (const [field, entry] of Object.entries(step)) {
      if (!text(field) || field.length === 0) return INVALID;
      const next = walk(entry, depth + 1);
      if (next === INVALID) return INVALID;
      projected.push([field, next]);
    }
    return Object.fromEntries(projected);
  };
  return walk(value, 0);
};

/**
 * The generic reader is a compatibility projection for current UI consumers,
 * not a way to discover arbitrary representation fields. In particular this
 * omits connector credentials, membership tokens, user auth/settings fields,
 * template provenance, and every authored body/snapshot table.
 */
const READABLE_FIELDS = {
  activity: ["projectId", "actor", "actorLabel", "verb", "target"],
  agentTasks: ["projectId", "title", "personaId"],
  comments: ["projectId", "threadId", "blocks", "mentions", "author"],
  commentThreads: [
    "projectId",
    "target",
    "within",
    "quote",
    "resolution",
    "createdBy",
    "updatedAt"
  ],
  connectors: ["projectId", "name"],
  documents: ["projectId", "title"],
  findings: ["projectId", "title"],
  hypotheses: ["projectId", "statement"],
  memberships: ["projectId", "userId", "role"],
  personas: ["projectId", "name"],
  personaThreads: ["projectId", "title", "personaId"],
  projects: ["name", "description"],
  questions: ["projectId", "text"],
  researchThreads: ["projectId", "title"],
  resourceSets: ["projectId", "name"],
  slideDecks: ["projectId", "title"],
  spreadsheets: ["projectId", "title"],
  users: ["displayName"],
  variables: ["projectId", "name", "value"]
} as const satisfies Record<ReadableTable, readonly string[]>;

const SYSTEM_FIELDS: readonly string[] = ["_id", "_creationTime"];

const fieldsOf = (row: AnyRow): Fields => row as unknown as Fields;

const REQUIRED_FIELDS = {
  activity: ["projectId", "actor", "actorLabel", "verb", "target"],
  agentTasks: ["projectId", "title"],
  comments: ["projectId", "threadId", "blocks", "mentions", "author"],
  commentThreads: ["projectId", "target", "createdBy", "updatedAt"],
  connectors: ["projectId", "name"],
  documents: ["projectId", "title"],
  findings: ["projectId", "title"],
  hypotheses: ["projectId", "statement"],
  memberships: ["projectId", "userId", "role"],
  personas: ["projectId", "name"],
  personaThreads: ["projectId", "title", "personaId"],
  projects: ["name"],
  questions: ["projectId", "text"],
  researchThreads: ["projectId", "title"],
  resourceSets: ["projectId", "name"],
  slideDecks: ["projectId", "title"],
  spreadsheets: ["projectId", "title"],
  users: ["displayName"],
  variables: ["projectId", "name", "value"]
} as const satisfies Record<ReadableTable, readonly string[]>;

const ID_FIELDS = ["projectId", "userId", "threadId", "personaId"] as const;
const TEXT_FIELDS = [
  "actorLabel",
  "description",
  "displayName",
  "name",
  "quote",
  "statement",
  "text",
  "title",
  "verb"
] as const;

const projectedField = (
  table: ReadableTable,
  field: string,
  value: unknown
): unknown | typeof INVALID => {
  if ((ID_FIELDS as readonly string[]).includes(field)) return identifier(value) ? value : INVALID;
  if ((TEXT_FIELDS as readonly string[]).includes(field)) return text(value) ? value : INVALID;
  if (field === "role") {
    return value === "owner" || value === "editor" || value === "viewer" ? value : INVALID;
  }
  if (field === "actor" || field === "author" || field === "createdBy") return actor(value);
  if (field === "target") {
    return table === "activity" ? activityTarget(value) : resourceRef(value);
  }
  if (field === "blocks" || field === "mentions") {
    return Array.isArray(value) ? composite(value) : INVALID;
  }
  if (field === "within") return anchorWithin(value);
  if (field === "resolution") return resolution(value);
  if (field === "updatedAt") return nonNegativeNumber(value) ? value : INVALID;
  if (field === "value") return composite(value);
  return INVALID;
};

const admittedRow = (value: unknown): AnyRow | undefined => {
  if (!isRecord(value) || !identifier(value._id)) return undefined;
  if (
    typeof value._creationTime !== "number" ||
    !Number.isFinite(value._creationTime) ||
    value._creationTime < 0
  ) {
    return undefined;
  }
  return value as AnyRow;
};

const readableFields = (
  table: string
): { readonly table: ReadableTable; readonly fields: readonly string[] } => {
  if (!Object.hasOwn(READABLE_FIELDS, table)) {
    throw new Error(`store/read: '${table}' requires its subject capability`);
  }
  const readable = table as ReadableTable;
  return { table: readable, fields: READABLE_FIELDS[readable] };
};

const valuesIn = (store: Pick<StoreModel, "read">, table: ReadableTable): readonly unknown[] => {
  const found = store.read(table);
  if (found?.kind !== "table" || found.table !== table || !Array.isArray(found.rows)) return [];
  return found.rows as readonly unknown[];
};

const rowsIn = (store: Pick<StoreModel, "read">, table: ReadableTable): readonly AnyRow[] =>
  valuesIn(store, table).flatMap((value) => {
    const row = admittedRow(value);
    return row === undefined ? [] : [row];
  });

/** Every claimant is counted, even when one duplicate has otherwise-corrupt fields. */
const unambiguousRowsIn = (
  store: Pick<StoreModel, "read">,
  table: ReadableTable
): readonly AnyRow[] => {
  const values = valuesIn(store, table);
  const claims = new Map<string, number>();
  for (const value of values) {
    if (!isRecord(value) || !identifier(value._id)) continue;
    claims.set(value._id, (claims.get(value._id) ?? 0) + 1);
  }
  return values.flatMap((value) => {
    const row = admittedRow(value);
    return row !== undefined && claims.get(row._id) === 1 ? [row] : [];
  });
};

/**
 * The users table has no project id. Membership is therefore the boundary for
 * user reads; the scoped viewer is included because resolving the scope has
 * already proved their access even while membership data is being repaired.
 */
const memberIds = (store: Pick<StoreModel, "read">, scope: Scope): ReadonlySet<string> => {
  const ids = new Set<string>([scope.userId]);
  for (const membership of unambiguousRowsIn(store, "memberships")) {
    const fields = fieldsOf(membership);
    if (
      fields.projectId === scope.projectId &&
      identifier(fields.userId) &&
      (fields.role === "owner" || fields.role === "editor" || fields.role === "viewer")
    ) {
      ids.add(fields.userId);
    }
  }
  return ids;
};

const visibleIn = (
  store: Pick<StoreModel, "read">,
  table: ReadableTable,
  scope: Scope
): ((row: AnyRow) => boolean) => {
  if (table === "projects") return (row) => row._id === scope.projectId;
  if (table === "memberships") {
    return (row) => fieldsOf(row).projectId === scope.projectId;
  }
  if (table === "users") {
    const visibleUsers = memberIds(store, scope);
    return (row) => visibleUsers.has(row._id);
  }

  // Every other allowed table has a projectId. Personas are the sole schema
  // exception (their projectId is optional); project-less personas stay hidden
  // until an explicit ownership rule exists for them.
  return (row) => fieldsOf(row).projectId === scope.projectId;
};

const project = <T extends ReadableTable>(
  table: T,
  row: AnyRow,
  allowed: readonly string[]
): ProjectedRow<T> | undefined => {
  const source = fieldsOf(row);
  const visible: Fields = {
    _id: row._id,
    _creationTime: row._creationTime
  };
  for (const field of allowed) {
    if (!Object.hasOwn(source, field)) {
      if (REQUIRED_FIELDS[table].includes(field as never)) return undefined;
      continue;
    }
    const value = projectedField(table, field, source[field]);
    if (value === INVALID) return undefined;
    visible[field] = value;
  }
  return visible as ProjectedRow<T>;
};

/** A discriminated-union member assembled from a runtime-validated table. */
const projectedFound = (value: object): ProjectedFound => value as ProjectedFound;

/**
 * Reads are safe projections of the active project. An inaccessible row looks
 * absent, while unsupported tables and fields fail closed so accidental new
 * callers cannot silently widen this transitional capability.
 */
export const scopedRead = (
  store: Pick<StoreModel, "read">,
  path: string,
  scope: Scope
): ProjectedFound | null => {
  const [untrustedTable, id, ...fields] = path.split(".");
  const { table, fields: allowed } = readableFields(untrustedTable ?? "");
  const rootField = fields[0];
  if (
    rootField !== undefined &&
    !SYSTEM_FIELDS.includes(rootField) &&
    !allowed.includes(rootField)
  ) {
    throw new Error(`store/read: '${table}.${rootField}' requires its subject capability`);
  }
  if (fields.length > 1) {
    throw new Error(`store/read: nested fields require the '${table}' subject capability`);
  }

  const visible = visibleIn(store, table, scope);
  const rows = unambiguousRowsIn(store, table);

  if (id === undefined) {
    return projectedFound({
      table,
      kind: "table",
      rows: rows.flatMap((row) => {
        if (!visible(row)) return [];
        const projected = project(table, row, allowed);
        return projected === undefined ? [] : [projected];
      })
    });
  }

  // Authorize against the complete row before following a requested field
  // path. This keeps a nested read from evading the row's project boundary.
  const row = rows.find((candidate) => candidate._id === id);
  if (row === undefined || !visible(row)) return null;
  const projected = project(table, row, allowed);
  if (projected === undefined) return null;

  if (fields.length === 0) {
    return projectedFound({ table, kind: "row", row: projected });
  }
  const value = (projected as unknown as Fields)[rootField as string];
  return value === undefined
    ? null
    : projectedFound({ table, kind: "field", fields: [rootField as string], value });
};
