import type { StoreModel } from "$model/server/store/index.server";

export const referenceScope = {
  projectId: "projects:references",
  userId: "users:references",
  username: "Reference Auditor"
};
export const referenceActor = { kind: "user" as const, userId: referenceScope.userId };
export const externalFileId = "externalFiles:reference-target";
export const externalRef = { kind: "externalFile::text" as const, id: externalFileId };
export const referenceSet = {
  include: [{ select: "resources" as const, refs: [externalRef] }],
  exclude: []
};

const editable = { createdBy: referenceActor, updatedBy: referenceActor, updatedAt: 1 };
const investigation = { ...editable, revision: 1 };
const agentRecord = { createdBy: referenceActor, revision: 1, updatedAt: 1 };

export const linkedBlock = (id: string) => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: `${id}:atom`, kind: "literal" as const, text: "source" }],
  display: "source",
  marks: [{
    id: `${id}:mark`,
    from: { atom: `${id}:atom`, offset: 0 },
    to: { atom: `${id}:atom`, offset: 6 },
    link: { kind: "resource" as const, ref: externalRef }
  }]
});

export const populateLiveExternalReferences = (store: StoreModel) => {
  const documentId = store.create("documents", {
    projectId: referenceScope.projectId,
    title: "Linked document",
    ...editable
  });
  store.create("documentSnapshots", {
    projectId: referenceScope.projectId,
    resourceId: documentId,
    revision: 1,
    role: "leader",
    part: 0,
    body: { rows: [{ id: "row", kind: "blocks", blocks: [linkedBlock("doc")] }] },
    at: 1
  });

  const presentationId = store.create("presentations", {
    projectId: referenceScope.projectId,
    title: "Linked presentation",
    ...editable
  });
  store.create("presentationSnapshots", {
    projectId: referenceScope.projectId,
    resourceId: presentationId,
    revision: 1,
    role: "leader",
    part: 0,
    body: {
      aspectRatio: "16:9",
      theme: {
        colors: { text: "#111111", accent: "#3366ff" },
        background: { kind: "image", fileId: externalFileId, fit: "cover" }
      },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [],
      slides: [],
      sections: []
    },
    at: 1
  });

  const spreadsheetId = store.create("spreadsheets", {
    projectId: referenceScope.projectId,
    title: "Linked sheet",
    ...editable
  });
  store.create("sheetCells", {
    projectId: referenceScope.projectId,
    resourceId: spreadsheetId,
    rowOrder: 0,
    rowId: "row",
    columnId: "column",
    value: { kind: "reference", target: { to: "resource", ref: externalRef } }
  });

  store.create("resourceSets", {
    projectId: referenceScope.projectId,
    name: "Linked set",
    set: referenceSet,
    createdBy: referenceActor,
    revision: 1,
    updatedAt: 1
  });
  store.create("findings", {
    projectId: referenceScope.projectId,
    title: "Linked finding",
    body: [],
    sources: [{ kind: "resource", ref: externalRef }],
    evidenceFor: [],
    relatedTo: [],
    researchThreadIds: [],
    ...investigation
  });
  store.create("questions", {
    projectId: referenceScope.projectId,
    text: "Linked question",
    notes: [linkedBlock("question")],
    status: "open",
    relatedTo: [],
    researchThreadIds: [],
    ...investigation
  });
  store.create("hypotheses", {
    projectId: referenceScope.projectId,
    statement: "Linked hypothesis",
    notes: [linkedBlock("hypothesis")],
    assessment: "untested",
    evidence: [],
    relatedTo: [],
    researchThreadIds: [],
    ...investigation
  });

  const commentThreadId = store.create("commentThreads", {
    projectId: referenceScope.projectId,
    target: { kind: "document", id: documentId },
    createdBy: referenceActor,
    updatedAt: 1
  });
  store.create("comments", {
    projectId: referenceScope.projectId,
    threadId: commentThreadId,
    blocks: [],
    mentions: [{ kind: "resource", ref: externalRef }],
    author: referenceActor
  });

  const threadId = store.create("threads", {
    projectId: referenceScope.projectId,
    kind: "researchThread"
  });
  const researchThreadId = store.create("researchThreads", {
    projectId: referenceScope.projectId,
    threadId,
    title: "Linked research",
    mode: { kind: "explore" },
    findingIds: [],
    createdBy: referenceActor,
    updatedAt: 1
  });
  store.create("researchTurns", {
    projectId: referenceScope.projectId,
    researchThreadId,
    threadId,
    promptMessageId: "research-prompt",
    prompt: "Inspect the linked resource",
    mode: { kind: "explore" },
    scope: { kind: "resource", ref: externalRef },
    tools: [],
    state: "answered",
    messageId: "research-answer",
    queries: [],
    sources: [],
    blocks: [],
    findings: [],
    usage: { requests: 1, promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    model: "test-model",
    askedAt: 1,
    updatedAt: 1,
    answeredAt: 1
  });
  store.create("threadParts", {
    projectId: referenceScope.projectId,
    threadId,
    part: 1,
    messages: [{
      id: "linked-message",
      role: "prompt",
      author: referenceActor,
      sentAt: 1,
      blocks: [],
      attachments: [externalRef],
      state: "complete"
    }]
  });

  const personaId = store.create("personas", {
    projectId: referenceScope.projectId,
    name: "Linked persona",
    definition: {
      focus: "External evidence",
      background: "",
      approach: "",
      outputPreferences: "",
      verification: ""
    },
    scope: referenceSet,
    tools: [],
    ...agentRecord
  });
  const agentThreadId = store.create("threads", {
    projectId: referenceScope.projectId,
    kind: "agentTask"
  });
  store.create("agentTasks", {
    projectId: referenceScope.projectId,
    threadId: agentThreadId,
    title: "Linked task",
    instruction: "Review the linked resource",
    personaId,
    scope: referenceSet,
    state: "running",
    execution: { kind: "grounded" },
    tools: [],
    plan: [],
    outputs: [],
    questions: [],
    origin: { kind: "person" },
    startedAt: 1,
    ...agentRecord
  });
  store.create("automations", {
    projectId: referenceScope.projectId,
    name: "Linked automation",
    personaId,
    instruction: "Review edits",
    trigger: { kind: "resource-edited", kinds: ["externalFile"], ref: externalRef },
    tools: [],
    enabled: true,
    firedCount: 0,
    ...agentRecord
  });

  const derivedOutputId = store.create("derivedOutputs", {
    projectId: referenceScope.projectId,
    prompt: "Linked derived output",
    definitionRevision: 1,
    origin: externalRef,
    valueSource: "none",
    queries: [],
    evidence: [],
    state: "idle",
    createdBy: referenceActor,
    updatedAt: 1
  });
  store.create("derivedOutputRefreshJobs", {
    projectId: referenceScope.projectId,
    derivedOutputId,
    selection: { ref: externalRef, from: 0, to: 1 },
    state: "queued",
    requestKey: "linked-refresh",
    requestedVersion: 1,
    attempts: 0,
    queuedAt: 1,
    updatedAt: 1
  });
  store.create("variables", {
    projectId: referenceScope.projectId,
    name: "linked_variable",
    value: { kind: "reference", target: { to: "resource", ref: externalRef } },
    type: "reference",
    createdBy: referenceActor,
    updatedAt: 1
  });
  store.create("formulas", {
    projectId: referenceScope.projectId,
    representation: "LINKED()",
    usedBy: [{ in: "resource", ref: externalRef, path: "rows" }],
    updatedAt: 1
  });
};
