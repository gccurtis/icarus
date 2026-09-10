import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { defineStore, type StoreModel } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import { emptyBody } from "$representation/data/behavior/spreadsheets/empty-sheet";

const harness = vi.hoisted(() => ({
  model: undefined as unknown as ServerModel,
  scope: { projectId: "", userId: "", username: "Uma" }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => harness.model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve(harness.scope)
}));

const { prepareOverlay } = await import(
  "$capabilities/research-chat/api/shared/overlay"
);
const { enqueueSemanticSync } = await import("$capabilities/semantic-overlay/index");

const directories: string[] = [];

const rows = (store: StoreModel, table: string): Array<Record<string, unknown>> => {
  const found = store.read(table);
  return found?.kind === "table"
    ? found.rows.map((row) => row as unknown as Record<string, unknown>)
    : [];
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("research pull-boundary spreadsheet projection", () => {
  test("discovers a fresh spreadsheet and publishes its searchable material path", async () => {
    const directory = mkdtempSync(join(tmpdir(), "icarus-research-spreadsheet-"));
    directories.push(directory);
    let clock = 1_000;
    const store = defineStore({ directory, now: () => clock++ });
    const projectId = store.create("projects", {
      name: "Grid project",
      revision: 1,
      settings: "{}",
      updatedAt: 1
    });
    const userId = store.create("users", {
      authSubject: "test:uma",
      displayName: "Uma",
      settings: "{}",
      updatedAt: 1
    });
    const spreadsheetId = store.create("spreadsheets", {
      projectId,
      title: "Incident totals",
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId },
      updatedAt: 1
    });
    const base = emptyBody();
    const body = {
      ...base,
      rows: base.rows.slice(0, 2),
      columns: base.columns.slice(0, 2),
      rowPartCounts: [2]
    };
    store.create("spreadsheetSnapshots", {
      projectId,
      resourceId: spreadsheetId,
      revision: 1,
      role: "leader",
      part: 0,
      body,
      at: 1
    });
    store.createMany("sheetCells", [
      {
        projectId,
        resourceId: spreadsheetId,
        rowId: "r1",
        columnId: "c1",
        rowOrder: 1,
        value: { kind: "text", value: "Region" }
      },
      {
        projectId,
        resourceId: spreadsheetId,
        rowId: "r1",
        columnId: "c2",
        rowOrder: 1,
        value: { kind: "text", value: "Incidents" }
      },
      {
        projectId,
        resourceId: spreadsheetId,
        rowId: "r2",
        columnId: "c1",
        rowOrder: 2,
        value: { kind: "text", value: "North" }
      },
      {
        projectId,
        resourceId: spreadsheetId,
        rowId: "r2",
        columnId: "c2",
        rowOrder: 2,
        value: { kind: "number", value: 3 }
      }
    ]);
    harness.scope = { projectId, userId, username: "Uma" };
    let embeddingCalls = 0;
    const usage = (operation: string, inputItems = 1) => ({
      operation,
      api: "deterministic-test",
      model: "test-material",
      requestCount: 1,
      inputItems
    });
    harness.model = {
      store,
      configuration: {
        get: (key: string): unknown =>
          ({
            "semanticOverlay.materials.generateDescriptors": false,
            "semanticOverlay.translation.maxTokens": 320,
            "semanticOverlay.translation.minTokens": 1,
            "semanticOverlay.translation.changeThreshold": 0.28,
            "semanticOverlay.translation.basinProminenceThreshold": 0,
            "semanticOverlay.translation.basinMassFraction": 0,
            "semanticOverlay.translation.attractionDecayTokens": 2,
            "semanticOverlay.translation.attractionStationaryThreshold": 0.005,
            "semanticOverlay.index.branchFactor": 3,
            "semanticOverlay.index.leafSize": 2,
            "semanticOverlay.index.maxIterations": 16,
            "semanticOverlay.index.convergenceTolerance": 0.000001,
            "semanticOverlay.index.candidateMultiplier": 2
          })[key]
      },
      embedding: {
        space: { provider: "jina", model: "test-material", dimensions: 2 },
        tokenField: async (value: string) => {
          embeddingCalls += 1;
          return {
            value: {
              labels: ["Pass", "age", ":", value],
              vectors: [[0, 0], [0, 0], [0, 0], [1, 0]]
            },
            usage: usage("tokenField")
          };
        },
        windowedPassages: async (values: readonly string[]) => {
          embeddingCalls += 1;
          return {
            value: values.map((_, index) => [1, (index + 1) / 100]),
            usage: usage("windowedPassageVectors", values.length)
          };
        },
        passages: async (values: readonly string[]) => {
          embeddingCalls += 1;
          return {
            value: values.map((_, index) => [1, (index + 1) / 100]),
            usage: usage("passageVectors", values.length)
          };
        },
        image: async () => {
          throw new Error("A spreadsheet must not request an image embedding");
        }
      },
      intelligence: {
        completeWithTools: async () => {
          throw new Error("Descriptors are disabled in this contract");
        }
      },
      observability: { logger: { info: () => {}, warn: () => {} } }
    } as unknown as ServerModel;

    const result = await prepareOverlay(harness.model, projectId, { kind: "project" });

    expect(result).toEqual({ indexed: 1 });
    expect(rows(store, "semanticSyncJobs")).toEqual([]);
    expect(rows(store, "semanticMaterialJobs")).toEqual([]);
    expect(rows(store, "semanticSources")).toEqual([]);
    expect(rows(store, "semanticMaterials")).toMatchObject([
      {
        name: "Incident totals",
        kind: "table",
        source: {
          kind: "resourceContent",
          ref: { kind: "spreadsheet", id: spreadsheetId },
          revision: 1
        },
        profile: {
          kind: "table",
          sheet: true,
          rows: 2,
          columns: 2,
          headers: ["Region", "Incidents"]
        }
      }
    ]);
    expect(rows(store, "semanticObjects")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lane: "material", facet: "identity" }),
        expect.objectContaining({ lane: "material", facet: "profile" })
      ])
    );

    const materialBefore = structuredClone(rows(store, "semanticMaterials"));
    const callsBefore = embeddingCalls;
    const second = await prepareOverlay(harness.model, projectId, { kind: "project" });

    expect(second).toEqual({ indexed: 0 });
    expect(embeddingCalls).toBe(callsBefore);
    expect(rows(store, "semanticSyncJobs")).toEqual([]);
    expect(rows(store, "semanticMaterialJobs")).toEqual([]);
    expect(rows(store, "semanticMaterials")).toEqual(materialBefore);

    const documentId = store.create("documents", {
      projectId,
      title: "Crew totals",
      createdBy: { kind: "user", userId },
      updatedBy: { kind: "user", userId },
      updatedAt: 1
    });
    store.create("documentSnapshots", {
      projectId,
      resourceId: documentId,
      revision: 1,
      role: "leader",
      part: 0,
      body: {
        rows: [
          {
            id: "document-row",
            kind: "blocks",
            blocks: [
              {
                id: "crew-table",
                type: "table",
                headerRows: 1,
                rows: [
                  {
                    id: "crew-header",
                    cells: [
                      {
                        id: "crew-header-cell",
                        blocks: [
                          {
                            id: "crew-header-text",
                            type: "text",
                            variant: "paragraph",
                            atoms: [{ id: "crew-header-atom", kind: "literal", text: "Crew" }],
                            display: "Crew",
                            marks: []
                          }
                        ]
                      }
                    ]
                  },
                  {
                    id: "crew-row",
                    cells: [
                      {
                        id: "crew-cell",
                        blocks: [
                          {
                            id: "crew-text",
                            type: "text",
                            variant: "paragraph",
                            atoms: [{ id: "crew-atom", kind: "literal", text: "North" }],
                            display: "North",
                            marks: []
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      at: 1
    });
    await prepareOverlay(harness.model, projectId, {
      kind: "resource",
      ref: { kind: "document", id: documentId }
    });

    const documentMaterials = rows(store, "semanticMaterials").filter(
      (material) =>
        (material.source as { ref?: { kind?: string; id?: string } }).ref?.kind === "document" &&
        (material.source as { ref?: { id?: string } }).ref?.id === documentId
    );
    const materialIds = documentMaterials.map((material) => material._id as string);
    const placementIds = rows(store, "semanticMaterialPlacements")
      .filter((placement) => materialIds.includes(placement.semanticMaterialId as string))
      .map((placement) => placement._id as string);
    store.removeRows("semanticMaterialPlacements", placementIds as never[]);
    store.removeRows("semanticMaterials", materialIds as never[]);

    const materialOnly = await enqueueSemanticSync({
      ref: { kind: "document", id: documentId }
    });
    expect(materialOnly?.jobId).toBeUndefined();
    expect(materialOnly?.materialJobId).toBeDefined();
    expect(rows(store, "semanticSyncJobs")).toEqual([]);
    store.removeRows(
      "semanticMaterialJobs",
      rows(store, "semanticMaterialJobs").map((job) => job._id) as never[]
    );
    await prepareOverlay(harness.model, projectId, {
      kind: "resource",
      ref: { kind: "document", id: documentId }
    });

    const exactSourceIds = rows(store, "semanticSources")
      .filter(
        (source) =>
          (source.ref as { kind?: string; id?: string }).kind === "document" &&
          (source.ref as { id?: string }).id === documentId
      )
      .map((source) => source._id as string);
    store.removeRows("semanticSources", exactSourceIds as never[]);
    const exactOnly = await enqueueSemanticSync({
      ref: { kind: "document", id: documentId }
    });
    expect(exactOnly?.jobId).toBeDefined();
    expect(exactOnly?.materialJobId).toBeUndefined();
    expect(rows(store, "semanticMaterialJobs")).toEqual([]);
  });
});
