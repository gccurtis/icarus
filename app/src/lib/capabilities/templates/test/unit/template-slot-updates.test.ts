import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  body,
  model,
  updateTemplate
} from "$capabilities/templates/test/unit/template-answer-fixture";

describe("replacing the slot list", () => {
  test("keeps a slot the body names and accepts a list that declares it", async () => {
    const dropped = await updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: { slots: [] } });
    assert.deepEqual(dropped, {
      accepted: false,
      templateId: "templates:1",
      reason: "slot-in-use",
      revision: 1,
      detail: "the body still names evidence"
    });

    const kept = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        slots: [
          { name: "evidence", label: "Evidence", kind: "scope", description: "What happened" },
          { name: "models", label: "Models", kind: "scope", default: { include: [{ select: "project" }], exclude: [] } }
        ]
      }
    });
    assert.deepEqual(kept, { accepted: true, templateId: "templates:1", revision: 2 });
    assert.deepEqual(
      (model.tables.templates[0].slots as { name: string }[]).map((slot) => slot.name),
      ["evidence", "models"]
    );
  });
});
