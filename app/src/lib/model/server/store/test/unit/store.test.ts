import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { asId } from "$representation/data/behavior/core/id";
import { CURRENT_ROW_POLICIES } from "$representation/store/current-schema";
import { CURRENT_ROW_VALUE_VALIDATORS } from "$representation/store/current-values";
import { TABLE_NAMES } from "$representation/store/tables";
import { defineStore } from "$model/server/store/constructor";
import type { StoreUnitOfWork } from "$model/server/store/types";

const directories: string[] = [];

const inMemory = () => defineStore({ now: () => 1000 });
const system = { kind: "system" as const };
const project = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  revision: 1,
  settings: "{}",
  updatedAt: 1000,
  ...extra
});
const document = (projectId: string, title: string) => ({
  projectId,
  title,
  createdBy: system,
  updatedBy: system,
  updatedAt: 1000
});

const onDisk = () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-store-"));
  directories.push(directory);
  return { store: defineStore({ directory, now: () => 1000 }), directory };
};

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("create", () => {
  it("has one exhaustive runtime policy for every represented table", () => {
    expect(Object.keys(CURRENT_ROW_POLICIES).toSorted()).toEqual([...TABLE_NAMES].toSorted());
    expect(Object.keys(CURRENT_ROW_VALUE_VALIDATORS).toSorted()).toEqual([...TABLE_NAMES].toSorted());
    expect(Object.values(CURRENT_ROW_POLICIES).every((policy) => Object.keys(policy).length > 0)).toBe(true);
    expect(Object.values(CURRENT_ROW_VALUE_VALIDATORS).every((validator) => typeof validator === "function"))
      .toBe(true);
  });

  it("mints an id and stamps the row", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3"));

    expect(id).toMatch(/^projects:[0-9a-f-]{36}$/);
    const found = store.read(`projects.${id}`);
    expect(found?.kind).toBe("row");
    expect(found?.kind === "row" && found.row._creationTime).toBe(1000);
  });

  it("does not reuse an id a reloaded table already holds or a deletion freed", () => {
    const { store, directory } = onDisk();
    const first = store.create("projects", project("one"));
    store.remove(`projects.${first}`);

    const reopened = defineStore({ directory, now: () => 2000 });
    const second = reopened.create("projects", project("two", { updatedAt: 2000 }));
    expect(second).not.toBe(first);
    expect(second).toMatch(/^projects:[0-9a-f-]{36}$/);
  });

  it("refuses what a JSON file cannot hold", () => {
    const store = inMemory();
    expect(() => store.create("projects", project("no", { settings: () => "no" }))).toThrow(/not storable/);
    expect(() => store.create("projects", ["not", "an", "object"])).toThrow(/is an object/);

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => store.create("projects", project("cyclic", { settings: cycle }))).toThrow(/cycle/);
  });

  it("refuses values JSON would coerce, omit, invoke, or reshape", () => {
    const sparse = new Array(2);
    sparse[0] = "present";
    const decorated: unknown[] & { note?: string } = [];
    decorated.note = "JSON ignores this";
    const accessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => "invoked"
    });
    const hidden = Object.defineProperty({}, "value", { value: "lost" });
    const symbolic = { value: "visible", [Symbol("lost")]: "hidden" };
    const custom = Object.create({ inherited: true }) as Record<string, unknown>;
    custom.value = "present";

    const values = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -0,
      sparse,
      [undefined],
      decorated,
      accessor,
      hidden,
      symbolic,
      custom,
      new Date(0),
      new Map([["key", "value"]])
    ];
    const store = inMemory();
    for (const settings of values) {
      expect(() => store.create("projects", project("unstable", { settings }))).toThrow(/not storable/);
    }
    expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });
  });

  it("rejects missing, unknown, and caller-owned identity fields", () => {
    const store = inMemory();
    expect(() => store.create("projects", { name: "missing" })).toThrow(/missing required/);
    expect(() => store.create("projects", project("old", { legacyName: "old" }))).toThrow(/unknown field/);
    expect(() => store.create("projects", project("claimed", { _id: "projects:claimed" }))).toThrow(/Store-owned/);
    expect(() => store.create("projects", project("claimed", { _creationTime: 0 }))).toThrow(/Store-owned/);
  });

  it("creates a collection as one admitted table change", () => {
    const store = inMemory();

    const ids = store.createMany("projects", [project("one"), project("two")]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids)).toHaveLength(2);
    expect(ids.every((id) => /^projects:[0-9a-f-]{36}$/.test(id))).toBe(true);
    const created = store.read("projects");
    expect(created?.kind === "table" && created.rows).toHaveLength(2);

    expect(() =>
      store.createMany("projects", [project("three"), project("bad", { settings: () => "not storable" })])
    ).toThrow(/not storable/);
    const refused = store.read("projects");
    expect(refused?.kind === "table" && refused.rows).toHaveLength(2);

    expect(() => store.createMany("projects", [project("four"), project("claimed", { _id: "projects:x" })]))
      .toThrow(/Store-owned/);
    const afterIdentityRefusal = store.read("projects");
    expect(afterIdentityRefusal?.kind === "table" && afterIdentityRefusal.rows).toHaveLength(2);
  });
});

describe("read", () => {
  it("returns the table, the row, or the field the path names", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3"));

    expect(store.read("projects")).toMatchObject({ kind: "table" });
    expect(store.read(`projects.${id}`)).toMatchObject({ kind: "row" });
    expect(store.read(`projects.${id}.name`)).toMatchObject({ kind: "field", value: "Q3" });
  });

  it("names the table it found, so a caller can narrow", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3"));

    const found = store.read(`projects.${id}`);
    expect(found?.table).toBe("projects");
  });

  it("is undefined for a row or field that is not there", () => {
    const store = inMemory();
    expect(store.read("projects.projects:9")).toBeUndefined();

    const id = store.create("projects", project("Q3"));
    expect(store.read(`projects.${id}.missing`)).toBeUndefined();
  });

  it("refuses a table it does not have", () => {
    expect(() => inMemory().read("nowhere.x")).toThrow(/No such table/);
  });
});

describe("update", () => {
  it("replaces a field without touching the rest of the row", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3", { archivedAt: 900 }));
    store.update(`projects.${id}.name`, "Q4");

    const found = store.read(`projects.${id}`);
    expect(found?.kind === "row" && found.row).toMatchObject({ name: "Q4", archivedAt: 900 });
  });

  it("refuses identity, retired, and incomplete whole-row writes", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3"));
    expect(() => store.update(`projects.${id}`, project("Q4", { _id: "projects:9" }))).toThrow(/Store-owned/);
    expect(() => store.update(`projects.${id}`, { name: "Q4" })).toThrow(/missing required/);
    expect(() => store.update(`projects.${id}`, project("Q4", { oldName: "Q3" }))).toThrow(/unknown field/);
    expect(() => store.update(`projects.${id}._id`, "projects:9")).toThrow(/Store-owned/);
    expect(() => store.update(`projects.${id}._creationTime`, 0)).toThrow(/Store-owned/);
    expect(store.read(`projects.${id}.name`)).toMatchObject({ value: "Q3" });
  });

  it("rejects non-round-tripping nested writes before replacing the row", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3"));
    expect(() => store.update(`projects.${id}.settings`, new Date(0))).toThrow(/not storable/);
    expect(() => store.update(`projects.${id}.settings`, [undefined])).toThrow(/not storable/);
    expect(() => store.update(`projects.${id}.settings`, Number.NaN)).toThrow(/not storable/);
    expect(store.read(`projects.${id}.settings`)).toMatchObject({ value: "{}" });
  });

  it("refuses a row that is not there, and a table with no row named", () => {
    const store = inMemory();
    expect(() => store.update("projects.projects:9", { name: "x" })).toThrow(/no 'projects' row/);
    expect(() => store.update("projects", { name: "x" })).toThrow(/is a table, not a row/);
  });
});

describe("remove", () => {
  it("drops the row, or the field", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3", { archivedAt: 900 }));

    store.remove(`projects.${id}.archivedAt`);
    const found = store.read(`projects.${id}`);
    expect(found?.kind === "row" && "archivedAt" in found.row).toBe(false);

    store.remove(`projects.${id}`);
    expect(store.read(`projects.${id}`)).toBeUndefined();
  });

  it("refuses removal of required or Store-owned fields without changing the row", () => {
    const store = inMemory();
    const id = store.create("projects", project("Q3"));

    expect(() => store.remove(`projects.${id}.revision`)).toThrow(/missing required/);
    expect(() => store.remove(`projects.${id}._id`)).toThrow(/Store-owned/);
    expect(() => store.removeFieldFromRows("projects", [id], "settings")).toThrow(/missing required/);
    expect(store.read(`projects.${id}`)).toMatchObject({
      kind: "row",
      row: { name: "Q3", revision: 1, settings: "{}" }
    });
  });

  it("batches row and top-level-field removals without accepting a partial request", () => {
    const store = inMemory();
    const ids = store.createMany("projects", [
      project("one", { archivedAt: 900 }),
      project("two", { archivedAt: 900 }),
      project("three", { archivedAt: 900 })
    ]);

    store.removeFieldFromRows("projects", [ids[0], ids[2]], "archivedAt");
    expect(store.read(`projects.${ids[0]}.archivedAt`)).toBeUndefined();
    expect(store.read(`projects.${ids[1]}.archivedAt`)).toMatchObject({ value: 900 });

    expect(() =>
      store.removeRows("projects", [ids[1], asId<"projects">("projects:99")])
    ).toThrow(/no 'projects' row projects:99/);
    const afterRefusal = store.read("projects");
    expect(afterRefusal?.kind === "table" && afterRefusal.rows).toHaveLength(3);

    store.removeRows("projects", [ids[0], ids[2]]);
    const remaining = store.read("projects");
    expect(remaining?.kind === "table" && remaining.rows.map((row) => row._id)).toEqual([ids[1]]);
  });

});

describe("transaction", () => {
  it("publishes several table changes together after every operation is admitted", () => {
    const store = inMemory();
    const result = store.transaction((unit) => {
      const projectId = unit.create("projects", project("Q3"));
      const documentId = unit.create("documents", document(projectId, "Plan"));
      expect(unit.read(`projects.${projectId}`)).toMatchObject({ kind: "row" });
      return { projectId, documentId };
    });

    expect(store.read(`projects.${result.projectId}`)).toMatchObject({ kind: "row" });
    expect(store.read(`documents.${result.documentId}`)).toMatchObject({ kind: "row" });
  });

  it("rolls back staged operations when a later operation is invalid", () => {
    const store = inMemory();

    expect(() =>
      store.transaction((unit) => {
        unit.create("projects", project("never committed"));
        unit.update("documents.documents:missing.title", "invalid");
      })
    ).toThrow(/no 'documents' row/);

    expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });
  });

  it("rejects a non-round-tripping staged value before writing a journal or table", () => {
    const { store, directory } = onDisk();
    expect(() => store.transaction((unit) => {
      unit.create("projects", project("staged"));
      unit.create("projects", project("invalid", { settings: new Map() }));
    })).toThrow(/not storable/);

    expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });
    expect(existsSync(join(directory, "projects.json"))).toBe(false);
    expect(existsSync(join(directory, ".store-transaction.json"))).toBe(false);
  });

  it("re-admits changed tables at commit after direct staged-row mutation", () => {
    for (const store of [inMemory(), onDisk().store]) {
      expect(() => store.transaction((unit) => {
        const id = unit.create("projects", project("staged"));
        const found = unit.read(`projects.${id}`);
        if (found?.kind !== "row") throw new Error("missing staged project");
        (found.row as unknown as { settings: unknown }).settings = new Date(0);
      })).toThrow(/not storable/);
      expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });
    }
  });

  it("isolates rows read by work that later rolls back", () => {
    const store = inMemory();
    const id = store.create("projects", project("before"));

    expect(() =>
      store.transaction((unit) => {
        const found = unit.read(`projects.${id}`);
        if (found?.kind === "row") {
          (found.row as unknown as { name: string }).name = "staged only";
        }
        throw new Error("rollback");
      })
    ).toThrow(/rollback/);

    expect(store.read(`projects.${id}.name`)).toMatchObject({ value: "before" });
  });

  it("does not let a returned working row mutate committed state", () => {
    const store = inMemory();
    const staged = store.transaction((unit) => {
      const id = unit.create("projects", project("committed"));
      const found = unit.read(`projects.${id}`);
      if (found?.kind !== "row") throw new Error("created row is missing");
      return { id, row: found.row as unknown as { name: string } };
    });

    staged.row.name = "outside";
    expect(store.read(`projects.${staged.id}.name`)).toMatchObject({ value: "committed" });
  });

  it("closes the scoped unit and refuses root access or async work inside it", () => {
    const store = inMemory();
    let retained: StoreUnitOfWork | undefined;

    store.transaction((unit) => {
      retained = unit;
      expect(() => store.read("projects")).toThrow(/supplied Store unit/);
    });
    expect(() => retained?.read("projects")).toThrow(/unit of work is closed/);
    expect(() => retained?.createMany("projects", [])).toThrow(/unit of work is closed/);

    let ran = false;
    expect(() =>
      store.transaction(async () => {
        ran = true;
      })
    ).toThrow(/must be synchronous/);
    expect(ran).toBe(false);

    expect(() =>
      store.transaction((unit) => {
        unit.create("projects", project("staged"));
        return Promise.resolve();
      })
    ).toThrow(/must be synchronous/);
    expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });

    expect(() =>
      store.transaction(() => store.transaction(() => undefined))
    ).toThrow(/cannot be nested/);
  });
});

describe("on disk", () => {
  it("fails readiness for missing required or unknown persisted fields", () => {
    const missingDirectory = mkdtempSync(join(tmpdir(), "icarus-store-"));
    directories.push(missingDirectory);
    writeFileSync(join(missingDirectory, "projects.json"), JSON.stringify([{
      _id: "projects:old",
      _creationTime: 1,
      name: "Missing"
    }]));
    expect(() => defineStore({ directory: missingDirectory })).toThrow(/missing required/);

    const unknownDirectory = mkdtempSync(join(tmpdir(), "icarus-store-"));
    directories.push(unknownDirectory);
    writeFileSync(join(unknownDirectory, "projects.json"), JSON.stringify([{
      _id: "projects:old",
      _creationTime: 1,
      ...project("Old"),
      legacyName: "Retired"
    }]));
    expect(() => defineStore({ directory: unknownDirectory })).toThrow(/unknown field/);
  });

  it("writes the whole table on every mutation, and reads it back", () => {
    const { store, directory } = onDisk();
    const id = store.create("projects", project("Q3"));

    const written = JSON.parse(readFileSync(join(directory, "projects.json"), "utf8"));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ _id: id, name: "Q3" });

    store.remove(`projects.${id}`);
    expect(JSON.parse(readFileSync(join(directory, "projects.json"), "utf8"))).toHaveLength(0);
  });

  it("persists a multi-table transaction for a later Store instance", () => {
    const { store, directory } = onDisk();
    const ids = store.transaction((unit) => {
      const projectId = unit.create("projects", project("Q3"));
      const documentId = unit.create("documents", document(projectId, "Plan"));
      return { projectId, documentId };
    });

    const reopened = defineStore({ directory });
    expect(reopened.read(`projects.${ids.projectId}`)).toMatchObject({ kind: "row" });
    expect(reopened.read(`documents.${ids.documentId}`)).toMatchObject({ kind: "row" });
  });
});
