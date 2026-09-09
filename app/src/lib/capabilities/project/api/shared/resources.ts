import type { TableName } from "$model/server/store/index.server";

import { recordsIn, type StoreReads } from "$capabilities/project/api/shared/store";
import type { ProjectResourceKind } from "$capabilities/project/types/project";

export type ProjectResourceSpec = {
  readonly table: TableName;
  readonly kind: ProjectResourceKind;
  readonly snapshot?: TableName;
  readonly hasUpdatedBy: boolean;
};

export const PROJECT_RESOURCE_SPECS: readonly ProjectResourceSpec[] = [
  { table: "documents", kind: "document", snapshot: "documentSnapshots", hasUpdatedBy: true },
  { table: "slideDecks", kind: "slides", snapshot: "slideDeckSnapshots", hasUpdatedBy: true },
  { table: "spreadsheets", kind: "spreadsheet", snapshot: "spreadsheetSnapshots", hasUpdatedBy: true },
  { table: "researchThreads", kind: "research", hasUpdatedBy: false },
  { table: "findings", kind: "finding", hasUpdatedBy: true }
];

export type RepresentedProjectResource = {
  readonly spec: ProjectResourceSpec;
  readonly row: Record<string, unknown>;
};

/** Resolve exactly one supported resource inside the already-resolved project. */
export const projectResourceOf = (
  store: StoreReads,
  projectId: string,
  resourceId: string
): RepresentedProjectResource | undefined => {
  const spec = PROJECT_RESOURCE_SPECS.find((candidate) =>
    resourceId.startsWith(`${candidate.table}:`)
  );
  if (spec === undefined) return undefined;

  const rows = recordsIn(store, spec.table).filter(
    (row) => row._id === resourceId && row.projectId === projectId
  );
  return rows.length === 1 ? { spec, row: rows[0] } : undefined;
};
