import { describe, expect, test } from "vitest";

import { visibleScopeOf } from "$capabilities/derived-output/api/shared/scope-projection";
import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

const output = (scope: TableRow<"derivedOutputs">["scope"]): TableRow<"derivedOutputs"> => ({
  _id: asId<"derivedOutputs">("derivedOutputs:1"),
  _creationTime: 1,
  projectId: asId<"projects">("projects:1"),
  prompt: "Summarize it",
  definitionRevision: 1,
  origin: { kind: "document", id: asId<"documents">("documents:made") },
  scope,
  valueSource: "none",
  queries: [],
  evidence: [],
  state: "idle",
  createdBy: { kind: "user", userId: asId<"users">("users:1") },
  updatedAt: 1
});

const storeWith = (rows: readonly TableRow<"resourceSets">[]): StoreUnitOfWork =>
  ({
    read: (path: string) =>
      path === "resourceSets"
        ? { kind: "table", table: "resourceSets", rows }
        : undefined
  }) as StoreUnitOfWork;

describe("the Derived Output scope read projection", () => {
  test("shows the concrete file rule behind a private resource-owned row", () => {
    const scope = {
      include: [{ select: "set" as const, setId: "resourceSets:bound" as never }],
      exclude: []
    };
    const concrete: ResourceSet = {
      include: [
        {
          select: "resources" as const,
          refs: [{ kind: "document", id: asId<"documents">("documents:2") }]
        }
      ],
      exclude: []
    };
    const store = storeWith([
      {
        _id: asId<"resourceSets">("resourceSets:bound"),
        _creationTime: 1,
        projectId: asId<"projects">("projects:1"),
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: asId<"documents">("documents:made") },
          hole: "source_material"
        },
        set: concrete,
        createdBy: { kind: "user", userId: asId<"users">("users:1") },
        revision: 1,
        updatedAt: 1
      }
    ]);

    expect(visibleScopeOf(store, output(scope))).toEqual(concrete);
  });

  test("keeps named, differently identified, and cross-kind owners opaque", () => {
    const scope = {
      include: [{ select: "set" as const, setId: "resourceSets:1" as never }],
      exclude: []
    };
    const named = {
      _id: "resourceSets:1" as never,
      _creationTime: 1,
      projectId: "projects:1" as never,
      name: "Field evidence",
      set: { include: [{ select: "project" as const }], exclude: [] },
      createdBy: { kind: "user" as const, userId: "users:1" as never },
      revision: 1,
      updatedAt: 1
    };
    expect(visibleScopeOf(storeWith([named]), output(scope))).toBe(scope);

    const { name: _name, ...another } = {
      ...named,
      boundTo: {
        kind: "resource" as const,
        ref: { kind: "document" as const, id: "documents:another" as never },
        hole: "source_material"
      }
    };
    void _name;
    expect(visibleScopeOf(storeWith([another]), output(scope))).toBe(scope);

    const otherKind = {
      ...another,
      boundTo: {
        kind: "resource" as const,
        ref: { kind: "slides" as const, id: "slideDecks:made" as never },
        hole: "source_material"
      }
    };
    expect(visibleScopeOf(storeWith([otherKind]), output(scope))).toBe(scope);
  });

  test("fails closed on an ambiguous private id", () => {
    const scope = {
      include: [{ select: "set" as const, setId: "resourceSets:duplicate" as never }],
      exclude: []
    };
    const owned = {
      _id: "resourceSets:duplicate" as never,
      _creationTime: 1,
      projectId: "projects:1" as never,
      boundTo: {
        kind: "resource" as const,
        ref: { kind: "document" as const, id: "documents:made" as never },
        hole: "source_material"
      },
      set: { include: [{ select: "project" as const }], exclude: [] },
      createdBy: { kind: "system" as const },
      revision: 1,
      updatedAt: 1
    };

    expect(() => visibleScopeOf(storeWith([owned, { ...owned, _creationTime: 2 }]), output(scope)))
      .toThrow(/repeats row id/);
  });

  test("fails closed when a foreign row claims the private id", () => {
    const scope = {
      include: [{ select: "set" as const, setId: "resourceSets:duplicate" as never }],
      exclude: []
    };
    const owned = {
      _id: "resourceSets:duplicate" as never,
      _creationTime: 1,
      projectId: "projects:1" as never,
      boundTo: {
        kind: "resource" as const,
        ref: { kind: "document" as const, id: "documents:made" as never },
        hole: "source_material"
      },
      set: { include: [{ select: "project" as const }], exclude: [] },
      createdBy: { kind: "system" as const },
      revision: 1,
      updatedAt: 1
    };
    const foreign = {
      ...owned,
      projectId: "projects:other" as never,
      boundTo: {
        kind: "resource" as const,
        ref: { kind: "document" as const, id: "documents:elsewhere" as never },
        hole: "source_material"
      }
    };

    expect(() => visibleScopeOf(storeWith([owned, foreign]), output(scope)))
      .toThrow(/repeats row id/);
  });

  test("fails closed when the exact-owner private row is malformed", () => {
    const scope = {
      include: [{ select: "set" as const, setId: "resourceSets:broken" as never }],
      exclude: []
    };
    const malformed = {
      _id: "resourceSets:broken",
      _creationTime: 1,
      projectId: "projects:1",
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: "documents:made" },
        hole: "source_material"
      },
      set: { include: "everything", exclude: [] },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    } as unknown as TableRow<"resourceSets">;

    expect(() => visibleScopeOf(storeWith([malformed]), output(scope)))
      .toThrow(/resourceSets.*non-current field values/);
  });

  test("fails closed when the Store does not return the requested table", () => {
    const scope = {
      include: [{ select: "set" as const, setId: "resourceSets:missing" as never }],
      exclude: []
    };
    const missing = { read: () => undefined } as unknown as StoreUnitOfWork;
    const wrong = {
      read: () => ({ kind: "table", table: "projects", rows: [] })
    } as unknown as StoreUnitOfWork;

    expect(() => visibleScopeOf(missing, output(scope))).toThrow(/did not return/);
    expect(() => visibleScopeOf(wrong, output(scope))).toThrow(/did not return/);
  });
});
