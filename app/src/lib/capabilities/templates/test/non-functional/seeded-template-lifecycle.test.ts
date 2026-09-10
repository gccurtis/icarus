import { describe, expect, test, vi } from "vitest";
import { asId } from "$representation/data/behavior/core/id";
import { isReusableResourceSetRow } from "$representation/data/behavior/core/resource-set";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import {
  instantiateTemplate,
  removeTemplate,
  rowIn,
  rowsIn,
  runtime,
  storeFromCommittedSeed,
  updateTemplate
} from "$capabilities/templates/test/non-functional/seeded-template-fixture";

describe("the committed template fixtures", () => {
  test("a placed default owns its scope after the template changes and is deleted", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_790_000_000_000);
    runtime.store = storeFromCommittedSeed();

    const placed = await instantiateTemplate({
      templateId: "templates:3",
      texts: { subject_line: "Existing glossary" }
    });
    if (!placed.accepted) throw new Error(placed.detail);
    const output = rowsIn(runtime.store, "derivedOutputs").find(
      (candidate) => (candidate.origin as { id?: unknown } | undefined)?.id === placed.resourceId
    );
    const scope = output?.scope as ResourceSet;
    const setId = (scope.include[0] as { setId: string }).setId;
    expect(setId).not.toBe("resourceSets:4");
    const ownedBefore = structuredClone(rowIn(runtime.store, "resourceSets", setId));
    expect(ownedBefore).toMatchObject({
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: placed.resourceId },
        hole: "source_material"
      },
      set: {
        include: [
          { select: "resources", refs: [{ kind: "document", id: "documents:3" }] }
        ],
        exclude: []
      }
    });
    const executionScope = ownedBefore.set as ResourceSet;
    const reusableSets = new Map(
      rowsIn(runtime.store, "resourceSets")
        .filter((row) => isReusableResourceSetRow(row as Record<string, unknown>))
        .map((row) => [row._id, row.set as ResourceSet])
    );
    const reusableLookup = (id: string) => reusableSets.get(id);
    expect(
      resourceInScope(
        { kind: "document", id: asId<"documents">("documents:3") },
        executionScope!,
        reusableLookup as Parameters<typeof resourceInScope>[2]
      )
    ).toBe(true);
    expect(
      resourceInScope(
        { kind: "document", id: asId<"documents">("documents:2") },
        executionScope!,
        reusableLookup as Parameters<typeof resourceInScope>[2]
      )
    ).toBe(false);

    const updated = await updateTemplate({
      templateId: "templates:3",
      baseRevision: 3,
      patch: {
        holes: [
          {
            name: "source_material",
            label: "Source material",
            kind: "scope",
            default: {
              include: [
                { select: "resources", refs: [{ kind: "document", id: "documents:2" }] }
              ],
              exclude: []
            }
          },
          {
            name: "subject_line",
            label: "Subject line",
            kind: "text",
            text: "Technical terms"
          }
        ]
      }
    });
    expect(updated).toMatchObject({ accepted: true, revision: 4 });
    expect(rowIn(runtime.store, "resourceSets", setId)).toEqual(ownedBefore);

    const removed = await removeTemplate({ templateId: "templates:3", baseRevision: 4 });
    expect(removed).toMatchObject({ accepted: true });
    expect(rowsIn(runtime.store, "templates").some((row) => row._id === "templates:3")).toBe(false);
    expect(rowsIn(runtime.store, "resourceSets").some((row) => row._id === "resourceSets:4")).toBe(false);
    expect(rowIn(runtime.store, "resourceSets", setId)).toEqual(ownedBefore);
    expect(output?.scope).toEqual(scope);
  });
});
