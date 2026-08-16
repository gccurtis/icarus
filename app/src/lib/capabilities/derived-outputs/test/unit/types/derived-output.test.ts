import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import type { Id } from "$convex/_generated/dataModel";
import { derivedOutputsRefusal } from "$derived-outputs/errors";
import {
  derivedBlock,
  derivedInputValidator,
  derivedInputs,
  derivedPrompt,
  emptyBlock,
  inputRevisionValidator,
  type ContentBlockOrList,
  type DerivedInput
} from "$derived-outputs/types/derived-output";

type Fields = Record<string, { kind: string; isOptional: string }>;

/** Members are looked up by their `kind` literal — never by position. */
const inputFields = (kind: string): Fields =>
  derivedInputValidator.members.find((member) => member.fields.kind.value === kind)!
    .fields as unknown as Fields;

const revisionFields = (kind: string): Fields =>
  inputRevisionValidator.members.find((member) => member.fields.kind.value === kind)!
    .fields as unknown as Fields;

const refusalOf = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error: unknown) {
    return derivedOutputsRefusal(error);
  }
};

describe("derivedInputValidator", () => {
  it("names the five things an output can be derived from", () => {
    expect(derivedInputValidator.members.map((m) => m.fields.kind.value).sort()).toEqual([
      "file",
      "finding",
      "lattice",
      "question",
      "resource"
    ]);
  });

  it("takes a resource by its whole key, because the id alone is not one", () => {
    expect(Object.keys(inputFields("resource")).sort()).toEqual([
      "kind",
      "resourceId",
      "resourceType"
    ]);
    expect(
      validate(derivedInputValidator, {
        kind: "resource",
        resourceType: "document",
        resourceId: "documents:1"
      })
    ).toBe(true);
    expect(
      validate(derivedInputValidator, { kind: "resource", resourceId: "documents:1" })
    ).toBe(false);
  });

  it("makes the lattice input a query rather than a set", () => {
    // The one input that resolves differently over time by design: "the top
    // passages about pricing" is not a list of things that can be compared.
    expect(validate(derivedInputValidator, { kind: "lattice", query: "pricing", limit: 8 })).toBe(
      true
    );
    expect(validate(derivedInputValidator, { kind: "lattice", query: "pricing" })).toBe(true);
    expect(validate(derivedInputValidator, { kind: "lattice", refs: ["x"] })).toBe(false);
  });

  it("lets a question pull the findings hanging off it, and does not assume it", () => {
    expect(
      validate(derivedInputValidator, { kind: "question", questionId: "questions:1" })
    ).toBe(true);
    expect(
      validate(derivedInputValidator, {
        kind: "question",
        questionId: "questions:1",
        includeFindings: true
      })
    ).toBe(true);
  });
});

describe("inputRevisionValidator", () => {
  it("records a revision for what has one, and identity for what does not", () => {
    // A resource is edited in place, so its revision is the comparison. A file's
    // bytes are immutable — a replacement is a different row — so its id is its
    // revision and there is nothing to compare.
    expect(revisionFields("resource").revision.kind).toBe("float64");
    expect(Object.keys(revisionFields("file")).sort()).toEqual(["fileId", "kind"]);
    expect(Object.keys(revisionFields("finding")).sort()).toEqual(["findingId", "kind"]);
  });

  it("takes any resource kind, where a declared resource input takes three", () => {
    // A finding is durable project content whose writeup is revised in place, so
    // it is recorded as a resource even though it is declared as its own kind.
    expect(
      validate(inputRevisionValidator, {
        kind: "resource",
        resourceType: "finding",
        resourceId: "findings:1",
        revision: 3
      })
    ).toBe(true);
    expect(
      validate(derivedInputValidator, {
        kind: "resource",
        resourceType: "finding",
        resourceId: "findings:1"
      })
    ).toBe(false);
  });

  it("refuses a revision that is not a number, which is what a comparison needs", () => {
    expect(
      validate(inputRevisionValidator, {
        kind: "resource",
        resourceType: "document",
        resourceId: "documents:1",
        revision: "3"
      })
    ).toBe(false);
  });
});

describe("derivedPrompt", () => {
  it("stores what was asked for, trimmed", () => {
    expect(derivedPrompt("  Summarize the findings  ")).toBe("Summarize the findings");
  });

  it("refuses a prompt with nothing in it", () => {
    // The prompt is the whole instruction and it lives only here, so an empty
    // one is a row that can never generate anything.
    expect(refusalOf(() => derivedPrompt("   "))).toMatchObject({
      capability: "derived-outputs",
      code: "empty-prompt"
    });
  });
});

describe("derivedInputs", () => {
  it("keeps a declared set as declared", () => {
    const inputs = [
      { kind: "file", fileId: "externalFiles:1" as Id<"externalFiles"> },
      { kind: "lattice", query: "pricing", limit: 5 }
    ] satisfies DerivedInput[];

    expect(derivedInputs([...inputs])).toEqual(inputs);
  });

  it("takes an empty set, because a prompt over nothing is still a prompt", () => {
    expect(derivedInputs([])).toEqual([]);
  });

  it("refuses a lattice input with nothing to search for", () => {
    expect(refusalOf(() => derivedInputs([{ kind: "lattice", query: "  " }]))).toMatchObject({
      code: "empty-query"
    });
  });

  it("refuses a lattice limit that admits nothing", () => {
    expect(
      refusalOf(() => derivedInputs([{ kind: "lattice", query: "pricing", limit: 0 }]))
    ).toMatchObject({ code: "lattice-limit" });
  });
});

describe("derivedBlock", () => {
  const block = emptyBlock();

  it("takes one block", () => {
    expect(derivedBlock(block)).toEqual(block);
  });

  it("gives the block the output's one id, whatever the generator called it", () => {
    // One block, one id space, and nothing addresses it — a generator-chosen id
    // would look like an identity that survives a refresh, and none does.
    expect(derivedBlock({ ...block, id: "whatever-the-model-said" }).id).toBe("generated");
  });

  it("refuses a list, whatever length it is", () => {
    // The generator's output is parsed from a model's answer, so a list is
    // exactly what it will sometimes be. Storing the first would silently drop
    // the rest; storing all of them would make a position hold several blocks.
    for (const list of [[], [block], [block, block]] as ContentBlockOrList[]) {
      expect(refusalOf(() => derivedBlock(list))).toMatchObject({ code: "block-list" });
    }
  });
});

describe("emptyBlock", () => {
  it("is a real block, so an output has something to render before it generates", () => {
    // `block` is required and neither a failure nor a fresh declaration clears
    // it, which means there is never a moment where a consumer holds nothing.
    expect(validate(derivedInputValidator, emptyBlock())).toBe(false);
    expect(emptyBlock()).toMatchObject({ type: "text", display: "", atoms: [], marks: [] });
  });
});
