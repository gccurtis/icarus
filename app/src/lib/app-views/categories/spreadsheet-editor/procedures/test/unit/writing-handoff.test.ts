import { describe, expect, it } from "vitest";

import {
  continueWritingHandoff,
  type WritingHandoff
} from "$app-views/categories/spreadsheet-editor/procedures/writing-handoff";

describe("spreadsheet grid-to-field writing handoff", () => {
  it("keeps every seed received before the input owns focus", () => {
    let handoff: WritingHandoff | undefined;
    handoff = continueWritingHandoff(handoff, "", "D");
    handoff = continueWritingHandoff(handoff, "", "urable");
    handoff = continueWritingHandoff(handoff, "", " sheet proof");

    expect(handoff).toEqual({ text: "Durable sheet proof", selectAll: false });
  });

  it("replaces an existing value when writing follows Enter before focus", () => {
    let handoff: WritingHandoff | undefined;
    handoff = continueWritingHandoff(handoff, "old value", "");
    expect(handoff).toEqual({ text: "old value", selectAll: true });

    handoff = continueWritingHandoff(handoff, "old value", "N");
    expect(handoff).toEqual({ text: "N", selectAll: false });
  });
});
