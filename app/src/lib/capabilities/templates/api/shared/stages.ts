import type { StoreUnitOfWork, TableName, TableRow } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

import { forgetSemanticResourceFor } from "$capabilities/semantic-overlay/index";
import { rowsOfResource } from "$capabilities/templates/api/shared/scopes";
import { canonicalRowId, recordsIn } from "$capabilities/templates/api/shared/store";
import type { TemplateStageTarget } from "$capabilities/templates/types/templates";

export type Stage = TableRow<"templateStages">;

export type ResourceTable = "documents" | "slideDecks";

export const stageTitleOf = (name: string): string => `Template · ${name}`.slice(0, 160);

export const resourceTableOf = (target: TemplateStageTarget): ResourceTable =>
  target === "document" ? "documents" : "slideDecks";

export const resourceTableOfId = (resourceId: string): ResourceTable | undefined =>
  resourceId.startsWith("documents:")
    ? "documents"
    : resourceId.startsWith("slideDecks:")
      ? "slideDecks"
      : undefined;

const isStageTarget = (value: unknown): value is TemplateStageTarget =>
  value === "document" || value === "slides";

const admittedStage = (row: Record<string, unknown>): Stage | undefined =>
  canonicalRowId(row._id, "templateStages") !== undefined &&
  typeof row.projectId === "string" &&
  typeof row.templateId === "string" &&
  Number.isSafeInteger(row.templateRevision) &&
  isStageTarget(row.target) &&
  typeof row.resourceId === "string" &&
  resourceTableOfId(row.resourceId) === resourceTableOf(row.target)
    ? (row as unknown as Stage)
    : undefined;

export const stagesIn = (store: StoreUnitOfWork): readonly Stage[] =>
  recordsIn(store, "templateStages").flatMap((row) => {
    const stage = admittedStage(row);
    return stage === undefined ? [] : [stage];
  });

export const stageById = (store: StoreUnitOfWork, stageId: string): Stage | undefined =>
  stagesIn(store).find((stage) => stage._id === stageId);

export const stageOf = (
  store: StoreUnitOfWork,
  projectId: string,
  templateId: string
): Stage | undefined =>
  stagesIn(store).find((stage) => stage.projectId === projectId && stage.templateId === templateId);

export const stageOfResource = (
  store: StoreUnitOfWork,
  projectId: string,
  resourceId: string
): Stage | undefined =>
  stagesIn(store).find((stage) => stage.projectId === projectId && stage.resourceId === resourceId);

export const stagedResourceIdsIn = (store: StoreUnitOfWork, projectId: string): ReadonlySet<string> =>
  new Set(
    stagesIn(store)
      .filter((stage) => stage.projectId === projectId)
      .map((stage) => stage.resourceId)
  );

export type StageLeader =
  | { readonly target: "document"; readonly revision: number; readonly body: DocumentBody }
  | { readonly target: "slides"; readonly revision: number; readonly body: SlideDeckBody };

export const leaderBodyOf = (
  store: StoreUnitOfWork,
  projectId: string,
  target: TemplateStageTarget,
  resourceId: string
): StageLeader | undefined => {
  const table = target === "document" ? "documentSnapshots" : "slideDeckSnapshots";
  const found = recordsIn(store, table).find(
    (row) => row.projectId === projectId && row.resourceId === resourceId && row.role === "leader"
  );
  if (found === undefined || typeof found.revision !== "number" || found.body === null) return undefined;
  return target === "document"
    ? { target, revision: found.revision, body: found.body as DocumentBody }
    : { target, revision: found.revision, body: found.body as SlideDeckBody };
};

const idsOf = <T extends TableName>(rows: readonly Record<string, unknown>[], table: T): Id<T>[] =>
  rows.flatMap((row) => {
    const id = canonicalRowId(row._id, table);
    return id === undefined ? [] : [asId<T>(id)];
  });

export const removeStage = (store: StoreUnitOfWork, stage: Stage): void => {
  const table = resourceTableOf(stage.target);
  const snapshots = stage.target === "document" ? "documentSnapshots" : "slideDeckSnapshots";
  const changeSets = stage.target === "document" ? "documentChangeSets" : "slideDeckChangeSets";
  const kind = stage.target === "document" ? "document" : "slides";

  const threads = recordsIn(store, "commentThreads").filter((row) => {
    const target = row.target as Record<string, unknown> | undefined;
    return (
      row.projectId === stage.projectId &&
      target?.kind === kind &&
      target.id === stage.resourceId
    );
  });
  const threadIds = new Set(threads.map((row) => row._id));
  const comments = recordsIn(store, "comments").filter((row) => threadIds.has(row.threadId as string));

  store.removeRows("comments", idsOf(comments, "comments"));
  store.removeRows("commentThreads", idsOf(threads, "commentThreads"));
  store.removeRows(
    changeSets,
    idsOf(
      recordsIn(store, changeSets).filter(
        (row) => row.projectId === stage.projectId && row.resourceId === stage.resourceId
      ),
      changeSets
    )
  );
  store.removeRows(
    snapshots,
    idsOf(
      recordsIn(store, snapshots).filter(
        (row) => row.projectId === stage.projectId && row.resourceId === stage.resourceId
      ),
      snapshots
    )
  );
  forgetSemanticResourceFor(store, stage.projectId, { kind, id: stage.resourceId });
  for (const setId of rowsOfResource(store, stage.projectId, stage.resourceId)) {
    store.remove(`resourceSets.${setId}`);
  }
  if (recordsIn(store, table).some((row) => row._id === stage.resourceId)) {
    store.remove(`${table}.${stage.resourceId}`);
  }
  store.remove(`templateStages.${stage._id}`);
};
