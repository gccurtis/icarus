import type { StoreUnitOfWork, TableName } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import {
  isStoredTemplateStage,
  type StoredTemplateStage
} from "$representation/data/behavior/templates/stored-stage";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { PresentationBody } from "$representation/data/types/presentations/body";

import { forgetSemanticResourceFor } from "$capabilities/semantic-overlay/index";
import { rowsOfResource } from "$capabilities/templates/api/shared/scope-rows";
import { canonicalRowId, recordsIn } from "$capabilities/templates/api/shared/store";
import type { TemplateStageTarget } from "$capabilities/templates/types/templates";

export type Stage = StoredTemplateStage;

export type ResourceTable = "documents" | "presentations";

export const stageTitleOf = (name: string): string => `Template · ${name}`.slice(0, 160);

export const resourceTableOf = (target: TemplateStageTarget): ResourceTable =>
  target === "document" ? "documents" : "presentations";

export const stageResourceRef = (
  target: TemplateStageTarget,
  resourceId: string
): Extract<ResourceRef, { kind: "document" | "presentation" }> =>
  target === "document"
    ? { kind: "document", id: asId<"documents">(resourceId) }
    : { kind: "presentation", id: asId<"presentations">(resourceId) };

export const resourceTableOfId = (resourceId: string): ResourceTable | undefined =>
  resourceId.startsWith("documents:")
    ? "documents"
    : resourceId.startsWith("presentations:")
      ? "presentations"
      : undefined;

export const stagesIn = (store: StoreUnitOfWork): readonly Stage[] =>
  recordsIn(store, "templateStages").filter(isStoredTemplateStage);

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
  | { readonly target: "presentation"; readonly revision: number; readonly body: PresentationBody };

export const leaderBodyOf = (
  store: StoreUnitOfWork,
  projectId: string,
  target: TemplateStageTarget,
  resourceId: string
): StageLeader | undefined => {
  const table = target === "document" ? "documentSnapshots" : "presentationSnapshots";
  const found = recordsIn(store, table).find(
    (row) => row.projectId === projectId && row.resourceId === resourceId && row.role === "leader"
  );
  if (found === undefined || typeof found.revision !== "number" || found.body === null) return undefined;
  return target === "document"
    ? { target, revision: found.revision, body: found.body as DocumentBody }
    : { target, revision: found.revision, body: found.body as PresentationBody };
};

const idsOf = <T extends TableName>(rows: readonly Record<string, unknown>[], table: T): Id<T>[] =>
  rows.flatMap((row) => {
    const id = canonicalRowId(row._id, table);
    return id === undefined ? [] : [asId<T>(id)];
  });

export const removeStage = (store: StoreUnitOfWork, stage: Stage): void => {
  const table = resourceTableOf(stage.target);
  const snapshots = stage.target === "document" ? "documentSnapshots" : "presentationSnapshots";
  const changeSets = stage.target === "document" ? "documentChangeSets" : "presentationChangeSets";
  const kind = stage.target === "document" ? "document" : "presentation";
  const ref = stageResourceRef(stage.target, stage.resourceId);

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
  forgetSemanticResourceFor(store, stage.projectId, ref);
  for (const setId of rowsOfResource(store, stage.projectId, ref)) {
    store.remove(`resourceSets.${setId}`);
  }
  if (recordsIn(store, table).some((row) => row._id === stage.resourceId)) {
    store.remove(`${table}.${stage.resourceId}`);
  }
  store.remove(`templateStages.${stage._id}`);
};
