import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableName
} from "$model/server/store/index.server";

import { storedFields } from "$representation/data/behavior/core/stored";
import { externalFileResourceKind } from "$representation/data/behavior/core/resource";
import {
  storedProjectResource,
  type StoredProjectResource
} from "$representation/data/behavior/project-resources/stored";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { isStoredTemplateStage } from "$representation/data/behavior/templates/stored-stage";

import { projectedActorName } from "$capabilities/project-resources/api/read-project-resource-index/projected-actor";
import type {
  ProjectResourceIndex,
  ProjectResourceIndexItem,
  ProjectResourceKind,
  ProjectResourceUnavailable
} from "$capabilities/project-resources/types/project-resources";

type StoreReads = Pick<StoreUnitOfWork, "read">;

const rowsIn = (store: StoreReads, table: TableName): readonly Record<string, unknown>[] => {
  return readCurrentRows(store, table).flatMap((value) => {
    const row = storedFields(value);
    return row === undefined ? [] : [row];
  });
};

const RESOURCE_TABLES = [
  { table: "documents", kind: "document" },
  { table: "slideDecks", kind: "slides" },
  { table: "spreadsheets", kind: "spreadsheet" },
  { table: "researchThreads", kind: "research" },
  { table: "externalFiles", kind: "file" },
  { table: "findings", kind: "finding" }
] as const satisfies readonly { table: TableName; kind: ProjectResourceKind }[];

const unavailableId = (value: unknown, table: TableName): string =>
  typeof value === "string" && value.length <= 500 ? value : `${table}:invalid`;

const stageState = (
  store: StoreReads,
  projectId: string,
  resourceId: string
): "none" | "staged" | "corrupt" => {
  const rows = rowsIn(store, "templateStages");
  const claims = rows.filter(
    (row) => row.projectId === projectId && row.resourceId === resourceId
  );
  if (claims.length === 0) return "none";
  return claims.length === 1 &&
    rows.filter((row) => row._id === claims[0]._id).length === 1 &&
    isStoredTemplateStage(claims[0])
    ? "staged"
    : "corrupt";
};

const representedRef = (stored: StoredProjectResource): ResourceRef => {
  switch (stored.table) {
    case "documents":
      return { kind: "document", id: stored.row._id };
    case "slideDecks":
      return { kind: "slides", id: stored.row._id };
    case "spreadsheets":
      return { kind: "spreadsheet", id: stored.row._id };
    case "researchThreads":
      return { kind: "research", id: stored.row._id };
    case "externalFiles":
      return { kind: externalFileResourceKind(stored.row.subkind), id: stored.row._id };
    case "findings":
      return { kind: "finding", id: stored.row._id };
  }
};

const projectedItem = (
  store: StoreReads,
  projectId: string,
  kind: ProjectResourceKind,
  stored: StoredProjectResource
): ProjectResourceIndexItem => {
  const name = stored.table === "externalFiles" ? stored.row.name : stored.row.title;
  const actor = stored.table === "researchThreads"
    ? stored.row.createdBy
    : stored.row.updatedBy;
  return {
    id: stored.row._id,
    ref: representedRef(stored),
    kind,
    name,
    relativePath: stored.table === "externalFiles" ? stored.row.relativePath : null,
    updatedAt: stored.row.updatedAt,
    updatedByName: projectedActorName(store, projectId, actor)
  };
};

/** Exact current resource metadata only; malformed scoped claimants are quarantined. */
export const readProjectResourceIndex = async (): Promise<ProjectResourceIndex> => {
  const scope = await requireScope();
  const store = serverModel().store;
  const resources: ProjectResourceIndexItem[] = [];
  const unavailable: ProjectResourceUnavailable[] = [];

  for (const { table, kind } of RESOURCE_TABLES) {
    const rows = rowsIn(store, table);
    const idCounts = new Map<string, number>();
    for (const row of rows) {
      if (typeof row._id !== "string") continue;
      idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
    }

    for (const row of rows) {
      if (row.projectId !== scope.projectId) continue;
      const id = unavailableId(row._id, table);
      const stored = storedProjectResource(row, table);
      const staged = typeof row._id === "string"
        ? stageState(store, scope.projectId, row._id)
        : "none";
      if (stored === undefined || idCounts.get(id) !== 1 || staged === "corrupt") {
        unavailable.push({
          resourceId: id,
          kind,
          reason: "corrupt",
          detail: stored === undefined
            ? "resource does not match the current represented shape"
            : staged === "corrupt"
              ? "resource has an invalid template-stage claimant"
              : `${table} id is unique`
        });
        continue;
      }
      if (staged === "staged") continue;
      resources.push(projectedItem(store, scope.projectId, kind, stored));
    }
  }

  return { resources, unavailable };
};
