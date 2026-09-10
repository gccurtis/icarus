import type { StoreModel } from "$model/server/store/index.server";
import { externalFileResourceKind } from "$representation/data/behavior/core/resource";
import { admitStoredExternalFile } from "$representation/data/behavior/external/stored-row";

import { rowsIn } from "$capabilities/agents/api/shared/store";
import type { ResourceOption } from "$capabilities/agents/types/agents";

/** Exact current External resources visible to one project's agent scopes and triggers. */
export const externalResourceOptionsIn = (
  store: StoreModel,
  projectId: string
): readonly ResourceOption[] => rowsIn(store, "externalFiles")
  .filter((row) => row.projectId === projectId)
  .map((row) => admitStoredExternalFile(row))
  .map((row) => ({
    ref: { kind: externalFileResourceKind(row.subkind), id: row._id },
    name: row.name,
    relativePath: row.relativePath
  }));
