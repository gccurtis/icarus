import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import { materialsAreCurrent } from "$capabilities/semantic-overlay/api/shared/material-current";
import { describeMaterial } from "$capabilities/semantic-overlay/api/shared/material-description";
import { prepareMaterials } from "$capabilities/semantic-overlay/api/shared/material-preparation";

const projectId = "projects:material-policy" as Id<"projects">;
const ref: ResourceRef = {
  kind: "document",
  id: "documents:material-policy" as Id<"documents">
};

const modelWith = (values: Readonly<Record<string, unknown>>): ServerModel => ({
  store: defineStore({}),
  configuration: { get: (key: string): unknown => values[key] }
}) as unknown as ServerModel;

const policyConsumers = [
  [
    "currency checks",
    async (model: ServerModel) => materialsAreCurrent(model, projectId, ref, [])
  ],
  [
    "material preparation",
    async (model: ServerModel) => prepareMaterials(model, projectId, [], false)
  ],
  [
    "material description",
    async (model: ServerModel) => describeMaterial(model, {} as MaterialSeed)
  ]
] as const;

describe("semantic material policy admission", () => {
  for (const [consumer, execute] of policyConsumers) {
    it(`${consumer} refuses an absent descriptor policy`, async () => {
      await assert.rejects(
        () => execute(modelWith({})),
        /semanticOverlay\.materials\.generateDescriptors.*boolean/
      );
    });

    it(`${consumer} refuses an enabled policy without its model`, async () => {
      await assert.rejects(
        () => execute(modelWith({
          "semanticOverlay.materials.generateDescriptors": true
        })),
        /intelligence\.providers\.openrouter\.model.*non-empty string/
      );
    });
  }
});
