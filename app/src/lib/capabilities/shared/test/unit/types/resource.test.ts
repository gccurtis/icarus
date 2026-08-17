import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { kindMatches, resourceKindValidator, resourceRefValidator } from "$shared/types/resource";

describe("kindMatches", () => {
  /**
   * The negative cases come first because they are the reason the function
   * exists. A `startsWith` passes every positive case below and fails these.
   */
  describe("what it must not match", () => {
    it("does not match a longer word sharing a prefix", () => {
      expect(kindMatches("connector::google", "connector::googlesheets")).toBe(false);
    });

    it("does not match a partial first segment", () => {
      expect(kindMatches("ext", "external")).toBe(false);
      expect(kindMatches("extern", "external::image")).toBe(false);
    });

    it("does not match a narrower pattern against a broader kind", () => {
      // The pattern is the prefix, never the other way round.
      expect(kindMatches("external::image", "external")).toBe(false);
    });

    it("does not match a different family", () => {
      expect(kindMatches("external", "document")).toBe(false);
      expect(kindMatches("external::image", "external::data")).toBe(false);
    });

    it("does not match on a shared later segment", () => {
      expect(kindMatches("connector::drive", "external::drive")).toBe(false);
    });
  });

  describe("what it matches", () => {
    it("matches a kind against itself", () => {
      expect(kindMatches("document", "document")).toBe(true);
      expect(kindMatches("external::web-page", "external::web-page")).toBe(true);
    });

    it("matches a family against its members", () => {
      expect(kindMatches("external", "external::image")).toBe(true);
      expect(kindMatches("external", "external::web-page")).toBe(true);
      expect(kindMatches("connector", "connector::google-docs")).toBe(true);
    });

    it("matches at arbitrary depth, with no special case per level", () => {
      // The comparison never knows how many levels there are, so a subkind can
      // have a subkind and nothing has to be taught about it.
      expect(kindMatches("connector", "connector::google-docs::v1")).toBe(true);
      expect(kindMatches("connector::google-docs", "connector::google-docs::v1")).toBe(true);
      expect(kindMatches("a::b::c", "a::b::c::d::e")).toBe(true);
    });

    it("treats a hyphen as an ordinary character inside a segment", () => {
      expect(kindMatches("external::web-page", "external::web-page")).toBe(true);
      expect(kindMatches("external::web", "external::web-page")).toBe(false);
    });
  });
});

describe("resourceKindValidator", () => {
  it("is an open string, so a kind can grow with an integration", () => {
    // A closed union would make every new connector a schema change. The cost is
    // stated and accepted: a typo is a silent miss rather than a rejected write.
    expect(resourceKindValidator.kind).toBe("string");
    expect(validate(resourceKindValidator, "connector::something-nobody-has-built")).toBe(true);
  });

  it("still refuses a kind that is not a string at all", () => {
    expect(validate(resourceKindValidator, 7)).toBe(false);
    expect(validate(resourceKindValidator, { kind: "document" })).toBe(false);
  });
});

describe("resourceRefValidator", () => {
  it("keeps kind and id as separate fields", () => {
    // A concatenated key would force every reader to split it back apart, and the
    // whole point of the kind is that it is readable without parsing an id.
    expect(Object.keys(resourceRefValidator.fields).sort()).toEqual(["id", "kind"]);
  });

  it("admits a ref carrying a subkind", () => {
    expect(validate(resourceRefValidator, { kind: "external::web-page", id: "f1" })).toBe(true);
  });

  describe("what it refuses", () => {
    it("refuses a ref with no kind", () => {
      expect(validate(resourceRefValidator, { id: "d1" })).toBe(false);
    });

    it("refuses a ref with no id", () => {
      expect(validate(resourceRefValidator, { kind: "document" })).toBe(false);
    });
  });
});
