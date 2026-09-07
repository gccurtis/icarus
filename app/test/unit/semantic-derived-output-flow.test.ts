import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import { defineStore } from "$model/server/store/index.server";
import type { IntelligenceTool } from "$model/server/intelligence/index.server";

const state = vi.hoisted(() => ({
  model: undefined as unknown as {
    store: { read(path: string): unknown };
    [key: string]: unknown;
  },
  query: undefined as unknown as (input: unknown) => Promise<unknown>,
  now: 1
}));

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({
    projectId: "projects:flow",
    userId: "users:flow",
    username: "Flow tester"
  })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => state.model }));
vi.mock("$capabilities/semantic-overlay/index.remote", () => ({
  querySemanticOverlay: (input: unknown) => state.query(input)
}));

const { querySemanticOverlay } = await import(
  "$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay"
);
const { createProjectResource } = await import(
  "$capabilities/project-resources/api/create-project-resource/create-project-resource"
);
const { submitDocumentChanges } = await import(
  "$capabilities/document/api/submit-document-changes/submit-document-changes"
);
const { processSemanticSyncQueue } = await import(
  "$capabilities/semantic-overlay/api/process-semantic-sync-queue/process-semantic-sync-queue"
);
const { createDerivedOutput } = await import(
  "$capabilities/derived-output/api/create-derived-output/create-derived-output"
);
const { createTemplatedDerivedOutput } = await import(
  "$capabilities/derived-output/api/create-templated-derived-output/create-templated-derived-output"
);
const { refreshDerivedOutput } = await import(
  "$capabilities/derived-output/api/refresh-derived-output/refresh-derived-output"
);
const { readDerivedOutput } = await import(
  "$capabilities/derived-output/api/read-derived-output/read-derived-output"
);
const { readDerivedOutputValue } = await import(
  "$capabilities/derived-output/api/read-derived-output-value/read-derived-output-value"
);

const configuration: Record<string, unknown> = {
  "semanticOverlay.translation.maxTokens": 320,
  "semanticOverlay.translation.minTokens": 1,
  "semanticOverlay.translation.changeThreshold": 0.28,
  "semanticOverlay.translation.basinProminenceThreshold": 0.02,
  "semanticOverlay.translation.basinMassFraction": 0.04,
  "semanticOverlay.translation.attractionDecayTokens": 2,
  "semanticOverlay.translation.attractionStationaryThreshold": 0.005,
  "semanticOverlay.index.branchFactor": 3,
  "semanticOverlay.index.leafSize": 2,
  "semanticOverlay.index.maxIterations": 16,
  "semanticOverlay.index.convergenceTolerance": 0.000001,
  "semanticOverlay.index.candidateMultiplier": 2,
  "intelligence.agent.maxSourceRetries": 1,
  "intelligence.agent.defaultTopK": 4
};

beforeEach(() => {
  state.now = 1;
  const store = defineStore({ now: () => state.now++ });
  const usage = (operation: string, inputItems = 1) => ({
    operation,
    api: "deterministic-test",
    model: "flow-v1",
    requestCount: 1,
    inputItems
  });
  state.query = querySemanticOverlay;
  state.model = {
    store,
    configuration: { get: (key: string) => configuration[key] },
    embedding: {
      space: { provider: "jina", model: "flow-v1", dimensions: 2 },
      tokenField: async (value: string) => ({
        value: {
          labels: ["Pass", "age", ":", value],
          vectors: [[0, 0], [0, 0], [0, 0], [1, 0]]
        },
        usage: usage("tokenField")
      }),
      windowedPassages: async (values: readonly string[]) => ({
        value: values.map(() => [1, 0]),
        usage: usage("windowedPassageVectors", values.length)
      }),
      passage: async () => ({ value: [1, 0], usage: usage("passageVector") }),
      query: async () => ({ value: [1, 0], usage: usage("queryVector") })
    },
    intelligence: {
      completeWithTools: async (input: {
        tools: readonly IntelligenceTool[];
        output?: { name: string };
      }) => {
        const retrieve = input.tools.find((tool) => tool.name === "retrieve");
        if (retrieve === undefined) throw new Error("retrieve tool was not provided");
        const found = (await retrieve.execute({ query: "Avery age", topK: 4 })) as {
          hits: Array<{ evidenceId: string; span: { text: string } }>;
        };
        const hit = found.hits.find((candidate) => candidate.span.text.includes("37"));
        if (hit === undefined) throw new Error("the indexed age evidence was not retrieved");
        const value =
          input.output?.name === "semantic_derived_variables"
            ? {
                variables: [
                  {
                    name: "person",
                    status: "answered",
                    value: "Avery",
                    evidence: [{ evidenceId: hit.evidenceId, use: "Names the person" }]
                  },
                  {
                    name: "age",
                    status: "answered",
                    value: "37",
                    evidence: [{ evidenceId: hit.evidenceId, use: "States the person's age" }]
                  }
                ]
              }
            : {
                status: "answered",
                response: "Avery is 37 years old.",
                evidence: [{ evidenceId: hit.evidenceId, use: "States Avery's age" }]
              };
        return {
          value,
          usage: {
            requestCount: 2,
            promptTokens: 20,
            completionTokens: 8,
            totalTokens: 28
          },
          toolCalls: [{ id: "retrieve-1", name: "retrieve", input: {}, ok: true }],
          rounds: 2
        };
      }
    },
    observability: { logger: { info: () => {}, warn: () => {} } }
  };
});

describe("resource text to readable Derived Output", () => {
  it("publishes an edited document, retrieves its age, and stores grounded evidence", async () => {
    const created = await createProjectResource({ target: "document", title: "People" });
    const row = {
      id: "row:avery",
      kind: "blocks",
      blocks: [
        {
          id: "block:avery",
          type: "text",
          variant: "paragraph",
          atoms: [{ id: "atom:avery", kind: "literal", text: "Avery is 37 years old." }],
          display: "Avery is 37 years old.",
          marks: []
        }
      ]
    };
    const submitted = await submitDocumentChanges({
      changeSet: {
        resourceId: created.resourceId,
        baseRevision: 0,
        ops: [
          {
            op: "insert",
            target: "row",
            path: "rows",
            ids: [row.id],
            after: null,
            values: [row]
          }
        ],
        touched: ["rows"]
      }
    });
    assert.deepEqual(submitted, { accepted: true, revision: 1 });

    const queued = state.model.store.read("semanticSyncJobs") as {
      rows: Array<{ requestedRevision: number }>;
    };
    assert.equal(queued.rows.length, 1);
    assert.equal(queued.rows[0].requestedRevision, 1);

    const processed = await processSemanticSyncQueue({ limit: 1 });
    assert.equal(processed.processed[0].error, undefined);
    assert.equal(processed.processed[0].result?.outcome, "published");
    assert.equal(processed.remaining, 0);

    const source = state.model.store.read("semanticSources") as {
      rows: Array<{ revision: number; locators: Array<{ locator: { kind: string } }> }>;
    };
    assert.equal(source.rows[0].revision, 1);
    assert.deepEqual(
      source.rows[0].locators.map((entry) => entry.locator.kind),
      ["resourceTitle", "documentBlock"]
    );

    const output = await createDerivedOutput({
      prompt: "How old is Avery?",
      scope: {
        include: [
          { select: "resources", refs: [{ kind: "document", id: created.resourceId }] }
        ],
        exclude: []
      }
    });
    const refreshed = await refreshDerivedOutput({ derivedOutputId: output._id });
    assert.equal(refreshed?.outcome, "published");

    const read = await readDerivedOutput({ derivedOutputId: output._id });
    assert.equal(read?.effectiveState, "fresh");
    assert.equal(read?.output.lastResponse?.type, "text");
    assert.equal(read?.output.lastResponse?.display, "Avery is 37 years old.");
    assert.equal(read?.output.evidence[0].span.text.includes("Avery is 37 years old."), true);
    assert.equal(
      read?.output.evidence[0].locators?.some(
        (entry) => entry.locator.kind === "documentBlock"
      ),
      true
    );
    assert.deepEqual(read?.output.evidence[0].selections, [
      { evidenceId: "evidence-1", use: "States Avery's age" }
    ]);

    const templated = await createTemplatedDerivedOutput({
      template: {
        variables: [
          { name: "person", prompt: "Find the person's name" },
          { name: "age", prompt: "Find the person's age as a number" }
        ],
        output: "{{person}} is {{age}} years old.",
        exampleResponse: "Jordan is 42 years old."
      },
      scope: {
        include: [
          { select: "resources", refs: [{ kind: "document", id: created.resourceId }] }
        ],
        exclude: []
      }
    });
    const refreshedTemplate = await refreshDerivedOutput({ derivedOutputId: templated._id });
    assert.equal(refreshedTemplate?.output.error, undefined);
    assert.equal(refreshedTemplate?.outcome, "published");
    const readTemplate = await readDerivedOutput({ derivedOutputId: templated._id });
    assert.equal(
      readTemplate?.output.lastResponse?.type === "text"
        ? readTemplate.output.lastResponse.display
        : undefined,
      "Avery is 37 years old."
    );
    assert.deepEqual(readTemplate?.output.lastVariables, [
      {
        name: "person",
        value: "Avery",
        evidence: [{ evidenceId: "evidence-1", use: "Names the person" }]
      },
      {
        name: "age",
        value: "37",
        evidence: [{ evidenceId: "evidence-1", use: "States the person's age" }]
      }
    ]);
    const value = await readDerivedOutputValue({ derivedOutputId: templated._id });
    assert.deepEqual(value?.variables, [
      {
        name: "person",
        value: "Avery",
        evidence: [{ evidenceId: "evidence-1", use: "Names the person" }]
      },
      {
        name: "age",
        value: "37",
        evidence: [{ evidenceId: "evidence-1", use: "States the person's age" }]
      }
    ]);
    assert.equal(value?.value, "Avery is 37 years old.");
    assert.equal(value?.state, "fresh");
  });
});
