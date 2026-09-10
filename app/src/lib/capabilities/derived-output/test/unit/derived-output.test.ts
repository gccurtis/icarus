import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { createOperationFlights } from "$model/server/operation-flights/index.server";
import type { OperationFlightsModel } from "$model/server/operation-flights/index.server";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type Tool = { name: string; execute(value: unknown): Promise<unknown> };

const state = vi.hoisted(() => {
  const tables = new Map<string, Row[]>();
  const counters = new Map<string, number>();
  const rows = (table: string): Row[] => tables.get(table) ?? [];
  const controls = {
    mode: "normal" as
      | "normal"
      | "no-evidence"
      | "unknown-evidence"
      | "drift"
      | "overlay-drift"
      | "failure"
      | "gate",
    maxRetries: 2,
    defaultTopK: 8,
    intelligenceCalls: 0,
    queryInputs: [] as Record<string, unknown>[],
    retrieveResults: [] as unknown[],
    firstTools: [] as (string | undefined)[],
    userPrompts: [] as string[],
    enqueuedRefs: [] as { kind: string; id: string }[],
    preparationEvents: [] as string[],
    enqueueBlocked: false,
    enqueueStarted: false,
    queueCalls: 0,
    queueFailure: undefined as string | undefined,
    queueFailureRef: {
      kind: "document",
      id: "documents:unrelated-quarantined-resource"
    } as { kind: string; id: string },
    materialQueueFailure: undefined as string | undefined,
    queueBlocked: false,
    queueStarted: false,
    queryBlocked: false,
    queryStarted: false,
    queryOrdinaryAbort: false,
    queuedSourceRevision: undefined as number | undefined,
    release: undefined as (() => void) | undefined
  };
  const store = {
    create: (table: string, fields: unknown): string => {
      const sequence = (counters.get(table) ?? 0) + 1;
      counters.set(table, sequence);
      const id = `${table}:${sequence}`;
      tables.set(table, [
        ...rows(table),
        { ...(fields as Record<string, unknown>), _id: id, _creationTime: sequence }
      ]);
      return id;
    },
    read: (path: string) => {
      const [table] = path.split(".");
      return { table, kind: "table", rows: rows(table) };
    },
    update: (path: string, value: unknown) => {
      const [table, id, ...field] = path.split(".");
      tables.set(
        table,
        rows(table).map((row) => {
          if (row._id !== id) return row;
          if (field.length === 0) {
            return {
              ...(value as Record<string, unknown>),
              _id: row._id,
              _creationTime: row._creationTime
            };
          }
          return { ...row, [field[0]]: value };
        })
      );
    },
    remove: (path: string) => {
      const [table, id] = path.split(".");
      tables.set(table, rows(table).filter((row) => row._id !== id));
    },
    removeRows: (table: string, ids: readonly string[]) => {
      const removed = new Set(ids);
      tables.set(table, rows(table).filter((row) => !removed.has(row._id)));
    },
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T => {
      const beforeTables = structuredClone([...tables.entries()]);
      const beforeCounters = structuredClone([...counters.entries()]);
      try {
        return work(store as unknown as StoreUnitOfWork);
      } catch (error) {
        tables.clear();
        for (const [table, held] of beforeTables) tables.set(table, held);
        counters.clear();
        for (const [table, count] of beforeCounters) counters.set(table, count);
        throw error;
      }
    }
  };
  const source = (): Row => rows("semanticSources")[0];
  const intelligence = {
    completeWithTools: async (input: {
      firstTool?: string;
      user: string;
      tools: readonly Tool[];
    }) => {
      controls.intelligenceCalls += 1;
      controls.firstTools.push(input.firstTool);
      controls.userPrompts.push(input.user);
      if (controls.mode === "failure") throw new Error("apiKey=private-value provider failed");

      const retrieve = input.tools.find((tool) => tool.name === "retrieve");
      if (retrieve === undefined) throw new Error("retrieve tool missing");
      const found = await retrieve.execute({ query: "launch schedule", topK: 3 });
      controls.retrieveResults.push(found);
      const evidenceIds = ((found as { hits: { evidenceId: string }[] }).hits ?? []).map(
        (hit) => hit.evidenceId
      );

      if (controls.mode === "drift") {
        source().revision = Number(source().revision) + 1;
      }
      if (controls.mode === "overlay-drift") {
        rows("semanticOverlays")[0].generation =
          Number(rows("semanticOverlays")[0].generation) + 1;
      }
      if (controls.mode === "gate") {
        await new Promise<void>((resolve) => {
          controls.release = resolve;
        });
      }
      return {
        value:
          controls.mode === "no-evidence" || controls.mode === "overlay-drift"
            ? { status: "insufficient", response: "I cannot answer.", evidence: [] }
            : {
                status: "answered",
                response: " Launch\nis Tuesday. ",
                evidence: [
                  {
                    evidenceId:
                      controls.mode === "unknown-evidence"
                        ? "evidence-never-issued"
                        : evidenceIds[0],
                    use: "Establishes the launch day"
                  }
                ]
              },
        usage: {
          requestCount: 2,
          promptTokens: 20,
          completionTokens: 5,
          totalTokens: 25,
          reasoningTokens: 2,
          costUsd: 0.01
        },
        toolCalls: [{ id: "retrieve-call", name: "retrieve", input: {}, ok: true }],
        rounds: 2
      };
    }
  };
  const model = {
    store,
    intelligence,
    observability: {
      logger: { info: () => {}, warn: () => {} }
    },
    configuration: {
      get: (key: string): unknown =>
        key === "intelligence.agent.maxSourceRetries"
          ? controls.maxRetries
          : key === "intelligence.agent.defaultTopK"
            ? controls.defaultTopK
            : undefined
    },
    operationFlights: undefined as unknown as OperationFlightsModel
  };
  return { tables, counters, rows, controls, store, source, model };
});

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:1", userId: "users:1", username: "You" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => state.model }));
vi.mock("$capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync", () => ({
  enqueueSemanticSync: async (
    input: { ref: { kind: string; id: string } },
    signal?: AbortSignal
  ) => {
    signal?.throwIfAborted();
    state.controls.enqueuedRefs.push(input.ref);
    state.controls.preparationEvents.push(`enqueue:${input.ref.kind}:${input.ref.id}`);
    if (state.controls.enqueueBlocked) {
      state.controls.enqueueStarted = true;
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    signal?.throwIfAborted();
    return { ref: input.ref, revision: 1 };
  }
}));
vi.mock("$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay", () => ({
  querySemanticOverlay: async (input: Record<string, unknown>, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    state.controls.queryInputs.push(input);
    if (state.controls.queryOrdinaryAbort) {
      throw new DOMException("The user cancelled this refresh", "AbortError");
    }
    if (state.controls.queryBlocked) {
      state.controls.queryStarted = true;
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    signal?.throwIfAborted();
    const source = state.source();
    const overlay = state.rows("semanticOverlays")[0];
    const text = "Launch is Tuesday.";
    return {
      overlayGeneration: overlay.generation,
      hits: [
        {
          semanticObjectIds: ["semanticObjects:1"],
          source: {
            ref: source.ref,
            revision: source.revision,
            encoding: source.encoding
          },
          span: { from: 0, to: text.length, text },
          score: 0.97,
          overlayGeneration: overlay.generation
        }
      ],
      usage: [
        {
          operation: "queryVector",
          api: "jina",
          model: "jina-embeddings-v4",
          requestCount: 1,
          inputItems: 1
        }
      ],
      diagnostics: {
        eligibleObjects: 1,
        candidateTarget: 1,
        visitedNodes: 1,
        evaluatedObjects: 1,
        exhausted: true
      }
    };
  }
}));
vi.mock("$capabilities/semantic-overlay/api/query-semantic-materials/query-semantic-materials", () => ({
  querySemanticMaterials: async () => ({
    overlayGeneration: Number(state.rows("semanticOverlays")[0].generation),
    hits: [],
    usage: [],
    diagnostics: {
      eligibleObjects: 0,
      candidateTarget: 0,
      visitedNodes: 0,
      evaluatedObjects: 0,
      exhausted: true
    }
  })
}));
vi.mock("$capabilities/semantic-overlay/api/shared/queue-processor", () => ({
  processSemanticSyncQueueFor: async (
    _model: unknown,
    _projectId: unknown,
    _limit: unknown,
    _ref?: unknown,
    signal?: AbortSignal
  ) => {
    signal?.throwIfAborted();
    state.controls.queueCalls += 1;
    state.controls.preparationEvents.push("drain");
    if (state.controls.queueBlocked) {
      state.controls.queueStarted = true;
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    signal?.throwIfAborted();
    if (state.controls.queuedSourceRevision !== undefined) {
      state.source().revision = state.controls.queuedSourceRevision;
      state.controls.queuedSourceRevision = undefined;
    }
    return {
      processed: [],
      remaining: 0,
      failed:
        state.controls.queueFailure === undefined
          ? []
          : [{
              jobId: "semanticSyncJobs:failed",
              ref: state.controls.queueFailureRef,
              error: state.controls.queueFailure
            }],
      materials: {
        processed: [],
        remaining: 0,
        failed:
          state.controls.materialQueueFailure === undefined
            ? []
            : [{
                jobId: "semanticMaterialJobs:failed",
                ref: state.controls.queueFailureRef,
                error: state.controls.materialQueueFailure
              }]
      }
    };
  }
}));

const { createDerivedOutput } = await import(
  "$capabilities/derived-output/api/create-derived-output/create-derived-output"
);
const { createTemplatedDerivedOutput } = await import(
  "$capabilities/derived-output/api/create-templated-derived-output/create-templated-derived-output"
);
const { readDerivedOutput } = await import(
  "$capabilities/derived-output/api/read-derived-output/read-derived-output"
);
const { readDerivedOutputValue } = await import(
  "$capabilities/derived-output/api/read-derived-output-value/read-derived-output-value"
);
const { updateDerivedOutput } = await import(
  "$capabilities/derived-output/api/update-derived-output/update-derived-output"
);
const { refreshDerivedOutput } = await import(
  "$capabilities/derived-output/api/refresh-derived-output/refresh-derived-output"
);

const seed = (table: string, row: Row): void => {
  state.tables.set(table, [...state.rows(table), row]);
  const sequence = Number(row._id.split(":").at(-1));
  state.counters.set(table, Math.max(state.counters.get(table) ?? 0, sequence));
};

const baseRows = (): void => {
  seed("semanticOverlays", {
    _id: "semanticOverlays:1",
    _creationTime: 1,
    projectId: "projects:1",
    generation: 4,
    embedding: { provider: "jina", model: "jina-embeddings-v4", dimensions: 512 },
    updatedAt: 1
  });
  seed("semanticSources", {
    _id: "semanticSources:1",
    _creationTime: 1,
    projectId: "projects:1",
    ref: { kind: "document", id: "documents:launch-brief" },
    revision: 1,
    encoding: "utf-16",
    updatedAt: 1
  });
};

const textBlock = (text: string) => ({
  id: "old-response",
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: "old-text", kind: "literal" as const, text }],
  display: text,
  marks: []
});

const generatedValue = (
  response = textBlock("Previously generated response"),
  revision = 1,
  generation = 4
) => ({
  valueSource: "generated" as const,
  lastResponse: response,
  lastRevision: revision,
  lastGeneration: generation,
  refreshedAt: 9
});

const editableResourceFields = {
  createdBy: { kind: "system" as const },
  updatedBy: { kind: "system" as const },
  updatedAt: 1
};

const seedOutput = (overrides: Record<string, unknown> = {}): string =>
  state.store.create("derivedOutputs", {
    projectId: "projects:1",
    prompt: "Summarize the launch schedule",
    definitionRevision: 1,
    scope: {
      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
      exclude: []
    },
    valueSource: "none",
    queries: [],
    evidence: [],
    state: "idle",
    createdBy: { kind: "user", userId: "users:1" },
    updatedAt: 10,
    ...overrides
  });

beforeEach(async () => {
  await state.model.operationFlights?.close();
  state.model.operationFlights = createOperationFlights();
  state.tables.clear();
  state.counters.clear();
  state.controls.mode = "normal";
  state.controls.maxRetries = 2;
  state.controls.defaultTopK = 8;
  state.controls.intelligenceCalls = 0;
  state.controls.queryInputs.length = 0;
  state.controls.retrieveResults.length = 0;
  state.controls.firstTools.length = 0;
  state.controls.userPrompts.length = 0;
  state.controls.enqueuedRefs.length = 0;
  state.controls.preparationEvents.length = 0;
  state.controls.enqueueBlocked = false;
  state.controls.enqueueStarted = false;
  state.controls.queueCalls = 0;
  state.controls.queueFailure = undefined;
  state.controls.queueFailureRef = {
    kind: "document",
    id: "documents:unrelated-quarantined-resource"
  };
  state.controls.materialQueueFailure = undefined;
  state.controls.queueBlocked = false;
  state.controls.queueStarted = false;
  state.controls.queryBlocked = false;
  state.controls.queryStarted = false;
  state.controls.queryOrdinaryAbort = false;
  state.controls.queuedSourceRevision = undefined;
  state.controls.release = undefined;
  baseRows();
});

describe("Derived Output lifecycle", () => {
  it("creates a project-scoped idle definition after validating its input", async () => {
    const created = await createDerivedOutput({
      prompt: "  Find the launch date  ",
      scope: { include: [], exclude: [] }
    });

    assert.equal(created.projectId, "projects:1");
    assert.equal(created.prompt, "Find the launch date");
    assert.deepEqual(created.queries, []);
    assert.deepEqual(created.evidence, []);
    assert.equal(created.state, "idle");
    assert.equal(created.definitionRevision, 1);
    assert.deepEqual(created.createdBy, { kind: "user", userId: "users:1" });
    await assert.rejects(() => createDerivedOutput({ prompt: " " }), /must not be blank/);
  });

  it("refuses private Resource Set pointers at every caller-authored definition boundary", async () => {
    seed("resourceSets", {
      _id: "resourceSets:private",
      _creationTime: 1,
      projectId: "projects:1",
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: "documents:made" },
        hole: "evidence"
      },
      set: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
        exclude: []
      },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });
    const privateScope = {
      include: [{ select: "set" as const, setId: "resourceSets:private" }],
      exclude: []
    };
    const id = seedOutput();
    const before = structuredClone(state.rows("derivedOutputs"));

    await assert.rejects(
      () => createDerivedOutput({ prompt: "Unsafe", scope: privateScope }),
      /not one reusable set/
    );
    await assert.rejects(
      () => createTemplatedDerivedOutput({
        template: {
          variables: [{ name: "answer", prompt: "Find the answer" }],
          output: "{{answer}}"
        },
        scope: privateScope
      }),
      /not one reusable set/
    );
    await assert.rejects(
      () => updateDerivedOutput({
        derivedOutputId: id,
        prompt: "Unsafe update",
        scope: privateScope
      }),
      /not one reusable set/
    );
    assert.deepEqual(state.rows("derivedOutputs"), before);
  });

  it("computes pull-time staleness from cited revisions and ignores unrelated changes", async () => {
    const citation = {
      evidenceKind: "text" as const,
      selections: [{ evidenceId: "evidence-1", use: "Names the launch" }],
      source: {
        ref: { kind: "document", id: "documents:launch-brief" },
        revision: 1,
        encoding: "utf-16" as const
      },
      span: { from: 0, to: 6, text: "Launch" },
      overlayGeneration: 4
    };
    const id = seedOutput({ state: "fresh", ...generatedValue(), evidence: [citation] });
    seed("semanticSources", {
      _id: "semanticSources:2",
      _creationTime: 2,
      projectId: "projects:1",
      ref: { kind: "document", id: "documents:unrelated" },
      revision: 9,
      encoding: "utf-16",
      updatedAt: 1
    });

    assert.equal((await readDerivedOutput({ derivedOutputId: id }))?.effectiveState, "fresh");
    state.rows("semanticSources")[1].revision = 10;
    state.rows("semanticOverlays")[0].generation = 99;
    assert.equal((await readDerivedOutput({ derivedOutputId: id }))?.effectiveState, "fresh");
    state.source().revision = 2;
    const stale = await readDerivedOutput({ derivedOutputId: id });
    assert.equal(stale?.effectiveState, "stale");
    assert.deepEqual(stale?.changedSources, [citation.source]);
    assert.equal((state.rows("derivedOutputs")[0] as Row).state, "fresh");
  });

  it("computes pull-time staleness from native material revisions", async () => {
    seed("documents", {
      _id: "documents:launch-brief",
      _creationTime: 1,
      projectId: "projects:1",
      title: "Launch brief",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    seed("documentSnapshots", {
      _id: "documentSnapshots:1",
      _creationTime: 1,
      projectId: "projects:1",
      resourceId: "documents:launch-brief",
      revision: 1,
      role: "leader",
      part: 0,
      body: { rows: [] },
      at: 1
    });
    seed("semanticMaterials", {
      _id: "semanticMaterials:1",
      _creationTime: 1,
      projectId: "projects:1",
      identityKey: "table-one",
      kind: "table",
      name: "Launch budget",
      source: {
        kind: "resourceContent",
        ref: { kind: "document", id: "documents:launch-brief" },
        revision: 1,
        locator: { kind: "documentBlock", area: "body", rowId: "row", blockPath: ["table"] }
      },
      profile: {
        kind: "table",
        rows: 2,
        columns: 2,
        headerRows: 1,
        headers: ["Item", "Cost"],
        columnsProfile: [],
        mergedRegions: 0,
        sample: [],
        warnings: []
      },
      profileHash: "profile-1",
      contextHash: "context-1",
      revisionKey: "revision:document:documents:launch-brief:1",
      state: "ready",
      updatedAt: 1
    });
    const material = {
      materialId: "semanticMaterials:1",
      kind: "table",
      name: "Launch budget",
      source: {
        kind: "resourceContent",
        ref: { kind: "document", id: "documents:launch-brief" },
        revision: 1,
        locator: { kind: "documentBlock", area: "body", rowId: "row", blockPath: ["table"] }
      },
      profileHash: "profile-1",
      contextHash: "context-1",
      revisionKey: "revision:document:documents:launch-brief:1"
    };
    const citation = {
      evidenceKind: "structured",
      distance: 1,
      selections: [{ evidenceId: "evidence-1", use: "States the budget" }],
      material,
      selection: { kind: "table", rows: [0, 1], columns: [0, 1] },
      value: [["Item", "Cost"], ["Launch", "10"]],
      overlayGeneration: 4
    };
    const id = seedOutput({ state: "fresh", ...generatedValue(), evidence: [citation] });

    const fresh = await readDerivedOutput({ derivedOutputId: id });
    assert.equal(fresh?.effectiveState, "fresh");
    assert.deepEqual(fresh?.changedMaterials, []);
    state.rows("semanticMaterials")[0].revisionKey = "revision:document:documents:launch-brief:2";
    const stale = await readDerivedOutput({ derivedOutputId: id });
    assert.equal(stale?.effectiveState, "stale");
    assert.deepEqual(stale?.changedMaterials, [material]);
  });

  it("edits the definition by marking a prior response stale without erasing it", async () => {
    const previous = textBlock("Old grounded response");
    const id = seedOutput({ state: "fresh", ...generatedValue(previous, 2) });

    const updated = await updateDerivedOutput({
      derivedOutputId: id,
      prompt: "Use the revised question"
    });
    assert.equal(updated?.state, "stale");
    assert.deepEqual(updated?.lastResponse, previous);
    assert.deepEqual(updated?.scope, {
      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
      exclude: []
    });

    const concurrentEdit = await updateDerivedOutput({
      derivedOutputId: id,
      prompt: "Another edit"
    });
    assert.equal(concurrentEdit?.prompt, "Another edit");
    assert.equal(concurrentEdit?.definitionRevision, 3);
    assert.equal(concurrentEdit?.state, "stale");
  });

  it("stores a user-edited response as ungrounded continuity for the next refresh", async () => {
    const previous = textBlock("Old grounded response");
    const id = seedOutput({
      state: "fresh",
      ...generatedValue(previous, 2),
      evidence: [
        {
          evidenceKind: "text",
          selections: [{ evidenceId: "old-evidence", use: "Old support" }],
          source: {
            ref: { kind: "document", id: "documents:launch-brief" },
            revision: 1,
            encoding: "utf-16"
          },
          span: { from: 0, to: 6, text: "Launch" },
          overlayGeneration: 4
        }
      ]
    });

    const edited = await updateDerivedOutput({
      derivedOutputId: id,
      prompt: "Summarize the launch schedule",
      scope: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
        exclude: []
      },
      lastResponse: "  Keep this\nshape  "
    });

    assert.equal(edited?.lastResponse?.type, "text");
    assert.equal(edited?.lastResponse?.display, "Keep this shape");
    assert.equal(edited?.lastRevision, 3);
    assert.equal(edited?.state, "stale");
    assert.equal(edited?.valueSource, "authored");
    assert.deepEqual(edited?.evidence, []);
    assert.equal(edited?.lastGeneration, undefined);

    await refreshDerivedOutput({ derivedOutputId: id });
    assert.match(state.controls.userPrompts[0], /Keep this shape/);
    assert.match(state.controls.userPrompts[0], /continuity only/);
  });

  it("can explicitly clear an edited continuity response", async () => {
    const id = seedOutput({
      state: "fresh",
      ...generatedValue(textBlock("Remove this response"), 2)
    });

    const updated = await updateDerivedOutput({
      derivedOutputId: id,
      prompt: "Start over from evidence",
      lastResponse: null
    });

    assert.equal(updated?.lastResponse, undefined);
    assert.equal(updated?.state, "stale");
    assert.equal(updated?.valueSource, "none");
    assert.equal(updated?.lastGeneration, undefined);
  });

  it("retrieves text, selects issued evidence, and atomically publishes one revision", async () => {
    const id = seedOutput();
    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "published");
    assert.equal(result?.attempts, 1);
    assert.equal(result?.toolCalls, 1);
    assert.equal(result?.output.state, "fresh");
    assert.equal(result?.output.lastRevision, 1);
    assert.equal(result?.output.lastGeneration, 4);
    assert.equal(result?.output.lastResponse?.type, "text");
    assert.equal(result?.output.lastResponse?.display, "Launch is Tuesday.");
    assert.deepEqual(result?.output.queries, ["launch schedule"]);
    const evidence = result?.output.evidence[0];
    assert.ok(evidence !== undefined && evidence.evidenceKind === "text");
    assert.equal(evidence.evidenceKind, "text");
    assert.equal(evidence.source.revision, 1);
    assert.equal(evidence.span.text, "Launch is Tuesday.");
    assert.deepEqual(evidence.selections, [
      { evidenceId: "evidence-1", use: "Establishes the launch day" }
    ]);
    assert.deepEqual(state.controls.firstTools, ["retrieve"]);
    assert.equal(JSON.stringify(state.controls.retrieveResults).includes("Launch is Tuesday"), true);
    assert.deepEqual(state.controls.queryInputs[0].scope, {
      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
      exclude: []
    });
  });

  it("executes a resource-owned private scope as concrete without rewriting its stored pointer", async () => {
    const id = seedOutput({
      origin: { kind: "document", id: "documents:made" },
      scope: {
        include: [{ select: "set", setId: "resourceSets:placed" }],
        exclude: []
      }
    });
    seed("resourceSets", {
      _id: "resourceSets:placed",
      _creationTime: 1,
      projectId: "projects:1",
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: "documents:made" },
        hole: "source_material"
      },
      set: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
        exclude: []
      },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "published");
    assert.deepEqual(state.controls.queryInputs[0].scope, {
      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
      exclude: []
    });
    assert.deepEqual(state.rows("derivedOutputs")[0].scope, {
      include: [{ select: "set", setId: "resourceSets:placed" }],
      exclude: []
    });
  });

  it("treats refresh as a no-op when the published answer and its evidence are current", async () => {
    const id = seedOutput({
      state: "fresh",
      ...generatedValue(textBlock("Launch is Tuesday.")),
      evidence: [{
        evidenceKind: "text",
        selections: [{ evidenceId: "evidence-1", use: "Establishes the launch day" }],
        source: {
          ref: { kind: "document", id: "documents:launch-brief" },
          revision: 1,
          encoding: "utf-16"
        },
        span: { from: 0, to: 19, text: "Launch is Tuesday." },
        overlayGeneration: 4
      }]
    });

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "current");
    assert.equal(result?.attempts, 0);
    assert.equal(result?.toolCalls, 0);
    assert.equal(result?.usage.providerRequests, 0);
    assert.equal(state.controls.intelligenceCalls, 0);
    assert.equal(result?.output.lastRevision, 1);
    assert.equal(state.controls.queueCalls, 1);
  });

  it("drains pending semantic work before deciding that a response is current", async () => {
    const id = seedOutput({
      state: "fresh",
      ...generatedValue(textBlock("Launch is Tuesday.")),
      evidence: [{
        evidenceKind: "text",
        selections: [{ evidenceId: "evidence-1", use: "Establishes the launch day" }],
        source: {
          ref: { kind: "document", id: "documents:launch-brief" },
          revision: 1,
          encoding: "utf-16"
        },
        span: { from: 0, to: 19, text: "Launch is Tuesday." },
        overlayGeneration: 4
      }]
    });
    state.controls.queuedSourceRevision = 2;

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "published");
    assert.equal(state.controls.queueCalls, 1);
    assert.equal(state.controls.intelligenceCalls, 1);
    const evidence = result?.output.evidence[0];
    assert.ok(evidence !== undefined && evidence.evidenceKind === "text");
    assert.equal(evidence.source.revision, 2);
  });

  it("enqueues every current indexable in-scope resource before draining", async () => {
    seed("documents", {
      _id: "documents:launch",
      _creationTime: 1,
      projectId: "projects:1",
      title: "Launch brief",
      ...editableResourceFields
    });
    seed("slideDecks", {
      _id: "slideDecks:board",
      _creationTime: 1,
      projectId: "projects:1",
      title: "Board update",
      ...editableResourceFields
    });
    seed("spreadsheets", {
      _id: "spreadsheets:forecast",
      _creationTime: 1,
      projectId: "projects:1",
      title: "Forecast",
      ...editableResourceFields
    });
    seed("documents", {
      _id: "documents:foreign",
      _creationTime: 2,
      projectId: "projects:other",
      title: "Foreign",
      ...editableResourceFields
    });
    for (const [suffix, name, mediaType, subkind, hashDigit] of [
      ["brief", "brief.txt", "text/plain", "text", "1"],
      ["source", "source.ts", "text/typescript", "code", "2"],
      ["forecast", "forecast.csv", "text/csv", "data", "3"],
      ["diagram", "diagram.png", "image/png", "image", "4"],
      ["recording", "recording.mp3", "audio/mpeg", "audio", "5"]
    ] as const) {
      const hash = hashDigit.repeat(64);
      seed("externalFiles", {
        _id: `externalFiles:${suffix}`,
        _creationTime: 1,
        projectId: "projects:1",
        name,
        originalName: name,
        relativePath: name,
        mediaType,
        subkind,
        storageId: `_storage:${hash}`,
        hash,
        size: 0,
        origin: { kind: "upload" },
        ...editableResourceFields,
        revision: 1
      });
    }
    const foreignHash = "6".repeat(64);
    seed("externalFiles", {
      _id: "externalFiles:foreign",
      _creationTime: 2,
      projectId: "projects:other",
      name: "foreign.txt",
      originalName: "foreign.txt",
      relativePath: "foreign.txt",
      mediaType: "text/plain",
      subkind: "text",
      storageId: `_storage:${foreignHash}`,
      hash: foreignHash,
      size: 0,
      origin: { kind: "upload" },
      ...editableResourceFields,
      revision: 1
    });
    const id = seedOutput({
      scope: { include: [{ select: "project" }], exclude: [] }
    });

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "published");
    assert.deepEqual(state.controls.enqueuedRefs, [
      { kind: "document", id: "documents:launch" },
      { kind: "slides", id: "slideDecks:board" },
      { kind: "spreadsheet", id: "spreadsheets:forecast" },
      { kind: "externalFile::text", id: "externalFiles:brief" },
      { kind: "externalFile::code", id: "externalFiles:source" },
      { kind: "externalFile::data", id: "externalFiles:forecast" },
      { kind: "externalFile::image", id: "externalFiles:diagram" }
    ]);
    assert.deepEqual(state.controls.preparationEvents, [
      "enqueue:document:documents:launch",
      "enqueue:slides:slideDecks:board",
      "enqueue:spreadsheet:spreadsheets:forecast",
      "enqueue:externalFile::text:externalFiles:brief",
      "enqueue:externalFile::code:externalFiles:source",
      "enqueue:externalFile::data:externalFiles:forecast",
      "enqueue:externalFile::image:externalFiles:diagram",
      "drain"
    ]);
  });

  it("does not let an unrelated quarantined resource poison a refresh", async () => {
    const previous = textBlock("Previously published");
    const id = seedOutput({
      state: "stale",
      ...generatedValue(previous, 3)
    });
    state.controls.queueFailure = "semantic source indexing exhausted its retry budget";

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    const output = state.rows("derivedOutputs")[0];
    assert.equal(result?.outcome, "published");
    assert.notDeepEqual(output.lastResponse, previous);
    assert.equal(output.lastRevision, 4);
    assert.equal(output.state, "fresh");
    assert.equal(state.controls.intelligenceCalls, 1);
  });

  it("fails before synthesis when a resource in its concrete scope cannot be indexed", async () => {
    const previous = textBlock("Previously published");
    const id = seedOutput({
      state: "stale",
      ...generatedValue(previous, 3)
    });
    state.controls.queueFailureRef = { kind: "document", id: "documents:launch-brief" };
    state.controls.queueFailure = "source indexing exhausted its retry budget";
    state.controls.materialQueueFailure = "material indexing exhausted its retry budget";

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "failed");
    assert.equal(result?.attempts, 0);
    assert.equal(result?.output.state, "error");
    assert.deepEqual(result?.output.lastResponse, previous);
    assert.equal(result?.output.lastRevision, 3);
    assert.match(
      result?.output.error ?? "",
      /launch-brief.*text.*source indexing.*launch-brief.*material.*material indexing/i
    );
    assert.equal(state.controls.intelligenceCalls, 0);
  });

  it("follows nested reusable named sets when deciding whether a failure is required", async () => {
    seed("documents", {
      _id: "documents:launch-brief",
      _creationTime: 1,
      projectId: "projects:1",
      title: "Launch brief",
      ...editableResourceFields
    });
    seed("resourceSets", {
      _id: "resourceSets:inner",
      _creationTime: 1,
      projectId: "projects:1",
      name: "Launch material",
      set: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
        exclude: []
      },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });
    seed("resourceSets", {
      _id: "resourceSets:outer",
      _creationTime: 2,
      projectId: "projects:1",
      name: "Nested launch material",
      set: {
        include: [{ select: "set", setId: "resourceSets:inner" }],
        exclude: []
      },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });
    const id = seedOutput({
      scope: {
        include: [{ select: "set", setId: "resourceSets:outer" }],
        exclude: []
      }
    });
    state.controls.queueFailureRef = { kind: "document", id: "documents:launch-brief" };
    state.controls.queueFailure = "nested source could not be indexed";

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "failed");
    assert.match(result?.output.error ?? "", /nested source could not be indexed/);
    assert.deepEqual(state.controls.enqueuedRefs, [
      { kind: "document", id: "documents:launch-brief" }
    ]);
    assert.equal(state.controls.intelligenceCalls, 0);
  });

  it("projects an exact-owner private template scope before classifying failures", async () => {
    seed("documents", {
      _id: "documents:launch-brief",
      _creationTime: 1,
      projectId: "projects:1",
      title: "Launch brief",
      ...editableResourceFields
    });
    seed("resourceSets", {
      _id: "resourceSets:private-template-scope",
      _creationTime: 1,
      projectId: "projects:1",
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: "documents:made" },
        hole: "source_material"
      },
      set: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:launch-brief" }] }],
        exclude: []
      },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });
    const id = seedOutput({
      origin: { kind: "document", id: "documents:made" },
      scope: {
        include: [{ select: "set", setId: "resourceSets:private-template-scope" }],
        exclude: []
      }
    });
    state.controls.queueFailureRef = { kind: "document", id: "documents:launch-brief" };
    state.controls.queueFailure = "template source could not be indexed";

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "failed");
    assert.match(result?.output.error ?? "", /template source could not be indexed/);
    assert.deepEqual(state.controls.enqueuedRefs, [
      { kind: "document", id: "documents:launch-brief" }
    ]);
    assert.equal(state.controls.intelligenceCalls, 0);
  });

  it("lets server shutdown abort and drain blocked in-scope enqueue preparation", async () => {
    seed("documents", {
      _id: "documents:launch-brief",
      _creationTime: 1,
      projectId: "projects:1",
      title: "Launch brief",
      ...editableResourceFields
    });
    state.controls.enqueueBlocked = true;
    const id = seedOutput();
    const refresh = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.controls.enqueueStarted).toBe(true));

    await state.model.operationFlights.close();

    await assert.rejects(refresh, /aborted/i);
    assert.equal(state.controls.queueCalls, 0);
    assert.equal(state.controls.intelligenceCalls, 0);
  });

  it("lets server shutdown abort and drain blocked overlay preparation", async () => {
    state.controls.queueBlocked = true;
    const id = seedOutput();
    const refresh = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.controls.queueStarted).toBe(true));

    await state.model.operationFlights.close();

    await assert.rejects(refresh, /aborted/i);
    assert.equal(state.controls.intelligenceCalls, 0);
  });

  it("leaves shutdown-interrupted work queued for a fresh ServerModel to reclaim", async () => {
    state.controls.queryBlocked = true;
    const previous = textBlock("Earlier answer");
    const id = seedOutput({
      state: "stale",
      ...generatedValue(previous, 3)
    });
    const stoppedModel = state.model;
    const refresh = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.controls.queryStarted).toBe(true));

    await stoppedModel.operationFlights.close();
    await assert.rejects(refresh, /server shutdown aborted/i);

    const queued = state.rows("derivedOutputRefreshJobs")[0];
    assert.equal(queued.state, "queued");
    assert.equal(queued.attempts, 0);
    assert.equal(queued.error, undefined);
    assert.equal(queued.startedAt, undefined);
    const interruptedOutput = state.rows("derivedOutputs")[0];
    assert.equal(interruptedOutput.state, "stale");
    assert.equal(interruptedOutput.error, undefined);
    assert.deepEqual(interruptedOutput.lastResponse, previous);
    assert.equal(interruptedOutput.lastRevision, 3);

    state.controls.queryBlocked = false;
    state.controls.queryStarted = false;
    const restartedModel = {
      ...stoppedModel,
      operationFlights: createOperationFlights()
    };
    assert.notEqual(restartedModel, stoppedModel);
    state.model = restartedModel;

    const recovered = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(recovered?.outcome, "published");
    assert.equal(recovered?.output.state, "fresh");
    assert.equal(recovered?.output.error, undefined);
    assert.equal(recovered?.output.lastRevision, 4);
    assert.equal(state.rows("derivedOutputRefreshJobs").length, 0);
  });

  it("keeps an ordinary AbortError as a visible refresh failure", async () => {
    state.controls.queryOrdinaryAbort = true;
    const id = seedOutput();

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "failed");
    assert.equal(result?.output.state, "error");
    assert.match(result?.output.error ?? "", /user cancelled this refresh/i);
    const failedJob = state.rows("derivedOutputRefreshJobs")[0];
    assert.equal(failedJob.state, "failed");
    assert.equal(failedJob.attempts, 1);
    assert.match(String(failedJob.error), /user cancelled this refresh/i);
  });

  it("rejects a refresh job that omits its required requestedVersion", async () => {
    const id = seedOutput();
    seed("derivedOutputRefreshJobs", {
      _id: "derivedOutputRefreshJobs:1",
      _creationTime: 1,
      projectId: "projects:1",
      derivedOutputId: id,
      state: "queued",
      requestKey: "malformed-current-row",
      attempts: 0,
      queuedAt: 10,
      updatedAt: 10
    });

    await assert.rejects(
      () => refreshDerivedOutput({ derivedOutputId: id }),
      /missing required field: requestedVersion/
    );
    assert.equal(state.controls.intelligenceCalls, 0);
    assert.equal(state.rows("derivedOutputRefreshJobs")[0].requestedVersion, undefined);
  });

  it("restarts synthesis when a cited revision changes before publication", async () => {
    state.controls.mode = "drift";
    state.controls.maxRetries = 2;
    const id = seedOutput();

    // Drift only after the first retrieval; the retry observes revision 2 and then stabilizes.
    const originalComplete = state.model.intelligence.completeWithTools;
    let calls = 0;
    state.model.intelligence.completeWithTools = async (input) => {
      calls += 1;
      if (calls === 2) state.controls.mode = "normal";
      return originalComplete(input);
    };
    const result = await refreshDerivedOutput({ derivedOutputId: id });
    state.model.intelligence.completeWithTools = originalComplete;

    assert.equal(result?.outcome, "published");
    assert.equal(result?.attempts, 2);
    const evidence = result?.output.evidence[0];
    assert.ok(evidence !== undefined && evidence.evidenceKind === "text");
    assert.equal(evidence.source.revision, 2);
    assert.equal(result?.usage.providerRequests, 4);
    assert.equal(result?.usage.embeddings.length, 2);
  });

  it("fails bounded revision churn without overwriting the last good response", async () => {
    state.controls.mode = "drift";
    state.controls.maxRetries = 1;
    const previous = textBlock("Previously published");
    const previousEvidence = [
      {
        evidenceKind: "text" as const,
        selections: [{ evidenceId: "evidence-1", use: "Names the launch" }],
        source: {
          ref: { kind: "document", id: "documents:launch-brief" },
          revision: 1,
          encoding: "utf-16"
        },
        span: { from: 0, to: 6, text: "Launch" },
        overlayGeneration: 4
      }
    ];
    const id = seedOutput({
      state: "stale",
      ...generatedValue(previous, 3),
      evidence: previousEvidence
    });

    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "failed");
    assert.equal(result?.attempts, 2);
    assert.equal(result?.output.state, "error");
    assert.deepEqual(result?.output.lastResponse, previous);
    assert.equal(result?.output.lastRevision, 3);
    assert.deepEqual(result?.output.evidence, previousEvidence);
    assert.match(result?.output.error ?? "", /kept changing/);
  });

  it("publishes a deterministic insufficiency response when no evidence is selected", async () => {
    state.controls.mode = "no-evidence";
    const id = seedOutput();
    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "published");
    assert.deepEqual(result?.output.evidence, []);
    const response = result?.output.lastResponse;
    assert.equal(response?.type, "text");
    if (response?.type !== "text") assert.fail("expected a text response");
    assert.equal(
      response.display,
      "The project does not contain enough evidence to answer this request."
    );
    assert.equal(result?.output.lastGeneration, 4);
    assert.equal((await readDerivedOutput({ derivedOutputId: id }))?.effectiveState, "fresh");
    state.rows("semanticOverlays")[0].generation = 5;
    assert.equal((await readDerivedOutput({ derivedOutputId: id }))?.effectiveState, "stale");
  });

  it("retries a negative result when the searched overlay changes during synthesis", async () => {
    state.controls.mode = "overlay-drift";
    state.controls.maxRetries = 1;
    const id = seedOutput();
    const originalComplete = state.model.intelligence.completeWithTools;
    let calls = 0;
    state.model.intelligence.completeWithTools = async (input) => {
      calls += 1;
      if (calls === 2) state.controls.mode = "no-evidence";
      return originalComplete(input);
    };

    const result = await refreshDerivedOutput({ derivedOutputId: id });
    state.model.intelligence.completeWithTools = originalComplete;

    assert.equal(result?.outcome, "published");
    assert.equal(result?.attempts, 2);
    assert.equal(result?.output.lastGeneration, 5);
    assert.deepEqual(result?.output.evidence, []);
  });

  it("does not publish model prose that selects an evidence id the application never issued", async () => {
    state.controls.mode = "unknown-evidence";
    const id = seedOutput();
    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "published");
    assert.deepEqual(result?.output.evidence, []);
    const response = result?.output.lastResponse;
    assert.equal(response?.type, "text");
    if (response?.type !== "text") assert.fail("expected a text response");
    assert.equal(
      response.display,
      "The project does not contain enough evidence to answer this request."
    );
  });

  it("sanitizes a provider failure and preserves an earlier revision", async () => {
    state.controls.mode = "failure";
    const previous = textBlock("Earlier answer");
    const id = seedOutput({ state: "stale", ...generatedValue(previous, 4) });
    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "failed");
    assert.equal(result?.output.state, "error");
    assert.deepEqual(result?.output.lastResponse, previous);
    assert.equal(result?.output.lastRevision, 4);
    assert.doesNotMatch(result?.output.error ?? "", /private-value/);
    assert.match(result?.output.error ?? "", /redacted/);
    const read = await readDerivedOutput({ derivedOutputId: id });
    assert.equal(read?.effectiveState, "error");
    assert.equal(read?.refresh.state, "failed");
    if (read?.refresh.state === "failed") {
      assert.match(read.refresh.error ?? "", /redacted/);
    }
  });

  it("coalesces concurrent browser signals onto one server refresh flight", async () => {
    state.controls.mode = "gate";
    const id = seedOutput();
    const first = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() =>
      expect(state.rows("derivedOutputRefreshJobs")[0]?.state).toBe("running")
    );

    const inFlight = await readDerivedOutput({ derivedOutputId: id });
    assert.equal(inFlight?.output.state, "idle");
    assert.equal(inFlight?.effectiveState, "idle");
    assert.equal(inFlight?.refresh.state, "running");
    const valueInFlight = await readDerivedOutputValue({ derivedOutputId: id });
    assert.equal(valueInFlight?.value, null);
    assert.equal(valueInFlight?.state, "idle");
    assert.equal(valueInFlight?.refresh.state, "running");

    const second = refreshDerivedOutput({ derivedOutputId: id });
    state.controls.mode = "normal";
    state.controls.release?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    assert.equal(firstResult?.outcome, "published");
    assert.deepEqual(secondResult, firstResult);
    assert.equal(firstResult?.output.lastRevision, 1);
    assert.equal(state.controls.intelligenceCalls, 1);
    assert.equal(state.rows("derivedOutputRefreshJobs").length, 0);
    assert.equal(
      (await readDerivedOutput({ derivedOutputId: id }))?.refresh.state,
      "idle"
    );
  });

  it("runs one follow-up when the definition changes during shared work", async () => {
    state.controls.mode = "gate";
    const id = seedOutput();
    const first = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.controls.release).toBeTypeOf("function"));

    const edited = await updateDerivedOutput({
      derivedOutputId: id,
      prompt: "Use the revised launch question"
    });
    assert.equal(edited?.definitionRevision, 2);
    const second = refreshDerivedOutput({ derivedOutputId: id });
    state.controls.mode = "normal";
    state.controls.release?.();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(secondResult, firstResult);
    assert.equal(firstResult?.outcome, "published");
    assert.equal(firstResult?.output.prompt, "Use the revised launch question");
    assert.equal(state.controls.intelligenceCalls, 2);
    assert.equal(state.rows("derivedOutputRefreshJobs").length, 0);
  });

  it("retries once when a collaborator changes semantic inputs during synthesis", async () => {
    seed("semanticSources", {
      _id: "semanticSources:2",
      _creationTime: 2,
      projectId: "projects:1",
      ref: { kind: "document", id: "documents:neighboring-brief" },
      revision: 1,
      encoding: "utf-16",
      updatedAt: 1
    });
    state.controls.mode = "gate";
    const id = seedOutput();
    const refresh = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.controls.release).toBeTypeOf("function"));

    state.rows("semanticSources")[1].revision = 2;
    state.controls.mode = "normal";
    state.controls.release?.();
    const result = await refresh;

    assert.equal(result?.outcome, "published");
    assert.equal(result?.attempts, 2);
    assert.equal(state.controls.intelligenceCalls, 2);
  });

  it("does not publish over a definition superseded while synthesis is in flight", async () => {
    state.controls.mode = "gate";
    const id = seedOutput();
    const refresh = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.controls.release).toBeTypeOf("function"));
    const row = state.rows("derivedOutputs")[0];
    row.prompt = "A newer definition";
    row.updatedAt = 11;
    row.state = "stale";
    state.controls.release?.();

    const result = await refresh;
    assert.equal(result?.outcome, "superseded");
    assert.equal(result?.output.prompt, "A newer definition");
    assert.equal(result?.output.lastResponse, undefined);
  });

  it("validates refresh configuration before starting provider work", async () => {
    state.controls.defaultTopK = 0;
    const id = seedOutput();

    await assert.rejects(() => refreshDerivedOutput({ derivedOutputId: id }), /defaultTopK/);
    assert.equal(state.rows("derivedOutputs")[0].state, "idle");
  });
});
