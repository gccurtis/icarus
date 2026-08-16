import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import {
  researchThreadAnchor,
  researchThreadModeValidator,
  researchThreadTitle,
  type ResearchThreadMode
} from "$research-threads/types/research-thread";

const questionId = "questions:1" as Id<"questions">;
const hypothesisId = "hypotheses:1" as Id<"hypotheses">;

const refusal = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return (error as { data?: unknown }).data;
  }
};

describe("researchThreadModeValidator", () => {
  it("names the three jobs a thread can have", () => {
    const modes = researchThreadModeValidator.members.map((member) => member.value).sort();

    expect(modes).toEqual(["discover", "hypothesis", "question"]);
  });
});

describe("researchThreadAnchor", () => {
  it("lets a discover thread anchor to nothing at all", () => {
    // `discover` is looking for things, driven by its prompt. It is a different
    // job, not a question thread with its question missing.
    expect(researchThreadAnchor("discover", {})).toEqual({
      questionId: undefined,
      hypothesisId: undefined
    });
  });

  it("keeps the anchor its mode names", () => {
    expect(researchThreadAnchor("question", { questionId })).toMatchObject({ questionId });
    expect(researchThreadAnchor("hypothesis", { hypothesisId })).toMatchObject({ hypothesisId });
  });

  it("refuses a pointed thread with nothing to be about", () => {
    expect(refusal(() => researchThreadAnchor("question", {}))).toMatchObject({
      code: "missing-anchor"
    });
    expect(refusal(() => researchThreadAnchor("hypothesis", {}))).toMatchObject({
      code: "missing-anchor"
    });
  });

  it("refuses an anchor the mode does not name, rather than dropping it", () => {
    // Dropping it would store a thread about something other than what was said,
    // and would leave `mode` and the ids free to disagree.
    expect(refusal(() => researchThreadAnchor("discover", { questionId }))).toMatchObject({
      code: "mismatched-anchor"
    });
    expect(
      refusal(() => researchThreadAnchor("question", { questionId, hypothesisId }))
    ).toMatchObject({ code: "mismatched-anchor" });
  });

  it("refuses a mode the model does not have", () => {
    const mode = "browse" as ResearchThreadMode;

    expect(refusal(() => researchThreadAnchor(mode, {}))).toMatchObject({ code: "unknown-mode" });
  });
});

describe("researchThreadTitle", () => {
  it("trims, because it is what every list and mention renders", () => {
    expect(researchThreadTitle("  Where did margin go?  ")).toBe("Where did margin go?");
  });

  it("refuses a thread nobody can pick out of a list", () => {
    expect(refusal(() => researchThreadTitle("   "))).toMatchObject({ code: "empty-title" });
  });
});
