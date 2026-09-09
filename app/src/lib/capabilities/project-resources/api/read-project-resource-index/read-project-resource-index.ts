import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { TableName } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import type { Actor } from "$representation/data/types/core/actor";

import type {
  ProjectResourceIndex,
  ProjectResourceIndexItem,
  ProjectResourceKind,
  ProjectResourceUnavailable
} from "$capabilities/project-resources/types/project-resources";

const rowsIn = (table: TableName): readonly unknown[] => {
  const found = serverModel().store.read(table);
  return found?.kind === "table" && found.table === table && Array.isArray(found.rows)
    ? found.rows
    : [];
};

const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const actorOf = (value: unknown): Actor => {
  const actor = recordOf(value);
  if (actor === undefined) throw new Error("updated actor is represented");
  const exact = (fields: readonly string[]) =>
    Object.keys(actor).every((field) => fields.includes(field));
  if (actor.kind === "system" && exact(["kind"])) return { kind: "system" };
  if (
    actor.kind === "user" &&
    exact(["kind", "userId"]) &&
    typeof actor.userId === "string" &&
    actor.userId.length > 0
  ) {
    return { kind: "user", userId: asId<"users">(actor.userId) };
  }
  if (
    actor.kind === "connector" &&
    exact(["kind", "connectorId"]) &&
    typeof actor.connectorId === "string" &&
    actor.connectorId.length > 0
  ) {
    return { kind: "connector", connectorId: asId<"connectors">(actor.connectorId) };
  }
  if (
    actor.kind === "agent" &&
    exact(["kind", "taskId"]) &&
    typeof actor.taskId === "string" &&
    actor.taskId.length > 0
  ) {
    return { kind: "agent", taskId: asId<"agentTasks">(actor.taskId) };
  }
  throw new Error("updated actor is represented");
};

const namedRow = (
  table: TableName,
  id: string,
  field: string,
  projectId?: string
): string | undefined => {
  const row = rowsIn(table)
    .map(recordOf)
    .find(
      (candidate) =>
        candidate?._id === id && (projectId === undefined || candidate.projectId === projectId)
  );
  const value = row?.[field];
  return typeof value === "string" &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= 160
    ? value
    : undefined;
};

const actorName = (actor: Actor, projectId: string): string => {
  if (actor.kind === "system") return "Icarus";
  if (actor.kind === "user") {
    const isMember = rowsIn("memberships")
      .map(recordOf)
      .some((row) => row?.projectId === projectId && row.userId === actor.userId);
    return isMember ? (namedRow("users", actor.userId, "displayName") ?? "Someone") : "Someone";
  }
  if (actor.kind === "connector") {
    return namedRow("connectors", actor.connectorId, "name", projectId) ?? "A connector";
  }
  const task = namedRow("agentTasks", actor.taskId, "title", projectId);
  return task === undefined ? "An agent" : `Agent · ${task}`;
};

const idOf = (value: unknown, table: TableName): string => {
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    !value.startsWith(`${table}:`) ||
    value.slice(table.length + 1).length === 0 ||
    /[.:\s]/.test(value.slice(table.length + 1))
  ) {
    throw new Error(`${table} id is one canonical row segment`);
  }
  return value;
};

const nameOf = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim() ||
    value.length > 10_000
  ) {
    throw new Error("resource name is bounded canonical text");
  }
  return value;
};

const timeOf = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("resource update time is finite and non-negative");
  }
  return value;
};

export const readProjectResourceIndex = async (): Promise<ProjectResourceIndex> => {
  const scope = await requireScope();
  const resources: ProjectResourceIndexItem[] = [];
  const unavailable: ProjectResourceUnavailable[] = [];

  const staged = new Set(
    rowsIn("templateStages")
      .map(recordOf)
      .filter((row) => row?.projectId === scope.projectId && typeof row.resourceId === "string")
      .map((row) => row?.resourceId as string)
  );

  const collect = (
    table: TableName,
    kind: ProjectResourceKind,
    nameField: "title" | "name",
    actorField: "updatedBy" | "createdBy"
  ) => {
    const rows = rowsIn(table);
    const idCounts = new Map<string, number>();

    for (const value of rows) {
      const row = recordOf(value);
      if (row === undefined) continue;
      try {
        const id = idOf(row._id, table);
        idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
      } catch {
        continue;
      }
    }

    for (const value of rows) {
      const row = recordOf(value);
      if (row === undefined || row.projectId !== scope.projectId) continue;
      if (typeof row._id === "string" && staged.has(row._id)) continue;

      try {
        const id = idOf(row._id, table);
        if (idCounts.get(id) !== 1) throw new Error(`${table} id is unique`);
        const actor = actorOf(row[actorField] ?? row.createdBy);
        resources.push({
          id,
          kind,
          name: nameOf(row[nameField]),
          updatedAt: timeOf(row.updatedAt),
          updatedByName: actorName(actor, scope.projectId)
        });
      } catch (error) {
        unavailable.push({
          resourceId:
            typeof row._id === "string" && row._id.length <= 500
              ? row._id
              : `${table}:invalid`,
          kind,
          reason: "corrupt",
          detail: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };

  collect("documents", "document", "title", "updatedBy");
  collect("slideDecks", "slides", "title", "updatedBy");
  collect("spreadsheets", "spreadsheet", "title", "updatedBy");
  collect("researchThreads", "research", "title", "createdBy");
  collect("externalFiles", "file", "name", "updatedBy");
  collect("findings", "finding", "title", "updatedBy");

  return { resources, unavailable };
};
