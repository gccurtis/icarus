import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import { pageSetupValidator } from "$shared/types/page-setup";

const a4 = {
  paper: "a4",
  orientation: "portrait",
  margins: { top: 72, right: 72, bottom: 72, left: 72 }
};

describe("pageSetupValidator", () => {
  it("stores a named size as its name, so A4 stays A4", () => {
    expect(validate(pageSetupValidator, a4)).toBe(true);
    // Resolved to points it is indistinguishable from a custom size that happens
    // to match, and no paper picker can show the right entry.
    expect(validate(pageSetupValidator, { ...a4, paper: { width: 595.28, height: 841.89 } })).toBe(
      true
    );
    expect(validate(pageSetupValidator, { ...a4, paper: "foolscap" })).toBe(false);
  });

  it("admits every named size the model lists", () => {
    for (const paper of ["letter", "legal", "tabloid", "a3", "a4", "a5"]) {
      expect(validate(pageSetupValidator, { ...a4, paper })).toBe(true);
    }
  });

  it("keeps orientation off the paper, because landscape A4 is still A4", () => {
    expect(validate(pageSetupValidator, { ...a4, orientation: "landscape" })).toBe(true);
    expect(validate(pageSetupValidator, { ...a4, orientation: "sideways" })).toBe(false);
    expect(pageSetupValidator.fields.paper.kind).toBe("union");
  });

  it("bounds content on all four sides, and requires every one", () => {
    expect(validate(pageSetupValidator, { ...a4, margins: { top: 72, right: 72, bottom: 72 } })).toBe(
      false
    );
  });
});
