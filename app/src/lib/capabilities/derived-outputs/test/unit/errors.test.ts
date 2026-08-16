import { describe, expect, it } from "vitest";
import { DerivedOutputsError } from "$derived-outputs/errors";

describe("DerivedOutputsError", () => {
  it("names the capability the way the deployment does", () => {
    // The discriminant a client switches on is the door's name —
    // `api.capabilities.derivedOutputs.*` — because that is the only spelling of
    // this capability a caller ever sees. A second spelling in the payload makes
    // the switch depend on which side of the wire wrote it.
    expect(new DerivedOutputsError("empty-prompt", "empty").data.capability).toBe("derivedOutputs");
  });
});
