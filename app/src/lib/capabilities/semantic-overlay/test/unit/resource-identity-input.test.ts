import { describe, expect, it } from "vitest";

import { validateQuerySemanticMaterials } from "$capabilities/semantic-overlay/api/query-semantic-materials/validate-query-semantic-materials";
import { validateQuerySemanticOverlay } from "$capabilities/semantic-overlay/api/query-semantic-overlay/validate-query-semantic-overlay";
import { validateBackfillSemanticOverlay } from "$capabilities/semantic-overlay/api/backfill-semantic-overlay/validate-backfill-semantic-overlay";
import { validateEnqueueSemanticSync } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/validate-enqueue-semantic-sync";
import { validateProcessSemanticSyncQueue } from "$capabilities/semantic-overlay/api/process-semantic-sync-queue/validate-process-semantic-sync-queue";
import { validateReadSemanticResource } from "$capabilities/semantic-overlay/api/read-semantic-resource/validate-read-semantic-resource";
import { validateReadSemanticStatus } from "$capabilities/semantic-overlay/api/read-semantic-status/validate-read-semantic-status";
import { validateRebuildSemanticIndex } from "$capabilities/semantic-overlay/api/rebuild-semantic-index/validate-rebuild-semantic-index";
import { validateSyncSemanticResource } from "$capabilities/semantic-overlay/api/sync-semantic-resource/validate-sync-semantic-resource";

const semanticQueryWith = (term: unknown): unknown => ({
  text: "evidence",
  topK: 3,
  scope: { include: [term], exclude: [] }
});

describe("semantic command data admission", () => {
  const ref = { kind: "document" as const, id: "documents:one" as never };
  const commands = [
    (value: unknown) => validateBackfillSemanticOverlay(value),
    (value: unknown) => validateEnqueueSemanticSync(value),
    (value: unknown) => validateProcessSemanticSyncQueue(value),
    (value: unknown) => validateReadSemanticResource(value),
    (value: unknown) => validateReadSemanticStatus(value),
    (value: unknown) => validateRebuildSemanticIndex(value),
    (value: unknown) => validateSyncSemanticResource(value)
  ];

  it("rejects hidden, symbolic, inherited, and explicitly undefined compatibility fields", () => {
    const hidden = {};
    Object.defineProperty(hidden, "retired", { enumerable: false, value: true });
    const inherited = Object.create({ retired: true });
    const symbolic = { [Symbol("retired")]: true };
    for (const validate of commands) {
      for (const value of [hidden, inherited, symbolic, { retired: undefined }]) {
        expect(() => validate(value)).toThrow(/exact current data fields/);
      }
    }
  });

  it("does not invoke accessors and accepts only each command's current fields", () => {
    let reads = 0;
    const accessor = {} as Record<string, unknown>;
    Object.defineProperty(accessor, "ref", {
      enumerable: true,
      get: () => {
        reads += 1;
        return ref;
      }
    });
    expect(() => validateReadSemanticResource(accessor)).toThrow(/exact current data fields/);
    expect(reads).toBe(0);

    expect(validateReadSemanticResource({ ref })).toEqual({ ref });
    expect(validateSyncSemanticResource({ ref, force: true })).toEqual({ ref, force: true });
    expect(validateBackfillSemanticOverlay({})).toEqual({ force: false, limit: 50 });
    expect(validateProcessSemanticSyncQueue({})).toEqual({ limit: 10 });
    expect(validateRebuildSemanticIndex({})).toEqual({});
    expect(() => validateSyncSemanticResource({ ref, force: undefined })).toThrow(/exact current data fields/);
  });
});

describe("semantic query resource identity input", () => {
  it.each([
    { select: "kinds", kinds: ["analysis"] },
    { select: "kinds", kinds: ["externalFile::pdf"] },
    { select: "resources", refs: [{ kind: "externalFile", id: "externalFiles:one" }] },
    { select: "resources", refs: [{ kind: "document", id: "presentations:one" }] },
    {
      select: "resources",
      refs: [{ kind: "document", id: "documents:one", retired: true }]
    },
    { select: "set", setId: "sets:one" },
    { select: "project", retired: true }
  ])("rejects a non-current scope term %#", (term) => {
    expect(() => validateQuerySemanticOverlay(semanticQueryWith(term))).toThrow();
    expect(() => validateQuerySemanticMaterials(semanticQueryWith(term))).toThrow();
  });

  it("keeps the external family selector separate from an exact external ref", () => {
    const input = {
      text: "evidence",
      topK: 3,
      scope: {
        include: [
          { select: "kinds", kinds: ["externalFile"] },
          {
            select: "resources",
            refs: [{ kind: "externalFile::text", id: "externalFiles:one" }]
          }
        ],
        exclude: []
      }
    };
    expect(validateQuerySemanticOverlay(input)).toEqual(input);
    expect(validateQuerySemanticMaterials(input)).toEqual(input);
  });

  it("rejects unknown input fields and duplicate material kinds", () => {
    expect(() => validateQuerySemanticOverlay({ text: "evidence", topK: 3, retired: true }))
      .toThrow(/unknown field/);
    expect(() => validateQuerySemanticMaterials({
      text: "evidence",
      topK: 3,
      kinds: ["table", "table"]
    })).toThrow(/supported kinds/);
  });

  it("rejects non-data records and explicit undefined at every query object boundary", () => {
    const hidden = { text: "evidence", topK: 3 };
    Object.defineProperty(hidden, "retired", { value: true, enumerable: false });
    const accessor = { topK: 3 } as { text: string; topK: number };
    Object.defineProperty(accessor, "text", {
      enumerable: true,
      get: () => "evidence"
    });
    const inherited = Object.assign(Object.create({ retired: true }), {
      text: "evidence",
      topK: 3
    });

    for (const input of [
      hidden,
      accessor,
      inherited,
      { text: "evidence", topK: 3, scope: undefined },
      { text: "evidence", topK: 3, [Symbol("retired")]: true }
    ]) {
      expect(() => validateQuerySemanticOverlay(input)).toThrow(/must be an object/);
      expect(() => validateQuerySemanticMaterials(input)).toThrow(/must be an object/);
    }

    for (const term of [
      Object.assign(Object.create({ retired: true }), { select: "project" }),
      { select: "project", retired: undefined },
      { select: "project", [Symbol("retired")]: true }
    ]) {
      expect(() => validateQuerySemanticOverlay(semanticQueryWith(term))).toThrow(/must be an object/);
      expect(() => validateQuerySemanticMaterials(semanticQueryWith(term))).toThrow(/must be an object/);
    }
  });
});
