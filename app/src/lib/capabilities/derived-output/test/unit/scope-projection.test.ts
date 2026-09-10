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
          resourceId: "documents:made",
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

  test("keeps a named set and a row owned by another resource opaque", () => {
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

    const another = {
      ...named,
      name: undefined,
      boundTo: {
        kind: "resource" as const,
        resourceId: "documents:another",
        hole: "source_material"
      }
    };
    expect(visibleScopeOf(storeWith([another]), output(scope))).toBe(scope);
  });

  test("keeps an ambiguous private id opaque", () => {
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
        resourceId: "documents:made",
        hole: "source_material"
      },
      set: { include: [{ select: "project" as const }], exclude: [] },
      createdBy: { kind: "system" as const },
      revision: 1,
      updatedAt: 1
    };

    expect(visibleScopeOf(storeWith([owned, { ...owned, _creationTime: 2 }]), output(scope)))
      .toBe(scope);
  });

  test("keeps a private row opaque when a foreign row claims its id", () => {
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
        resourceId: "documents:made",
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
        resourceId: "documents:elsewhere",
        hole: "source_material"
      }
    };

    expect(visibleScopeOf(storeWith([owned, foreign]), output(scope))).toBe(scope);
  });

  test("keeps an exact-owner private row opaque when its stored rule is malformed", () => {
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
        resourceId: "documents:made",
        hole: "source_material"
      },
      set: { include: "everything", exclude: [] },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    } as unknown as TableRow<"resourceSets">;

    expect(visibleScopeOf(storeWith([malformed]), output(scope))).toBe(scope);
  });
});
