import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      | "failure"
      | "gate",
    maxRetries: 2,
    defaultTopK: 8,
    intelligenceCalls: 0,
    queryInputs: [] as Record<string, unknown>[],
    retrieveResults: [] as unknown[],
    firstTools: [] as (string | undefined)[],
    userPrompts: [] as string[],
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
      if (retrieve === undefined || input.tools.length !== 1) throw new Error("tools missing");
      const found = await retrieve.execute({ query: "launch schedule", topK: 3 });
      controls.retrieveResults.push(found);
      const evidenceIds = ((found as { hits: { evidenceId: string }[] }).hits ?? []).map(
        (hit) => hit.evidenceId
      );

      if (controls.mode === "drift") {
        source().revision = Number(source().revision) + 1;
      }
      if (controls.mode === "gate") {
        await new Promise<void>((resolve) => {
          controls.release = resolve;
        });
      }
      return {
        value:
          controls.mode === "no-evidence"
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
    }
  };
  return { tables, counters, rows, controls, store, source, model };
});

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:1", userId: "users:1", username: "You" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => state.model }));
vi.mock("$capabilities/semantic-overlay/index.remote", () => ({
  querySemanticOverlay: async (input: Record<string, unknown>) => {
    state.controls.queryInputs.push(input);
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

const { createDerivedOutput } = await import(
  "$capabilities/derived-output/api/create-derived-output/create-derived-output"
);
const { readDerivedOutput } = await import(
  "$capabilities/derived-output/api/read-derived-output/read-derived-output"
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
    ref: { kind: "document", id: "launch-brief" },
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

const seedOutput = (overrides: Record<string, unknown> = {}): string =>
  state.store.create("derivedOutputs", {
    projectId: "projects:1",
    prompt: "Summarize the launch schedule",
    scope: {
      include: [{ select: "resources", refs: [{ kind: "document", id: "launch-brief" }] }],
      exclude: []
    },
    queries: [],
    evidence: [],
    state: "idle",
    createdBy: { kind: "user", userId: "users:1" },
    updatedAt: 10,
    ...overrides
  });

beforeEach(() => {
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
    assert.deepEqual(created.createdBy, { kind: "user", userId: "users:1" });
    await assert.rejects(() => createDerivedOutput({ prompt: " " }), /must not be blank/);
  });

  it("computes pull-time staleness from cited revisions and ignores unrelated changes", async () => {
    const citation = {
      selections: [{ evidenceId: "evidence-1", use: "Names the launch" }],
      source: {
        ref: { kind: "document", id: "launch-brief" },
        revision: 1,
        encoding: "utf-16" as const
      },
      span: { from: 0, to: 6, text: "Launch" },
      overlayGeneration: 4
    };
    const id = seedOutput({ state: "fresh", evidence: [citation] });
    seed("semanticSources", {
      _id: "semanticSources:2",
      _creationTime: 2,
      projectId: "projects:1",
      ref: { kind: "document", id: "unrelated" },
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

  it("edits the definition by marking a prior response stale without erasing it", async () => {
    const previous = textBlock("Old grounded response");
    const id = seedOutput({ state: "fresh", lastResponse: previous, lastRevision: 2 });

    const updated = await updateDerivedOutput({
      derivedOutputId: id,
      prompt: "Use the revised question"
    });
    assert.equal(updated?.state, "stale");
    assert.deepEqual(updated?.lastResponse, previous);
    assert.equal(updated?.scope, undefined);

    state.rows("derivedOutputs")[0].state = "generating";
    await assert.rejects(
      () => updateDerivedOutput({ derivedOutputId: id, prompt: "Another edit" }),
      /cannot be edited/
    );
  });

  it("stores a user-edited response as ungrounded continuity for the next refresh", async () => {
    const previous = textBlock("Old grounded response");
    const id = seedOutput({
      state: "fresh",
      lastResponse: previous,
      lastRevision: 2,
      lastGeneration: 4,
      evidence: [
        {
          selections: [{ evidenceId: "old-evidence", use: "Old support" }],
          source: {
            ref: { kind: "document", id: "launch-brief" },
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
        include: [{ select: "resources", refs: [{ kind: "document", id: "launch-brief" }] }],
        exclude: []
      },
      lastResponse: "  Keep this\nshape  "
    });

    assert.equal(edited?.lastResponse?.type, "text");
    assert.equal(edited?.lastResponse?.display, "Keep this shape");
    assert.equal(edited?.lastRevision, 3);
    assert.equal(edited?.state, "stale");
    assert.deepEqual(edited?.evidence, []);
    assert.equal(edited?.lastGeneration, undefined);

    await refreshDerivedOutput({ derivedOutputId: id });
    assert.match(state.controls.userPrompts[0], /Keep this shape/);
    assert.match(state.controls.userPrompts[0], /continuity only/);
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
    assert.equal(result?.output.evidence[0].source.revision, 1);
    assert.equal(result?.output.evidence[0].span.text, "Launch is Tuesday.");
    assert.deepEqual(result?.output.evidence[0].selections, [
      { evidenceId: "evidence-1", use: "Establishes the launch day" }
    ]);
    assert.deepEqual(state.controls.firstTools, ["retrieve"]);
    assert.equal(JSON.stringify(state.controls.retrieveResults).includes("Launch is Tuesday"), true);
    assert.deepEqual(state.controls.queryInputs[0].scope, {
      include: [{ select: "resources", refs: [{ kind: "document", id: "launch-brief" }] }],
      exclude: []
    });
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
    assert.equal(result?.output.evidence[0].source.revision, 2);
    assert.equal(result?.usage.providerRequests, 4);
    assert.equal(result?.usage.embeddings.length, 2);
  });

  it("fails bounded revision churn without overwriting the last good response", async () => {
    state.controls.mode = "drift";
    state.controls.maxRetries = 1;
    const previous = textBlock("Previously published");
    const previousEvidence = [
      {
        selections: [{ evidenceId: "evidence-1", use: "Names the launch" }],
        source: {
          ref: { kind: "document", id: "launch-brief" },
          revision: 1,
          encoding: "utf-16"
        },
        span: { from: 0, to: 6, text: "Launch" },
        overlayGeneration: 4
      }
    ];
    const id = seedOutput({
      state: "stale",
      lastResponse: previous,
      lastRevision: 3,
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
      "The Semantic Overlay did not return enough evidence to answer this request."
    );
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
      "The Semantic Overlay did not return enough evidence to answer this request."
    );
  });

  it("sanitizes a provider failure and preserves an earlier revision", async () => {
    state.controls.mode = "failure";
    const previous = textBlock("Earlier answer");
    const id = seedOutput({ state: "stale", lastResponse: previous, lastRevision: 4 });
    const result = await refreshDerivedOutput({ derivedOutputId: id });

    assert.equal(result?.outcome, "failed");
    assert.equal(result?.output.state, "error");
    assert.deepEqual(result?.output.lastResponse, previous);
    assert.equal(result?.output.lastRevision, 4);
    assert.doesNotMatch(result?.output.error ?? "", /private-value/);
    assert.match(result?.output.error ?? "", /redacted/);
  });

  it("uses the generating state as a single-process refresh lock", async () => {
    state.controls.mode = "gate";
    const id = seedOutput();
    const first = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.rows("derivedOutputs")[0].state).toBe("generating"));

    await assert.rejects(
      () => refreshDerivedOutput({ derivedOutputId: id }),
      /already generating/
    );
    state.controls.release?.();
    assert.equal((await first)?.outcome, "published");
  });

  it("does not publish over a definition superseded while synthesis is in flight", async () => {
    state.controls.mode = "gate";
    const id = seedOutput();
    const refresh = refreshDerivedOutput({ derivedOutputId: id });
    await vi.waitFor(() => expect(state.rows("derivedOutputs")[0].state).toBe("generating"));
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

  it("validates refresh configuration before acquiring the generating lock", async () => {
    state.controls.defaultTopK = 0;
    const id = seedOutput();

    await assert.rejects(() => refreshDerivedOutput({ derivedOutputId: id }), /defaultTopK/);
    assert.equal(state.rows("derivedOutputs")[0].state, "idle");
  });
});
