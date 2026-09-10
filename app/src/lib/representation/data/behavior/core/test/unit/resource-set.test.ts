import { describe, expect, it } from "vitest";

import type { ResourceRef } from "$representation/data/types/core/resource";
import { admitResourceRef } from "$representation/data/behavior/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import {
  isReusableResourceSetRow,
  resourceSetReferenceIssue,
  resolveResourceSet
} from "$representation/data/behavior/core/resource-set";
import {
  admitResourceSetRow,
  admitReusableResourceSetRow,
  admittedResourceSetClaim,
  admittedReusableResourceSets
} from "$representation/data/behavior/core/resource-set-rows";

const catalogue: ResourceRef[] = [
  admitResourceRef({ kind: "document", id: "documents:1" }),
  admitResourceRef({ kind: "document", id: "documents:2" }),
  admitResourceRef({ kind: "slides", id: "slideDecks:1" }),
  admitResourceRef({ kind: "finding", id: "findings:1" }),
  admitResourceRef({ kind: "externalFile::data", id: "externalFiles:1" })
];

const ids = (refs: readonly ResourceRef[]) => refs.map((ref) => ref.id);

describe("resolveResourceSet", () => {
  it("selects the whole project, minus what is excluded", () => {
    const set: ResourceSet = { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] };
    expect(ids(resolveResourceSet(set, catalogue))).toEqual(["documents:1", "documents:2", "findings:1", "externalFiles:1"]);
  });

  it("matches kinds by segment and named resources only when they exist", () => {
    const set: ResourceSet = {
      include: [
        { select: "kinds", kinds: ["externalFile"] },
        { select: "resources", refs: [
          admitResourceRef({ kind: "document", id: "documents:2" }),
          admitResourceRef({ kind: "document", id: "documents:9" })
        ] }
      ],
      exclude: []
    };
    expect(ids(resolveResourceSet(set, catalogue))).toEqual(["externalFiles:1", "documents:2"]);
  });

  it("follows a named set and stops at a cycle", () => {
    const sets = new Map<string, ResourceSet>([
      ["resourceSets:1", { include: [{ select: "kinds", kinds: ["finding"] }, { select: "set", setId: "resourceSets:2" as never }], exclude: [] }],
      ["resourceSets:2", { include: [{ select: "set", setId: "resourceSets:1" as never }, { select: "kinds", kinds: ["slides"] }], exclude: [] }]
    ]);
    const set: ResourceSet = { include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] };
    expect(ids(resolveResourceSet(set, catalogue, sets))).toEqual(["findings:1", "slideDecks:1"]);
  });

  it("selects nothing from an empty include", () => {
    expect(resolveResourceSet({ include: [], exclude: [] }, catalogue)).toEqual([]);
  });
});

describe("isReusableResourceSetRow", () => {
  it("distinguishes a named reusable row from private or malformed ownership", () => {
    expect(isReusableResourceSetRow({ name: "Evidence" })).toBe(true);
    expect(isReusableResourceSetRow({ name: " Evidence " })).toBe(false);
    expect(isReusableResourceSetRow({ boundTo: { kind: "resource" } })).toBe(false);
    expect(
      isReusableResourceSetRow({ name: "Evidence", boundTo: { kind: "resource" } })
    ).toBe(false);
  });
});

describe("admittedReusableResourceSets", () => {
  const row = (fields: Record<string, unknown> = {}) => ({
    _id: "resourceSets:one",
    _creationTime: 1,
    projectId: "projects:one",
    name: "Evidence",
    set: { include: [{ select: "project" }], exclude: [] },
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: 1,
    ...fields
  });

  it("admits one complete canonical named row", () => {
    const admitted = admitReusableResourceSetRow(row());
    expect(admitted.name).toBe("Evidence");
    expect(Object.hasOwn(admitted, "boundTo")).toBe(false);
    expect(admitted.set).toEqual({ include: [{ select: "project" }], exclude: [] });
  });

  it("admits exact private ownership only through the private row boundary", () => {
    const { name: _name, ...base } = row();
    const privateRow = {
      ...base,
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: "documents:one" },
        hole: "evidence"
      }
    };
    const admitted = admitResourceSetRow(privateRow);
    expect(admitted.name).toBeUndefined();
    expect(Object.hasOwn(admitted, "name")).toBe(false);
    expect(admitted.boundTo).toEqual({
      kind: "resource",
      ref: { kind: "document", id: "documents:one" },
      hole: "evidence"
    });
    expect(() => admitResourceSetRow({
      ...base,
      boundTo: { kind: "resource", resourceId: "documents:one", hole: "evidence" }
    })).toThrow(/names exactly one hole or resource/);
    expect(() => admitResourceSetRow({
      ...base,
      boundTo: {
        kind: "resource",
        ref: { kind: "slides", id: "documents:one" },
        hole: "evidence"
      }
    })).toThrow(/matching row id/);
    expect(() => admitReusableResourceSetRow(privateRow)).toThrow(/private storage/);
    expect(admittedResourceSetClaim([privateRow], "resourceSets:one")).toEqual(admitted);
    expect(() =>
      admittedResourceSetClaim(
        [privateRow, row({ projectId: "projects:other" })],
        "resourceSets:one"
      )
    ).toThrow(/repeats row id/);
  });

  it("fails closed on a duplicate id or any structurally non-current row", () => {
    expect(() =>
      admittedReusableResourceSets(
        [row(), row({ projectId: "projects:other", name: "Foreign duplicate" })],
        "projects:one"
      )
    ).toThrow(/repeats row id/);
    expect(() =>
      admittedReusableResourceSets(
        [row({ set: { include: "everything", exclude: [] } })],
        "projects:one"
      )
    ).toThrow(/include list and an exclude list/);
    expect(() =>
      admittedReusableResourceSets(
        [row({ createdBy: { kind: "user" } })],
        "projects:one"
      )
    ).toThrow(/represented actor/);
    expect(() =>
      admittedReusableResourceSets(
        [row({ legacyScope: { include: [] } })],
        "projects:one"
      )
    ).toThrow(/unknown field legacyScope/);
    expect(() => admitResourceSetRow(row({ legacyScope: {} }))).toThrow(/unknown field legacyScope/);
    expect(() => admitResourceSetRow(row({ boundTo: undefined }))).toThrow(/storable/);
    expect(() => admitResourceSetRow({ ...row(), name: undefined })).toThrow(/storable/);
  });
});

describe("resourceSetReferenceIssue", () => {
  it("finds missing and recursively cyclic named-set graphs", () => {
    const missing = { include: [{ select: "set" as const, setId: "missing" as never }], exclude: [] };
    expect(resourceSetReferenceIssue(missing, new Map())).toEqual({
      kind: "unavailable",
      setId: "missing"
    });

    const sets = new Map([
      ["a", { include: [{ select: "set" as const, setId: "b" as never }], exclude: [] }],
      ["b", { include: [{ select: "set" as const, setId: "a" as never }], exclude: [] }]
    ]);
    expect(resourceSetReferenceIssue(missing, sets)).toEqual({
      kind: "unavailable",
      setId: "missing"
    });
    expect(
      resourceSetReferenceIssue(
        { include: [{ select: "set", setId: "a" as never }], exclude: [] },
        sets
      )
    ).toEqual({ kind: "cycle", setId: "a" });
  });
});
