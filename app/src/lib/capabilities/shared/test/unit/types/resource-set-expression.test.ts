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
const savedSet = (id: string): Selector => ({ kind: "resource", ref: { kind: "resourceSet", id } });
const part = (id: string, scopePath: string): Selector => ({
  kind: "part",
  ref: { kind: "document", id },
  scopePath,
  label: "a paragraph"
});
const web: Selector = { kind: "web" };

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
        exclude: [savedSet("s1"), savedSet("s1")]
      });

      expect(result.include).toEqual([resource("document", "d1")]);
      expect(result.exclude).toEqual([savedSet("s1")]);
    });

    it("lets exclude win when a selector is in both lists", () => {
      const result = normalize({
        include: [kind("document"), savedSet("s1")],
        exclude: [savedSet("s1")]
      });

      expect(result.include).toEqual([kind("document")]);
      expect(result.exclude).toEqual([savedSet("s1")]);
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

    it("absorbs a saved set, because a set is a resource", () => {
      // There is no `set` arm: a resource set *is* a resource, so `project`
      // covers one exactly as it covers any other resource. That is the whole
      // reason a separate arm was not worth having.
      const result = normalize({ include: [project, savedSet("s1")], exclude: [] });

      expect(result.include).toEqual([project]);
      expect(normalize({ include: [savedSet("s1"), savedSet("s2")], exclude: [] }).include).toHaveLength(2);
    });

    it("does not let a narrower kind absorb its own family", () => {
      const result = normalize({ include: [kind("external::image"), kind("external")], exclude: [] });

      expect(result.include).toEqual([kind("external")]);
    });
  });

  describe("part and web are exempt from absorption", () => {
    it("project does not absorb a part", () => {
      // They are different mechanisms, not narrower statements of membership.
      // Retrieval over the document may never surface that paragraph; naming it
      // as a part is what guarantees the response sees it.
      const result = normalize({ include: [project, part("d1", "rows/#r1")], exclude: [] });

      expect(result.include).toHaveLength(2);
      expect(result.include).toContainEqual(part("d1", "rows/#r1"));
    });

    it("a resource does not absorb a part of itself", () => {
      const result = normalize({
        include: [resource("document", "d1"), part("d1", "rows/#r1")],
        exclude: []
      });

      expect(result.include).toHaveLength(2);
    });

    it("project does not absorb web, which belongs to no set", () => {
      const result = normalize({ include: [project, web], exclude: [] });

      expect(result.include).toContainEqual(web);
    });

    it("two parts of one resource at different paths are two selectors", () => {
      const result = normalize({
        include: [part("d1", "rows/#r1"), part("d1", "rows/#r2")],
        exclude: []
      });

      expect(result.include).toHaveLength(2);
    });

    it("the same part twice still collapses", () => {
      // Exempt from absorption is not exempt from deduplication.
      const result = normalize({
        include: [part("d1", "rows/#r1"), part("d1", "rows/#r1")],
        exclude: []
      });

      expect(result.include).toHaveLength(1);
    });

    it("web is still excluded when it appears in both lists", () => {
      const result = normalize({ include: [web], exclude: [web] });

      expect(result.include).toEqual([]);
      expect(result.exclude).toEqual([web]);
    });
  });

  describe("canonical form", () => {
    it("gives one representation to a set written two ways", () => {
      const one = normalize({ include: [kind("document"), savedSet("s1")], exclude: [] });
      const other = normalize({ include: [savedSet("s1"), kind("document")], exclude: [] });

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
  it("names five selectors and no combining operators", () => {
    // Union and difference are the two lists themselves. A tree of them
    // normalizes to one include set and one exclude set, so there is nothing for
    // an operator node to say.
    const kinds = selectorValidator.members.map((member) => member.fields.kind.value as string);

    expect(kinds.sort()).toEqual(["part", "project", "resource", "resourceKind", "web"]);
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
