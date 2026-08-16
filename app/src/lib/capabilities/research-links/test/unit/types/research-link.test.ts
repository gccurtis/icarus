import { describe, expect, it } from "vitest";
import { researchLinksRefusal } from "$research-links/errors";
import {
  researchLinkBearing,
  researchLinkNote,
  researchLinkPair,
  type LinkBearerKind,
  type LinkBearing,
  type LinkSubjectKind
} from "$research-links/types/research-link";

const refusalOf = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return researchLinksRefusal(error);
  }
};

/** A kind the validators exclude, as a caller reaching past them would send it. */
const asBearer = (kind: string) => kind as LinkBearerKind;
const asSubject = (kind: string) => kind as LinkSubjectKind;

describe("researchLinkPair", () => {
  it("admits the three pairings the model has, and only those", () => {
    expect(researchLinkPair("finding", "hypothesis")).toBeUndefined();
    expect(researchLinkPair("finding", "question")).toBeUndefined();
    expect(researchLinkPair("hypothesis", "question")).toBeUndefined();
  });

  it("refuses a hypothesis bearing on a hypothesis", () => {
    // The one illegal pair the validators still admit: both kinds are legal,
    // the pairing is not.
    expect(refusalOf(() => researchLinkPair("hypothesis", asSubject("hypothesis")))).toMatchObject({
      code: "illegal-pair"
    });
  });

  it("refuses a finding as the subject of anything", () => {
    // Direction runs finding → hypothesis → question. Reversed, the same
    // relationship could be stored two ways and every read would query both
    // directions and merge.
    for (const bearer of ["finding", "hypothesis"] as const) {
      expect(refusalOf(() => researchLinkPair(bearer, asSubject("finding")))).toMatchObject({
        code: "illegal-pair"
      });
    }
  });

  it("refuses a question as the bearer of anything", () => {
    // A question bears on nothing: it is the most general end of the chain.
    for (const subject of ["hypothesis", "question", "finding"]) {
      expect(
        refusalOf(() => researchLinkPair(asBearer("question"), asSubject(subject)))
      ).toMatchObject({ code: "illegal-pair" });
    }
  });
});

describe("researchLinkBearing", () => {
  it("keeps a finding's bearing toward its subject", () => {
    for (const bearing of ["supports", "contradicts", "neutral"] as const) {
      expect(researchLinkBearing("finding", bearing)).toBe(bearing);
    }
  });

  it("leaves a link with no bearing alone, whichever kind bears it", () => {
    expect(researchLinkBearing("finding", undefined)).toBeUndefined();
    expect(researchLinkBearing("hypothesis", undefined)).toBeUndefined();
  });

  it("refuses a bearing on a hypothesis, which proposes rather than evidences", () => {
    // A hypothesis addressing a question is not evidence, so "supports" would be
    // a claim about the proposal's own truth that nothing here can hold.
    expect(refusalOf(() => researchLinkBearing("hypothesis", "supports"))).toMatchObject({
      code: "bearing-not-evidence"
    });
  });

  it("refuses a bearing the model does not have", () => {
    expect(
      refusalOf(() => researchLinkBearing("finding", "refutes" as LinkBearing))
    ).toMatchObject({ code: "unknown-bearing" });
  });
});

describe("researchLinkNote", () => {
  it("stores the sentence without the whitespace around it", () => {
    expect(researchLinkNote("  Invoices confirm the input cost move  ")).toBe(
      "Invoices confirm the input cost move"
    );
  });

  it("treats a blank note as no note at all", () => {
    // An empty string is not a justification, and storing one would make "has a
    // note" false where it reads as true.
    expect(researchLinkNote("   ")).toBeUndefined();
    expect(researchLinkNote(undefined)).toBeUndefined();
  });
});
