import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import { emptyDocumentBody } from "$documents/types/body";
import { revisionsTables } from "$revisions/schema";
import { emptySlideDeckBody } from "$slide-decks/types/body";
import { emptySpreadsheetBody } from "$spreadsheets/types/body";

const indexesOf = (table: { " indexes"(): { indexDescriptor: string; fields: string[] }[] }) =>
  Object.fromEntries(table[" indexes"]().map((index) => [index.indexDescriptor, index.fields]));

const literalsOf = (union: { members: readonly { value: unknown }[] }) =>
  union.members.map((member) => member.value).sort();

/** Reading a member's own shape leaves the union's type behind; the assertion is the check. */
const asLiteral = (validator: unknown) => validator as { kind: string; value: unknown };

/**
 * The index compositions are read off the table rather than exercised through a
 * fake, which ignores index names — so a wrong field order is only catchable
 * here, and it is the difference between a read of one resource and a read of
 * every resource in the deployment.
 */
describe("revisions schema", () => {
  it("keys the change set indexes on the project and the resource pair, in query order", () => {
    const indexes = indexesOf(revisionsTables.changeSets);

    expect(indexes.by_resource_state).toEqual([
      "projectId",
      "resourceType",
      "resourceId",
      "tier",
      "revision"
    ]);
    expect(indexes.by_resource_revision).toEqual([
      "projectId",
      "resourceType",
      "resourceId",
      "revision"
    ]);
  });

  it("keys the snapshot index on the project, the resource pair, and the role", () => {
    const indexes = indexesOf(revisionsTables.resourceSnapshots);

    expect(indexes.by_resource_role).toEqual([
      "projectId",
      "resourceType",
      "resourceId",
      "role"
    ]);
  });

  it("leads every index with projectId, so a forgotten predicate cannot cross a project", () => {
    for (const table of [revisionsTables.changeSets, revisionsTables.resourceSnapshots]) {
      for (const fields of Object.values(indexesOf(table))) expect(fields[0]).toBe("projectId");
    }
  });

  it("carries what a conflict check reads without parsing a path", () => {
    const fields = revisionsTables.changeSets.validator.fields;

    expect(fields).toHaveProperty("touched");
    expect(fields.touched.element.kind).toBe("string");
  });

  it("holds both revisions, because the question is what changed and not whether", () => {
    const fields = Object.keys(revisionsTables.changeSets.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "resourceType",
        "resourceId",
        "revision",
        "baseRevision",
        "tier",
        "ops",
        "touched",
        "actor",
        "at"
      ].sort()
    );
  });

  it("gives a snapshot a role and a body and nothing to join for", () => {
    const fields = Object.keys(revisionsTables.resourceSnapshots.validator.fields).sort();

    expect(fields).toEqual(
      ["projectId", "resourceType", "resourceId", "revision", "role", "body", "at"].sort()
    );
  });

  it("admits exactly the three snapshot roles", () => {
    expect(literalsOf(revisionsTables.resourceSnapshots.validator.fields.role)).toEqual([
      "base",
      "checkpoint",
      "leader"
    ]);
  });

  it("admits exactly the two tiers, on one table", () => {
    expect(literalsOf(revisionsTables.changeSets.validator.fields.tier)).toEqual([
      "historical",
      "recent"
    ]);
  });

  it("declares a body as one of the three, so each is checked as itself", () => {
    const body = revisionsTables.resourceSnapshots.validator.fields.body;

    expect(body.kind).toBe("union");
    expect(validate(body, emptyDocumentBody())).toBe(true);
    expect(validate(body, emptySlideDeckBody())).toBe(true);
    expect(validate(body, emptySpreadsheetBody())).toBe(true);
    // `v.any()` was what the one implementation cost until all three existed.
    expect(validate(body, { rows: [] })).toBe(false);
    expect(validate(body, { ...emptySlideDeckBody(), slides: [{ id: "s1" }] })).toBe(false);
  });

  it("admits exactly the five ops", () => {
    const ops = revisionsTables.changeSets.validator.fields.ops.element.members;

    expect(ops.map((op) => op.fields.op.value).sort()).toEqual(
      ["set", "insert", "remove", "move", "text"].sort()
    );
  });

  it("lets a text op target literal atoms and nothing else", () => {
    const ops = revisionsTables.changeSets.validator.fields.ops.element.members;
    const target = asLiteral(ops.find((op) => op.fields.op.value === "text")?.fields.target);

    expect(target.kind).toBe("literal");
    expect(target.value).toBe("atom");
  });
});
