import type { ServerModel } from "$runtime/server/start.server";
import { externalFileResourceKind } from "$representation/data/behavior/core/resource";
import { admitStoredExternalFile } from "$representation/data/behavior/external/stored-row";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { rowsIn } from "$capabilities/research-chat/api/shared/store";

export type ResearchResource = {
  readonly ref: ResourceRef;
  readonly name: string;
  /** Exact uploaded path for External files; represented resources have no path. */
  readonly relativePath: string | null;
};

/** Exact current resource identities and names exposed to the research tool session. */
export const researchResources = (
  model: ServerModel,
  projectId: Id<"projects">
): readonly ResearchResource[] => [
  ...rowsIn(model.store, "documents")
    .filter((row) => row.projectId === projectId)
    .map((row) => ({
      ref: { kind: "document" as const, id: row._id },
      name: row.title,
      relativePath: null
    })),
  ...rowsIn(model.store, "slideDecks")
    .filter((row) => row.projectId === projectId)
    .map((row) => ({
      ref: { kind: "slides" as const, id: row._id },
      name: row.title,
      relativePath: null
    })),
  ...rowsIn(model.store, "spreadsheets")
    .filter((row) => row.projectId === projectId)
    .map((row) => ({
      ref: { kind: "spreadsheet" as const, id: row._id },
      name: row.title,
      relativePath: null
    })),
  ...rowsIn(model.store, "externalFiles")
    .filter((row) => row.projectId === projectId)
    .map((row) => admitStoredExternalFile(row))
    .map((row) => ({
      ref: { kind: externalFileResourceKind(row.subkind), id: row._id },
      name: row.name,
      relativePath: row.relativePath
    }))
];
