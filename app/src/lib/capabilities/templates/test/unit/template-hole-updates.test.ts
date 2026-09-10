import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  body,
  model,
  updateTemplate
} from "$capabilities/templates/test/unit/template-answer-fixture";

describe("replacing the hole list", () => {
  test("keeps a hole the body names and accepts a list that declares it", async () => {
    const dropped = await updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: { holes: [] } });
    assert.deepEqual(dropped, {
      accepted: false,
      templateId: "templates:1",
      reason: "hole-in-use",
      revision: 1,
      detail: "the body still names evidence"
    });

    const kept = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        holes: [
          { name: "evidence", label: "Evidence", kind: "scope", description: "What happened" },
          { name: "models", label: "Models", kind: "scope", default: { include: [{ select: "project" }], exclude: [] } }
        ]
      }
    });
    assert.deepEqual(kept, { accepted: true, templateId: "templates:1", revision: 2 });
    assert.deepEqual(
      (model.tables.templates[0].holes as { name: string }[]).map((hole) => hole.name),
      ["evidence", "models"]
    );
  });
});
