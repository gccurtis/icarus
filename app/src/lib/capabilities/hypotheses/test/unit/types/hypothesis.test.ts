import { describe, expect, it } from "vitest";
import { hypothesesRefusal } from "$hypotheses/errors";
import {
  hypothesisAssessment,
  hypothesisAssessmentValidator,
  hypothesisConfidence,
  hypothesisStatement,
  type HypothesisAssessment
} from "$hypotheses/types/hypothesis";

const refusalFromCall = (call: () => unknown) => {
  try {
    call();
  } catch (error) {
    return hypothesesRefusal(error);
  }
  return undefined;
};

describe("hypothesis assessment", () => {
  it("admits the three states of work and the three verdicts, as one field", () => {
    const values = hypothesisAssessmentValidator.members.map((member) => member.value).sort();

    expect(values).toEqual(
      ["untested", "testing", "supported", "refuted", "inconclusive"].sort()
    );
  });

  it("includes testing, so work in progress does not read as nobody having started", () => {
    const values = hypothesisAssessmentValidator.members.map((member) => member.value);

    expect(values).toContain("testing");
  });

  it("includes inconclusive, which untested would erase", () => {
    // A real outcome: the work was done and did not settle the question.
    const values = hypothesisAssessmentValidator.members.map((member) => member.value);

    expect(values).toContain("inconclusive");
  });

  it("refuses an assessment the model does not have", () => {
    expect(
      refusalFromCall(() => hypothesisAssessment("proven" as HypothesisAssessment))
    ).toMatchObject({ code: "unknown-assessment" });
  });
});

describe("hypothesisConfidence", () => {
  it("leaves an assessed hypothesis without one absent rather than defaulted", () => {
    // A default of 0 or 0.5 is a fabricated number charts would happily consume.
    expect(hypothesisConfidence("supported", undefined)).toBeUndefined();
  });

  it("keeps the number once there is an assessment to attach it to", () => {
    expect(hypothesisConfidence("supported", 0.8)).toBe(0.8);
  });

  it("refuses a confidence on an untested claim, and clears one on the way back", () => {
    expect(refusalFromCall(() => hypothesisConfidence("untested", 0.8))).toMatchObject({
      code: "confidence-untested"
    });
    expect(hypothesisConfidence("untested", undefined)).toBeUndefined();
  });

  it("refuses a number that is not a probability", () => {
    expect(refusalFromCall(() => hypothesisConfidence("supported", 1.4))).toMatchObject({
      code: "confidence-range"
    });
    expect(refusalFromCall(() => hypothesisConfidence("supported", -0.1))).toMatchObject({
      code: "confidence-range"
    });
    // NaN compares false against every bound, so a range check has to be
    // written as the negation of "in range" to catch it.
    expect(refusalFromCall(() => hypothesisConfidence("supported", Number.NaN))).toMatchObject({
      code: "confidence-range"
    });
  });
});

describe("hypothesisStatement", () => {
  it("trims, because the claim reads next to its assessment in a list", () => {
    expect(hypothesisStatement("  Input costs rose  ")).toBe("Input costs rose");
  });

  it("refuses a hypothesis that claims nothing", () => {
    expect(refusalFromCall(() => hypothesisStatement("  "))).toMatchObject({
      code: "empty-statement"
    });
  });
});
