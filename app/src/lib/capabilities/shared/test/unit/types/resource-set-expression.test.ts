import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import {
  normalize,
  resourceSetExpressionValidator,
  selectorValidator,
  type Selector
} from "$shared/types/resource-set-expression";

const project: Selector = { kind: "project" };
const kind = (resourceKind: string): Selector => ({ kind: "resourceKind", resourceKind });
const resource = (refKind: string, id: string): Selector => ({
  kind: "resource",
  ref: { kind: refKind, id }
});
const set = (setId: string): Selector => ({ kind: "set", setId });

describe("normalize", () => {
  /**
   * The cases that make an expression smaller are the reason it exists: a
   * canonical form is what makes two sets comparable, and under the old tree the
   * same set had many spellings and none of them could be diffed.
   */
  describe("what it removes", () => {
    it("drops every other include when the whole project is included", () => {
      const result = normalize({
        include: [kind("document"), project, resource("document", "d1")],
        exclude: []
      });

      expect(result.include).toEqual([project]);
    });

    it("drops a resource its own list already covers by kind", () => {
      const result = normalize({
        include: [kind("external"), resource("external::image", "f1")],
        exclude: []
      });

      expect(result.include).toEqual([kind("external")]);
    });

    it("drops a narrower kind its own list already covers", () => {
      // Goes past the letter of the design table, which names only the
      // kind-over-resource case. Leaving this alone would leave one set with two
      // spellings, which is precisely what the canonical form is for.
      const result = normalize({ include: [kind("external"), kind("external::image")], exclude: [] });

      expect(result.include).toEqual([kind("external")]);
    });

    it("collapses duplicates", () => {
      const result = normalize({
        include: [resource("document", "d1"), resource("document", "d1")],
        exclude: [set("s1"), set("s1")]
      });

      expect(result.include).toEqual([resource("document", "d1")]);
      expect(result.exclude).toEqual([set("s1")]);
    });

    it("lets exclude win when a selector is in both lists", () => {
      const result = normalize({
        include: [kind("document"), set("s1")],
        exclude: [set("s1")]
      });

      expect(result.include).toEqual([kind("document")]);
      expect(result.exclude).toEqual([set("s1")]);
    });

    it("absorbs before subtracting, so excluding the project leaves nothing", () => {
      // include (project ∪ documents) minus project is nothing, because documents
      // are in the project. Subtracting first would leave the documents behind.
      const result = normalize({
        include: [project, kind("document")],
        exclude: [project]
      });

      expect(result.include).toEqual([]);
    });

    it("applies absorption inside the exclude list too", () => {
      const result = normalize({
        include: [project],
        exclude: [kind("external"), resource("external::image", "f1")]
      });

      expect(result.exclude).toEqual([kind("external")]);
    });
  });

  describe("what it leaves alone", () => {
    it("leaves an empty include empty, rather than making it everything", () => {
      // An empty list is what an unfinished form produces. A default that quietly
      // meant "the whole project" is how a scope somebody meant to narrow leaks
      // the lot. Everything is `{ include: [project] }`, said out loud.
      expect(normalize({ include: [], exclude: [] }).include).toEqual([]);
      expect(normalize({ include: [], exclude: [kind("document")] }).include).toEqual([]);
    });

    it("keeps a resource no kind in its list covers", () => {
      const result = normalize({
        include: [kind("external"), resource("document", "d1")],
        exclude: []
      });

      expect(result.include).toContainEqual(resource("document", "d1"));
      expect(result.include).toContainEqual(kind("external"));
    });

    it("keeps a set, which is opaque until it resolves", () => {
      // Nothing can be said from here about what a set contains, so nothing may
      // absorb it — not even the project.
      const result = normalize({ include: [project, set("s1")], exclude: [] });

      expect(result.include).toEqual([project]);
      expect(normalize({ include: [set("s1"), set("s2")], exclude: [] }).include).toHaveLength(2);
    });

    it("does not let a narrower kind absorb its own family", () => {
      const result = normalize({ include: [kind("external::image"), kind("external")], exclude: [] });

      expect(result.include).toEqual([kind("external")]);
    });
  });

  describe("canonical form", () => {
    it("gives one representation to a set written two ways", () => {
      const one = normalize({ include: [kind("document"), set("s1")], exclude: [] });
      const other = normalize({ include: [set("s1"), kind("document")], exclude: [] });

      expect(one).toEqual(other);
    });

    it("is idempotent", () => {
      const once = normalize({
        include: [project, kind("document"), resource("document", "d1")],
        exclude: [kind("external"), resource("external::image", "f1")]
      });

      expect(normalize(once)).toEqual(once);
    });

    it("produces something a validator still admits", () => {
      const result = normalize({
        include: [project, kind("document")],
        exclude: [resource("document", "d1")]
      });

      expect(validate(resourceSetExpressionValidator, result)).toBe(true);
    });
  });
});

describe("selectorValidator", () => {
  it("names four selectors and no combining operators", () => {
    // Union and difference are the two lists themselves. A tree of them
    // normalizes to one include set and one exclude set, so there is nothing for
    // an operator node to say.
    const kinds = selectorValidator.members.map((member) => member.fields.kind.value as string);

    expect(kinds.sort()).toEqual(["project", "resource", "resourceKind", "set"]);
    for (const absent of ["union", "difference", "intersection"]) {
      expect(kinds).not.toContain(absent);
    }
  });

  describe("what it refuses", () => {
    it("refuses the old op-tagged spelling", () => {
      expect(validate(selectorValidator, { op: "project" })).toBe(false);
      expect(validate(selectorValidator, { op: "kind", kind: "document" })).toBe(false);
    });

    it("refuses a resource selector holding a bare id", () => {
      expect(validate(selectorValidator, { kind: "resource", id: "d1" })).toBe(false);
    });

    it("refuses a project selector carrying anything else", () => {
      expect(validate(selectorValidator, { kind: "project", resourceKind: "document" })).toBe(false);
    });
  });
});

describe("resourceSetExpressionValidator", () => {
  it("requires both lists, so an absent one cannot mean two things", () => {
    expect(validate(resourceSetExpressionValidator, { include: [project] })).toBe(false);
    expect(validate(resourceSetExpressionValidator, { exclude: [] })).toBe(false);
    expect(validate(resourceSetExpressionValidator, { include: [], exclude: [] })).toBe(true);
  });

  it("refuses a nested expression, because there is no nesting", () => {
    expect(
      validate(resourceSetExpressionValidator, {
        include: [{ include: [project], exclude: [] }],
        exclude: []
      })
    ).toBe(false);
  });
});
