import { describe, expect, it } from "vitest";
import {
  latticeCauseValidator,
  latticeNodeSetValidator
} from "$knowledge/types/lattice-change";
import { rebuildReasonValidator } from "$knowledge/types/lattice-version";
import { resourceTypeValidator } from "$revisions/types/change";

/** One variant's fields, read structurally — the union's own type narrows to none. */
type Fields = Record<string, { kind: string; members?: { value: string }[] }>;

const causeNamed = (kind: string): Fields =>
  latticeCauseValidator.members.find((member) => member.fields.kind.value === kind)
    ?.fields as unknown as Fields;

describe("latticeCauseValidator", () => {
  it("admits every cause the model defines", () => {
    const kinds = latticeCauseValidator.members.map((member) => member.fields.kind.value).sort();

    expect(kinds).toEqual(["connector_sync", "file", "finding", "rebuild", "resource"]);
  });

  it("makes a resource cause carry the change-set revision it followed", () => {
    // Without it a stale retrieval result is unattributable: you can see the
    // lattice is behind and not what it is behind.
    const resource = causeNamed("resource");

    expect(Object.keys(resource).sort()).toEqual(
      ["kind", "resourceType", "resourceId", "revision"].sort()
    );
    expect(resource.revision.kind).toBe("float64");
  });

  it("names the general resources by the same validator revisions does", () => {
    // A second spelling of the three would drift from the table whose revisions
    // this points at.
    expect(causeNamed("resource").resourceType.members?.map((member) => member.value)).toEqual(
      resourceTypeValidator.members.map((member) => member.value)
    );
  });

  it("gives the other causes no revision, because they follow no sequence", () => {
    for (const kind of ["file", "connector_sync", "finding", "rebuild"]) {
      expect(Object.keys(causeNamed(kind))).not.toContain("revision");
    }
  });

  it("holds a connector as a string until pass 8 brings the table", () => {
    expect(causeNamed("connector_sync").connectorId.kind).toBe("string");
    expect(causeNamed("file").fileId.kind).toBe("id");
    expect(causeNamed("finding").findingId.kind).toBe("id");
  });

  it("orders a rebuild by the same reasons the version row records", () => {
    expect(causeNamed("rebuild").reason.members?.map((member) => member.value)).toEqual(
      rebuildReasonValidator.members.map((member) => member.value)
    );
  });
});

describe("latticeNodeSetValidator", () => {
  it("lists what appeared and what went, and counts what stayed", () => {
    const fields = latticeNodeSetValidator.fields;

    expect(Object.keys(fields).sort()).toEqual(
      ["source", "added", "removed", "unchanged"].sort()
    );
    expect(fields.added.element.tableName).toBe("latticeNodes");
    expect(fields.removed.element.tableName).toBe("latticeNodes");
    expect(fields.unchanged.kind).toBe("float64");
  });

  it("has no modified, because a changed passage is a different node", () => {
    // A node's identity is its content and its embedding together. Modelling an
    // edit as a modification would imply the node persists across it.
    expect(Object.keys(latticeNodeSetValidator.fields)).not.toContain("modified");
  });
});
