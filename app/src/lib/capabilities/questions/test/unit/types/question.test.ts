import { describe, expect, it } from "vitest";
import {
  questionStatus,
  questionStatusValidator,
  questionText,
  type QuestionStatus
} from "$questions/types/question";
import { questionsRefusal } from "$questions/errors";

const refusalFromCall = (call: () => unknown) => {
  try {
    call();
  } catch (error) {
    return questionsRefusal(error);
  }
  return undefined;
};

describe("question status", () => {
  it("admits exactly where a question can stand", () => {
    const values = questionStatusValidator.members.map((member) => member.value).sort();

    expect(values).toEqual(["answered", "investigating", "open"]);
  });

  it("has no parked, so the door refuses one", () => {
    const values = questionStatusValidator.members.map((member) => member.value);

    // The validator is the refusal: a literal it does not list is rejected before
    // a handler runs. A question nobody intends to pursue is deleted — `open`
    // already covers one that is waiting, and the honest signal is its absence.
    expect(values).not.toContain("parked");
  });
});

describe("questionStatus", () => {
  it("passes through every status the validator lists", () => {
    for (const member of questionStatusValidator.members) {
      expect(questionStatus(member.value)).toBe(member.value);
    }
  });

  it("refuses parked, one step behind the door that already does", () => {
    expect(refusalFromCall(() => questionStatus("parked" as QuestionStatus))).toMatchObject({
      code: "unknown-status"
    });
  });
});

describe("questionText", () => {
  it("trims, because a question is reached by reading it", () => {
    expect(questionText("  Why did margin fall?  ")).toBe("Why did margin fall?");
  });

  it("refuses a question with nothing asked in it", () => {
    expect(refusalFromCall(() => questionText("   "))).toMatchObject({ code: "empty-text" });
  });
});
