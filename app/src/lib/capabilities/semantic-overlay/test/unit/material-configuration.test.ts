import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { Configuration } from "$model/server/configuration/index.server";
import {
  semanticMaterialDescriptorModel,
  semanticMaterialDescriptorsEnabled
} from "$capabilities/semantic-overlay/api/shared/configuration";

const configured = (values: Readonly<Record<string, unknown>>): Configuration => ({
  get: (key: string): unknown => values[key]
});

describe("semantic material configuration", () => {
  it("admits each explicit descriptor policy value", () => {
    assert.equal(semanticMaterialDescriptorsEnabled(configured({
      "semanticOverlay.materials.generateDescriptors": true
    })), true);
    assert.equal(semanticMaterialDescriptorsEnabled(configured({
      "semanticOverlay.materials.generateDescriptors": false
    })), false);
  });

  it("refuses an absent or malformed descriptor policy", () => {
    for (const value of [undefined, null, 0, "false"]) {
      assert.throws(
        () => semanticMaterialDescriptorsEnabled(configured({
          "semanticOverlay.materials.generateDescriptors": value
        })),
        /semanticOverlay\.materials\.generateDescriptors.*boolean/
      );
    }
  });

  it("requires the exact configured provider model without a fallback", () => {
    assert.equal(semanticMaterialDescriptorModel(configured({
      "intelligence.providers.openrouter.model": "model/current"
    })), "model/current");
    for (const value of [undefined, null, "", 1]) {
      assert.throws(
        () => semanticMaterialDescriptorModel(configured({
          "intelligence.providers.openrouter.model": value
        })),
        /intelligence\.providers\.openrouter\.model.*non-empty string/
      );
    }
  });
});
