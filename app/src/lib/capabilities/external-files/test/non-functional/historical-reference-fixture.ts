import type { StoreModel } from "$model/server/store/index.server";
import { startingWorkspace } from "$representation/data/behavior/workspace/starting";
import {
  externalFileId,
  externalRef,
  linkedBlock,
  referenceActor,
  referenceScope
} from "$capabilities/external-files/test/non-functional/resource-reference-fixture";

export const populateHistoricalExternalReferences = (store: StoreModel) => {
  store.create("activity", {
    projectId: referenceScope.projectId,
    actor: referenceActor,
    actorLabel: referenceScope.username,
    verb: "deleted",
    target: { kind: "externalFile", id: externalFileId, label: "Deleted file" }
  });
  store.create("documentSnapshots", {
    projectId: referenceScope.projectId,
    resourceId: "documents:historical",
    revision: 1,
    role: "checkpoint",
    part: 0,
    body: { rows: [{ id: "row", kind: "blocks", blocks: [linkedBlock("history")] }] },
    at: 1
  });
  store.create("templateVersions", {
    templateId: "templates:historical",
    revision: 1,
    name: "Historical",
    tags: [],
    body: { resource: "document", rows: [] },
    holes: [{
      name: "source",
      label: "Source",
      kind: "scope",
      default: { include: [{ select: "resources", refs: [externalRef] }], exclude: [] }
    }],
    at: 1
  });
  store.create("semanticSyncJobs", {
    projectId: referenceScope.projectId,
    ref: externalRef,
    requestedRevision: 1,
    state: "queued",
    attempts: 0,
    queuedAt: 1,
    updatedAt: 1
  });
  store.create("derivedOutputs", {
    projectId: referenceScope.projectId,
    prompt: "Evidence is a snapshot, not a live edge",
    definitionRevision: 1,
    valueSource: "generated",
    queries: [],
    evidence: [{
      evidenceKind: "text",
      selections: [{ evidenceId: "historical-evidence", use: "Historical snapshot" }],
      source: { ref: externalRef, revision: 1, encoding: "utf-8" },
      span: { from: 0, to: 1, text: "x" },
      overlayGeneration: 1
    }],
    lastResponse: {
      id: "historical-response",
      type: "text",
      variant: "paragraph",
      atoms: [{
        id: "historical-response:text",
        kind: "literal",
        text: "Historical answer"
      }],
      display: "Historical answer",
      marks: []
    },
    lastRevision: 1,
    lastGeneration: 1,
    refreshedAt: 1,
    state: "fresh",
    createdBy: referenceActor,
    updatedAt: 1
  });
  const starting = startingWorkspace();
  store.create("workspaceSnapshots", {
    projectId: referenceScope.projectId,
    userId: referenceScope.userId,
    revision: 1,
    tabs: starting.tabs,
    activeId: "external",
    views: {
      ...starting.views,
      external: { ...starting.views.external, focus: externalFileId }
    },
    at: 1
  });
};
