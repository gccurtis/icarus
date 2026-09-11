import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { textInContentBlocks } from "$representation/data/behavior/content/admission";
import {
  isStoredFinding,
  isStoredResearchThread
} from "$representation/data/behavior/project-resources/stored";
import {
  isStoredSnapshot,
  snapshotTable
} from "$representation/data/behavior/project-resources/stored-snapshot";
import { isStoredSheetCell } from "$representation/data/behavior/spreadsheets/stored-cell";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";

import { projectActor } from "$capabilities/project/api/shared/actors";
import { projectThreadCount } from "$capabilities/project/api/shared/comment-ownership";
import { activityIn } from "$capabilities/project/api/shared/projection";
import {
  projectResourceOf,
  type RepresentedProjectResource
} from "$capabilities/project/api/shared/resources";
import { recordsIn, type StoreReads } from "$capabilities/project/api/shared/store";
import { validateReadProjectResource } from "$capabilities/project/api/read-project-resource/validate-read-project-resource";
import type {
  ProjectResourceFact,
  ReadProjectResourceResult
} from "$capabilities/project/types/project";

type ResourceBody =
  | { readonly kind: "document"; readonly body: DocumentBody }
  | { readonly kind: "presentation"; readonly body: PresentationBody }
  | { readonly kind: "spreadsheet"; readonly body: SpreadsheetBody };

const leaderBody = (
  store: StoreReads,
  resource: RepresentedProjectResource
): ResourceBody | undefined => {
  const table = snapshotTable(resource.spec.snapshot);
  if (table === undefined) return undefined;
  const rows = recordsIn(store, table);
  const claimed = rows.filter(
    (row) =>
      row.projectId === resource.row.projectId &&
      row.resourceId === resource.row._id &&
      row.role === "leader"
  );
  if (
    claimed.length !== 1 ||
    rows.filter((row) => row._id === claimed[0]._id).length !== 1 ||
    !isStoredSnapshot(claimed[0], table)
  ) return undefined;
  if (table === "documentSnapshots" && resource.spec.kind === "document") {
    return { kind: "document", body: claimed[0].body as DocumentBody };
  }
  if (table === "presentationSnapshots" && resource.spec.kind === "presentation") {
    return { kind: "presentation", body: claimed[0].body as PresentationBody };
  }
  if (table === "spreadsheetSnapshots" && resource.spec.kind === "spreadsheet") {
    return { kind: "spreadsheet", body: claimed[0].body as SpreadsheetBody };
  }
  return undefined;
};

const documentWords = (body: DocumentBody): number => {
  const text = body.rows.flatMap((row) =>
    row.kind === "blocks" ? [textInContentBlocks(row.blocks)] : []
  ).join(" ");
  return text.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu)?.length ?? 0;
};

const count = (value: number): string => value.toLocaleString("en-US");

const spreadsheetCellCount = (
  store: StoreReads,
  resource: RepresentedProjectResource,
  body: SpreadsheetBody
): number | undefined => {
  const allCells = recordsIn(store, "sheetCells");
  const idCounts = new Map<unknown, number>();
  for (const row of allCells) idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
  const candidates = allCells.filter(
    (row) => row.projectId === resource.row.projectId && row.resourceId === resource.row._id
  );
  const rows = new Map(body.rows.map((row) => [row.id, row.order]));
  const columns = new Set(body.columns.map((column) => column.id));
  const refExists = (ref: { readonly rowId: string; readonly columnId: string }): boolean =>
    rows.has(ref.rowId) && columns.has(ref.columnId);
  if (
    candidates.some((row) =>
      !isStoredSheetCell(row) ||
      idCounts.get(row._id) !== 1 ||
      rows.get(row.rowId) !== row.rowOrder ||
      !columns.has(row.columnId) ||
      (row.mergedTo !== undefined && !refExists(row.mergedTo)) ||
      (row.spillTo !== undefined && !refExists(row.spillTo))
    )
  ) return undefined;
  return candidates.length;
};

const factsFor = (
  resource: RepresentedProjectResource,
  body: ResourceBody | undefined,
  comments: number,
  filledCells: number
): readonly ProjectResourceFact[] | undefined => {
  const commentFact = { label: "Comments", value: count(comments) };
  if (resource.spec.kind === "document") {
    if (body?.kind !== "document") return undefined;
    return [{ label: "Words", value: count(documentWords(body.body)) }, commentFact];
  }
  if (resource.spec.kind === "presentation") {
    if (body?.kind !== "presentation") return undefined;
    return [{ label: "Slides", value: count(body.body.slides.length) }, commentFact];
  }
  if (resource.spec.kind === "spreadsheet") {
    if (body?.kind !== "spreadsheet") return undefined;
    return [
      { label: "Rows", value: count(body.body.rows.length) },
      { label: "Columns", value: count(body.body.columns.length) },
      { label: "Filled cells", value: count(filledCells) },
      commentFact
    ];
  }
  if (resource.spec.kind === "research") {
    if (!isStoredResearchThread(resource.row)) return undefined;
    return [{ label: "Findings", value: count(resource.row.findingIds.length) }, commentFact];
  }
  if (!isStoredFinding(resource.row)) return undefined;
  return [
    { label: "Sources", value: count(resource.row.sources.length) },
    { label: "Research threads", value: count(resource.row.researchThreadIds.length) },
    commentFact
  ];
};

/** Exact current resource metadata, body-derived facts, and owned nested counts. */
export const readProjectResource = async (input: unknown): Promise<ReadProjectResourceResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectResource(input);
  const store = serverModel().store;
  const resource = projectResourceOf(store, scope.projectId, asked.resourceId);
  if (resource === undefined) return null;

  const body = resource.spec.snapshot === undefined ? undefined : leaderBody(store, resource);
  if (resource.spec.snapshot !== undefined && body === undefined) return null;
  const discussions = projectThreadCount(store, scope.projectId, resource);
  if (discussions === undefined) return null;
  let filledCells = 0;
  if (resource.spec.kind === "spreadsheet") {
    if (body?.kind !== "spreadsheet") return null;
    const admitted = spreadsheetCellCount(store, resource, body.body);
    if (admitted === undefined) return null;
    filledCells = admitted;
  }
  if (filledCells === undefined) return null;
  const facts = factsFor(resource, body, discussions, filledCells);
  if (facts === undefined) return null;

  return {
    id: resource.row._id,
    kind: resource.spec.kind,
    name: resource.row.title,
    createdAt: resource.row._creationTime,
    createdBy: projectActor(store, scope, resource.row.createdBy),
    summary: resource.row.summary ?? "",
    facts,
    recentActivity: activityIn(store, scope)
      .filter((entry) => entry.target.id === asked.resourceId)
      .slice(0, 5),
    openable: resource.spec.kind === "document" || resource.spec.kind === "presentation"
  };
};
