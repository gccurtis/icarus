import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import { blockValidator } from "$content/types/block";
import { derivedOutputsTables } from "$derived-outputs/schema";
import {
  derivedInputValidator,
  inputRevisionValidator
} from "$derived-outputs/types/derived-output";

const fields = () => derivedOutputsTables.derivedOutputs.validator.fields;

const paragraph = {
  id: "generated",
  type: "text",
  variant: "paragraph",
  atoms: [{ id: "g1", kind: "literal", text: "Revenue grew 12%." }],
  display: "Revenue grew 12%.",
  marks: []
};

/**
 * Generated content that stays connected to what it was generated from. The
 * schema is where two claims are either true or quietly abandoned: that an
 * output fills one position, and that what it was derived from is declared
 * rather than inferred.
 */
describe("derivedOutputs schema", () => {
  it("leads every index with projectId", () => {
    const indexes = derivedOutputsTables.derivedOutputs[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds the prompt, its inputs, what they were, and the content", () => {
    expect(Object.keys(fields()).sort()).toEqual(
      [
        "projectId",
        "prompt",
        "scope",
        "inputs",
        "block",
        "state",
        "error",
        "model",
        "inputsAt",
        "latticeVersion",
        "refreshedAt",
        "createdBy",
        "updatedAt"
      ].sort()
    );
  });

  it("stores exactly one block, never a list", () => {
    // A derived output fills the position a prompt block occupies, and a
    // position holds one block. A list would make every consumer handle a
    // variable-length insertion into a body it does not own.
    expect(fields().block).toBe(blockValidator);
    expect(fields().block.kind).toBe("union");
    expect(fields().block.isOptional).toBe("required");

    expect(validate(fields().block, paragraph)).toBe(true);
    expect(validate(fields().block, [paragraph])).toBe(false);
    expect(validate(fields().block, [])).toBe(false);
  });

  it("declares its inputs and records separately what they were", () => {
    // Two lists, not one: `inputs` is what this is derived from and `inputsAt`
    // is where those stood when it was generated. Staleness is the comparison
    // between them, so neither can be read off the other.
    expect(fields().inputs.element).toBe(derivedInputValidator);
    expect(fields().inputsAt.element).toBe(inputRevisionValidator);
    expect(fields().inputs.isOptional).toBe("required");
    expect(fields().inputsAt.isOptional).toBe("required");
  });

  it("keeps five states, because stale and error say different things", () => {
    expect(fields().state.members.map((member: { value: string }) => member.value).sort()).toEqual([
      "error",
      "fresh",
      "generating",
      "idle",
      "stale"
    ]);
    expect(validate(fields().state, "refreshing")).toBe(false);
  });

  it("attributes the declaration to an actor and dates the content, not the row", () => {
    expect(fields().createdBy.kind).toBe("union");
    // `refreshedAt` is when this content was generated; `updatedAt` is when the
    // row last moved. A failed attempt moves one and not the other.
    expect(fields().refreshedAt.isOptional).toBe("optional");
    expect(fields().updatedAt.isOptional).toBe("required");
  });

  it("has no history and no revision, because past generations are not kept", () => {
    // A refresh replaces the body wholesale and the generator emits no ops, so
    // there is nothing to reconstruct a previous generation from. Reverting the
    // edit that changed an input is what restores an output.
    expect(fields()).not.toHaveProperty("revision");
    expect(fields()).not.toHaveProperty("previous");
    expect(fields()).not.toHaveProperty("generations");
  });
});
