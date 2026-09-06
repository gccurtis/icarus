import type { StoreModel, TableRow } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/scope.server";
import type { Actor } from "$representation/data/types/core/actor";

import {
  canonicalRowId,
  recordsIn
} from "$capabilities/templates/api/shared/store";
import {
  bodyOf,
  descriptionOf,
  nameOf,
  requiredId,
  tagsOf,
  templateIdOf,
  variablesOf
} from "$capabilities/templates/api/shared/validation";
import type {
  TemplateDetail,
  TemplateLibraryItem,
  TemplateUnavailable
} from "$capabilities/templates/types/templates";

type Template = TableRow<"templates">;

export type TemplateLookup =
  | { readonly kind: "found"; readonly template: Template }
  | { readonly kind: "missing" }
  | {
      readonly kind: "ambiguous";
      readonly templateId: string;
      readonly detail: string;
    };

export const reportableRevision = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;

const actorOf = (value: unknown, subject: string): Actor => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`templates/${subject}: createdBy is an actor`);
  }
  const actor = value as Record<string, unknown>;
  const only = (fields: readonly string[]): boolean =>
    Object.keys(actor).every((field) => fields.includes(field));
  const identifier = (candidate: unknown): candidate is string =>
    typeof candidate === "string" &&
    candidate === candidate.trim() &&
    candidate.length > 0 &&
    candidate.length <= 500;
  if (actor.kind === "system" && only(["kind"])) return value as Actor;
  if (
    actor.kind === "user" &&
    only(["kind", "userId"]) &&
    identifier(actor.userId)
  ) {
    return value as Actor;
  }
  if (
    actor.kind === "connector" &&
    only(["kind", "connectorId"]) &&
    identifier(actor.connectorId)
  ) {
    return value as Actor;
  }
  if (
    actor.kind === "agent" &&
    only(["kind", "taskId"]) &&
    identifier(actor.taskId)
  ) {
    return value as Actor;
  }
  throw new Error(`templates/${subject}: createdBy is a represented actor`);
};

/** Admit an existing row before any projection or mutation trusts its typed claim. */
export const admitStoredTemplate = (template: Template): Template => {
  const subject = `stored-${template._id}`;
  templateIdOf(template._id, subject);
  requiredId(template.userId, subject, "owner id");
  if (!Number.isFinite(template._creationTime) || template._creationTime < 0) {
    throw new Error(`templates/${subject}: creation time is finite`);
  }
  if (!Number.isSafeInteger(template.revision) || template.revision < 1) {
    throw new Error(`templates/${subject}: revision is safe and positive`);
  }
  if (!Number.isFinite(template.updatedAt) || template.updatedAt < 0) {
    throw new Error(`templates/${subject}: updated time is finite`);
  }

  const name = nameOf(template.name, subject);
  const description =
    template.description === undefined
      ? undefined
      : descriptionOf(template.description, subject);
  const tags = tagsOf(template.tags, subject);
  const body = bodyOf(template.body, subject);
  const variables = variablesOf(template.variables, subject);
  const createdBy = actorOf(template.createdBy, subject);
  const { description: _description, ...withoutDescription } = template;
  return {
    ...withoutDescription,
    name,
    ...(description === undefined ? {} : { description }),
    tags: [...tags],
    body,
    variables: [...variables],
    createdBy
  };
};

export const visibleTemplate = (
  store: StoreModel,
  scope: Scope,
  templateId: string
): TemplateLookup => {
  const matching = recordsIn(store, "templates").filter((row) => row._id === templateId);
  const visible = matching.filter((row) => row.userId === scope.userId);
  if (visible.length === 0) return { kind: "missing" };
  if (matching.length !== 1 || visible.length !== 1) {
    return {
      kind: "ambiguous",
      templateId,
      detail: "more than one stored row claims this template id"
    };
  }
  return { kind: "found", template: visible[0] as unknown as Template };
};

const namedRow = (
  store: StoreModel,
  table: "users" | "connectors" | "agentTasks",
  id: string,
  field: "displayName" | "name" | "title",
  projectId?: string
): string | undefined => {
  const row = recordsIn(store, table).find(
    (candidate) =>
      candidate._id === id && (projectId === undefined || candidate.projectId === projectId)
  );
  const value = row?.[field];
  return typeof value === "string" &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= 160
    ? value
    : undefined;
};

const actorName = (store: StoreModel, scope: Scope, actor: Actor): string => {
  if (actor.kind === "system") return "System";
  if (actor.kind === "user") {
    const member = recordsIn(store, "memberships").some(
      (row) => row.projectId === scope.projectId && row.userId === actor.userId
    );
    return member
      ? (namedRow(store, "users", actor.userId, "displayName") ?? "Someone")
      : "Someone";
  }
  if (actor.kind === "connector") {
    return (
      namedRow(store, "connectors", actor.connectorId, "name", scope.projectId) ??
      "A connector"
    );
  }
  const title = namedRow(store, "agentTasks", actor.taskId, "title", scope.projectId);
  return title === undefined ? "An agent" : `Agent · ${title}`;
};

const usesByTemplate = (store: StoreModel, projectId: string): ReadonlyMap<string, number> => {
  const uses = new Map<string, number>();
  const collect = (rows: readonly Record<string, unknown>[]) => {
    for (const row of rows) {
      if (
        row.projectId !== projectId ||
        typeof row.templateId !== "string" ||
        !/^templates:[^.\s:]+$/.test(row.templateId) ||
        typeof row._creationTime !== "number" ||
        !Number.isFinite(row._creationTime) ||
        row._creationTime < 0
      ) {
        continue;
      }
      uses.set(row.templateId, Math.max(uses.get(row.templateId) ?? 0, row._creationTime));
    }
  };

  collect(recordsIn(store, "documents"));
  collect(recordsIn(store, "slideDecks"));
  collect(recordsIn(store, "spreadsheets"));
  return uses;
};

export const projectLibrary = (
  store: StoreModel,
  scope: Scope
): {
  readonly templates: readonly TemplateLibraryItem[];
  readonly unavailable: readonly TemplateUnavailable[];
} => {
  const uses = usesByTemplate(store, scope.projectId);
  const templates: TemplateLibraryItem[] = [];
  const unavailable: TemplateUnavailable[] = [];
  const rows = recordsIn(store, "templates");
  const idCounts = new Map<string, number>();
  for (const row of rows) {
    const id = canonicalRowId(row._id, "templates");
    if (id !== undefined) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  const visible = rows.filter((row) => row.userId === scope.userId);
  for (const [index, row] of visible.entries()) {
    const id = canonicalRowId(row._id, "templates");
    const reportId =
      typeof row._id === "string" && row._id.length <= 500
        ? row._id
        : `templates:invalid-${index + 1}`;
    if (id !== undefined && (idCounts.get(id) ?? 0) > 1) {
      unavailable.push({
        unavailable: true,
        templateId: id,
        reason: "corrupt",
        detail: "more than one stored row claims this template id"
      });
      continue;
    }
    try {
      const stored = row as unknown as Template;
      const template = admitStoredTemplate(stored);
      templates.push(itemOf(store, scope, template, uses.get(template._id) ?? null));
    } catch (error) {
      unavailable.push({
        unavailable: true,
        templateId: reportId,
        reason: "corrupt",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }
  templates.sort(
    (left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name)
  );
  return { templates, unavailable };
};

const itemOf = (
  store: StoreModel,
  scope: Scope,
  template: Template,
  lastUsedAt: number | null = null
): TemplateLibraryItem => {
  return {
    id: template._id,
    name: template.name,
    ...(template.description === undefined ? {} : { description: template.description }),
    target: template.body.resource,
    availability: "personal",
    tags: template.tags,
    variableCount: template.variables.length,
    createdByName: actorName(store, scope, template.createdBy),
    revision: template.revision,
    updatedAt: template.updatedAt,
    lastUsedAt,
    canEdit: true,
    canDelete: true
  };
};

export const detailOf = (
  store: StoreModel,
  scope: Scope,
  template: Template
): TemplateDetail => {
  const admitted = admitStoredTemplate(template);
  const lastUsedAt = usesByTemplate(store, scope.projectId).get(template._id) ?? null;
  const { variableCount: _variableCount, ...item } = itemOf(
    store,
    scope,
    admitted,
    lastUsedAt
  );
  return { ...item, body: admitted.body, variables: admitted.variables };
};
