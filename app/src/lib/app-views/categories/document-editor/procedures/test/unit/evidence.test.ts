import { describe, expect, it } from "vitest";

import {
  compactEvidenceSourceTitle,
  exactEvidenceText
} from "$app-views/categories/document-editor/procedures/evidence";
import { asId } from "$representation/data/behavior/core/id";
import type { SemanticTextCitation } from "$representation/data/types/semantic/derived-output";

const citation = (): SemanticTextCitation => {
  const first = "The Atlas beacon emits at 43 kilohertz.";
  const second = "Garry's age is 53.";
  const text = `${first}\n\n${second}`;
  const firstFrom = text.indexOf(first);
  const secondFrom = text.indexOf(second);
  return {
    selections: [{ evidenceId: "evidence-1", use: "States Garry's age" }],
    source: {
      ref: { kind: "document", id: asId<"documents">("documents:source") },
      revision: 5,
      encoding: "utf-16"
    },
    span: { from: 0, to: text.length, text },
    locators: [
      {
        from: firstFrom,
        to: firstFrom + first.length,
        locator: {
          kind: "documentBlock",
          area: "body",
          rowId: "row:first",
          blockPath: ["block:first"]
        }
      },
      {
        from: secondFrom,
        to: secondFrom + second.length,
        locator: {
          kind: "documentBlock",
          area: "body",
          rowId: "row:second",
          blockPath: ["block:second"]
        }
      }
    ],
    overlayGeneration: 37
  };
};

describe("document Prompt Block evidence presentation", () => {
  it("shows the exact current-schema span", () => {
    expect(exactEvidenceText(citation())).toBe(
      "The Atlas beacon emits at 43 kilohertz.\n\nGarry's age is 53."
    );
  });

  it("shows source-title clocks at minute precision", () => {
    expect(compactEvidenceSourceTitle("Derived Output proof · 9:28:40 PM")).toBe(
      "Derived Output proof · 9:28 PM"
    );
    expect(compactEvidenceSourceTitle("Untitled document 1")).toBe("Untitled document 1");
  });
});
