import { describe, expect, test, vi } from "vitest";
import { asId } from "$representation/data/behavior/core/id";
import { expandedScope } from "$capabilities/templates/api/shared/scopes";
import {
  slotsOf,
  versionSlotsOf
} from "$capabilities/templates/api/shared/slot-validation";
import {
  instantiateTemplate,
  rowIn,
  rowsIn,
  runtime,
  seededTemplates,
  seededVersions,
  storeFromCommittedSeed
} from "$capabilities/templates/test/non-functional/seeded-template-fixture";

describe("the committed template fixtures", () => {
  test.each(seededTemplates)("$_id has explicit valid live slot kinds", (template) => {
    expect(() => slotsOf(template.slots, `seed-${template._id}`)).not.toThrow();
  });

  test.each(seededVersions)("$_id has a valid immutable slot snapshot", (version) => {
    expect(() => versionSlotsOf(version.slots, `seed-${version._id}`)).not.toThrow();
  });

  test("version history and private defaults name live owners without resource provenance", () => {
    runtime.store = storeFromCommittedSeed();
    const templates = new Map(seededTemplates.map((template) => [template._id, template]));

    for (const version of seededVersions) {
      const template = templates.get(version.templateId);
      expect(template, `${version._id} has no live template`).toBeDefined();
      expect(version.revision).toBeLessThanOrEqual(template!.revision);
      expect(version.body.resource).toBe(template!.body.resource);
    }

    for (const template of seededTemplates) {
      const versions = seededVersions.filter((version) => version.templateId === template._id);
      expect(new Set(versions.map((version) => version.revision)).size).toBe(versions.length);
      const current = versions.filter((version) => version.revision === template.revision);
      expect(current, `${template._id} must have exactly one current version`).toHaveLength(1);
      const expandedSlots = template.slots.map((slot) => {
        const { default: storedDefault, ...identity } = slot;
        const value = expandedScope(
          runtime.store,
          template.projectId,
          { kind: "slot", templateId: asId<"templates">(template._id), slot: slot.name },
          storedDefault
        );
        return value === undefined ? identity : { ...identity, default: value };
      });
      expect({
        name: current[0].name,
        description: current[0].description,
        tags: current[0].tags,
        body: current[0].body,
        slots: current[0].slots
      }).toEqual({
        name: template.name,
        description: template.description,
        tags: template.tags,
        body: template.body,
        slots: expandedSlots
      });
    }

    for (const set of rowsIn(runtime.store, "resourceSets")) {
      if (set.name !== undefined || (set.boundTo as { kind?: unknown } | undefined)?.kind !== "slot") {
        continue;
      }
      const owner = set.boundTo as { templateId: string; slot: string };
      const template = templates.get(owner.templateId);
      expect(template, `${set._id} has no live template owner`).toBeDefined();
      const slot = template!.slots.find((candidate) => candidate.name === owner.slot);
      expect(slot, `${set._id} names no live slot`).toBeDefined();
      expect(
        slot!.default?.include.some(
          (term) => term.select === "set" && term.setId === set._id
        )
      ).toBe(true);
    }

    for (const table of ["documents", "presentations", "spreadsheets"] as const) {
      for (const resource of rowsIn(runtime.store, table)) {
        expect(resource, `${table}.${resource._id} unexpectedly stores a template pointer`)
          .not.toHaveProperty("templateId");
      }
    }
  });

  test.each(seededTemplates)(
    "$name instantiates into a real resource and leader snapshot",
    async (template) => {
      vi.spyOn(Date, "now").mockReturnValue(1_790_000_000_000);
      runtime.store = storeFromCommittedSeed();
      const texts = Object.fromEntries(
        template.slots
          .filter((slot) => slot.kind === "text")
          .map((slot) => [slot.name, `Filled ${template._id} ${slot.name}`])
      );

      const placed = await instantiateTemplate({ templateId: template._id, texts });
      if (!placed.accepted) throw new Error(placed.detail);
      expect(placed).toMatchObject({
        accepted: true,
        templateId: template._id,
        target: template.body.resource,
        revision: 0
      });

      const resourceTable =
        placed.target === "document"
          ? "documents"
          : placed.target === "presentation"
            ? "presentations"
            : "spreadsheets";
      const snapshotTable =
        placed.target === "document"
          ? "documentSnapshots"
          : placed.target === "presentation"
            ? "presentationSnapshots"
            : "spreadsheetSnapshots";
      expect(rowIn(runtime.store, resourceTable, placed.resourceId)).toMatchObject({
        projectId: "default",
        title: template.name
      });
      const leaders = rowsIn(runtime.store, snapshotTable).filter(
        (row) => row.resourceId === placed.resourceId && row.role === "leader"
      );
      expect(leaders).toHaveLength(1);
      expect(leaders[0]).toMatchObject({ revision: 0, part: 0 });

      const serialized = JSON.stringify(leaders[0].body);
      expect(serialized).not.toContain('"kind":"template"');
      expect(serialized).not.toContain('"select":"slot"');
      for (const [name, words] of Object.entries(texts)) {
        expect(serialized, `${template._id} did not fill ${name}`).toContain(words);
      }
    }
  );

});
