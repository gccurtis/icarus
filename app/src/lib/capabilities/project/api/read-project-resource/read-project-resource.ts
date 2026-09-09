import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { StoreModel, TableName } from "$model/server/store/index.server";

import { activityIn, actorOf } from "$capabilities/project/api/shared/projection";
import { projectResourceOf } from "$capabilities/project/api/shared/resources";
import {
  boundedText,
  finiteTime,
  recordOf,
  recordsIn
} from "$capabilities/project/api/shared/store";
import { validateReadProjectResource } from "$capabilities/project/api/read-project-resource/validate-read-project-resource";
import type {
  ProjectResourceFact,
  ProjectResourceKind,
  ReadProjectResourceResult
} from "$capabilities/project/types/project";

const listOf = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

const latestBody = (
  store: StoreModel,
  table: TableName | undefined,
  projectId: string,
  resourceId: string
): Record<string, unknown> | undefined => {
  if (table === undefined) return undefined;
  const snapshots = recordsIn(store, table)
    .filter((row) => row.projectId === projectId && row.resourceId === resourceId)
    .sort((left, right) => {
      const leftLeader = left.role === "leader" ? 1 : 0;
      const rightLeader = right.role === "leader" ? 1 : 0;
      if (leftLeader !== rightLeader) return rightLeader - leftLeader;
      const leftRevision = typeof left.revision === "number" ? left.revision : -1;
      const rightRevision = typeof right.revision === "number" ? right.revision : -1;
      return rightRevision - leftRevision;
    });
  return recordOf(snapshots[0]?.body);
};

const textInBlock = (value: unknown): readonly string[] => {
  const block = recordOf(value);
  if (block === undefined) return [];

  const own = typeof block.display === "string" ? [block.display] : [];
  const cells = listOf(block.rows).flatMap((row) =>
    listOf(recordOf(row)?.cells).flatMap((cell) =>
      listOf(recordOf(cell)?.blocks).flatMap(textInBlock)
    )
  );
  const caption = block.caption === undefined ? [] : textInBlock(block.caption);
  return [...own, ...cells, ...caption];
};

const documentWords = (body: Record<string, unknown> | undefined): number => {
  const text = listOf(body?.rows)
    .flatMap((row) => listOf(recordOf(row)?.blocks).flatMap(textInBlock))
    .join(" ");
  return text.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu)?.length ?? 0;
};

const count = (value: number): string => value.toLocaleString("en-US");

const factsFor = (
  kind: ProjectResourceKind,
  row: Record<string, unknown>,
  body: Record<string, unknown> | undefined,
  discussionCount: number,
  filledCells: number
): readonly ProjectResourceFact[] => {
  const comments = {
    label: "Comments",
    value: count(discussionCount)
  };

  if (kind === "document") {
    return [
      { label: "Words", value: count(documentWords(body)) },
      comments
    ];
  }
  if (kind === "slides") {
    return [
      { label: "Slides", value: count(listOf(body?.slides).length) },
      comments
    ];
  }
  if (kind === "spreadsheet") {
    return [
      { label: "Rows", value: count(listOf(body?.rows).length) },
      { label: "Columns", value: count(listOf(body?.columns).length) },
      { label: "Filled cells", value: count(filledCells) },
      comments
    ];
  }
  if (kind === "research") {
    return [
      { label: "Findings", value: count(listOf(row.findingIds).length) },
      comments
    ];
  }
  return [
    { label: "Sources", value: count(listOf(row.sources).length) },
    {
      label: "Research threads",
      value: count(listOf(row.researchThreadIds).length)
    },
    comments
  ];
};

/** Executive resource context: authored summary, useful counts, provenance, and recent history. */
export const readProjectResource = async (input: unknown): Promise<ReadProjectResourceResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectResource(input);
  const store = serverModel().store;
  const represented = projectResourceOf(store, scope.projectId, asked.resourceId);
  if (represented === undefined) return null;

  const { row, spec } = represented;
  const name = boundedText(row.title, 10_000);
  const createdAt = finiteTime(row._creationTime);
  if (name === undefined || createdAt === undefined) return null;

  const discussionCount = recordsIn(store, "commentThreads").filter((thread) => {
    const target = recordOf(thread.target);
    return thread.projectId === scope.projectId && target?.id === asked.resourceId;
  }).length;
  const filledCells = spec.kind === "spreadsheet"
    ? recordsIn(store, "sheetCells").filter(
        (cell) => cell.projectId === scope.projectId && cell.resourceId === asked.resourceId
      ).length
    : 0;
  const body = latestBody(store, spec.snapshot, scope.projectId, asked.resourceId);

  return {
    id: asked.resourceId,
    kind: spec.kind,
    name,
    createdAt,
    createdBy: actorOf(store, scope, row.createdBy),
    summary: boundedText(row.summary, 1_000) ?? "",
    facts: factsFor(spec.kind, row, body, discussionCount, filledCells),
    recentActivity: activityIn(store, scope)
      .filter((entry) => entry.target.id === asked.resourceId)
      .slice(0, 5),
    openable: spec.kind === "document" || spec.kind === "slides"
  };
};
