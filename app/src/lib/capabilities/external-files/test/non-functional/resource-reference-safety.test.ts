import { describe, expect, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import { EXTERNAL_REFERENCE_POLICY } from "$representation/data/behavior/external/reference-policy";
import {
  externalFileUsage
} from "$capabilities/external-files/api/shared/usage";

const scope = {
  projectId: "projects:references",
  userId: "users:references",
  username: "Reference Auditor"
};
const externalFileId = "externalFiles:reference-target";
const ref = { kind: "externalFile::text", id: externalFileId };
const set = { include: [{ select: "resources", refs: [ref] }], exclude: [] };
const linkedBlock = (id: string) => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}:atom`, kind: "literal", text: "source" }],
  display: "source",
  marks: [{
    id: `${id}:mark`,
    from: { atom: `${id}:atom`, offset: 0 },
    to: { atom: `${id}:atom`, offset: 6 },
    link: { kind: "resource", ref }
  }]
});

describe("complete External resource-reference deletion policy", () => {
  it("classifies every current represented table explicitly", () => {
    expect(Object.values(EXTERNAL_REFERENCE_POLICY)).toContain("live-traversal");
    expect(Object.values(EXTERNAL_REFERENCE_POLICY)).toContain("historical-by-value");
    expect(Object.values(EXTERNAL_REFERENCE_POLICY)).toContain("derived-cache");
    expect(EXTERNAL_REFERENCE_POLICY.externalFiles).toBe("subject");
  });

  it("finds every current live identity-bearing representation family", () => {
    const store = defineStore({ now: () => 100 });

    const documentId = store.create("documents", {
      projectId: scope.projectId, title: "Linked document"
    });
    store.create("documentSnapshots", {
      projectId: scope.projectId,
      resourceId: documentId,
      revision: 1,
      role: "leader",
      part: 0,
      body: { rows: [{ id: "row", kind: "blocks", blocks: [linkedBlock("doc")] }] },
      at: 1
    });

    const deckId = store.create("slideDecks", {
      projectId: scope.projectId, title: "Linked deck"
    });
    store.create("slideDeckSnapshots", {
      projectId: scope.projectId,
      resourceId: deckId,
      revision: 1,
      role: "leader",
      part: 0,
      body: {
        theme: { background: { kind: "image", fileId: externalFileId } },
        layouts: [],
        slides: []
      },
      at: 1
    });

    const spreadsheetId = store.create("spreadsheets", {
      projectId: scope.projectId, title: "Linked sheet"
    });
    store.create("sheetCells", {
      projectId: scope.projectId,
      resourceId: spreadsheetId,
      rowOrder: 0,
      rowId: "row",
      columnId: "column",
      value: { kind: "reference", target: { to: "resource", ref } }
    });

    store.create("templates", {
      projectId: scope.projectId,
      userId: scope.userId,
      name: "Linked template",
      body: { resource: "document", rows: [{ id: "row", kind: "blocks", blocks: [linkedBlock("template")] }] }
    });
    store.create("resourceSets", {
      projectId: scope.projectId, name: "Linked set", set
    });
    store.create("findings", {
      projectId: scope.projectId,
      title: "Linked finding",
      body: [],
      sources: [{ kind: "resource", ref }]
    });
    store.create("questions", {
      projectId: scope.projectId, text: "Linked question", notes: [linkedBlock("question")]
    });
    store.create("hypotheses", {
      projectId: scope.projectId, statement: "Linked hypothesis", notes: [linkedBlock("hypothesis")]
    });
    store.create("commentThreads", {
      projectId: scope.projectId, target: ref
    });
    store.create("comments", {
      projectId: scope.projectId,
      blocks: [],
      mentions: [{ kind: "resource", ref }]
    });
    const researchThreadId = store.create("researchThreads", {
      projectId: scope.projectId, title: "Linked research"
    });
    store.create("researchTurns", {
      projectId: scope.projectId,
      researchThreadId,
      scope: { kind: "resource", ref },
      sources: [],
      blocks: []
    });
    store.create("threadParts", {
      projectId: scope.projectId,
      threadId: "threads:linked",
      messages: [{ blocks: [], attachments: [ref] }]
    });
    store.create("personas", {
      projectId: scope.projectId, name: "Linked persona", scope: set
    });
    store.create("agentTasks", {
      projectId: scope.projectId,
      title: "Linked task",
      scope: set,
      outputs: [],
      origin: { kind: "person" }
    });
    store.create("automations", {
      projectId: scope.projectId,
      name: "Linked automation",
      trigger: { kind: "resource-edited", kinds: ["externalFile"], ref }
    });
    store.create("derivedOutputs", {
      projectId: scope.projectId,
      prompt: "Linked derived output",
      origin: ref
    });
    store.create("derivedOutputRefreshJobs", {
      projectId: scope.projectId,
      derivedOutputId: "derivedOutputs:refresh-linked",
      selection: { ref, from: 0, to: 1 }
    });
    store.create("variables", {
      projectId: scope.projectId,
      name: "linked_variable",
      value: { kind: "reference", target: { to: "resource", ref } }
    });
    store.create("formulas", {
      projectId: scope.projectId,
      representation: "LINKED()",
      usedBy: [{ in: "resource", ref, path: "rows" }]
    });

    const usage = externalFileUsage(store, scope, externalFileId);
    expect(new Set(usage.items.map((item) => item.kind))).toEqual(new Set([
      "document",
      "slide-deck",
      "spreadsheet",
      "template",
      "resource-set",
      "finding",
      "question",
      "hypothesis",
      "comment",
      "research",
      "thread",
      "persona",
      "agent-task",
      "automation",
      "derived-output",
      "variable",
      "formula"
    ]));
    expect(usage.total).toBe(19);
  });

  it("does not block on historical by-value records, semantic caches, or workspace focus", () => {
    const store = defineStore({ now: () => 100 });
    store.create("activity", {
      projectId: scope.projectId,
      target: { kind: "externalFile", id: externalFileId, label: "Deleted file" }
    });
    store.create("documentSnapshots", {
      projectId: scope.projectId,
      resourceId: "documents:historical",
      revision: 1,
      role: "history",
      part: 0,
      body: { rows: [{ id: "row", kind: "blocks", blocks: [linkedBlock("history")] }] },
      at: 1
    });
    store.create("templateVersions", {
      templateId: "templates:historical",
      revision: 1,
      name: "Historical",
      tags: [],
      body: { resource: "document", rows: [{ id: "row", kind: "blocks", blocks: [linkedBlock("version")] }] },
      holes: [],
      at: 1
    });
    store.create("semanticSyncJobs", {
      projectId: scope.projectId,
      ref,
      requestedRevision: 1,
      state: "queued",
      attempts: 0,
      queuedAt: 1,
      updatedAt: 1
    });
    store.create("derivedOutputs", {
      projectId: scope.projectId,
      prompt: "Evidence is a snapshot, not a live edge",
      evidence: [{ source: { ref } }]
    });
    store.create("workspaceSnapshots", {
      projectId: scope.projectId,
      userId: scope.userId,
      revision: 1,
      tabs: [],
      activeId: "external",
      views: { external: { focus: externalFileId } },
      at: 1
    });

    expect(externalFileUsage(store, scope, externalFileId)).toEqual({ total: 0, items: [] });
  });
});
