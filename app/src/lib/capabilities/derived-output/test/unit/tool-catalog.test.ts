import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { DERIVED_AGENT_TOOL_CATALOG } from "$capabilities/derived-output/api/shared/tool-catalog";

describe("Derived Output agent tool catalogue", () => {
  it("records the complete unique executable sightline", () => {
    assert.equal(DERIVED_AGENT_TOOL_CATALOG.length, 16);
    assert.equal(new Set(DERIVED_AGENT_TOOL_CATALOG.map((tool) => tool.name)).size, 16);
    assert.deepEqual(
      DERIVED_AGENT_TOOL_CATALOG.filter((tool) => tool.mode === "evidence").map(
        (tool) => tool.name
      ),
      [
        "retrieve",
        "retrieve_materials",
        "read_selection",
        "read_text",
        "read_table",
        "read_csv",
        "read_chart",
        "read_code",
        "read_image"
      ]
    );
    assert.deepEqual(
      DERIVED_AGENT_TOOL_CATALOG.filter((tool) => tool.mode === "orientation").map(
        (tool) => tool.name
      ),
      [
        "find_resources",
        "list_document_blocks",
        "list_presentation_slides",
        "inspect_slide",
        "view_slide",
        "inspect_dataset",
        "inspect_code"
      ]
    );
  });

  it("keeps descriptor discovery and slide navigation at their distinct authority levels", () => {
    const materials = DERIVED_AGENT_TOOL_CATALOG.find(
      (tool) => tool.name === "retrieve_materials"
    );
    assert.ok(materials !== undefined);
    assert.equal(materials.mode, "evidence");
    assert.ok("evidence" in materials);
    assert.equal(materials.evidence, "descriptor");

    const slides = DERIVED_AGENT_TOOL_CATALOG.find(
      (tool) => tool.name === "list_presentation_slides"
    );
    assert.equal(slides?.mode, "orientation");
    assert.match(slides?.sees ?? "", /slide IDs/i);
    assert.doesNotMatch(slides?.sees ?? "", /element|range|material/i);
  });
});
