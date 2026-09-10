import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  defineStore,
  type StoreModel
} from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import { isReusableResourceSetRow } from "$representation/data/behavior/core/resource-set";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { TemplateHole } from "$representation/data/types/templates/template";
import { expandedScope } from "$capabilities/templates/api/shared/scopes";
import {
  holesOf,
  versionHolesOf
} from "$capabilities/templates/api/shared/validation";

const runtime = vi.hoisted(() => ({ store: undefined as unknown as StoreModel }));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: "default", userId: "default-user", username: "Ana Duarte" })
}));

const { instantiateTemplate } = await import(
  "$capabilities/templates/api/instantiate-template/instantiate-template"
);
const { removeTemplate } = await import(
  "$capabilities/templates/api/remove-template/remove-template"
);
const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);

type StoredRow = Record<string, unknown> & { readonly _id: string };
type SeedTemplate = {
  readonly _id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly revision: number;
  readonly body: { readonly resource: "document" | "slides" | "spreadsheet" };
  readonly holes: readonly TemplateHole[];
};
type SeedTemplateVersion = {
  readonly _id: string;
  readonly templateId: string;
  readonly revision: number;
  readonly name: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly body: { readonly resource: "document" | "slides" | "spreadsheet" };
  readonly holes: readonly TemplateHole[];
};

const seedDirectory = dirname(
  fileURLToPath(new URL("../../../../../../seed/templates.json", import.meta.url))
);
const seededTemplates = JSON.parse(
  readFileSync(join(seedDirectory, "templates.json"), "utf8")
) as readonly SeedTemplate[];
const seededVersions = JSON.parse(
  readFileSync(join(seedDirectory, "templateVersions.json"), "utf8")
) as readonly SeedTemplateVersion[];
const directories: string[] = [];

const storeFromCommittedSeed = (): StoreModel => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-seeded-template-"));
  directories.push(directory);
  for (const file of readdirSync(seedDirectory)) {
    if (!file.endsWith(".json")) continue;
    copyFileSync(join(seedDirectory, file), join(directory, file));
  }
  return defineStore({ directory, now: () => 1_790_000_000_000 });
};

const rowsIn = (store: StoreModel, table: string): readonly StoredRow[] => {
  const answer = store.read(table);
  return answer?.kind === "table" ? (answer.rows as readonly StoredRow[]) : [];
};

const rowIn = (store: StoreModel, table: string, id: string): StoredRow => {
  const row = rowsIn(store, table).find((candidate) => candidate._id === id);
  if (row === undefined) throw new Error(`The committed seed has no ${table}.${id}`);
  return row;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe("the committed template fixtures", () => {
  test.each(seededTemplates)("$_id has explicit valid live hole kinds", (template) => {
    expect(() => holesOf(template.holes, `seed-${template._id}`)).not.toThrow();
  });

  test.each(seededVersions)("$_id has a valid immutable hole snapshot", (version) => {
    expect(() => versionHolesOf(version.holes, `seed-${version._id}`)).not.toThrow();
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
      const expandedHoles = template.holes.map((hole) => {
        const { default: storedDefault, ...identity } = hole;
        const value = expandedScope(
          runtime.store,
          template.projectId,
          { kind: "hole", templateId: asId<"templates">(template._id), hole: hole.name },
          storedDefault
        );
        return value === undefined ? identity : { ...identity, default: value };
      });
      expect({
        name: current[0].name,
        description: current[0].description,
        tags: current[0].tags,
        body: current[0].body,
        holes: current[0].holes
      }).toEqual({
        name: template.name,
        description: template.description,
        tags: template.tags,
        body: template.body,
        holes: expandedHoles
      });
    }

    for (const set of rowsIn(runtime.store, "resourceSets")) {
      if (set.name !== undefined || (set.boundTo as { kind?: unknown } | undefined)?.kind !== "hole") {
        continue;
      }
      const owner = set.boundTo as { templateId: string; hole: string };
      const template = templates.get(owner.templateId);
      expect(template, `${set._id} has no live template owner`).toBeDefined();
      const hole = template!.holes.find((candidate) => candidate.name === owner.hole);
      expect(hole, `${set._id} names no live hole`).toBeDefined();
      expect(
        hole!.default?.include.some(
          (term) => term.select === "set" && term.setId === set._id
        )
      ).toBe(true);
    }

    for (const table of ["documents", "slideDecks", "spreadsheets"] as const) {
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
        template.holes
          .filter((hole) => hole.kind === "text")
          .map((hole) => [hole.name, `Filled ${template._id} ${hole.name}`])
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
          : placed.target === "slides"
            ? "slideDecks"
            : "spreadsheets";
      const snapshotTable =
        placed.target === "document"
          ? "documentSnapshots"
          : placed.target === "slides"
            ? "slideDeckSnapshots"
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
      expect(serialized).not.toContain('"select":"hole"');
      for (const [name, words] of Object.entries(texts)) {
        expect(serialized, `${template._id} did not fill ${name}`).toContain(words);
      }
    }
  );

  test("Technical glossary fills words and replaces its default file throughout the placed scope", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_790_000_000_000);
    runtime.store = storeFromCommittedSeed();

    const seededTemplate = rowIn(runtime.store, "templates", "templates:3");
    const seededDefault = rowIn(runtime.store, "resourceSets", "resourceSets:4");
    expect(seededTemplate).toMatchObject({
      name: "Technical glossary",
      holes: [
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
      boundTo: { kind: "hole", templateId: "templates:3", hole: "source_material" },
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
        resourceId: placed.resourceId,
        hole: "source_material"
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
      boundTo: { kind: "resource", resourceId: placed.resourceId, hole: "source_material" },
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
