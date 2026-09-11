import { describe, expect, test, vi } from "vitest";
import { asId } from "$representation/data/behavior/core/id";
import { isReusableResourceSetRow } from "$representation/data/behavior/core/resource-set";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import {
  instantiateTemplate,
  rowIn,
  rowsIn,
  runtime,
  storeFromCommittedSeed
} from "$capabilities/templates/test/non-functional/seeded-template-fixture";

describe("the committed template fixtures", () => {
  test("Technical glossary fills words and replaces its default file throughout the placed scope", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_790_000_000_000);
    runtime.store = storeFromCommittedSeed();

    const seededTemplate = rowIn(runtime.store, "templates", "templates:3");
    const seededDefault = rowIn(runtime.store, "resourceSets", "resourceSets:4");
    expect(seededTemplate).toMatchObject({
      name: "Technical glossary",
      slots: [
        {
          name: "source_material",
          kind: "scope",
          default: {
            include: [{ select: "set", setId: "resourceSets:4" }],
            exclude: []
          }
        },
        { name: "subject_line", kind: "text" }
      ]
    });
    expect(seededDefault).toMatchObject({
      boundTo: { kind: "slot", templateId: "templates:3", slot: "source_material" },
      set: {
        include: [
          {
            select: "resources",
            refs: [{ kind: "document", id: "documents:3" }]
          }
        ],
        exclude: []
      }
    });

    const placed = await instantiateTemplate({
      templateId: "templates:3",
      texts: { subject_line: "Substation response terms" },
      answers: {
        source_material: {
          include: [
            {
              select: "resources",
              refs: [{ kind: "document", id: "documents:2" }]
            }
          ],
          exclude: []
        }
      }
    });

    expect(placed).toMatchObject({
      accepted: true,
      templateId: "templates:3",
      target: "document",
      revision: 0
    });
    if (!placed.accepted) throw new Error(placed.detail);

    const snapshot = rowsIn(runtime.store, "documentSnapshots").find(
      (candidate) => candidate.resourceId === placed.resourceId && candidate.role === "leader"
    );
    expect(snapshot).toBeDefined();
    const serializedBody = JSON.stringify(snapshot?.body);
    expect(serializedBody).toContain("Technical glossary · Substation response terms");
    expect(serializedBody).not.toContain("{subject_line}");

    const output = rowsIn(runtime.store, "derivedOutputs").find(
      (candidate) =>
        (candidate.origin as { id?: unknown } | undefined)?.id === placed.resourceId
    );
    expect(output).toBeDefined();
    const scope = output?.scope as ResourceSet;
    expect(scope).toMatchObject({
      include: [{ select: "set" }],
      exclude: []
    });
    const setId = (scope.include[0] as { setId: string }).setId;
    expect(setId).not.toBe("resourceSets:4");

    const placedSet = rowIn(runtime.store, "resourceSets", setId);
    expect(placedSet).toMatchObject({
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: placed.resourceId },
        slot: "source_material"
      },
      set: {
        include: [
          {
            select: "resources",
            refs: [{ kind: "document", id: "documents:2" }]
          }
        ],
        exclude: []
      }
    });
    expect(JSON.stringify(placedSet.set)).not.toContain("documents:3");

    const executionScope = placedSet.set as ResourceSet;
    const sets = new Map(
      rowsIn(runtime.store, "resourceSets")
        .filter((row) => isReusableResourceSetRow(row as Record<string, unknown>))
        .map((row) => [row._id, row.set as ResourceSet])
    );
    const lookup = (id: string) => sets.get(id);
    expect(
      resourceInScope(
        { kind: "document", id: asId<"documents">("documents:2") },
        executionScope!,
        lookup as Parameters<typeof resourceInScope>[2]
      )
    ).toBe(true);
    expect(
      resourceInScope(
        { kind: "document", id: asId<"documents">("documents:3") },
        executionScope!,
        lookup as Parameters<typeof resourceInScope>[2]
      )
    ).toBe(false);

    expect(rowIn(runtime.store, "resourceSets", "resourceSets:4")).toEqual(seededDefault);
  });

});
