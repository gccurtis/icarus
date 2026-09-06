import { describe, expect, it } from "vitest";

import {
  emptyTemplateInspectorTitle,
  selectedTemplateIdIn,
  templateDetail
} from "$app-views/categories/templates/procedures/library.svelte";

describe("template library view procedures", () => {
  it("does not issue a detail read when no template is selected", () => {
    expect(templateDetail(undefined)).toBeUndefined();
  });

  it("does not send restored legacy or deleted selections to the detail read", () => {
    expect(selectedTemplateIdIn("tp-cost", [])).toBeUndefined();
    expect(selectedTemplateIdIn("templates:gone", ["templates:1"])).toBeUndefined();
    expect(selectedTemplateIdIn("templates:1", ["templates:1"])).toBe("templates:1");
  });

  it("distinguishes an empty library from an unselected populated library", () => {
    expect(emptyTemplateInspectorTitle(0)).toBe("No templates exist.");
    expect(emptyTemplateInspectorTitle(1)).toBe("Select a template to inspect it.");
    expect(emptyTemplateInspectorTitle(undefined)).toBe("Select a template to inspect it.");
  });
});
